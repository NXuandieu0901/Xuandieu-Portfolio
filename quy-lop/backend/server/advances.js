import { audit } from "./db.js";
import { admin, fail, text, amount, date } from "./util.js";
import { once, record, requireFunds, balances } from "./ledger.js";
export function advanceRoutes(c) {
  const { path, method, db, body: b, user, send } = c;
  if (path === "/api/advances") {
    if (method === "GET") {
      const rows = db
        .prepare(
          "SELECT a.*,u.name AS owner_name,u.code AS owner_code FROM advances a JOIN users u ON u.id=a.owner " +
            (user.role === "admin" ? "" : "WHERE a.owner=? ") +
            "ORDER BY a.id DESC",
        )
        .all(...(user.role === "admin" ? [] : [user.id]));
      send(200, rows);
      return true;
    }
    if (method === "POST") {
      const result = once(c, "advance_create", () => {
        const title = text(b.title, "Mục đích"),
          n = amount(b.amount),
          due = date(b.due_date);
        const r = db
          .prepare(
            "INSERT INTO advances(owner,title,amount,due_date) VALUES(?,?,?,?)",
          )
          .run(user.id, title, n, due);
        audit(db, user, "advance_requested", "advance", r.lastInsertRowid, {
          amount: n,
          due_date: due,
        });
        return { id: Number(r.lastInsertRowid) };
      });
      send(201, result);
      return true;
    }
  }
  const m =
    /^\/api\/advances\/(\d+)\/(approve|reject|cancel|disburse|submit|return|settle-approve|complete)$/.exec(
      path,
    );
  if (!m || method !== "POST") return false;
  const result = once(c, "advance_" + m[1] + "_" + m[2], () => {
    const r = db.prepare("SELECT * FROM advances WHERE id=?").get(Number(m[1]));
    if (!r) fail(404, "Không tìm thấy tạm ứng.");
    const act = m[2];
    if (act === "submit") {
      if (user.role !== "admin" && r.owner !== user.id)
        fail(403, "Không được quyết toán hồ sơ người khác.");
      if (!["disbursed", "settlement_returned"].includes(r.status))
        fail(409, "Hồ sơ chưa thể nộp quyết toán.");
      if (!Number.isSafeInteger(b.actual) || b.actual < 0 || b.actual > 1e12)
        fail(400, "Chi thực tế không hợp lệ.");
      db.prepare(
        "UPDATE advances SET actual=?,settlement_evidence=?,settlement_category=?,status='settlement_submitted',reason='' WHERE id=?",
      ).run(
        b.actual,
        text(b.evidence, "Chứng từ hoặc giải trình", 1000),
        text(b.category || "Hoạt động", "Danh mục", 60),
        r.id,
      );
    } else {
      admin(c);
      if (act === "approve") {
        if (r.status !== "pending") fail(409, "Hồ sơ không còn chờ duyệt.");
        requireFunds(db, r.amount);
        db.prepare("UPDATE advances SET status='approved' WHERE id=?").run(
          r.id,
        );
      } else if (act === "reject" || act === "cancel") {
        if (
          !(act === "reject"
            ? r.status === "pending"
            : ["pending", "approved"].includes(r.status))
        )
          fail(409, "Không thể từ chối hoặc hủy hồ sơ này.");
        db.prepare("UPDATE advances SET status=?,reason=? WHERE id=?").run(
          act === "reject" ? "rejected" : "cancelled",
          text(b.reason, "Lý do", 500),
          r.id,
        );
      } else if (act === "disburse") {
        if (r.status !== "approved")
          fail(409, "Hồ sơ chưa duyệt hoặc đã giải ngân.");
        if (b.confirmed !== true)
          fail(400, "Cần xác nhận giải ngân thành công.");
        if (balances(db).cash < r.amount) fail(409, "Không đủ tiền thực tế.");
        record(c, {
          kind: "advance_disburse",
          amount: r.amount,
          cash_delta: -r.amount,
          member_id: r.owner,
          advance_id: r.id,
          title: "Tạm ứng: " + r.title,
          category: "Tạm ứng",
          date: date(b.date),
          reference: text(b.reference, "Mã tham chiếu", 100),
        });
        db.prepare("UPDATE advances SET status='disbursed' WHERE id=?").run(
          r.id,
        );
      } else if (act === "return") {
        if (r.status !== "settlement_submitted")
          fail(409, "Không có hồ sơ quyết toán chờ duyệt.");
        db.prepare(
          "UPDATE advances SET status='settlement_returned',reason=? WHERE id=?",
        ).run(text(b.reason, "Lý do", 500), r.id);
      } else if (act === "settle-approve") {
        if (r.status !== "settlement_submitted")
          fail(409, "Hồ sơ không còn chờ duyệt quyết toán.");
        const diff = r.actual - r.amount;
        if (diff > 0) requireFunds(db, diff);
        db.prepare("UPDATE advances SET status=? WHERE id=?").run(
          diff > 0
            ? "awaiting_payment"
            : diff < 0
              ? "awaiting_refund"
              : "settlement_approved",
          r.id,
        );
      } else if (act === "complete") {
        if (
          ![
            "awaiting_payment",
            "awaiting_refund",
            "settlement_approved",
          ].includes(r.status)
        )
          fail(409, "Hồ sơ chưa đủ điều kiện hoàn tất.");
        const d = date(b.date),
          diff = r.actual - r.amount;
        const disbursed = db
          .prepare(
            "SELECT date FROM transactions WHERE advance_id=? AND kind='advance_disburse'",
          )
          .get(r.id);
        if (d < disbursed.date)
          fail(400, "Ngày quyết toán không được trước ngày giải ngân.");
        if (diff !== 0) {
          if (b.confirmed !== true)
            fail(400, "Cần xác nhận đã nhận tiền hoàn hoặc chi bổ sung.");
          if (diff > 0 && balances(db).cash < diff)
            fail(409, "Không đủ tiền thực tế.");
          record(c, {
            kind: diff > 0 ? "advance_extra" : "advance_refund",
            amount: Math.abs(diff),
            cash_delta: -diff,
            member_id: r.owner,
            advance_id: r.id,
            title: (diff > 0 ? "Chi bổ sung: " : "Hoàn ứng: ") + r.title,
            category: "Tạm ứng",
            date: d,
            reference: text(b.reference, "Mã tham chiếu", 100),
          });
        }
        record(c, {
          kind: "settlement",
          amount: r.actual,
          cash_delta: 0,
          cost_delta: r.actual,
          member_id: r.owner,
          advance_id: r.id,
          title: "Quyết toán: " + r.title,
          category: r.settlement_category,
          date: d,
          evidence: r.settlement_evidence,
        });
        db.prepare("UPDATE advances SET status='closed' WHERE id=?").run(r.id);
      }
    }
    audit(db, user, "advance_" + act, "advance", r.id, {
      actual: act === "submit" ? b.actual : r.actual,
      reason: b.reason || "",
    });
    return {
      id: r.id,
      status: db.prepare("SELECT status FROM advances WHERE id=?").get(r.id)
        .status,
    };
  });
  send(200, result);
  return true;
}

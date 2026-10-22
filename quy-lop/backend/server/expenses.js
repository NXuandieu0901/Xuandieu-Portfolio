import { audit } from "./db.js";
import { admin, fail, text, amount, date } from "./util.js";
import { once, member, record, requireFunds, balances } from "./ledger.js";
export function expenseRoutes(c) {
  const { path, method, db, body: b, user, send } = c;
  if (path === "/api/expenses") {
    if (method === "GET") {
      const rows = db
        .prepare(
          "SELECT e.*,u.name AS owner_name,m.name AS recipient FROM expense_requests e JOIN users u ON u.id=e.owner JOIN users m ON m.id=e.member_id " +
            (user.role === "admin" ? "" : "WHERE e.owner=? ") +
            "ORDER BY e.id DESC",
        )
        .all(...(user.role === "admin" ? [] : [user.id]));
      send(200, rows);
      return true;
    }
    if (method === "POST") {
      const result = once(c, "expense_create", () => {
        const memberId =
            user.role === "admin" ? member(db, b.member_id) : user.id,
          n = amount(b.amount),
          title = text(b.title, "Nội dung"),
          category = text(b.category || "Hoạt động", "Danh mục", 60),
          evidence = text(b.evidence, "Chứng từ hoặc giải trình", 1000);
        const r = db
          .prepare(
            "INSERT INTO expense_requests(owner,member_id,title,amount,category,evidence) VALUES(?,?,?,?,?,?)",
          )
          .run(user.id, memberId, title, n, category, evidence);
        audit(db, user, "expense_requested", "expense", r.lastInsertRowid, {
          amount: n,
        });
        return { id: Number(r.lastInsertRowid) };
      });
      send(201, result);
      return true;
    }
  }
  const m = /^\/api\/expenses\/(\d+)\/(approve|reject|cancel|pay)$/.exec(path);
  if (m && method === "POST") {
    admin(c);
    const result = once(c, "expense_" + m[1] + "_" + m[2], () => {
      const r = db
        .prepare("SELECT * FROM expense_requests WHERE id=?")
        .get(Number(m[1]));
      if (!r) fail(404, "Không tìm thấy đề nghị.");
      const action = m[2];
      if (action === "approve") {
        if (r.status !== "pending") fail(409, "Đề nghị không còn chờ duyệt.");
        requireFunds(db, r.amount);
        db.prepare(
          "UPDATE expense_requests SET status='approved' WHERE id=?",
        ).run(r.id);
      } else if (action === "reject" || action === "cancel") {
        if (
          !(action === "reject"
            ? r.status === "pending"
            : ["pending", "approved"].includes(r.status))
        )
          fail(409, "Không thể đổi trạng thái đề nghị.");
        db.prepare(
          "UPDATE expense_requests SET status=?,reason=? WHERE id=?",
        ).run(
          action === "reject" ? "rejected" : "cancelled",
          text(b.reason, "Lý do", 500),
          r.id,
        );
      } else {
        if (r.status !== "approved")
          fail(409, "Đề nghị chưa được duyệt hoặc đã thanh toán.");
        if (b.confirmed !== true)
          fail(400, "Cần xác nhận thanh toán thành công.");
        if (balances(db).cash < r.amount) fail(409, "Không đủ tiền thực tế.");
        const tx = record(c, {
          kind: "expense",
          amount: r.amount,
          cash_delta: -r.amount,
          cost_delta: r.amount,
          member_id: r.member_id,
          expense_id: r.id,
          title: r.title,
          category: r.category,
          date: date(b.date),
          reference: text(b.reference, "Mã tham chiếu", 100),
          evidence: r.evidence,
        });
        db.prepare("UPDATE expense_requests SET status='paid' WHERE id=?").run(
          r.id,
        );
        audit(db, user, "expense_paid", "expense", r.id, {
          transaction_id: tx.id,
        });
        return { id: r.id, transaction_id: tx.id, status: "paid" };
      }
      audit(db, user, "expense_" + action, "expense", r.id, {
        reason: b.reason || "",
      });
      return {
        id: r.id,
        status: db
          .prepare("SELECT status FROM expense_requests WHERE id=?")
          .get(r.id).status,
      };
    });
    send(200, result);
    return true;
  }
  return false;
}

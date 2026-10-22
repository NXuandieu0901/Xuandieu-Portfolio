import { admin, fail, text, id, date } from "./util.js";
import { balances, once, record, requireFunds } from "./ledger.js";
import { audit } from "./db.js";
function range(url) {
  const m = url.searchParams.get("month");
  if (!m || m === "all") return { from: "0000-01-01", to: "9999-12-31" };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) fail(400, "Kỳ không hợp lệ.");
  const start = m + "-01";
  const last = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0))
    .toISOString()
    .slice(0, 10);
  return { from: start, to: last };
}
function transactionQuery(c, all = false) {
  const { from, to } = range(c.url),
    q = c.url.searchParams.get("q") || "",
    type = c.url.searchParams.get("type") || "all";
  if (q.length > 160 || !["all", "in", "out"].includes(type))
    fail(400, "Bộ lọc không hợp lệ.");
  let where = "t.date>=? AND t.date<=?",
    args = [from, to];
  if (type !== "all")
    where +=
      type === "in"
        ? " AND t.cash_delta>0"
        : " AND (t.cash_delta<0 OR t.kind='settlement')";
  if (q) {
    where +=
      c.user.role === "admin"
        ? " AND (instr(lower(t.title),lower(?))>0 OR instr(lower(coalesce(u.name,'')),lower(?))>0)"
        : " AND (instr(lower(t.title),lower(?))>0 OR (t.member_id=? AND instr(lower(coalesce(u.name,'')),lower(?))>0))";
    args.push(q, ...(c.user.role === "admin" ? [] : [c.user.id]), q);
  }
  const cursor = c.url.searchParams.get("cursor");
  if (cursor) {
    where += " AND t.id<?";
    args.push(id(cursor));
  }
  const limit = all
    ? 10001
    : Math.min(100, Math.max(1, Number(c.url.searchParams.get("limit") || 25)));
  if (!Number.isInteger(limit)) fail(400, "Phân trang không hợp lệ.");
  const rows = c.db
    .prepare(
      "SELECT t.*,u.name AS person,u.code AS student_code,p.name AS period_name FROM transactions t LEFT JOIN users u ON u.id=t.member_id LEFT JOIN collection_periods p ON p.id=t.period_id WHERE " +
        where +
        " ORDER BY t.id DESC LIMIT ?",
    )
    .all(...args, limit + Number(!all));
  if (all && rows.length > 10000)
    fail(400, "Báo cáo quá lớn. Hãy chọn kỳ ngắn hơn.");
  const hasMore = !all && rows.length > limit;
  if (hasMore) rows.pop();
  return {
    rows: rows.map((r) => redact(c, r)),
    nextCursor: hasMore ? rows.at(-1).id : null,
  };
}
function redact(c, r) {
  if (c.user.role === "admin") return r;
  const own = r.member_id === c.user.id;
  return {
    id: r.id,
    kind: r.kind,
    amount: r.amount,
    cash_delta: r.cash_delta,
    cost_delta: r.cost_delta,
    income_delta: r.income_delta,
    contribution_delta: own ? r.contribution_delta : undefined,
    title: r.title,
    category: r.category,
    date: r.date,
    period_name: r.period_name,
    person: own
      ? r.person
      : r.kind === "income"
        ? "Thành viên"
        : "Hoạt động chung",
    created_at: r.created_at,
  };
}
export function reportRoutes(c) {
  const { path, method, db, send, user, url } = c;
  if (path === "/api/notifications" && method === "GET") {
    const p = db
      .prepare(
        "SELECT * FROM collection_periods ORDER BY due_date DESC,id DESC LIMIT 1",
      )
      .get();
    const messages = [];
    if (p) {
      if (user.role === "student") {
        const paid = db
          .prepare(
            "SELECT coalesce(sum(contribution_delta),0) n FROM transactions WHERE member_id=? AND period_id=?",
          )
          .get(user.id, p.id).n;
        const remaining = Math.max(0, p.amount - paid);
        if (remaining)
          messages.push({
            type: "dues",
            message:
              p.name + ": còn thiếu " + remaining + " VND, hạn " + p.due_date,
          });
      } else {
        const unpaid = db
          .prepare(
            "SELECT count(*) n FROM users u WHERE role='student' AND active=1 AND (SELECT coalesce(sum(contribution_delta),0) FROM transactions t WHERE t.member_id=u.id AND t.period_id=?)<?",
          )
          .get(p.id, p.amount).n;
        if (unpaid)
          messages.push({
            type: "dues",
            message:
              p.name + ": " + unpaid + " sinh viên chưa hoàn thành đóng quỹ.",
          });
      }
    }
    const late = db
      .prepare(
        "SELECT count(*) n FROM advances WHERE due_date<date('now') AND status IN ('disbursed','settlement_returned','settlement_submitted','awaiting_payment','awaiting_refund','settlement_approved')" +
          (user.role === "student" ? " AND owner=?" : ""),
      )
      .get(...(user.role === "student" ? [user.id] : [])).n;
    if (late)
      messages.push({
        type: "advance",
        message: late + " hồ sơ tạm ứng đã quá hạn quyết toán.",
      });
    send(200, messages);
    return true;
  }
  if (path === "/api/dashboard" && method === "GET") {
    const { from, to } = range(url);
    const sums = db
      .prepare(
        "SELECT coalesce(sum(income_delta),0) income,coalesce(sum(cost_delta),0) expense,coalesce(sum(cash_delta),0) movement FROM transactions WHERE date>=? AND date<=?",
      )
      .get(from, to);
    const opening = db
      .prepare(
        "SELECT coalesce(sum(cash_delta),0) n FROM transactions WHERE date<?",
      )
      .get(from).n;
    const expenseBreakdown=db.prepare('SELECT coalesce(sum(CASE WHEN cost_delta>0 THEN cost_delta ELSE 0 END),0) gross_expense,coalesce(-sum(CASE WHEN cost_delta<0 THEN cost_delta ELSE 0 END),0) refunds FROM transactions WHERE date>=? AND date<=?').get(from,to);
    const groups = db
      .prepare(
        "SELECT category,sum(cost_delta) amount FROM transactions WHERE date>=? AND date<=? GROUP BY category HAVING sum(cost_delta)>0",
      )
      .all(from, to);
    const months = db
      .prepare(
        "SELECT substr(date,1,7) month,sum(income_delta) income,sum(cost_delta) expense FROM transactions WHERE date>=? AND date<=? GROUP BY substr(date,1,7) ORDER BY month",
      )
      .all(from, to);
    const outstanding = db
      .prepare(
        "SELECT coalesce(sum(t.amount),0) n FROM transactions t WHERE t.kind='advance_disburse' AND t.date<=? AND NOT EXISTS(SELECT 1 FROM transactions s WHERE s.advance_id=t.advance_id AND s.kind='settlement' AND s.date<=?)",
      )
      .get(to, to).n;
    const dues = db
      .prepare(
        "SELECT * FROM collection_periods ORDER BY due_date DESC,id DESC LIMIT 1",
      )
      .get();
    let paid = 0;
    const total = db
      .prepare("SELECT count(*) n FROM users WHERE role='student' AND active=1")
      .get().n;
    if (dues)
      paid = db
        .prepare(
          "SELECT count(*) n FROM users u WHERE role='student' AND active=1 AND (SELECT coalesce(sum(contribution_delta),0) FROM transactions t WHERE t.member_id=u.id AND t.period_id=?)>=?",
        )
        .get(dues.id, dues.amount).n;
    const current = balances(db);
    send(200, {
      ...sums,
      ...expenseBreakdown,
      opening,
      balance: opening + sums.movement,
      outstanding,
      groups,
      months,
      paid,
      total,
      dues: dues || null,
      current: {
        cash: current.cash,
        available: current.available,
        reserved: current.reserved,
      },
    });
    return true;
  }
  const st = /^\/api\/students\/([A-Za-z0-9_-]+)$/.exec(path);
  if (st && method === "GET") {
    const code = st[1].toUpperCase();
    if (user.role !== "admin" && user.code !== code)
      fail(403, "Bạn chỉ được tra cứu mã sinh viên của mình.");
    const target = db
      .prepare("SELECT id,name,code FROM users WHERE code=? AND role='student'")
      .get(code);
    if (!target) fail(404, "Không tìm thấy mã sinh viên.");
    let p;
    if (url.searchParams.has("period_id"))
      p = db
        .prepare("SELECT * FROM collection_periods WHERE id=?")
        .get(id(url.searchParams.get("period_id")));
    else
      p = db
        .prepare(
          "SELECT * FROM collection_periods ORDER BY due_date DESC,id DESC LIMIT 1",
        )
        .get();
    if (url.searchParams.has("period_id") && !p)
      fail(404, "Không tìm thấy đợt thu.");
    const total = db
      .prepare(
        "SELECT coalesce(sum(contribution_delta),0) n FROM transactions WHERE member_id=?",
      )
      .get(target.id).n;
    const paid = p
      ? db
          .prepare(
            "SELECT coalesce(sum(contribution_delta),0) n FROM transactions WHERE member_id=? AND period_id=?",
          )
          .get(target.id, p.id).n
      : 0;
    const history = db
      .prepare(
        "SELECT id,title,date,contribution_delta AS amount,period_id FROM transactions WHERE member_id=? AND contribution_delta<>0 ORDER BY date DESC,id DESC",
      )
      .all(target.id);
    send(200, {
      student: target,
      total,
      period: p || null,
      paid,
      remaining: p ? Math.max(0, p.amount - paid) : 0,
      history,
    });
    return true;
  }
  if (path === "/api/transactions" && method === "GET") {
    send(200, transactionQuery(c));
    return true;
  }
  const tx = /^\/api\/transactions\/(\d+)$/.exec(path);
  if (tx && method === "GET") {
    const r = db
      .prepare(
        "SELECT t.*,u.name person,u.code student_code,p.name period_name FROM transactions t LEFT JOIN users u ON u.id=t.member_id LEFT JOIN collection_periods p ON p.id=t.period_id WHERE t.id=?",
      )
      .get(id(tx[1]));
    if (!r) fail(404, "Không tìm thấy giao dịch.");
    send(200, redact(c, r));
    return true;
  }
  if (path === "/api/export" && method === "GET") {
    const { rows } = transactionQuery(c, true);
    const safe = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^(?=[\s]*[=+@-])/, "'")
        .replaceAll('"', '""') +
      '"';
    const csv =
      "\uFEFF" +
      [
        [
          "Mã",
          "Loại",
          "Nội dung",
          "Người nộp/nhận",
          "Ngày",
          "Tiền vào/ra",
          "Chi phí",
          "Danh mục",
        ],
        ...rows.map((r) => [
          r.id,
          r.kind,
          r.title,
          r.person,
          r.date,
          r.cash_delta,
          r.cost_delta,
          r.category,
        ]),
      ]
        .map((r) => r.map(safe).join(","))
        .join("\r\n");
    c.res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dong-quy.csv"',
      "Cache-Control": "no-store",
    });
    c.res.end(csv);
    return true;
  }
  if (path === "/api/audit" && method === "GET") {
    admin(c);
    const cursor = url.searchParams.get("cursor"),
      action = url.searchParams.get("action"),
      actor = url.searchParams.get("actor");
    let where = "1=1",
      args = [];
    if (cursor) {
      where += " AND a.id<?";
      args.push(id(cursor));
    }
    if (action) {
      where += " AND a.action=?";
      args.push(text(action, "Loại hành động", 80));
    }
    if (actor) {
      where += " AND a.actor=?";
      args.push(id(actor));
    }
    const { from, to } = range(url);
    where +=
      " AND substr(a.created_at,1,10)>=? AND substr(a.created_at,1,10)<=?";
    args.push(from, to);
    const rows = db
      .prepare(
        "SELECT a.*,u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor WHERE " +
          where +
          " ORDER BY a.id DESC LIMIT 26",
      )
      .all(...args);
    const more = rows.length > 25;
    if (more) rows.pop();
    send(200, { rows, nextCursor: more ? rows.at(-1).id : null });
    return true;
  }
  const rev = /^\/api\/transactions\/(\d+)\/reverse$/.exec(path);
  if (rev && method === "POST") {
    admin(c);
    const result = once(c, "reverse_" + rev[1], () => {
      const r = db
        .prepare("SELECT * FROM transactions WHERE id=?")
        .get(id(rev[1]));
      if (!r) fail(404, "Không tìm thấy phiếu.");
      if (!["income", "expense"].includes(r.kind))
        fail(
          409,
          "Chỉ đảo phiếu thu hoặc chi trực tiếp; tạm ứng cần xử lý qua hồ sơ.",
        );
      if (db.prepare("SELECT id FROM transactions WHERE reverses=?").get(r.id))
        fail(409, "Phiếu đã được đảo.");
      if (r.cash_delta > 0) requireFunds(db, r.cash_delta);
      if (date(c.body.date) < r.date)
        fail(400, "Ngày đảo không được trước ngày phiếu gốc.");
      const reason = text(c.body.reason, "Lý do", 500);
      const result = record(c, {
        kind: "reversal",
        amount: r.amount,
        cash_delta: -r.cash_delta,
        cost_delta: -r.cost_delta,
        income_delta: -r.income_delta,
        contribution_delta: -r.contribution_delta,
        member_id: r.member_id,
        period_id: r.period_id,
        title: "Đảo phiếu #" + r.id + ": " + reason,
        category: r.category,
        date: date(c.body.date),
        reverses: r.id,
      });
      audit(db, user, "transaction_reversed", "transaction", r.id, {
        reversal_id: result.id,
        reason,
      });
      return result;
    });
    send(201, result);
    return true;
  }
  return false;
}

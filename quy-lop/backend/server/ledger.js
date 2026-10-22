import { createHash } from "node:crypto";
import { atomic, audit } from "./db.js";
import { admin, fail, text, amount, date, id } from "./util.js";
export function migrateLedger(db) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS expense_requests(id INTEGER PRIMARY KEY,owner INTEGER NOT NULL REFERENCES users(id),member_id INTEGER NOT NULL REFERENCES users(id),title TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),category TEXT NOT NULL,evidence TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
 CREATE TABLE IF NOT EXISTS advances(id INTEGER PRIMARY KEY,owner INTEGER NOT NULL REFERENCES users(id),title TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),due_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT NOT NULL DEFAULT '',actual INTEGER,settlement_evidence TEXT NOT NULL DEFAULT '',settlement_category TEXT NOT NULL DEFAULT 'Hoạt động',created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
 CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>=0),cash_delta INTEGER NOT NULL,cost_delta INTEGER NOT NULL DEFAULT 0,income_delta INTEGER NOT NULL DEFAULT 0,contribution_delta INTEGER NOT NULL DEFAULT 0,member_id INTEGER REFERENCES users(id),period_id INTEGER REFERENCES collection_periods(id),expense_id INTEGER REFERENCES expense_requests(id),advance_id INTEGER REFERENCES advances(id),title TEXT NOT NULL,category TEXT NOT NULL,date TEXT NOT NULL,reference TEXT UNIQUE,actor INTEGER NOT NULL REFERENCES users(id),evidence TEXT NOT NULL DEFAULT '',reverses INTEGER UNIQUE REFERENCES transactions(id),created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
 CREATE INDEX IF NOT EXISTS tx_date ON transactions(date,id);
 CREATE INDEX IF NOT EXISTS tx_member ON transactions(member_id,period_id);
 CREATE TABLE IF NOT EXISTS idempotency(user_id INTEGER NOT NULL REFERENCES users(id),key TEXT NOT NULL,hash TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(user_id,key));
 CREATE TRIGGER IF NOT EXISTS tx_no_update BEFORE UPDATE ON transactions BEGIN SELECT RAISE(ABORT,'Use a reversal'); END;
 CREATE TRIGGER IF NOT EXISTS tx_no_delete BEFORE DELETE ON transactions BEGIN SELECT RAISE(ABORT,'Use a reversal'); END;
 `);
}
export function once(c, scope, fn) {
  const key = text(
      c.req.headers["idempotency-key"],
      "Khóa chống gửi trùng",
      100,
    ),
    hash = createHash("sha256")
      .update(scope + "\n" + JSON.stringify(c.body))
      .digest("hex");
  return atomic(c.db, () => {
    const prior = c.db
      .prepare("SELECT * FROM idempotency WHERE user_id=? AND key=?")
      .get(c.user.id, key);
    if (prior) {
      if (prior.hash !== hash)
        fail(409, "Khóa chống trùng đã dùng cho yêu cầu khác.");
      return JSON.parse(prior.response);
    }
    const result = fn();
    c.db
      .prepare("INSERT INTO idempotency VALUES(?,?,?,?)")
      .run(c.user.id, key, hash, JSON.stringify(result));
    return result;
  });
}
export function balances(db) {
  const r = db
    .prepare(
      "SELECT coalesce(sum(cash_delta),0) AS cash,coalesce(sum(cost_delta),0) AS cost,coalesce(sum(income_delta),0) AS income FROM transactions",
    )
    .get();
  const expense = db
    .prepare(
      "SELECT coalesce(sum(amount),0) AS n FROM expense_requests WHERE status='approved'",
    )
    .get().n;
  const advance = db
    .prepare(
      "SELECT coalesce(sum(amount),0) AS n FROM advances WHERE status='approved'",
    )
    .get().n;
  const extra = db
    .prepare(
      "SELECT coalesce(sum(actual-amount),0) AS n FROM advances WHERE status='awaiting_payment'",
    )
    .get().n;
  return {
    ...r,
    reserved: expense + advance + extra,
    available: r.cash - expense - advance - extra,
  };
}
export function requireFunds(db, n) {
  if (balances(db).available < n) fail(409, "Quỹ không đủ tiền khả dụng.");
}
export function member(db, value) {
  const n = id(value);
  const u = db
    .prepare("SELECT id,name,code FROM users WHERE id=? AND active=1")
    .get(n);
  if (!u) fail(400, "Người nộp hoặc nhận không hợp lệ.");
  return n;
}
export function period(db, value) {
  if (value === undefined || value === null || value === "") return null;
  const p = db
    .prepare("SELECT * FROM collection_periods WHERE id=?")
    .get(id(value));
  if (!p || p.locked) fail(400, "Đợt thu không hợp lệ hoặc đã khóa.");
  return p.id;
}
export function record(c, data) {
  const { db, user } = c;
  const ref =
    data.reference === undefined || data.reference === null
      ? null
      : text(data.reference, "Mã tham chiếu", 100);
  if (
    ref &&
    db.prepare("SELECT id FROM transactions WHERE reference=?").get(ref)
  )
    fail(409, "Mã tham chiếu đã được ghi nhận.");
  const fields = [
    "kind",
    "amount",
    "cash_delta",
    "cost_delta",
    "income_delta",
    "contribution_delta",
    "member_id",
    "period_id",
    "expense_id",
    "advance_id",
    "title",
    "category",
    "date",
    "reference",
    "actor",
    "evidence",
    "reverses",
  ];
  const row = {
    cost_delta: 0,
    income_delta: 0,
    contribution_delta: 0,
    member_id: null,
    period_id: null,
    expense_id: null,
    advance_id: null,
    evidence: "",
    reverses: null,
    ...data,
    reference: ref,
    actor: user.id,
  };
  const before = balances(db);
  for (const [key, delta] of [
    ["cash", row.cash_delta],
    ["cost", row.cost_delta],
    ["income", row.income_delta],
  ])
    if (
      !Number.isSafeInteger(before[key] + delta) ||
      Math.abs(before[key] + delta) > 8e15
    )
      fail(400, "Số dư vượt giới hạn hỗ trợ.");
  const r = db
    .prepare(
      "INSERT INTO transactions(" +
        fields.join(",") +
        ") VALUES(" +
        fields.map(() => "?").join(",") +
        ")",
    )
    .run(...fields.map((k) => row[k]));
  const txId = Number(r.lastInsertRowid);
  if (
    db
      .prepare(
        "SELECT 1 FROM (SELECT sum(cash_delta) OVER (ORDER BY date,id) running FROM transactions) WHERE running<0 LIMIT 1",
      )
      .get()
  )
    fail(
      409,
      "Ngày ghi sổ làm số dư lịch sử âm. Hãy kiểm tra ngày và số dư đầu kỳ.",
    );
  audit(db, user, "transaction_posted", "transaction", txId, {
    kind: row.kind,
    amount: row.amount,
  });
  return { id: txId };
}
export function incomeRoutes(c) {
  if (c.path !== "/api/income" || c.method !== "POST") return false;
  admin(c);
  const result = once(c, "income", () => {
    const b = c.body,
      n = amount(b.amount);
    if (b.confirmed !== true)
      fail(400, "Cần xác nhận đã đối soát tiền thực nhận.");
    const memberId = member(c.db, b.member_id),
      periodId = period(c.db, b.period_id);
    return record(c, {
      kind: "income",
      amount: n,
      cash_delta: n,
      income_delta: n,
      contribution_delta: n,
      member_id: memberId,
      period_id: periodId,
      title: text(b.title, "Nội dung"),
      category: text(b.category || "Quỹ lớp", "Danh mục", 60),
      date: date(b.date),
      reference: text(b.reference, "Mã tham chiếu", 100),
      evidence: typeof b.evidence === "string" ? b.evidence.slice(0, 1000) : "",
    });
  });
  c.send(201, result);
  return true;
}

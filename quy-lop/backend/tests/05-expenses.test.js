import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
const funding = (f) => ({
  member_id: f.student.id,
  amount: 1000000,
  reference: "FUND",
  title: "Quỹ",
  date: "2026-10-22",
  confirmed: true,
});
test("05 chi quỹ phải duyệt, giữ tiền và chống thanh toán trùng", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local");
  await a.request("/api/income", "POST", funding(f), "fund");
  const data = {
    member_id: f.other.id,
    title: "Mua tài liệu",
    amount: 700000,
    evidence: "Hóa đơn HD-01",
    category: "Học tập",
  };
  let r = await s.request("/api/expenses", "POST", data, "req1");
  const id = r.data.id;
  assert.equal(
    f.db.prepare("SELECT member_id FROM expense_requests WHERE id=?").get(id)
      .member_id,
    f.student.id,
  );
  assert.equal(
    (await s.request("/api/expenses/" + id + "/approve", "POST", {}, "hack"))
      .status,
    403,
  );
  assert.equal(
    (await a.request("/api/expenses/" + id + "/pay", "POST", {}, "early"))
      .status,
    409,
  );
  assert.equal(
    (
      await a.request(
        "/api/expenses/" + id + "/approve",
        "POST",
        {},
        "approve1",
      )
    ).status,
    200,
  );
  const second = await a.request(
    "/api/expenses",
    "POST",
    { ...data, amount: 500000 },
    "req2",
  );
  assert.equal(
    (
      await a.request(
        "/api/expenses/" + second.data.id + "/approve",
        "POST",
        {},
        "approve2",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await a.request(
        "/api/expenses/" + id + "/pay",
        "POST",
        { confirmed: false },
        "badpay",
      )
    ).status,
    400,
  );
  const payment = { date: "2026-10-22", reference: "PAY-01", confirmed: true };
  r = await a.request("/api/expenses/" + id + "/pay", "POST", payment, "pay1");
  assert.equal(r.status, 200);
  assert.equal(
    (await a.request("/api/expenses/" + id + "/pay", "POST", payment, "pay1"))
      .data.transaction_id,
    r.data.transaction_id,
  );
  assert.equal(
    (await a.request("/api/expenses/" + id + "/pay", "POST", payment, "pay2"))
      .status,
    409,
  );
  const totals = f.db
    .prepare(
      "SELECT sum(cash_delta) cash,sum(cost_delta) cost FROM transactions",
    )
    .get();
  assert.deepEqual({ ...totals }, { cash: 300000, cost: 700000 });
  assert.equal(
    (await (await f.login("other@test.local")).request("/api/expenses")).data
      .length,
    0,
  );
});

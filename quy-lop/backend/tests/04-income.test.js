import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
export const income = (
  member_id,
  amount = 100000,
  reference = "BANK-IN-1",
) => ({
  member_id,
  amount,
  reference,
  title: "Đóng quỹ",
  category: "Quỹ lớp",
  date: "2026-10-22",
  confirmed: true,
});
test("04 thu quỹ nguyên tử, đúng người, đối soát và chống trùng", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local"),
    data = income(f.student.id);
  assert.equal(
    (await s.request("/api/income", "POST", data, "sv")).status,
    403,
  );
  assert.equal(
    (
      await a.request(
        "/api/income",
        "POST",
        { ...data, confirmed: false },
        "bad",
      )
    ).status,
    400,
  );
  let r = await a.request("/api/income", "POST", data, "in1");
  assert.equal(r.status, 201);
  const txId = r.data.id;
  r = await a.request("/api/income", "POST", data, "in1");
  assert.equal(r.data.id, txId);
  assert.equal(
    (await a.request("/api/income", "POST", { ...data, amount: 999 }, "in1"))
      .status,
    409,
  );
  assert.equal(
    (await a.request("/api/income", "POST", data, "in2")).status,
    409,
  );
  assert.equal(
    (
      await a.request(
        "/api/income",
        "POST",
        { ...data, amount: -1 },
        "negative",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await a.request(
        "/api/income",
        "POST",
        { ...data, member_id: 999 },
        "unknown",
      )
    ).status,
    400,
  );
  assert.equal(
    f.db.prepare("SELECT count(*) AS n FROM transactions").get().n,
    1,
  );
  assert.equal(
    f.db
      .prepare(
        "SELECT count(*) AS n FROM audit_logs WHERE action='transaction_posted'",
      )
      .get().n,
    1,
  );
  assert.equal(
    f.db.prepare("SELECT sum(cash_delta) AS n FROM transactions").get().n,
    100000,
  );
});

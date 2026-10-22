import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
test("07 dashboard, số dư đầu kỳ, tra cứu riêng tư, lọc và CSV", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local");
  const p = await a.request("/api/periods", "POST", {
    name: "Đợt 10",
    code: "T10",
    amount: 100000,
    due_date: "2026-10-31",
  });
  for (const [i, d] of ["2026-09-01", "2026-10-01"].entries()) {
    const r = await a.request(
      "/api/income",
      "POST",
      {
        member_id: i ? f.student.id : f.other.id,
        period_id: p.data.id,
        amount: 100000,
        date: d,
        title: i ? '=HYPERLINK("x")' : "Đóng quỹ",
        reference: "R" + i,
        confirmed: true,
      },
      "in" + i,
    );
    assert.equal(r.status, 201);
  }
  let r = await s.request("/api/dashboard?month=2026-10");
  assert.equal(r.data.opening, 100000);
  assert.equal(r.data.income, 100000);
  assert.equal(r.data.balance, 200000);
  assert.equal(r.data.paid, 2);
  r = await s.request("/api/students/K24001");
  assert.equal(r.data.total, 100000);
  assert.equal(r.data.remaining, 0);
  assert.equal((await s.request("/api/students/K24002")).status, 403);
  r = await s.request("/api/transactions?limit=1");
  assert.equal(r.data.rows.length, 1);
  assert.ok(r.data.nextCursor);
  r = await s.request("/api/transactions?cursor=" + r.data.nextCursor);
  assert.equal(r.data.rows[0].person, "Thành viên");
  assert.equal(r.data.rows[0].reference, undefined);
  assert.equal((await s.request("/api/audit")).status, 403);
  r = await s.request("/api/export");
  assert.ok(r.data.includes("'=HYPERLINK"));
  assert.ok(!r.data.includes("R0"));
  assert.equal(
    (await a.request("/api/transactions?month=2026-13")).status,
    400,
  );
});
test("07 đảo phiếu, không xóa lịch sử, nhật ký bất biến", async (t) => {
  const f = await fixture(t),
    a = await f.login();
  let r = await a.request(
    "/api/income",
    "POST",
    {
      member_id: f.student.id,
      amount: 100000,
      date: "2026-10-22",
      title: "Thu",
      reference: "R",
      confirmed: true,
    },
    "in",
  );
  const id = r.data.id;
  assert.equal(
    (
      await a.request(
        "/api/transactions/" + id + "/reverse",
        "POST",
        { reason: "Nhập nhầm", date: "2026-02-30" },
        "invalid",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await a.request(
        "/api/transactions/" + id + "/reverse",
        "POST",
        { reason: "Nhập nhầm", date: "2026-10-22" },
        "reverse",
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await a.request(
        "/api/transactions/" + id + "/reverse",
        "POST",
        { reason: "Lặp", date: "2026-10-22" },
        "reverse2",
      )
    ).status,
    409,
  );
  assert.equal((await a.request("/api/dashboard")).data.balance, 0);
  assert.throws(
    () => f.db.prepare("DELETE FROM audit_logs").run(),
    /Immutable/,
  );
  assert.throws(
    () => f.db.prepare("UPDATE transactions SET amount=1").run(),
    /reversal/,
  );
  assert.equal((await a.request("/api/audit")).status, 200);
});

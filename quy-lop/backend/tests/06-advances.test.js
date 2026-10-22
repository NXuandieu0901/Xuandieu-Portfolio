import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
for (const actual of [600000, 800000, 1000000, 0])
  test(
    "06 quyết toán " + actual + ": tiền và chi phí không bị tính trùng",
    async (t) => {
      const f = await fixture(t),
        a = await f.login(),
        s = await f.login("sv@test.local");
      await a.request(
        "/api/income",
        "POST",
        {
          member_id: f.student.id,
          amount: 2000000,
          title: "Quỹ",
          date: "2026-10-22",
          reference: "IN",
          confirmed: true,
        },
        "fund",
      );
      const r = await s.request(
        "/api/advances",
        "POST",
        { amount: 800000, title: "Hoạt động lớp", due_date: "2026-10-31" },
        "req",
      );
      const base = "/api/advances/" + r.data.id;
      assert.equal(
        (await s.request(base + "/approve", "POST", {}, "hack")).status,
        403,
      );
      assert.equal(
        (await a.request(base + "/approve", "POST", {}, "approve")).status,
        200,
      );
      assert.equal(
        (
          await a.request(
            base + "/disburse",
            "POST",
            { date: "2026-10-22", reference: "ADV", confirmed: true },
            "disburse",
          )
        ).status,
        200,
      );
      let sums = f.db
        .prepare(
          "SELECT sum(cash_delta) cash,sum(cost_delta) cost FROM transactions",
        )
        .get();
      assert.equal(sums.cash, 1200000);
      assert.equal(sums.cost, 0);
      const other = await f.login("other@test.local");
      assert.equal(
        (
          await other.request(
            base + "/submit",
            "POST",
            { actual, evidence: "HD" },
            "other",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await s.request(
            base + "/submit",
            "POST",
            { actual, evidence: "Hóa đơn", category: "Hoạt động" },
            "submit",
          )
        ).status,
        200,
      );
      assert.equal(
        (await a.request(base + "/settle-approve", "POST", {}, "settleapprove"))
          .status,
        200,
      );
      if (actual !== 800000)
        assert.equal(
          (
            await a.request(
              base + "/complete",
              "POST",
              { date: "2026-10-22" },
              "early",
            )
          ).status,
          400,
        );
      const payment = {
        date: "2026-10-22",
        reference: "SETTLE",
        confirmed: true,
      };
      assert.equal(
        (await a.request(base + "/complete", "POST", payment, "complete"))
          .status,
        200,
      );
      assert.equal(
        (await a.request(base + "/complete", "POST", payment, "complete"))
          .status,
        200,
      );
      assert.equal(
        (await a.request(base + "/complete", "POST", payment, "again")).status,
        409,
      );
      sums = f.db
        .prepare(
          "SELECT sum(cash_delta) cash,sum(cost_delta) cost,sum(income_delta) income FROM transactions",
        )
        .get();
      assert.equal(sums.cash, 2000000 - actual);
      assert.equal(sums.cost, actual);
      assert.equal(sums.income, 2000000);
      assert.equal(
        f.db.prepare("SELECT status FROM advances").get().status,
        "closed",
      );
    },
  );
test("06 khoản đã duyệt giữ tiền và quyết toán vượt quỹ bị chặn", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local");
  await a.request(
    "/api/income",
    "POST",
    {
      member_id: f.student.id,
      amount: 500000,
      title: "Quỹ",
      date: "2026-10-22",
      reference: "IN",
      confirmed: true,
    },
    "fund",
  );
  const req = async (key) =>
    s.request(
      "/api/advances",
      "POST",
      { amount: 400000, title: "Hoạt động", due_date: "2026-10-31" },
      key,
    );
  const r1 = await req("one"),
    r2 = await req("two");
  assert.equal(
    (
      await a.request(
        "/api/advances/" + r1.data.id + "/approve",
        "POST",
        {},
        "approve1",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await a.request(
        "/api/advances/" + r2.data.id + "/approve",
        "POST",
        {},
        "approve2",
      )
    ).status,
    409,
  );
  const base = "/api/advances/" + r1.data.id;
  assert.equal(
    (
      await a.request(
        base + "/disburse",
        "POST",
        { date: "2026-10-22", reference: "ADV-1", confirmed: true },
        "disburse",
      )
    ).status,
    200,
  );
  await s.request(
    base + "/submit",
    "POST",
    { actual: 600000, evidence: "HD" },
    "actual",
  );
  assert.equal(
    (await a.request(base + "/settle-approve", "POST", {}, "overfund")).status,
    409,
  );
  assert.equal(
    f.db.prepare("SELECT status FROM advances WHERE id=?").get(r1.data.id)
      .status,
    "settlement_submitted",
  );
});

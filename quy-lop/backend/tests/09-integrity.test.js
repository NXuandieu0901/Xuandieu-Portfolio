import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/index.js";
import { createUser } from "../server/auth.js";
import { fixture } from "./helper.js";
test("09 dữ liệu SQLite và phiên vẫn tồn tại sau khi khởi động lại", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "dq-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "fund.sqlite");
  let app = createApp({ dbPath: path, secureCookies: false });
  createUser(app.db, {
    email: "admin@test.local",
    name: "Admin",
    role: "admin",
    password: "Test-password-123",
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const first = "http://127.0.0.1:" + app.server.address().port;
  let res = await fetch(first + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@test.local",
      password: "Test-password-123",
    }),
  });
  const cookie = res.headers.get("set-cookie").split(";")[0],
    auth = await res.json();
  res = await fetch(first + "/api/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-CSRF-Token": auth.csrf,
    },
    body: JSON.stringify({
      bank: "VCB",
      holder: "QUY",
      number: "123456",
      version: 0,
    }),
  });
  assert.equal(res.status, 200);
  await app.close();
  app = createApp({ dbPath: path, secureCookies: false });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.close());
  res = await fetch(
    "http://127.0.0.1:" + app.server.address().port + "/api/settings",
    { headers: { Cookie: cookie } },
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).number, "123456");
});
test("09 duyệt đồng thời không vượt quỹ; lỗi quyết toán rollback toàn bộ", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local");
  const income = {
    member_id: f.student.id,
    amount: 1000000,
    title: "Thu",
    date: "2026-10-22",
    reference: "IN",
    confirmed: true,
  };
  const duplicates = await Promise.all([
    a.request("/api/income", "POST", income, "same"),
    a.request("/api/income", "POST", income, "same"),
  ]);
  assert.equal(duplicates[0].data.id, duplicates[1].data.id);
  let r = await s.request(
    "/api/expenses",
    "POST",
    { title: "Chi", amount: 700000, evidence: "HD" },
    "expense",
  );
  const expense = r.data.id;
  r = await s.request(
    "/api/advances",
    "POST",
    { title: "Ứng", amount: 700000, due_date: "2026-10-31" },
    "advance",
  );
  const advance = r.data.id;
  const results = await Promise.all([
    a.request(
      "/api/expenses/" + expense + "/approve",
      "POST",
      {},
      "approveExpense",
    ),
    a.request(
      "/api/advances/" + advance + "/approve",
      "POST",
      {},
      "approveAdvance",
    ),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  if (results[0].status === 200) {
    await a.request(
      "/api/expenses/" + expense + "/cancel",
      "POST",
      { reason: "Đổi kế hoạch" },
      "cancel",
    );
    await a.request(
      "/api/advances/" + advance + "/approve",
      "POST",
      {},
      "approveAgain",
    );
  }
  await a.request(
    "/api/advances/" + advance + "/disburse",
    "POST",
    { date: "2026-10-22", reference: "DISB", confirmed: true },
    "disburse",
  );
  await s.request(
    "/api/advances/" + advance + "/submit",
    "POST",
    { actual: 600000, evidence: "HD" },
    "submit",
  );
  await a.request(
    "/api/advances/" + advance + "/settle-approve",
    "POST",
    {},
    "settleapprove",
  );
  const before = f.db.prepare("SELECT count(*) n FROM transactions").get().n;
  r = await a.request(
    "/api/advances/" + advance + "/complete",
    "POST",
    { date: "2026-10-22", reference: "IN", confirmed: true },
    "duplicateRef",
  );
  assert.equal(r.status, 409);
  assert.equal(
    f.db.prepare("SELECT count(*) n FROM transactions").get().n,
    before,
  );
  assert.equal(
    f.db.prepare("SELECT status FROM advances WHERE id=?").get(advance).status,
    "awaiting_refund",
  );
  assert.equal(
    f.db.prepare("SELECT coalesce(sum(cost_delta),0) n FROM transactions").get()
      .n,
    0,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
test("01 đăng nhập, cookie an toàn, CSRF, phiên hết hạn và đăng xuất", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("/api/me")).status, 401);
  assert.equal(
    (
      await f.call("/api/login", {
        method: "POST",
        body: { email: "admin@test.local", password: "wrong" },
      })
    ).status,
    401,
  );
  const a = await f.login();
  let r = await a.request("/api/me");
  assert.equal(r.data.user.role, "admin");
  assert.equal(r.data.user.password, undefined);
  assert.equal(
    (
      await f.call("/api/logout", {
        method: "POST",
        body: {},
        cookie: a.cookie,
      })
    ).status,
    403,
  );
  assert.equal((await a.request("/api/logout", "POST", {})).status, 200);
  assert.equal((await a.request("/api/me")).status, 401);
  const s = await f.login("sv@test.local");
  assert.equal((await s.request("/api/me")).data.user.code, "K24001");
  f.db.prepare("UPDATE sessions SET expires=0").run();
  assert.equal((await s.request("/api/me")).status, 401);
});
test("01 chặn nguồn ngoài, tài khoản vô hiệu và thử mật khẩu hàng loạt", async (t) => {
  const f = await fixture(t);
  let r = await f.call("/api/login", {
    method: "POST",
    body: {},
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(r.status, 403);
  f.db.prepare("UPDATE users SET active=0 WHERE id=?").run(f.student.id);
  assert.equal(
    (
      await f.call("/api/login", {
        method: "POST",
        body: { email: "sv@test.local", password: "Test-password-123" },
      })
    ).status,
    401,
  );
  for (let i = 0; i < 9; i++)
    await f.call("/api/login", {
      method: "POST",
      body: { email: "none", password: "wrong" },
    });
  assert.equal(
    (
      await f.call("/api/login", {
        method: "POST",
        body: { email: "none", password: "wrong" },
      })
    ).status,
    429,
  );
});

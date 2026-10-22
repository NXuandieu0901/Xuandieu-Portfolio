import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
test("03 thành viên, quyền xem, trùng mã, đổi mật khẩu và đợt thu", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local");
  assert.equal((await s.request("/api/members")).status, 403);
  const data = {
    email: "new@test.local",
    name: "Sinh viên Mới",
    code: "K24003",
    password: "New-password-123",
    role: "admin",
  };
  let r = await a.request("/api/members", "POST", data);
  assert.equal(r.status, 201);
  assert.equal(r.data.role, "student");
  assert.equal(r.data.password, undefined);
  assert.equal(
    (
      await a.request("/api/members", "POST", {
        ...data,
        email: "new2@test.local",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await a.request("/api/periods", "POST", {
        name: "Quỹ tháng 10",
        code: "T10",
        amount: 100000,
        due_date: "2026-02-30",
      })
    ).status,
    400,
  );
  r = await a.request("/api/periods", "POST", {
    name: "Quỹ tháng 10",
    code: "T10",
    amount: 100000,
    due_date: "2026-10-31",
  });
  assert.equal(r.status, 201);
  assert.equal((await s.request("/api/periods")).data.length, 1);
  assert.equal((await s.request("/api/periods", "POST", {})).status, 403);
  await a.request("/api/members/" + f.student.id, "PATCH", { active: false });
  assert.equal((await s.request("/api/me")).status, 401);
  assert.equal(
    (await a.request("/api/members/" + f.admin.id, "PATCH", { active: false }))
      .status,
    404,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6xkAAAAASUVORK5CYII=";
test("02 QR tùy chọn, lưu bền, phân quyền, xung đột và thay tài khoản gỡ QR cũ", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local");
  assert.equal((await s.request("/api/settings")).data.bank, "");
  const data = {
    bank: "VCB",
    holder: "QUY LOP",
    number: "123456789",
    version: 0,
    qr: png,
  };
  assert.equal((await s.request("/api/settings", "PUT", data)).status, 403);
  let r = await a.request("/api/settings", "PUT", data);
  assert.equal(r.status, 200);
  assert.equal((await s.request("/api/settings")).data.qr, png);
  assert.equal((await a.request("/api/settings", "PUT", data)).status, 409);
  r = await a.request("/api/settings", "PUT", {
    ...data,
    qr: "data:image/png;base64,AAAA",
    version: 1,
  });
  assert.equal(r.status, 400);
  r = await a.request("/api/settings", "PUT", {
    bank: "ACB",
    holder: "QUY LOP",
    number: "987654321",
    version: 1,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.qr, "");
  assert.equal(
    f.db
      .prepare(
        "SELECT count(*) AS n FROM audit_logs WHERE action='settings_updated'",
      )
      .get().n,
    2,
  );
});

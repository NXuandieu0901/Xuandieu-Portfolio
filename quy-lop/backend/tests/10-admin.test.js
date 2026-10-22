import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helper.js";
import { createBackup } from "../scripts/backup.js";
import { openDatabase } from "../server/db.js";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("10 khóa đợt thu, thông báo theo quyền và reset mật khẩu", async (t) => {
  const f = await fixture(t),
    a = await f.login(),
    s = await f.login("sv@test.local");
  const p = (
    await a.request("/api/periods", "POST", {
      name: "Quỹ 10",
      code: "T10",
      amount: 100000,
      due_date: "2026-10-31",
    })
  ).data.id;
  assert.equal((await s.request("/api/notifications")).data.length, 1);
  assert.equal(
    (
      await a.request("/api/periods/" + p, "PATCH", {
        locked: true,
        reason: "Kết thúc đợt",
      })
    ).status,
    200,
  );
  const data = {
    member_id: f.student.id,
    period_id: p,
    amount: 100000,
    date: "2026-10-22",
    reference: "IN",
    title: "Thu",
    confirmed: true,
  };
  assert.equal(
    (await a.request("/api/income", "POST", data, "locked")).status,
    400,
  );
  await a.request("/api/periods/" + p, "PATCH", {
    locked: false,
    reason: "Mở lại",
  });
  assert.equal(
    (await a.request("/api/income", "POST", data, "open")).status,
    201,
  );
  assert.equal((await s.request("/api/notifications")).data.length, 0);
  assert.equal(
    (
      await a.request("/api/members/" + f.student.id, "PATCH", {
        password: "Replacement-12345",
        name: "Tên cập nhật",
      })
    ).status,
    200,
  );
  assert.equal((await s.request("/api/me")).status, 401);
});
test("10 sao lưu SQLite nhất quán và không ghi đè bản cũ", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "dq-backup-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, "main.sqlite"),
    target = join(dir, "backup.sqlite");
  const db = openDatabase(source);
  db.prepare(
    "INSERT INTO audit_logs(action,entity,entity_id) VALUES('backup_test','system','1')",
  ).run();
  await createBackup(source, target);
  const copy = new DatabaseSync(target, { readOnly: true });
  assert.equal(
    copy.prepare("SELECT action FROM audit_logs").get().action,
    "backup_test",
  );
  copy.close();
  await assert.rejects(createBackup(source, target), /đã tồn tại/);
  db.close();
});

import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { resolve } from "node:path";
import { openDatabase, atomic, audit } from "../server/db.js";
import { createUser } from "../server/auth.js";
import { migrateFeatures } from "../server/features.js";
const [email, name, role = "admin", code] = process.argv.slice(2);
if (!email || !name) {
  console.error(
    'Dùng: npm run create-user -- email "Họ tên" admin|student [mã-sinh-viên]\nNhập mật khẩu qua stdin (không truyền mật khẩu trong tham số lệnh).',
  );
  process.exit(1);
}
const db = openDatabase(resolve("data/dongquy.sqlite"));
migrateFeatures(db);
const muted = new Writable({
  write(chunk, encoding, callback) {
    callback();
  },
});
const rl = createInterface({
  input: process.stdin,
  output: muted,
  terminal: !!process.stdin.isTTY,
});
process.stdout.write("Mật khẩu (10–128 ký tự, ký tự được ẩn): ");
try {
  const password = await rl.question("");
  const user = atomic(db, () => {
    const u = createUser(db, { email, name, role, code, password });
    audit(db, null, "user_created_cli", "user", u.id);
    return u;
  });
  console.log("Đã tạo tài khoản:", user.email, user.role);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
  db.close();
}

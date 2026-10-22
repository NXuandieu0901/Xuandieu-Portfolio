import { atomic, audit } from "./db.js";
import { admin, fail, text } from "./util.js";
export function migrateSettings(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS fund_settings(id INTEGER PRIMARY KEY CHECK(id=1),bank TEXT NOT NULL DEFAULT '',holder TEXT NOT NULL DEFAULT '',number TEXT NOT NULL DEFAULT '',qr TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 0); INSERT OR IGNORE INTO fund_settings(id) VALUES(1);`,
  );
}
function validateQR(qr) {
  if (typeof qr !== "string" || qr.length > 1_450_000) fail(400, "QR quá lớn.");
  if (!qr) return "";
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    qr,
  );
  if (!m) fail(400, "Ảnh QR phải là PNG, JPEG hoặc WebP.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 1048576) fail(400, "Ảnh QR tối đa 1 MB.");
  const valid =
    m[1] === "png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : m[1] === "jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) fail(400, "Nội dung ảnh QR không hợp lệ.");
  return qr;
}
export function settingsRoutes(c) {
  const { db, path, method, body, send, user } = c;
  if (path !== "/api/settings") return false;
  if (method === "GET") {
    send(200, db.prepare("SELECT * FROM fund_settings WHERE id=1").get());
    return true;
  }
  if (method === "PUT") {
    admin(c);
    const bank = text(body.bank, "Ngân hàng", 80),
      holder = text(body.holder, "Chủ tài khoản", 100),
      number = text(body.number, "Số tài khoản", 30);
    if (!/^\d{4,30}$/.test(number)) fail(400, "Số tài khoản không hợp lệ.");
    const result = atomic(db, () => {
      const old = db.prepare("SELECT * FROM fund_settings WHERE id=1").get();
      if (body.version !== old.version)
        fail(409, "Cấu hình đã thay đổi. Vui lòng tải lại.");
      const changed =
        old.bank !== bank || old.holder !== holder || old.number !== number;
      const qr =
        body.qr === undefined ? (changed ? "" : old.qr) : validateQR(body.qr);
      db.prepare(
        "UPDATE fund_settings SET bank=?,holder=?,number=?,qr=?,version=version+1 WHERE id=1",
      ).run(bank, holder, number, qr);
      audit(db, user, "settings_updated", "settings", 1, {
        bank,
        holder,
        number,
        qrChanged: qr !== old.qr,
      });
      return db.prepare("SELECT * FROM fund_settings WHERE id=1").get();
    });
    send(200, result);
    return true;
  }
  return false;
}

import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { atomic, audit } from "./db.js";
import { fail, text, profile } from "./util.js";
export const digest = (s) => createHash("sha256").update(s).digest("hex");
export function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    fail(400, "Mật khẩu phải dài 10–128 ký tự.");
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verify(password, hash) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [salt, key] = hash.split(":");
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(key, "hex"));
}
export function createUser(db, { email, name, code, role, password }) {
  email = text(email, "Email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(400, "Email không hợp lệ.");
  name = text(name, "Họ tên", 100);
  if (!["admin", "student"].includes(role)) fail(400, "Vai trò không hợp lệ.");
  code = code ? text(code, "Mã sinh viên", 30).toUpperCase() : null;
  if (role === "student" && !code) fail(400, "Cần mã sinh viên.");
  if (code && !/^[A-Z0-9_-]{3,30}$/.test(code))
    fail(400, "Mã sinh viên không hợp lệ.");
  if (
    db
      .prepare(
        "SELECT id FROM users WHERE email=? OR (code IS NOT NULL AND code=?)",
      )
      .get(email, code)
  )
    fail(409, "Email hoặc mã sinh viên đã tồn tại.");
  const result = db
    .prepare(
      "INSERT INTO users(email,name,code,role,password) VALUES(?,?,?,?,?)",
    )
    .run(email, name, code, role, passwordHash(password));
  return profile(
    db.prepare("SELECT * FROM users WHERE id=?").get(result.lastInsertRowid),
  );
}
const dummy = passwordHash("dummy-password-never-used");
export function authRoutes(ctx) {
  const { path, method, db, body, req, res, send, options } = ctx;
  if (path === "/api/login" && method === "POST") {
    const key = req.socket.remoteAddress;
    const now = Date.now();
    const attempts = ctx.attempts;
    let record = attempts.get(key);
    if (!record || record.until < now) {
      record = { count: 0, until: now + 15 * 60 * 1000 };
      attempts.set(key, record);
    }
    if (record.count >= 10)
      fail(429, "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.");
    record.count++;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    const valid = verify(body.password, user?.password || dummy);
    if (!valid || !user?.active) fail(401, "Email hoặc mật khẩu không đúng.");
    record.count = 0;
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    atomic(db, () => {
      db.prepare("DELETE FROM sessions WHERE expires<?").run(now);
      db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
        digest(token),
        user.id,
        csrf,
        now + options.sessionTTL,
      );
      audit(db, user, "login", "user", user.id);
    });
    send(
      200,
      { user: profile(user), csrf },
      {
        "Set-Cookie": `dq_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(options.sessionTTL / 1000)}${options.secureCookies ? "; Secure" : ""}`,
      },
    );
    return true;
  }
  if (path === "/api/me" && method === "GET") {
    send(200, { user: profile(ctx.user), csrf: ctx.session.csrf });
    return true;
  }
  if (path === "/api/logout" && method === "POST") {
    atomic(db, () => {
      db.prepare("DELETE FROM sessions WHERE token=?").run(ctx.session.token);
      audit(db, ctx.user, "logout", "user", ctx.user.id);
    });
    send(
      200,
      { ok: true },
      {
        "Set-Cookie": `dq_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${options.secureCookies ? "; Secure" : ""}`,
      },
    );
    return true;
  }
  return false;
}
export function authenticate(db, req) {
  const token = /\bdq_session=([a-f0-9]{64})\b/.exec(
    req.headers.cookie || "",
  )?.[1];
  if (!token) fail(401, "Vui lòng đăng nhập.");
  const session = db
    .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
    .get(digest(token), Date.now());
  if (!session) fail(401, "Phiên đăng nhập đã hết hạn.");
  const user = db
    .prepare("SELECT * FROM users WHERE id=? AND active=1")
    .get(session.user_id);
  if (!user) fail(401, "Tài khoản đã ngừng hoạt động.");
  return { session, user };
}

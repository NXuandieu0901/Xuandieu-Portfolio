import { atomic, audit } from "./db.js";
import { createUser, passwordHash } from "./auth.js";
import { admin, fail, text, amount, date, profile, id } from "./util.js";
export function migrateMembers(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS collection_periods(id INTEGER PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL CHECK(amount>0),due_date TEXT NOT NULL,locked INTEGER NOT NULL DEFAULT 0);`,
  );
}
export function memberRoutes(c) {
  const { path, method, body, db, send, user } = c;
  if (path === "/api/periods") {
    if (method === "GET") {
      send(
        200,
        db
          .prepare(
            "SELECT * FROM collection_periods ORDER BY due_date DESC,id DESC",
          )
          .all(),
      );
      return true;
    }
    if (method === "POST") {
      admin(c);
      const name = text(body.name, "Tên đợt thu", 100),
        code = text(body.code, "Mã đợt thu", 30).toUpperCase(),
        n = amount(body.amount),
        due = date(body.due_date);
      if (!/^[A-Z0-9_-]{2,30}$/.test(code))
        fail(400, "Mã đợt thu không hợp lệ.");
      if (
        db.prepare("SELECT id FROM collection_periods WHERE code=?").get(code)
      )
        fail(409, "Mã đợt thu đã tồn tại.");
      const result = atomic(db, () => {
        const r = db
          .prepare(
            "INSERT INTO collection_periods(name,code,amount,due_date) VALUES(?,?,?,?)",
          )
          .run(name, code, n, due);
        audit(db, user, "period_created", "period", r.lastInsertRowid, {
          name,
          code,
          amount: n,
          due_date: due,
        });
        return Number(r.lastInsertRowid);
      });
      send(201, { id: result });
      return true;
    }
  }
  if (path === "/api/members") {
    admin(c);
    if (method === "GET") {
      send(
        200,
        db
          .prepare(
            "SELECT id,email,name,code,role,active FROM users ORDER BY name,id",
          )
          .all(),
      );
      return true;
    }
    if (method === "POST") {
      const result = atomic(db, () => {
        const u = createUser(db, { ...body, role: "student" });
        audit(db, user, "member_created", "user", u.id, {
          name: u.name,
          code: u.code,
        });
        return u;
      });
      send(201, result);
      return true;
    }
  }
  const periodMatch = /^\/api\/periods\/(\d+)$/.exec(path);
  if (periodMatch && method === "PATCH") {
    admin(c);
    if (typeof body.locked !== "boolean")
      fail(400, "Trạng thái khóa không hợp lệ.");
    const result = atomic(db, () => {
      const p = db
        .prepare("SELECT * FROM collection_periods WHERE id=?")
        .get(Number(periodMatch[1]));
      if (!p) fail(404, "Không tìm thấy đợt thu.");
      const reason = text(body.reason, "Lý do", 500);
      db.prepare("UPDATE collection_periods SET locked=? WHERE id=?").run(
        Number(body.locked),
        p.id,
      );
      audit(
        db,
        user,
        body.locked ? "period_locked" : "period_unlocked",
        "period",
        p.id,
        { reason },
      );
      return { id: p.id, locked: Number(body.locked) };
    });
    send(200, result);
    return true;
  }
  const match = /^\/api\/members\/(\d+)$/.exec(path);
  if (match && method === "PATCH") {
    admin(c);
    const memberId = id(match[1]);
    const result = atomic(db, () => {
      const target = db
        .prepare("SELECT * FROM users WHERE id=? AND role='student'")
        .get(memberId);
      if (!target) fail(404, "Không tìm thấy sinh viên.");
      const name =
        body.name === undefined ? target.name : text(body.name, "Họ tên", 100);
      const email=body.email===undefined?target.email:text(body.email,"Email",200).toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,"Email không hợp lệ.");
      if(db.prepare("SELECT id FROM users WHERE email=? AND id<>?").get(email,memberId))fail(409,"Email đã được sử dụng.");
      let active = target.active;
      if (body.active !== undefined) {
        if (typeof body.active !== "boolean")
          fail(400, "Trạng thái không hợp lệ.");
        active = Number(body.active);
      }
      const password =
        body.password === undefined
          ? target.password
          : passwordHash(body.password);
      db.prepare("UPDATE users SET name=?,active=?,password=?,email=? WHERE id=?").run(
        name,
        active,
        password,
        email,
        memberId,
      );
      if (!active || body.password !== undefined || email!==target.email)
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(memberId);
      audit(db, user, "member_updated", "user", memberId, {
        name,
        active,
        passwordReset: body.password !== undefined,
        emailChanged: email!==target.email,
      });
      return profile(
        db.prepare("SELECT * FROM users WHERE id=?").get(memberId),
      );
    });
    send(200, result);
    return true;
  }
  return false;
}

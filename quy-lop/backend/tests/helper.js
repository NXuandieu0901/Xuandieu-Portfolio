import { createApp } from "../server/index.js";
import { createUser } from "../server/auth.js";
export async function fixture(t) {
  const app = createApp({ dbPath: ":memory:", secureCookies: false });
  const admin = createUser(app.db, {
    email: "admin@test.local",
    name: "Quản trị viên",
    role: "admin",
    password: "Test-password-123",
  });
  const student = createUser(app.db, {
    email: "sv@test.local",
    name: "Sinh viên Một",
    code: "K24001",
    role: "student",
    password: "Test-password-123",
  });
  const other = createUser(app.db, {
    email: "other@test.local",
    name: "Sinh viên Hai",
    code: "K24002",
    role: "student",
    password: "Test-password-123",
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.close());
  const base = "http://127.0.0.1:" + app.server.address().port;
  async function call(
    path,
    { method = "GET", body, cookie, csrf, headers = {} } = {},
  ) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
    return { status: res.status, data, headers: res.headers };
  }
  async function login(email = "admin@test.local") {
    const r = await call("/api/login", {
      method: "POST",
      body: { email, password: "Test-password-123" },
    });
    const cookie = r.headers.get("set-cookie").split(";")[0];
    const csrf = r.data.csrf;
    return {
      cookie,
      csrf,
      request: (path, method = "GET", body, key) =>
        call(path, {
          method,
          body,
          cookie,
          csrf,
          headers: key ? { "Idempotency-Key": key } : {},
        }),
    };
  }
  return { ...app, call, login, admin, student, other, base };
}

import { publicReport } from "./public-report.js";
import http from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openDatabase } from "./db.js";
import { authRoutes, authenticate } from "./auth.js";
import { json, AppError, fail } from "./util.js";
import { migrateFeatures, featureRoutes } from "./features.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
export function createApp({
  dbPath = resolve(root, "../data/dongquy.sqlite"),
  secureCookies = process.env.NODE_ENV === "production",
  sessionTTL = 8 * 3600 * 1000,
} = {}) {
  const db = openDatabase(dbPath);
  migrateFeatures(db);
  const attempts = new Map();
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname,
        method = req.method;
      if (!path.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(method))
          fail(405, "Phương thức không hỗ trợ.");
        const allowed = {
          "/": "index.html",
          "/index.html": "index.html",
          "/style.css": "style.css",
          "/app.js": "app.js",
        };
        const name = allowed[path];
        if (!name) fail(404, "Không tìm thấy.");
        const data = readFileSync(resolve(root, name));
        res.writeHead(200, {
          "Content-Type": {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
          }[extname(name)],
          "Cache-Control": "no-store",
        });
        res.end(method === "HEAD" ? undefined : data);
        return;
      }
      let body = {};
      if (!["GET", "HEAD"].includes(method)) {
        const origin = req.headers.origin;
        if (
          origin &&
          origin !== `${secureCookies ? "https" : "http"}://${req.headers.host}`
        )
          fail(403, "Nguồn yêu cầu không hợp lệ.");
        if (!(req.headers["content-type"] || "").startsWith("application/json"))
          fail(415, "Yêu cầu dữ liệu JSON.");
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) fail(413, "Dữ liệu quá lớn.");
          chunks.push(chunk);
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          fail(400, "JSON không hợp lệ.");
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          fail(400, "Dữ liệu không hợp lệ.");
      }
      const ctx = {
        req,
        res,
        db,
        url,
        path,
        method,
        body,
        attempts,
        options: { secureCookies, sessionTTL },
        send: (status, data, headers) => json(res, status, data, headers),
      };
      if (path === "/api/public-report" && method === "GET") {json(res,200,publicReport(db));return;}
      if (path !== "/api/login") {
        Object.assign(ctx, authenticate(db, req));
        if (
          !["GET", "HEAD"].includes(method) &&
          req.headers["x-csrf-token"] !== ctx.session.csrf
        )
          fail(403, "Mã bảo vệ phiên không hợp lệ.");
      }
      if (authRoutes(ctx) || featureRoutes(ctx)) return;
      fail(404, "Không tìm thấy API.");
    } catch (e) {
      if (!res.headersSent) {
        const known = e instanceof AppError;
        if (!known) console.error(e);
        json(res, known ? e.status : 500, {
          error: known ? e.message : "Không thể xử lý yêu cầu.",
        });
      } else res.end();
    }
  });
  return {
    server,
    db,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          db.close();
          resolve();
        });
        server.closeIdleConnections();
      }),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = createApp();
  app.server.listen(
    Number(process.env.PORT || 8080),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        "Đồng Quỹ: http://" +
          (process.env.HOST || "127.0.0.1") +
          ":" +
          (process.env.PORT || 8080),
      ),
  );
}

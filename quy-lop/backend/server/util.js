export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function fail(status, message) {
  throw new AppError(status, message);
}
export function text(value, label, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(400, label + " không hợp lệ.");
  return value.trim();
}
export function amount(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000_000_000_000)
    fail(400, "Số tiền phải là số nguyên dương, tối đa 1.000 tỷ đồng.");
  return value;
}
export function date(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(400, "Ngày không hợp lệ.");
  return value;
}
export function admin(ctx) {
  if (ctx.user.role !== "admin")
    fail(403, "Chỉ quản trị viên được thực hiện thao tác này.");
}
export function id(value) {
  if (!/^\d+$/.test(String(value))) fail(400, "Mã không hợp lệ.");
  return Number(value);
}
export function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(data));
}
export const profile = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  code: u.code,
  role: u.role,
  active: u.active,
});

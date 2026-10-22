import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole, CookieJar } from "jsdom";
import { randomUUID } from "node:crypto";
import { fixture } from "./helper.js";
const sleep = (n) => new Promise((r) => setTimeout(r, n));
async function until(fn, message) {
  const end = Date.now() + 7000;
  while (Date.now() < end) {
    if (fn()) return;
    await sleep(15);
  }
  throw new Error("Hết thời gian: " + message);
}
async function ui(t) {
  const f = await fixture(t),
    jar = new CookieJar(),
    errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (e) => errors.push(e.message));
  const dom = await JSDOM.fromURL(f.base, {
    resources: "usable",
    runScripts: "dangerously",
    cookieJar: jar,
    virtualConsole: console,
    beforeParse(w) {
      w.HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
      w.HTMLDialogElement.prototype.close = function () {
        this.open = false;
      };
      w.crypto.randomUUID = randomUUID;
      w.fetch = async (path, options = {}) => {
        const url = new URL(path, f.base).href,
          headers = {
            ...options.headers,
            Cookie: await jar.getCookieString(url),
          };
        const r = await fetch(url, { ...options, headers });
        for (const cookie of r.headers.getSetCookie())
          await jar.setCookie(cookie, url);
        return r;
      };
    },
  });
  t.after(() => dom.window.close());
  const $ = (s) => dom.window.document.querySelector(s);
  await until(() => $("#login").open, "hiển thị đăng nhập");
  async function login(email) {
    $("#login-email").value = email;
    $("#login-password").value = "Test-password-123";
    $("#loginForm button").click();
    await until(
      () =>
        !$("#login").open &&
        !dom.window.document.body.classList.contains("locked"),
      "đăng nhập",
    );
    await until(
      () =>
        $("#account b").textContent ===
        (email.startsWith("admin") ? "Quản trị viên" : "Sinh viên Một"),
      "hồ sơ",
    );
  }
  async function nav(page) {
    $(`nav [data-page="${page}"]`).click();
    await until(
      () =>
        $("#title").textContent ===
        (page === "Tổng quan" ? "Tổng quan quỹ chung" : page),
      "đổi trang",
    );
    await sleep(70);
  }
  function fill(form, data) {
    for (const [key, value] of Object.entries(data)) {
      const input = $(form + ' [name="' + key + '"]');
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
  }
  function submit(form) {
    $(form + " button.primary").click();
  }
  return { ...f, dom, $, errors, login, nav, fill, submit };
}
test("08 giao diện quản trị: thiết lập, đợt thu, thu, chi và nhật ký nối API thật", async (t) => {
  const f = await ui(t),
    { $, fill, submit } = f;
  await f.login("admin@test.local");
  await f.nav("Thiết lập");
  fill("#bank-form", { bank: "VCB", holder: "QUY CHUNG", number: "123456789" });
  submit("#bank-form");
  await until(
    () => $("#bank-status").textContent.includes("Đã lưu"),
    "lưu ngân hàng",
  );
  fill("#period-form", {
    name: "Quỹ tháng 10",
    code: "T10",
    amount: 100000,
    due_date: "2026-10-31",
  });
  submit("#period-form");
  await until(
    () => $("#period-list").textContent.includes("Quỹ tháng 10"),
    "tạo đợt",
  );
  await f.nav("Khoản thu");
  $("#add").click();
  fill("#entry", {
    member_id: f.student.id,
    amount: 2000000,
    title: "Thu quỹ kiểm thử",
    date: "2026-10-22",
    reference: "UI-IN",
    confirmed: true,
  });
  submit("#entry");
  await until(
    () =>
      !$("#editor").open && $("#rows").textContent.includes("Thu quỹ kiểm thử"),
    "ghi thu",
  );
  await f.nav("Khoản chi");
  await until(
    () => $("#workflow-title").textContent === "Đề nghị chi",
    "danh sách chi",
  );
  $("#add").click();
  fill("#request-form", {
    title: "Chi học tập",
    amount: 700000,
    member_id: f.student.id,
    evidence: "Hóa đơn HD-UI",
  });
  submit("#request-form");
  await until(
    () =>
      !$("#request-editor").open &&
      $("#workflow-rows").textContent.includes("Chi học tập"),
    "đề nghị chi",
  );
  let buttons = [...$("#workflow-rows").querySelectorAll("button")];
  buttons.find((b) => b.textContent === "Duyệt").click();
  submit("#operation-form");
  await until(
    () =>
      $("#workflow-rows").textContent.includes("Đã duyệt") &&
      !$("#operation-editor").open,
    "duyệt chi",
  );
  buttons = [...$("#workflow-rows").querySelectorAll("button")];
  buttons.find((b) => b.textContent === "Xác nhận đã chi").click();
  fill("#operation-form", {
    date: "2026-10-22",
    reference: "UI-PAY",
    confirmed: true,
  });
  submit("#operation-form");
  await until(
    () =>
      $("#workflow-rows").textContent.includes("Đã thanh toán") &&
      !$("#operation-editor").open,
    "thanh toán",
  );
  await f.nav("Tổng quan");
  await until(() => $("#balance").textContent.includes("1.300.000"), "số dư");
  await f.nav("Nhật ký");
  await until(
    () => $("#rows").textContent.includes("expense_paid"),
    "nhật ký chi",
  );
  assert.deepEqual(f.errors, []);
});
test("08 giao diện sinh viên: riêng tư, tài khoản nhận quỹ, đề nghị tạm ứng và đăng xuất", async (t) => {
  const f = await ui(t),
    { $, fill, submit } = f;
  const a = await f.login("sv@test.local");
  await until(
    () => $("#student-result").textContent.includes("K24001"),
    "tra cứu cá nhân",
  );
  assert.equal($("#settings-nav").hidden, true);
  assert.equal($("#members-nav").hidden, true);
  assert.equal($("#student-panel").hidden, false);
  assert.equal($("#add").hidden, true);
  $("#student-code").value = "K24002";
  $("#lookup button").click();
  await until(
    () => $("#student-result").textContent.includes("chỉ được tra cứu"),
    "chặn mã khác",
  );
  await f.nav("Tạm ứng");
  await until(
    () => $("#workflow-title").textContent.includes("tạm ứng"),
    "trang tạm ứng",
  );
  $("#add").click();
  fill("#request-form", {
    title: "Tạm ứng tổ chức lớp",
    amount: 300000,
    due_date: "2026-10-31",
  });
  submit("#request-form");
  await until(
    () =>
      !$("#request-editor").open &&
      $("#workflow-rows").textContent.includes("Tạm ứng tổ chức lớp"),
    "gửi tạm ứng",
  );
  assert.ok(
    ![...$("#workflow-rows").querySelectorAll("button")].some(
      (b) => b.textContent === "Duyệt",
    ),
  );
  $("#account").click();
  await until(() => $("#login").open, "đăng xuất");
  assert.ok(f.dom.window.document.body.classList.contains("locked"));
  assert.deepEqual(f.errors, []);
});
test("08 giao diện quyết toán: sinh viên nộp hồ sơ, quản trị xác nhận hoàn ứng", async (t) => {
  const f = await ui(t),
    { $, fill, submit } = f;
  const auth = await f.call("/api/login", {
    method: "POST",
    body: { email: "admin@test.local", password: "Test-password-123" },
  });
  const cookie = auth.headers.get("set-cookie").split(";")[0],
    csrf = auth.data.csrf;
  const admin = (path, body, key) =>
    f.call(path, {
      method: "POST",
      body,
      cookie,
      csrf,
      headers: { "Idempotency-Key": key },
    });
  await admin(
    "/api/income",
    {
      member_id: f.student.id,
      amount: 1000000,
      date: "2026-10-22",
      title: "Quỹ",
      reference: "UI-ADV-FUND",
      confirmed: true,
    },
    "fund",
  );
  await f.login("sv@test.local");
  await f.nav("Tạm ứng");
  $("#add").click();
  fill("#request-form", {
    title: "Tạm ứng kiểm thử",
    amount: 300000,
    due_date: "2026-10-31",
  });
  submit("#request-form");
  await until(
    () =>
      !$("#request-editor").open &&
      $("#workflow-rows").textContent.includes("Tạm ứng kiểm thử"),
    "gửi đề nghị",
  );
  const id = f.db.prepare("SELECT id FROM advances").get().id;
  await admin("/api/advances/" + id + "/approve", {}, "approve");
  await admin(
    "/api/advances/" + id + "/disburse",
    { date: "2026-10-22", reference: "UI-ADV", confirmed: true },
    "disburse",
  );
  await f.nav("Tạm ứng");
  await until(
    () => $("#workflow-rows").textContent.includes("Nộp quyết toán"),
    "đã giải ngân",
  );
  [...$("#workflow-rows").querySelectorAll("button")]
    .find((b) => b.textContent === "Nộp quyết toán")
    .click();
  fill("#operation-form", { actual: 200000, evidence: "Hóa đơn UI" });
  submit("#operation-form");
  await until(
    () =>
      !$("#operation-editor").open &&
      $("#workflow-rows").textContent.includes("Chờ duyệt quyết toán"),
    "nộp hồ sơ",
  );
  await admin("/api/advances/" + id + "/settle-approve", {}, "settle");
  $("#account").click();
  await until(() => $("#login").open, "đăng xuất sinh viên");
  await f.login("admin@test.local");
  await f.nav("Tạm ứng");
  await until(
    () => $("#workflow-rows").textContent.includes("Xác nhận nhận hoàn ứng"),
    "chờ hoàn ứng",
  );
  [...$("#workflow-rows").querySelectorAll("button")]
    .find((b) => b.textContent === "Xác nhận nhận hoàn ứng")
    .click();
  fill("#operation-form", {
    date: "2026-10-22",
    reference: "UI-REFUND",
    confirmed: true,
  });
  submit("#operation-form");
  await until(
    () =>
      !$("#operation-editor").open &&
      $("#workflow-rows").textContent.includes("Đã quyết toán"),
    "đóng hồ sơ",
  );
  await f.nav("Tổng quan");
  await until(
    () => $("#balance").textContent.includes("800.000"),
    "số dư sau quyết toán",
  );
  assert.deepEqual(f.errors, []);
});

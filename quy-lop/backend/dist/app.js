const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
const labels = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  paid: "Đã thanh toán",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
  disbursed: "Đã giải ngân",
  settlement_submitted: "Chờ duyệt quyết toán",
  settlement_returned: "Cần bổ sung hồ sơ",
  awaiting_payment: "Chờ chi bổ sung",
  awaiting_refund: "Chờ hoàn ứng",
  settlement_approved: "Đã duyệt quyết toán",
  closed: "Đã quyết toán",
};
const kinds = {
  income: "Thu quỹ",
  expense: "Chi quỹ",
  historical_refund: "Hoàn ứng lịch sử",
  advance_disburse: "Giải ngân tạm ứng",
  advance_refund: "Hoàn ứng",
  advance_extra: "Chi bổ sung",
  settlement: "Quyết toán",
  reversal: "Đảo phiếu",
};
let memberEditId = null;
let user = null,
  csrf = "",
  page = "Tổng quan",
  type = "all",
  settings = null,
  members = [],
  periods = [],
  transactions = [],
  nextCursor = null,
  auditRows = [],
  requestKind = "expense",
  requestKey = "",
  entryKey = "",
  memberKey = "",
  operation = null,
  revision = 0;
function element(tag, value, className) {
  const e = document.createElement(tag);
  if (value !== undefined) e.textContent = value;
  if (className) e.className = className;
  return e;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => ($("#toast").style.display = "none"),
    4500,
  );
}
function lock() {
  user = null;
  csrf = "";
  revision++;
  transactions = [];
  members = [];
  settings = null;
  $("#rows").replaceChildren();
  $("#student-result").replaceChildren();
  $("#workflow-rows").replaceChildren();
  $("#bank-form").reset();
  $("#member-form").reset();
  $("#fund-qr").removeAttribute("src");
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  document.body.classList.add("locked");
  $("#login-password").value = "";
  $("#login").showModal();
}
async function api(path, method = "GET", body, key) {
  const res = await fetch("/api" + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = "Không thể xử lý yêu cầu.";
    try {
      message = (await res.json()).error || message;
    } catch {}
    if (res.status === 401 && path !== "/login") lock();
    const e = new Error(message);
    e.status = res.status;
    throw e;
  }
  return res.headers.get("content-type")?.includes("application/json")
    ? res.json()
    : res;
}
async function action(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    toast(e.message);
  } finally {
    button.disabled = false;
  }
}
function query(cursor) {
  const q = new URLSearchParams();
  if ($("#period").value) q.set("month", $("#period").value);
  if (type !== "all") q.set("type", type);
  if ($("#search").value.trim()) q.set("q", $("#search").value.trim());
  if (cursor) q.set("cursor", cursor);
  return "?" + q;
}
function layout() {
  const admin = user.role === "admin";
  if (!admin && ["Thiết lập", "Thành viên", "Nhật ký"].includes(page))
    page = "Tổng quan";
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("#settings-nav").hidden = !admin;
  $("#members-nav").hidden = !admin;
  $("#audit-nav").hidden = !admin;
  $("#crumb").textContent = page;
  $("#title").textContent = page === "Tổng quan" ? "Tổng quan quỹ chung" : page;
  $("#subtitle").textContent =
    page === "Thiết lập"
      ? "Bổ sung tài khoản nhận quỹ và mã QR bất cứ lúc nào."
      : "Mọi khoản thu chi, rõ ràng trong một góc nhìn.";
  $("#account b").textContent = user.name;
  $("#account small").textContent =
    (admin ? "Quản trị viên" : "Sinh viên") + " · Đăng xuất";
  document.querySelectorAll("em").forEach(
    (e) =>
      (e.textContent = user.name
        .split(" ")
        .slice(-2)
        .map((n) => n[0])
        .join("")),
  );
  $("#bank-settings").hidden = !admin || page !== "Thiết lập";
  $("#period-settings").hidden = !admin || page !== "Thiết lập";
  $("#member-tools").hidden = !admin || page !== "Thành viên";
  $("#student-panel").hidden = admin || page !== "Tổng quan";
  $("#dashboard").hidden = !["Tổng quan", "Báo cáo"].includes(page);
  $("#workflow-panel").hidden = !["Khoản chi", "Tạm ứng"].includes(page);
  $(".transactions").hidden = ["Thiết lập", "Tạm ứng"].includes(page);
  $(".filters").hidden = ["Thành viên", "Nhật ký"].includes(page);
  $(".context").hidden = ["Thiết lập", "Thành viên", "Tạm ứng"].includes(page);
  $(".actions").hidden = ["Thiết lập", "Thành viên", "Nhật ký"].includes(page);
  $("#add").hidden =
    (!admin && !["Khoản chi", "Tạm ứng"].includes(page)) || page === "Báo cáo";
  $("#add").textContent =
    page === "Khoản chi"
      ? "＋ Đề nghị chi"
      : page === "Tạm ứng"
        ? "＋ Đề nghị tạm ứng"
        : "＋ Ghi nhận thu";
  $("#export").hidden = ["Tạm ứng"].includes(page);
  document
    .querySelectorAll("[data-type]")
    .forEach((b) => b.classList.toggle("selected", b.dataset.type === type));
}
async function refresh() {
  if (!user) return;
  layout();
  const version = ++revision;
  const currentPage = page;
  const periodQuery = $("#period").value ? "?month=" + $("#period").value : "";
  const [s, p, m, d] = await Promise.all([
    api("/settings"),
    api("/periods"),
    user.role === "admin" ? api("/members") : Promise.resolve([]),
    api("/dashboard" + periodQuery),
  ]);
  if (version !== revision || !user) return;
  settings = s;
  periods = p;
  members = m;
  renderSettings();
  renderPeriodOptions();
  renderDashboard(d);
  if (currentPage === "Thành viên") renderMembers();
  else if (currentPage === "Nhật ký") {
    const result = await api("/audit" + periodQuery);
    if (version !== revision) return;
    auditRows = result.rows;
    nextCursor = result.nextCursor;
    renderAudit();
  } else if (!["Thiết lập", "Tạm ứng"].includes(currentPage)) {
    const result = await api("/transactions" + query());
    if (version !== revision) return;
    transactions = result.rows;
    nextCursor = result.nextCursor;
    renderTransactions();
  }
  if (["Khoản chi", "Tạm ứng"].includes(currentPage)) {
    const rows = await api(
      currentPage === "Khoản chi" ? "/expenses" : "/advances",
    );
    if (version !== revision) return;
    renderWorkflows(rows, currentPage === "Tạm ứng");
  }
  if (user.role === "student" && currentPage === "Tổng quan") {
    if (!$("#student-code").value) $("#student-code").value = user.code;
    await lookupStudent();
  }
}
function renderSettings() {
  for (const key of ["bank", "holder", "number"])
    $("#bank-form [name=" + key + "]").value = settings[key];
  $("#fund-qr").hidden = !settings.qr;
  $("#qr-empty").hidden = !!settings.qr;
  if (settings.qr) $("#fund-qr").src = settings.qr;
  else $("#fund-qr").removeAttribute("src");
  $("#bank-details").textContent = settings.bank
    ? [settings.bank, settings.number, settings.holder].join(" · ")
    : "Quản trị viên chưa cấu hình tài khoản nhận quỹ.";
  $("#bank-config-state").textContent = settings.bank
    ? settings.qr
      ? "Đã có tài khoản và QR"
      : "Đã có tài khoản · Chưa có QR"
    : "Chưa thiết lập";
  $("#member-count").textContent = members.filter(
    (m) => m.role === "student",
  ).length;
}
function renderPeriodOptions() {
  const old = $("#entry-period").value;
  $("#people").replaceChildren();
  $("#request-form [name=member_id]").replaceChildren();
  members
    .filter((m) => m.active)
    .forEach((m) => {
      const label = m.name + (m.code ? " · " + m.code : "");
      $("#people").append(new Option(label, m.id));
      $("#request-form [name=member_id]").append(new Option(label, m.id));
    });
  $("#entry-period").replaceChildren(new Option("Không thuộc đợt thu", ""));
  periods.forEach((p) => $("#entry-period").append(new Option(p.name, p.id)));
  if (periods.some((p) => String(p.id) === old)) $("#entry-period").value = old;
  $("#period-list").replaceChildren();
  periods.forEach((p) => {
    const row = element(
      "div",
      p.name +
        " · " +
        p.code +
        " · " +
        money(p.amount) +
        (p.due_date ? " · Hạn " + p.due_date : " · Chưa cấu hình hạn đóng") +
        " · " +
        (p.locked ? "Đã khóa nhận thu" : "Đang nhận thu") +
        " ",
    );
    const b = element(
      "button",
      p.locked ? "Mở lại" : "Khóa nhận thu",
      "table-action",
    );
    b.onclick = () =>
      openOperation(
        "/periods/" + p.id,
        p.locked ? "Mở lại đợt thu" : "Khóa nhận thu",
        "period",
        p,
      );
    row.append(b);
    $("#period-list").append(row);
  });
  $(".fund small").textContent = periods[0]?.name || "Chưa có đợt thu";
}
function renderDashboard(d) {
  $("#income").textContent = money(d.income);
  $("#expense").textContent = money(d.expense);
  $("#balance").textContent = money(d.balance);
  $("#opening-label").textContent =
    "Đầu kỳ: " + money(d.opening) + " · Biến động: " + money(d.movement);
  $("#paid").textContent = d.paid + "/" + d.total;
  $("#dues-label").textContent = d.dues
    ? d.dues.name + " · " + money(d.dues.amount) + "/người"
    : "Chưa có đợt thu";
  $("#outstanding").textContent = money(d.outstanding);
  $("#reserved").textContent = money(d.current.reserved);
  $("#available").textContent = money(d.current.available);
  $("#donutTotal").textContent = money(d.gross_expense ?? d.expense);
  $("#categories").replaceChildren();
  const colors = ["#2a8067", "#9bc4ae", "#efc6a7", "#b6afcd", "#8ab0be"];
  const sum = d.groups.reduce((n, g) => n + g.amount, 0);
  let start = 0;
  const gradients = [];
  d.groups.forEach((g, i) => {
    const pct = sum ? (100 * g.amount) / sum : 0;
    gradients.push(
      colors[i % colors.length] + " " + start + "% " + (start + pct) + "%",
    );
    start += pct;
    const div = element("div"),
      s = element("span"),
      dot = element("i");
    dot.style.background = colors[i % colors.length];
    s.append(dot, document.createTextNode(g.category));
    div.append(s, element("b", Math.round(pct) + "%"));
    $("#categories").append(div);
  });
  $(".donut").style.background = gradients.length
    ? "conic-gradient(" + gradients.join(",") + ")"
    : "#edf1ee";
  $("#bars").replaceChildren();
  const months = d.months.slice(-12),
    max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  $(".yaxis").replaceChildren();
  [max, (max * 2) / 3, max / 3, 0].forEach((n) => {
    $(".yaxis").append(
      document.createTextNode(
        n >= 1e6 ? (n / 1e6).toFixed(1) + " tr" : Math.round(n / 1000) + " k",
      ),
      element("br"),
    );
  });
  if (!months.length)
    $("#bars").append(element("p", "Chưa có giao dịch trong kỳ."));
  months.forEach((m) => {
    const bar = element("div", undefined, "bar");
    for (const [key, label] of [
      ["income", "Thu"],
      ["expense", "Chi phí"],
    ]) {
      const b = element("i");
      b.style.height = (Math.max(0, m[key]) / max) * 100 + "%";
      b.title = m.month + " · " + label + ": " + money(m[key]);
      bar.append(b);
    }
    bar.append(element("small", m.month.slice(5) + "/" + m.month.slice(2, 4)));
    $("#bars").append(bar);
  });
}
function renderMembers() {
  $("#tabletitle").textContent = "Danh sách thành viên";
  $("thead").innerHTML =
    "<tr><th>HỌ TÊN</th><th>MÃ SINH VIÊN</th><th>EMAIL</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr>";
  $("#rows").replaceChildren();
  members.forEach((m) => {
    const tr = element("tr");
    [
      m.name,
      m.code || "—",
      m.email,
      m.active ? "Đang hoạt động" : "Ngừng hoạt động",
    ].forEach((v) => tr.append(element("td", v)));
    const cell = element("td");
    if (m.role === "student") {
      const b = element(
        "button",
        m.active ? "Ngừng hoạt động" : "Kích hoạt",
        "table-action",
      );
      b.onclick = () =>
        action(b, async () => {
          await api("/members/" + m.id, "PATCH", { active: !m.active });
          await refresh();
        });
      const lookup = element("button", "Đóng góp", "table-action");
      lookup.onclick = () =>
        action(lookup, async () => {
          const r = await api("/students/" + m.code);
          showDetail([
            ["Sinh viên", r.student.name],
            ["Mã", r.student.code],
            ["Tổng đã đóng", money(r.total)],
            ["Đợt thu", r.period?.name || "Chưa có"],
            ["Đã đóng đợt này", money(r.paid)],
            ["Còn thiếu", money(r.remaining)],
          ]);
        });
      const edit = element("button", "Chỉnh sửa", "table-action");
      edit.onclick = () => openMemberEditor(m);
      cell.append(lookup, edit, b);
    }
    tr.append(cell);
    $("#rows").append(tr);
  });
  $("#count").textContent = members.length + " thành viên";
  $("#more").hidden = true;
}
function renderTransactions() {
  $("#tabletitle").textContent =
    page === "Tổng quan"
      ? "Sổ giao dịch gần đây"
      : page === "Báo cáo"
        ? "Sổ giao dịch trong kỳ"
        : page;
  $("thead").innerHTML =
    "<tr><th>NỘI DUNG</th><th>NGƯỜI NỘP / NHẬN</th><th>NGÀY</th><th>TIỀN VÀO / RA</th><th>THAO TÁC</th></tr>";
  $("#rows").replaceChildren();
  transactions.forEach((t) => {
    const tr = element("tr"),
      first = element("td"),
      desc = element("div");
    desc.append(
      element("strong", t.title),
      element(
        "small",
        "#" + t.id + " · " + (kinds[t.kind] || t.kind) + " · " + t.category,
      ),
    );
    const icon = element(
      "span",
      t.cash_delta >= 0 ? "↙" : "↗",
      "arrow " + (t.cash_delta < 0 ? "out" : ""),
    );
    first.append(icon, desc);
    tr.append(first, element("td", t.person || "—"), element("td", t.date));
    const value =
      t.kind === "settlement"
        ? "Chi phí: " + money(t.cost_delta)
        : (t.cash_delta > 0 ? "+" : "") + money(t.cash_delta);
    tr.append(element("td", value, t.cash_delta >= 0 ? "green" : "orange"));
    const tools = element("td"),
      detail = element("button", "Chi tiết");
    detail.onclick = () =>
      action(detail, async () => {
        const r = await api("/transactions/" + t.id);
        showDetail([
          ["Mã phiếu", r.id],
          ["Loại", kinds[r.kind] || r.kind],
          ["Nội dung", r.title],
          ["Người nộp/nhận", r.person],
          ["Ngày", r.date],
          ["Tiền vào/ra", money(r.cash_delta)],
          ["Chi phí ghi nhận", money(r.cost_delta)],
          ["Tham chiếu", r.reference || "—"],
          ["Chứng từ/giải trình", r.evidence || "—"],
        ]);
      });
    tools.append(detail);
    if (user.role === "admin" && ["income", "expense"].includes(t.kind)) {
      const reverse = element("button", "Đảo phiếu");
      reverse.onclick = () =>
        openOperation(
          "/transactions/" + t.id + "/reverse",
          "Đảo phiếu #" + t.id,
          "reverse",
          t,
        );
      tools.append(reverse);
    }
    tr.append(tools);
    $("#rows").append(tr);
  });
  if (!transactions.length) {
    const tr = element("tr"),
      td = element("td", "Chưa có giao dịch phù hợp.");
    td.colSpan = 5;
    tr.append(td);
    $("#rows").append(tr);
  }
  $("#count").textContent = transactions.length + " giao dịch đã tải";
  $("#more").hidden = !nextCursor;
}
function showDetail(pairs) {
  $("#detail-content").replaceChildren();
  pairs.forEach(([label, value]) =>
    $("#detail-content").append(element("p", label + ": " + (value ?? "—"))),
  );
  $("#detail").showModal();
}
function renderAudit() {
  $("#tabletitle").textContent = "Nhật ký thao tác";
  $("thead").innerHTML =
    "<tr><th>HÀNH ĐỘNG</th><th>NGƯỜI THAO TÁC</th><th>THỜI GIAN</th><th>ĐỐI TƯỢNG</th><th>CHI TIẾT</th></tr>";
  $("#rows").replaceChildren();
  auditRows.forEach((r) => {
    const tr = element("tr");
    [
      r.action,
      r.actor_name || "Hệ thống",
      r.created_at,
      r.entity + " #" + r.entity_id,
    ].forEach((v) => tr.append(element("td", v)));
    const td = element("td"),
      b = element("button", "Xem");
    b.onclick = () =>
      showDetail([
        ["Hành động", r.action],
        ["Thời gian", r.created_at],
        ["Người thao tác", r.actor_name || "Hệ thống"],
        ["Dữ liệu", JSON.stringify(JSON.parse(r.detail), null, 2)],
      ]);
    td.append(b);
    tr.append(td);
    $("#rows").append(tr);
  });
  $("#count").textContent = auditRows.length + " sự kiện đã tải";
  $("#more").hidden = !nextCursor;
}
function renderWorkflows(rows, isAdvance) {
  $("#workflow-title").textContent = isAdvance
    ? "Hồ sơ tạm ứng và quyết toán"
    : "Đề nghị chi";
  $("#workflow-subtitle").textContent =
    user.role === "admin"
      ? "Duyệt, đối soát thanh toán và theo dõi hồ sơ."
      : "Các đề nghị của bạn và tình trạng xử lý.";
  $("#workflow-head").innerHTML =
    "<tr><th>HỒ SƠ</th><th>NGƯỜI ĐỀ NGHỊ</th><th>SỐ TIỀN</th><th>TRẠNG THÁI</th><th>XỬ LÝ</th></tr>";
  $("#workflow-rows").replaceChildren();
  rows.forEach((r) => {
    const tr = element("tr"),
      name = element("td");
    name.append(element("strong", "#" + r.id + " · " + r.title));
    if (isAdvance) {
      name.append(element("small", "Hạn quyết toán: " + r.due_date));
      if (
        r.due_date < today() &&
        !["closed", "rejected", "cancelled"].includes(r.status)
      )
        name.append(element("small", "Quá hạn", "overdue"));
      if (r.actual !== null)
        name.append(element("small", "Chi thực tế: " + money(r.actual)));
    }
    if (r.reason) name.append(element("small", "Lý do: " + r.reason));
    tr.append(
      name,
      element("td", r.owner_name),
      element("td", money(r.amount)),
      element("td", labels[r.status] || r.status),
    );
    const cell = element("td"),
      actions = element("div", undefined, "workflow-actions");
    const base = (isAdvance ? "/advances/" : "/expenses/") + r.id;
    const add = (label, act, mode) => {
      const b = element("button", label);
      b.onclick = () =>
        openOperation(base + "/" + act, label + " #" + r.id, mode, r);
      actions.append(b);
    };
    const admin = user.role === "admin";
    if (admin && r.status === "pending") {
      add("Duyệt", "approve", "simple");
      add("Từ chối", "reject", "reason");
    }
    if (admin && r.status === "approved") {
      add(
        isAdvance ? "Giải ngân" : "Xác nhận đã chi",
        isAdvance ? "disburse" : "pay",
        "payment",
      );
      add("Hủy", "cancel", "reason");
    }
    if (isAdvance && ["disbursed", "settlement_returned"].includes(r.status))
      add("Nộp quyết toán", "submit", "settlement");
    if (isAdvance && admin && r.status === "settlement_submitted") {
      add("Duyệt quyết toán", "settle-approve", "simple");
      add("Yêu cầu bổ sung", "return", "reason");
    }
    if (
      isAdvance &&
      admin &&
      ["awaiting_payment", "awaiting_refund", "settlement_approved"].includes(
        r.status,
      )
    )
      add(
        r.status === "awaiting_payment"
          ? "Xác nhận chi bổ sung"
          : r.status === "awaiting_refund"
            ? "Xác nhận nhận hoàn ứng"
            : "Hoàn tất quyết toán",
        "complete",
        r.status === "settlement_approved" ? "complete" : "payment",
      );
    const info = element("button", "Chi tiết");
    info.onclick = () =>
      showDetail([
        ["Nội dung", r.title],
        ["Số tiền", money(r.amount)],
        ["Trạng thái", labels[r.status]],
        ["Người đề nghị", r.owner_name],
        ["Chứng từ/giải trình", r.evidence || r.settlement_evidence || "—"],
        ["Lý do", r.reason || "—"],
      ]);
    actions.append(info);
    cell.append(actions);
    tr.append(cell);
    $("#workflow-rows").append(tr);
  });
  if (!rows.length) {
    const tr = element("tr"),
      td = element("td", "Chưa có đề nghị.");
    td.colSpan = 5;
    tr.append(td);
    $("#workflow-rows").append(tr);
  }
}
async function lookupStudent() {
  const code = $("#student-code").value.trim().toUpperCase();
  if (!code) return;
  const r = await api("/students/" + encodeURIComponent(code));
  if (!user) return;
  $("#student-result").replaceChildren(
    element("h3", r.student.name + " · " + r.student.code),
  );
  const stats = element("div", undefined, "personal-stats");
  [
    ["Tổng đã đóng mọi kỳ", r.total],
    ["Đã đóng đợt hiện tại", r.paid],
    ["Còn thiếu", r.remaining],
  ].forEach(([title, n]) => {
    const d = element("div");
    d.append(element("small", title), element("b", money(n)));
    stats.append(d);
  });
  $("#student-result").append(
    stats,
    element(
      "p",
      r.period
        ? r.period.name + (r.period.due_date ? " · Hạn " + r.period.due_date : " · Chưa cấu hình hạn đóng")
        : "Chưa có đợt thu",
    ),
  );
  const history = element("div", undefined, "personal-history");
  r.history.forEach((t) => {
    const d = element("div");
    d.append(
      element("span", t.date + " · " + t.title),
      element("b", money(t.amount)),
    );
    history.append(d);
  });
  if (!r.history.length)
    history.append(element("p", "Chưa có đóng góp được ghi nhận."));
  $("#student-result").append(history);
  $("#transfer-note").textContent =
    r.student.code + " " + (r.period?.code || "DONG QUY");
}
function openOperation(path, title, mode, row) {
  operation = { path, mode, row, key: crypto.randomUUID() };
  $("#operation-form").reset();
  $("#operation-title").textContent = title;
  $("#operation-help").textContent =
    mode === "payment"
      ? "Chỉ xác nhận khi đã đối soát tiền thực nhận hoặc thanh toán thành công."
      : mode === "reverse"
        ? "Phiếu gốc được giữ nguyên. Hệ thống tạo bút toán ngược chiều và lưu lý do."
        : "Kiểm tra hồ sơ trước khi xác nhận.";
  $("#operation-error").textContent = "";
  const show = {
    actual: mode === "settlement",
    evidence: mode === "settlement",
    category: mode === "settlement",
    reason: ["reason", "reverse", "period"].includes(mode),
    date: ["payment", "complete", "reverse"].includes(mode),
    reference: mode === "payment",
    confirm: mode === "payment",
  };
  for (const [name, visible] of Object.entries(show)) {
    const label = $("#op-" + name);
    label.hidden = !visible;
    const field = label.querySelector("input,textarea,select");
    if (field) field.required = visible && name !== "category";
  }
  $("#operation-form [name=date]").value = today();
  if (mode === "settlement")
    $("#operation-form [name=actual]").value = row.actual ?? row.amount;
  $("#operation-editor").showModal();
}
$("#operation-form").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    const d = Object.fromEntries(new FormData(e.target));
    d.confirmed = e.target.elements.confirmed.checked;
    if (operation.mode === "settlement") d.actual = Number(d.actual);
    try {
      if (operation.mode === "period") d.locked = !operation.row.locked;
      await api(
        operation.path,
        operation.mode === "period" ? "PATCH" : "POST",
        d,
        operation.key,
      );
      $("#operation-editor").close();
      await refresh();
      toast("Đã cập nhật hồ sơ.");
    } catch (error) {
      $("#operation-error").textContent = error.message;
      throw error;
    }
  });
};
$("#login").addEventListener("cancel", (e) => e.preventDefault());
$("#loginForm").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    try {
      const r = await api("/login", "POST", {
        email: $("#login-email").value,
        password: $("#login-password").value,
      });
      user = r.user;
      csrf = r.csrf;
      page = "Tổng quan";
      $("#student-code").value = user.code || "";
      $("#login-password").value = "";
      $("#login-error").textContent = "";
      $("#login").close();
      document.body.classList.remove("locked");
      await refresh();
    } catch (error) {
      $("#login-error").textContent = error.message;
      throw error;
    }
  });
};
$("#account").onclick = () =>
  action($("#account"), async () => {
    await api("/logout", "POST", {});
    lock();
  });
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => $("#" + b.dataset.close).close()));
$("#close").onclick = () => $("#editor").close();
document.querySelectorAll("nav button").forEach(
  (b) =>
    (b.onclick = () => {
      page = b.dataset.page;
      type = page === "Khoản thu" ? "in" : page === "Khoản chi" ? "out" : "all";
      refresh().catch((e) => toast(e.message));
    }),
);
document.querySelectorAll("[data-type]").forEach(
  (b) =>
    (b.onclick = () => {
      type = b.dataset.type;
      refresh().catch((e) => toast(e.message));
    }),
);
$("#period").onchange = () => refresh().catch((e) => toast(e.message));
$("#all-periods").onclick = () => {
  $("#period").value = "";
  refresh().catch((e) => toast(e.message));
};
let searchTimer;
$("#search").oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => refresh().catch((e) => toast(e.message)), 250);
};
$("#more").onclick = () =>
  action($("#more"), async () => {
    const r = revision;
    if (page === "Nhật ký") {
      const q = new URLSearchParams({ cursor: nextCursor });
      if ($("#period").value) q.set("month", $("#period").value);
      const result = await api("/audit?" + q);
      if (r !== revision) return;
      auditRows.push(...result.rows);
      nextCursor = result.nextCursor;
      renderAudit();
    } else {
      const result = await api("/transactions" + query(nextCursor));
      if (r !== revision) return;
      transactions.push(...result.rows);
      nextCursor = result.nextCursor;
      renderTransactions();
    }
  });
$("#add").onclick = () => {
  if (page === "Khoản chi" || page === "Tạm ứng") {
    requestKind = page === "Tạm ứng" ? "advance" : "expense";
    requestKey = crypto.randomUUID();
    $("#request-form").reset();
    $("#request-title").textContent =
      requestKind === "advance" ? "Đề nghị tạm ứng" : "Đề nghị chi";
    $("#request-recipient").hidden =
      requestKind === "advance" || user.role !== "admin";
    $("#request-due").hidden = requestKind !== "advance";
    $("#request-form [name=due_date]").required = requestKind === "advance";
    $("#request-evidence").hidden = requestKind === "advance";
    $("#request-form [name=evidence]").required = requestKind === "expense";
    $("#request-editor").showModal();
  } else {
    entryKey = crypto.randomUUID();
    $("#entry").reset();
    $("#entry [name=date]").value = today();
    if (periods.length) $("#entry-period").value = periods[0].id;
    $("#editor h2").textContent = "Ghi nhận thu quỹ";
    $("#editor").showModal();
  }
};
$("#entry").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    const d = Object.fromEntries(new FormData(e.target));
    d.amount = Number(d.amount);
    d.member_id = Number(d.member_id);
    d.period_id = d.period_id ? Number(d.period_id) : null;
    d.confirmed = e.target.elements.confirmed.checked;
    await api("/income", "POST", d, entryKey);
    $("#editor").close();
    await refresh();
    toast("Đã ghi nhận khoản thu.");
  });
};
$("#request-form").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    const d = Object.fromEntries(new FormData(e.target));
    d.amount = Number(d.amount);
    d.member_id = Number(d.member_id) || user.id;
    await api(
      requestKind === "advance" ? "/advances" : "/expenses",
      "POST",
      d,
      requestKey,
    );
    $("#request-editor").close();
    await refresh();
    toast("Đã gửi đề nghị.");
  });
};
$("#lookup").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    try {
      await lookupStudent();
    } catch (error) {
      $("#student-result").textContent = error.message;
      $("#transfer-note").textContent = "Mã sinh viên + mã đợt thu";
      throw error;
    }
  });
};
$("#bank-form").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    const data = new FormData(e.target),
      file = data.get("qr"),
      body = {
        bank: data.get("bank"),
        holder: data.get("holder"),
        number: data.get("number"),
        version: settings.version,
      };
    if (file?.size) {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 1048576
      )
        throw new Error("Chọn PNG, JPEG hoặc WebP tối đa 1 MB.");
      body.qr = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("Không đọc được ảnh."));
        r.readAsDataURL(file);
      });
    }
    settings = await api("/settings", "PUT", body);
    $("#bank-form [name=qr]").value = "";
    renderSettings();
    $("#bank-status").textContent = "Đã lưu cấu hình tại máy chủ.";
  });
};
function openMemberEditor(member) {
  memberEditId = member?.id || null;
  $("#member-form").reset();
  $("#member-editor h2").textContent = member
    ? "Chỉnh sửa sinh viên"
    : "Thêm sinh viên";
  for (const name of ["email", "code"]) {
    $("#member-form [name=" + name + "]").readOnly = !!member && name === "code";
    if (member) $("#member-form [name=" + name + "]").value = member[name];
  }
  $("#member-form [name=password]").required = !member;
  if (member) $("#member-form [name=name]").value = member.name;
  $("#member-editor").showModal();
}
$("#new-member").onclick = () => openMemberEditor(null);
$("#member-form").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    const d = Object.fromEntries(new FormData(e.target));
    if (memberEditId) {
      const body = { name: d.name, email: d.email };
      if (d.password) body.password = d.password;
      await api("/members/" + memberEditId, "PATCH", body);
    } else await api("/members", "POST", d);
    $("#member-editor").close();
    e.target.reset();
    await refresh();
    toast(
      memberEditId ? "Đã cập nhật sinh viên." : "Đã tạo tài khoản sinh viên.",
    );
  });
};
$("#period-form").onsubmit = (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    const d = Object.fromEntries(new FormData(e.target));
    d.amount = Number(d.amount);
    await api("/periods", "POST", d);
    e.target.reset();
    await refresh();
    toast("Đã tạo đợt thu.");
  });
};
$("#export").onclick = () =>
  action($("#export"), async () => {
    const res = await api("/export" + query());
    const blob = await res.blob(),
      url = URL.createObjectURL(blob),
      a = element("a");
    a.href = url;
    a.download = "dong-quy-bao-cao.csv";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
$("#bell").onclick = () =>
  action($("#bell"), async () => {
    const messages = await api("/notifications");
    showDetail(
      messages.length
        ? messages.map((m) => [
            m.type === "dues" ? "Đóng quỹ" : "Tạm ứng",
            m.message,
          ])
        : [["Thông báo", "Không có việc cần xử lý."]],
    );
  });
(async () => {
  try {
    const r = await api("/me");
    user = r.user;
    csrf = r.csrf;
    $("#student-code").value = user.code || "";
    document.body.classList.remove("locked");
    await refresh();
  } catch (e) {
    lock();
    if (e.status !== 401)
      $("#login-error").textContent =
        "Không kết nối được máy chủ. Hãy chạy npm start.";
  }
})();

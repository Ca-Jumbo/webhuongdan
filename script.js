"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const NAV_ITEMS = [
  { id: "home", label: "Trang chủ", icon: "fa-house" },
  { id: "categories", label: "Danh mục", icon: "fa-folder-open" },
  { id: "products", label: "Sản phẩm", icon: "fa-box" },
  { id: "documents", label: "Tài liệu", icon: "fa-file-lines" },
  { id: "notifications", label: "Thông báo", icon: "fa-bell" },
  { id: "profile", label: "Tài khoản", icon: "fa-user" },
  { id: "admin", label: "Quản trị", icon: "fa-lock" }
];

const STORAGE_KEYS = {
  logo: "nhs_logo",
  banner: "nhs_banner",
  quickNav: "nhs_quick_nav",
  logoSupabase: "nhs_logo_supabase",
  bannerSupabase: "nhs_banner_supabase",
  token: "nhs_token",
  user: "nhs_user"
};

let darkMode = false;
let selectedQuickNav = loadQuickNav();
let draggingNavId = null;
let quickNavBound = false;

const sampleData = {
  categories: [
    { id: 1, name: "Pin năng lượng mặt trời" },
    { id: 2, name: "Inverter" }
  ],
  products: [
    { id: 1, name: "Solar Panel 550W", status: "active", category: "Pin năng lượng mặt trời" },
    { id: 2, name: "Hybrid Inverter", status: "hidden", category: "Inverter" }
  ],
  manuals: [
    { id: 1, title: "Hướng dẫn lắp đặt", status: "approved", category: "Pin năng lượng mặt trời" },
    { id: 2, title: "Tài liệu kỹ thuật", status: "pending", category: "Inverter" }
  ],
  notifications: [
    { id: 1, text: "Chào mừng bạn đến với Nguyễn Hưng Solar" }
  ]
};

function loadQuickNav() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.quickNav);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr.slice(0, 4) : ["home", "products", "documents", "admin"];
  } catch {
    return ["home", "products", "documents", "admin"];
  }
}

function saveQuickNav() {
  localStorage.setItem(STORAGE_KEYS.quickNav, JSON.stringify(selectedQuickNav));
}

function showToast(msg) {
  const el = $(".toast");
  if (!el) return;
  const span = el.querySelector("span");
  if (span) span.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 1800);
}

function toggleDrawer(open) {
  document.body.classList.toggle("drawer-open", open);
}

function closeModal() {
  $("#modalBox")?.classList.remove("show");
  $("#modalOverlay")?.classList.remove("show");
}

function showPage(id) {
  $$(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(id);
  if (page) page.classList.add("active");
  document.body.classList.remove("drawer-open");
}

function openAdmin() {
  showPage("admin");
  renderChart();
  renderQuickNav();
}

function renderCategories() {
  const el = $("#categoryGrid");
  if (!el) return;
  el.innerHTML = sampleData.categories.map(i => `<div class="card"><h3>${escapeHtml(i.name)}</h3></div>`).join("");
}

function renderProducts() {
  const el = $("#productGrid");
  if (!el) return;

  const q = ($("#productSearch")?.value || "").trim().toLowerCase();
  const cat = $("#productCategoryFilter")?.value || "all";
  const status = $("#productStatusFilter")?.value || "all";

  const items = sampleData.products.filter(p => {
    const matchText = !q || String(p.name || "").toLowerCase().includes(q) || String(p.category || "").toLowerCase().includes(q);
    const matchCat = cat === "all" || String(p.category || "") === cat;
    const matchStatus = status === "all" || p.status === status;
    return matchText && matchCat && matchStatus;
  });

  el.innerHTML = items.map(i => `<div class="card"><h3>${escapeHtml(i.name)}</h3><p>${escapeHtml(i.category || "")}</p><p>${escapeHtml(i.status)}</p></div>`).join("");
}

function renderDocuments() {
  const el = $("#manualGrid");
  if (!el) return;

  const q = ($("#docSearch")?.value || "").trim().toLowerCase();
  const cat = $("#docFilter")?.value || "all";
  const status = $("#docStatusFilter")?.value || "all";

  const items = sampleData.manuals.filter(m => {
    const matchText = !q || String(m.title || "").toLowerCase().includes(q) || String(m.category || "").toLowerCase().includes(q);
    const matchCat = cat === "all" || String(m.category || "") === cat;
    const matchStatus = status === "all" || m.status === status;
    return matchText && matchCat && matchStatus;
  });

  el.innerHTML = items.map(i => `<div class="card"><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.category || "")}</p><p>${escapeHtml(i.status)}</p></div>`).join("");

  const empty = $("#emptyState");
  if (empty) empty.style.display = items.length ? "none" : "block";
}

function renderNotifications() {
  const el = $("#notificationList");
  if (!el) return;
  el.innerHTML = sampleData.notifications.map(i => `<div class="card"><h3>${escapeHtml(i.text)}</h3></div>`).join("");
}

function renderProfile() {
  const el = $("#profileBox");
  const user = getCurrentUser();

  if (el) {
    el.innerHTML = user
      ? `<strong>${escapeHtml(user.email || "Người dùng")}</strong><br><span>Vai trò: ${escapeHtml(user.role || "user")}</span>`
      : "Bạn chưa đăng nhập.";
  }

  const roleLabel = $("#userRoleLabel");
  if (roleLabel) roleLabel.textContent = user ? `Vai trò: ${user.role || "user"}` : "Khách truy cập";

  const logoutBtn = $("#logoutBtn");
  const loginBtn = $("#loginBtn");
  if (logoutBtn && loginBtn) {
    logoutBtn.style.display = user ? "inline-flex" : "none";
    loginBtn.style.display = user ? "none" : "inline-flex";
  }
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuthState(token, user) {
  if (token) localStorage.setItem(STORAGE_KEYS.token, token);
  if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  renderProfile();
}

function clearAuthState() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  renderProfile();
}

function exportSelectedData() {
  const target = $("#dataExportTarget")?.value || "all";
  const payload = target === "all" ? sampleData : { [target]: sampleData[target] || [] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nguyenhungsolar-${target}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Đã xuất dữ liệu.");
}

function handleImportJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.categories) sampleData.categories = data.categories;
      if (data.products) sampleData.products = data.products;
      if (data.manuals) sampleData.manuals = data.manuals;
      if (data.notifications) sampleData.notifications = data.notifications;
      fillFilters();
      renderAll();
      showToast("Đã nhập dữ liệu.");
    } catch {
      showToast("File JSON không hợp lệ.");
    }
  };
  reader.readAsText(file);
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderChart() {
  const canvas = $("#statsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 420;
  const cssHeight = canvas.clientHeight || 220;

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = cssWidth;
  const height = cssHeight;
  ctx.clearRect(0, 0, width, height);

  const values = [sampleData.categories.length, sampleData.products.length, sampleData.manuals.length, sampleData.notifications.length];
  const labels = ["Danh mục", "Sản phẩm", "Tài liệu", "Thông báo"];
  const colors = ["#2563eb", "#7c3aed", "#10b981", "#f59e0b"];
  const max = Math.max(...values, 1);

  const chartX = 22;
  const chartY = 22;
  const chartW = width - 44;
  const chartH = height - 56;
  const gap = 14;
  const barW = (chartW - gap * 3) / 4;
  const baseY = chartY + chartH;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#f8fbff");
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, 0, 0, width, height, 20);
  ctx.fill();

  ctx.strokeStyle = "rgba(15,23,42,.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = chartY + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(chartX, y);
    ctx.lineTo(chartX + chartW, y);
    ctx.stroke();
  }

  values.forEach((v, i) => {
    const x = chartX + i * (barW + gap);
    const barH = Math.max(18, (v / max) * (chartH - 18));
    const y = baseY - barH;
    ctx.shadowColor = "rgba(37,99,235,.18)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = colors[i];
    drawRoundedRect(ctx, x, y, barW, barH, 16);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 16px Inter";
    ctx.textAlign = "center";
    ctx.fillText(String(v), x + barW / 2, y - 10);

    ctx.fillStyle = "#334155";
    ctx.font = "600 13px Inter";
    ctx.fillText(labels[i], x + barW / 2, baseY + 18);
  });
}

function bindQuickNav() {
  if (quickNavBound) return;
  quickNavBound = true;

  const slots = $("#quickNavSlots");
  const pool = $("#quickNavPool");

  if (slots) {
    slots.addEventListener("dragover", e => e.preventDefault());
    slots.addEventListener("drop", e => {
      e.preventDefault();
      if (!draggingNavId) return;
      if (!selectedQuickNav.includes(draggingNavId)) {
        selectedQuickNav.push(draggingNavId);
        selectedQuickNav = selectedQuickNav.slice(0, 4);
        saveQuickNav();
        renderQuickNav();
      }
    });
  }

  if (pool) {
    pool.addEventListener("dragover", e => e.preventDefault());
    pool.addEventListener("drop", e => {
      e.preventDefault();
      if (!draggingNavId) return;
      selectedQuickNav = selectedQuickNav.filter(id => id !== draggingNavId);
      saveQuickNav();
      renderQuickNav();
    });
  }
}

function renderQuickNav() {
  const slots = $("#quickNavSlots");
  const pool = $("#quickNavPool");
  if (!slots || !pool) return;

  const selected = NAV_ITEMS.filter(i => selectedQuickNav.includes(i.id)).slice(0, 4);
  const unselected = NAV_ITEMS.filter(i => !selectedQuickNav.includes(i.id));

  slots.innerHTML = selected.length
    ? selected.map((item, idx) => `
      <div class="quick-nav-item" draggable="true" data-id="${item.id}" data-slot="${idx}">
        <span><i class="fa-solid ${item.icon}"></i> ${escapeHtml(item.label)}</span>
        <small>Slot ${idx + 1}</small>
      </div>
    `).join("")
    : `<div class="quick-nav-empty">Thả mục vào đây</div>`;

  pool.innerHTML = unselected.map(item => `
    <div class="quick-nav-item" draggable="true" data-id="${item.id}">
      <span><i class="fa-solid ${item.icon}"></i> ${escapeHtml(item.label)}</span>
      <small>Kéo lên trên</small>
    </div>
  `).join("");

  [...slots.querySelectorAll(".quick-nav-item"), ...pool.querySelectorAll(".quick-nav-item")].forEach(el => {
    el.addEventListener("dragstart", (e) => {
      draggingNavId = el.dataset.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggingNavId);
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => {
      draggingNavId = null;
      $$(".quick-nav-item").forEach(x => x.classList.remove("drag-over"));
      el.classList.remove("dragging");
    });
  });

  [...slots.querySelectorAll(".quick-nav-item")].forEach((el) => {
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      $$(".quick-nav-item").forEach(x => x.classList.remove("drag-over"));
      el.classList.add("drag-over");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!draggingNavId) return;
      moveQuickNavToIndex(draggingNavId, Number(el.dataset.slot));
    });
  });

  bindQuickNav();
}

function moveQuickNavToIndex(id, index) {
  const clean = selectedQuickNav.filter(x => x !== id);
  clean.splice(index, 0, id);
  selectedQuickNav = clean.slice(0, 4);
  saveQuickNav();
  renderQuickNav();
}

function dataUrlFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function applyLogo(dataUrl) {
  localStorage.setItem(STORAGE_KEYS.logo, dataUrl);
  const img = $("#siteLogo");
  const placeholder = $("#logoPlaceholder");
  const logoBox = $(".logo");
  if (img) {
    img.src = dataUrl;
    img.style.display = "block";
  }
  if (placeholder) placeholder.style.display = "none";
  if (logoBox) logoBox.classList.add("has-image");
}

async function applyBanner(dataUrl) {
  localStorage.setItem(STORAGE_KEYS.banner, dataUrl);
  const box = $("#bannerPreviewBox");
  if (box) {
    box.innerHTML = `<img src="${dataUrl}" alt="Banner">`;
    box.classList.add("has-image");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadToSupabaseStorage(file, bucket = "images") {
  const token = localStorage.getItem(STORAGE_KEYS.token) || "";
  if (!token) throw new Error("Chưa đăng nhập");

  const fileBase64 = await fileToBase64(file);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      fileName: file.name,
      fileBase64,
      mimeType: file.type || "application/octet-stream",
      bucket
    })
  });

  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Upload lỗi");
  return json.fileUrl;
}

async function handleLogoInput(file) {
  if (!file) return;
  const dataUrl = await dataUrlFromFile(file);
  await applyLogo(dataUrl);
  showToast("Đã lưu logo vào localStorage.");

  try {
    const url = await uploadToSupabaseStorage(file, "images");
    localStorage.setItem(STORAGE_KEYS.logoSupabase, url);
    showToast("Đã upload logo lên Supabase.");
  } catch {
    showToast("Upload Supabase chưa thành công.");
  }
}

async function handleBannerInput(file) {
  if (!file) return;
  const dataUrl = await dataUrlFromFile(file);
  await applyBanner(dataUrl);
  showToast("Đã lưu banner vào localStorage.");

  try {
    const url = await uploadToSupabaseStorage(file, "images");
    localStorage.setItem(STORAGE_KEYS.bannerSupabase, url);
    showToast("Đã upload banner lên Supabase.");
  } catch {
    showToast("Upload Supabase chưa thành công.");
  }
}

function restoreMediaFromStorage() {
  const logo = localStorage.getItem(STORAGE_KEYS.logo);
  const banner = localStorage.getItem(STORAGE_KEYS.banner);
  if (logo) applyLogo(logo);
  if (banner) applyBanner(banner);
}

function restoreMediaFromSupabase() {
  const logoUrl = localStorage.getItem(STORAGE_KEYS.logoSupabase);
  const bannerUrl = localStorage.getItem(STORAGE_KEYS.bannerSupabase);

  if (logoUrl) {
    const img = $("#siteLogo");
    const placeholder = $("#logoPlaceholder");
    const logoBox = $(".logo");
    if (img) {
      img.src = logoUrl;
      img.style.display = "block";
    }
    if (placeholder) placeholder.style.display = "none";
    if (logoBox) logoBox.classList.add("has-image");
  }

  if (bannerUrl) {
    const box = $("#bannerPreviewBox");
    if (box) {
      box.innerHTML = `<img src="${bannerUrl}" alt="Banner">`;
      box.classList.add("has-image");
    }
  }
}

function restoreMedia() {
  restoreMediaFromStorage();
  restoreMediaFromSupabase();
}

function clearLogo() {
  if (!confirm("Bạn có chắc muốn xóa logo không?")) return;
  localStorage.removeItem(STORAGE_KEYS.logo);
  localStorage.removeItem(STORAGE_KEYS.logoSupabase);

  const img = $("#siteLogo");
  const placeholder = $("#logoPlaceholder");
  const logoBox = $(".logo");
  const input = $("#logoInput");
  if (img) {
    img.removeAttribute("src");
    img.style.display = "none";
  }
  if (placeholder) placeholder.style.display = "flex";
  if (logoBox) logoBox.classList.remove("has-image");
  if ($("#logoPreviewBox")) $("#logoPreviewBox").textContent = "Logo trống";
  if (input) input.value = "";
  showToast("Đã xóa logo.");
}

function clearBanner() {
  if (!confirm("Bạn có chắc muốn xóa banner không?")) return;
  localStorage.removeItem(STORAGE_KEYS.banner);
  localStorage.removeItem(STORAGE_KEYS.bannerSupabase);

  const box = $("#bannerPreviewBox");
  const input = $("#bannerInput");
  if (box) {
    box.textContent = "Banner trống";
    box.classList.remove("has-image");
  }
  if (input) input.value = "";
  showToast("Đã xóa banner.");
}

function pickBrandLogo() { $("#logoInput")?.click(); }
function pickProductImage() { $("#bannerInput")?.click(); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function login(email, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Đăng nhập thất bại");
  setAuthState(json.token, json.user);
  return json;
}

function searchAll(keyword) {
  const q = (keyword || "").trim().toLowerCase();
  if (!q) return [];
  const results = [];

  sampleData.products.forEach(x => {
    if (String(x.name || "").toLowerCase().includes(q) || String(x.category || "").toLowerCase().includes(q)) {
      results.push({ type: "product", text: x.name });
    }
  });

  sampleData.manuals.forEach(x => {
    if (String(x.title || "").toLowerCase().includes(q) || String(x.category || "").toLowerCase().includes(q)) {
      results.push({ type: "manual", text: x.title });
    }
  });

  sampleData.categories.forEach(x => {
    if (String(x.name || "").toLowerCase().includes(q)) {
      results.push({ type: "category", text: x.name });
    }
  });

  return results.slice(0, 6);
}

function renderSuggestions(keyword) {
  const box = $("#searchSuggest");
  if (!box) return;
  const items = searchAll(keyword);

  if (!keyword.trim() || !items.length) {
    box.innerHTML = "";
    box.style.display = "none";
    return;
  }

  box.innerHTML = items.map(i => `<div class="suggest-item">${escapeHtml(i.text)}</div>`).join("");
  box.style.display = "block";
}

function fillFilters() {
  const productCategoryFilter = $("#productCategoryFilter");
  const docFilter = $("#docFilter");

  if (productCategoryFilter) {
    productCategoryFilter.innerHTML = `<option value="all">Tất cả danh mục</option>` +
      sampleData.categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  }

  if (docFilter) {
    docFilter.innerHTML = `<option value="all">Tất cả danh mục</option>` +
      sampleData.categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  }
}

function renderAll() {
  fillFilters();
  renderCategories();
  renderProducts();
  renderDocuments();
  renderNotifications();
  renderProfile();
  renderChart();
  renderQuickNav();
  restoreMedia();
}

function init() {
  $("#loading")?.remove();
  showPage("home");
  renderAll();

  $("#themeBtn")?.addEventListener("click", () => {
    darkMode = !darkMode;
    document.documentElement.classList.toggle("dark", darkMode);
  });

  $("#logoutBtn")?.addEventListener("click", () => {
    clearAuthState();
    showToast("Đã đăng xuất");
  });

  $("#heroSearchBtn")?.addEventListener("click", () => {
    const value = $("#heroSearch")?.value || $("#globalSearch")?.value || "";
    renderSuggestions(value);
    showPage("products");
    renderProducts();
  });

  $("#globalSearch")?.addEventListener("input", e => renderSuggestions(e.target.value));
  $("#productSearch")?.addEventListener("input", renderProducts);
  $("#productCategoryFilter")?.addEventListener("change", renderProducts);
  $("#productStatusFilter")?.addEventListener("change", renderProducts);
  $("#docSearch")?.addEventListener("input", renderDocuments);
  $("#docFilter")?.addEventListener("change", renderDocuments);
  $("#docStatusFilter")?.addEventListener("change", renderDocuments);

  $("#emailAuthForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#authEmail")?.value.trim() || "";
    const password = $("#authPassword")?.value || "";
    try {
      await login(email, password);
      showToast("Đăng nhập thành công.");
      showPage("home");
    } catch (err) {
      showToast(err.message || "Đăng nhập thất bại");
    }
  });

  $("#logoInput")?.addEventListener("change", e => handleLogoInput(e.target.files?.[0]));
  $("#bannerInput")?.addEventListener("change", e => handleBannerInput(e.target.files?.[0]));

  window.addEventListener("resize", () => {
    if ($("#admin")?.classList.contains("active")) renderChart();
  });

  renderProfile();
}

window.showPage = showPage;
window.openAdmin = openAdmin;
window.toggleDrawer = toggleDrawer;
window.closeModal = closeModal;
window.exportSelectedData = exportSelectedData;
window.handleImportJson = handleImportJson;
window.pickBrandLogo = pickBrandLogo;
window.pickProductImage = pickProductImage;
window.clearLogo = clearLogo;
window.clearBanner = clearBanner;

window.addEventListener("load", init);
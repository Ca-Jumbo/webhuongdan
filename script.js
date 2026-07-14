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

const state = { categories: [], products: [], manuals: [], notifications: [] };

const sampleData = {
  categories: [{ id: "1", name: "Pin năng lượng mặt trời" }, { id: "2", name: "Inverter" }],
  products: [
    { id: "1", name: "Solar Panel 550W", status: "active", category: "Pin năng lượng mặt trời" },
    { id: "2", name: "Hybrid Inverter", status: "hidden", category: "Inverter" }
  ],
  manuals: [
    { id: "1", title: "Hướng dẫn lắp đặt", status: "approved", category: "Pin năng lượng mặt trời" },
    { id: "2", title: "Tài liệu kỹ thuật", status: "pending", category: "Inverter" }
  ],
  notifications: [{ id: "1", text: "Chào mừng bạn đến với Nguyễn Hưng Solar" }]
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

function saveQuickNav() { localStorage.setItem(STORAGE_KEYS.quickNav, JSON.stringify(selectedQuickNav)); }
function userRole() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null")?.role || "guest"; } catch { return "guest"; } }
function isAdmin() { return ["super_admin", "admin", "editor"].includes(userRole()); }

function showToast(msg) {
  const el = $(".toast");
  if (!el) return;
  const span = el.querySelector("span");
  if (span) span.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 1800);
}

function toggleAccountMenu() {
  $("#accountMenu")?.classList.toggle("show");
}

function closeAccountMenu() {
  $("#accountMenu")?.classList.remove("show");
}

document.addEventListener("click", (e) => {
  const menu = $("#accountMenu");
  const btn = $("#accountMenuBtn");
  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) closeAccountMenu();
});

function closeModal() {
  $("#modalBox")?.classList.remove("show");
  $("#modalOverlay")?.classList.remove("show");
}

function setActiveSidebar(id) {
  const map = { home: 0, categories: 1, products: 2, documents: 3, notifications: 4, profile: 5, admin: 6 };
  $$(".menu-item").forEach(a => a.classList.remove("active"));
  $$(".menu-item")[map[id]]?.classList.add("active");
}

function showPage(id) {
  if (id === "admin" && !isAdmin()) { showToast("Chỉ tài khoản quản trị mới được truy cập."); showPage("home"); return; }
  $$(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(id);
  if (page) page.classList.add("active");
  setActiveSidebar(id);
  if (id === "admin") { refreshAdminAccess(); renderChart(); renderQuickNav(); renderAdminLists(); }
}

function goHome() { showPage("home"); }
function openAdmin() { showPage("admin"); }

function renderProfile() {
  const user = getCurrentUser();
  const el = $("#profileBox");
  if (el) el.innerHTML = user ? `<strong>${escapeHtml(user.email || "Người dùng")}</strong><br><span>Vai trò: ${escapeHtml(user.role || "user")}</span>` : "Bạn chưa đăng nhập.";
  const roleLabel = $("#userRoleLabel");
  if (roleLabel) roleLabel.textContent = user ? `Vai trò: ${user.role || "user"}` : "Khách truy cập";
  refreshAdminAccess();
  closeAccountMenu();
}

function refreshAdminAccess() {
  const adminAllowed = isAdmin();
  $$(".admin-only").forEach(el => el.style.display = adminAllowed ? "" : "none");
  const adminPage = $("#admin");
  if (adminPage) adminPage.style.display = adminAllowed || adminPage.classList.contains("active") ? "" : "none";
}

function getCurrentUser() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null"); } catch { return null; } }
function setAuthState(token, user) { if (token) localStorage.setItem(STORAGE_KEYS.token, token); if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user)); renderProfile(); }
function clearAuthState() { localStorage.removeItem(STORAGE_KEYS.token); localStorage.removeItem(STORAGE_KEYS.user); renderProfile(); }

async function loadRemoteData() {
  try {
    const [c, p, m, n] = await Promise.all([
      fetch("/api/categories").then(r => r.json()).catch(() => null),
      fetch("/api/products").then(r => r.json()).catch(() => null),
      fetch("/api/manuals").then(r => r.json()).catch(() => null),
      apiFetch("/api/notifications").catch(() => null)
    ]);
    state.categories = c?.success && Array.isArray(c.data) ? c.data : sampleData.categories;
    state.products = p?.success && Array.isArray(p.data) ? p.data : sampleData.products;
    state.manuals = m?.success && Array.isArray(m.data) ? m.data : sampleData.manuals;
    state.notifications = n?.success && Array.isArray(n.data) ? n.data : sampleData.notifications;
  } catch {
    state.categories = sampleData.categories;
    state.products = sampleData.products;
    state.manuals = sampleData.manuals;
    state.notifications = sampleData.notifications;
  }
}

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.token) || "";
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

function renderCategories() {
  const el = $("#categoryGrid");
  if (!el) return;
  const data = state.categories.length ? state.categories : sampleData.categories;
  el.innerHTML = data.map(i => `<div class="card"><h3>${escapeHtml(i.name || "")}</h3></div>`).join("");
}

function renderProducts() {
  const el = $("#productGrid");
  if (!el) return;
  const data = state.products.length ? state.products : sampleData.products;
  const q = ($("#productSearch")?.value || "").trim().toLowerCase();
  const cat = $("#productCategoryFilter")?.value || "all";
  const status = $("#productStatusFilter")?.value || "all";
  const items = data.filter(p => {
    const text = `${p.name || ""} ${p.category || ""}`.toLowerCase();
    return (!q || text.includes(q)) && (cat === "all" || String(p.category || p.categoryName || "") === cat) && (status === "all" || String(p.status || "") === status);
  });
  el.innerHTML = items.length ? items.map(i => `<div class="card"><h3>${escapeHtml(i.name || "")}</h3><p>${escapeHtml(i.category || i.categoryName || "")}</p><p>${escapeHtml(i.status || "")}</p></div>`).join("") : `<div class="empty-state">Không có sản phẩm phù hợp.</div>`;
}

function renderDocuments() {
  const el = $("#manualGrid");
  if (!el) return;
  const data = state.manuals.length ? state.manuals : sampleData.manuals;
  const q = ($("#docSearch")?.value || "").trim().toLowerCase();
  const cat = $("#docFilter")?.value || "all";
  const status = $("#docStatusFilter")?.value || "all";
  const items = data.filter(m => {
    const text = `${m.title || ""} ${m.category || ""}`.toLowerCase();
    return (!q || text.includes(q)) && (cat === "all" || String(m.category || m.categoryName || "") === cat) && (status === "all" || String(m.status || "") === status);
  });
  el.innerHTML = items.length ? items.map(i => `<div class="card"><h3>${escapeHtml(i.title || "")}</h3><p>${escapeHtml(i.category || i.categoryName || "")}</p><p>${escapeHtml(i.status || "")}</p></div>`).join("") : "";
  $("#emptyState") && ($("#emptyState").style.display = items.length ? "none" : "block");
}

function renderNotifications() {
  const el = $("#notificationList");
  if (!el) return;
  const items = state.notifications.length ? state.notifications : sampleData.notifications;
  el.innerHTML = items.map(i => `<div class="card"><h3>${escapeHtml(i.text || i.title || "")}</h3></div>`).join("");
}

function fillFilters() {
  const categories = state.categories.length ? state.categories : sampleData.categories;
  const opts = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  if ($("#productCategoryFilter")) $("#productCategoryFilter").innerHTML = opts;
  if ($("#docFilter")) $("#docFilter").innerHTML = opts;
  if ($("#productCategoryInput")) $("#productCategoryInput").innerHTML = categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  if ($("#manualCategoryInput")) $("#manualCategoryInput").innerHTML = categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
}

function renderAdminLists() {
  const categoryList = $("#adminCategoryList");
  const productList = $("#adminProductList");
  const manualList = $("#adminManualList");
  if (categoryList) categoryList.innerHTML = (state.categories || []).map(i => `<div class="admin-row"><div><strong>${escapeHtml(i.name || "")}</strong><br><small>ID: ${escapeHtml(i.id || "")}</small></div><div class="admin-row-actions"><button class="btn-danger" type="button" onclick="deleteCategory('${escapeHtml(i.id || "")}')">Xóa</button></div></div>`).join("");
  if (productList) productList.innerHTML = (state.products || []).map(i => `<div class="admin-row"><div><strong>${escapeHtml(i.name || "")}</strong><br><small>${escapeHtml(i.status || "")} • ${escapeHtml(i.category || i.categoryName || "")}</small></div><div class="admin-row-actions"><button class="btn-danger" type="button" onclick="deleteProduct('${escapeHtml(i.id || "")}')">Xóa</button></div></div>`).join("");
  if (manualList) manualList.innerHTML = (state.manuals || []).map(i => `<div class="admin-row"><div><strong>${escapeHtml(i.title || "")}</strong><br><small>${escapeHtml(i.status || "")} • ${escapeHtml(i.category || i.categoryName || "")}</small></div><div class="admin-row-actions"><button class="btn-secondary" type="button" onclick="approveManual('${escapeHtml(i.id || "")}')">Phê duyệt</button><button class="btn-danger" type="button" onclick="deleteManual('${escapeHtml(i.id || "")}')">Xóa</button></div></div>`).join("");
}

function exportSelectedData() {
  if (!isAdmin()) return showToast("Chỉ admin mới được xuất dữ liệu.");
  const target = $("#dataExportTarget")?.value || "all";
  const payload = target === "all" ? { categories: state.categories, products: state.products, manuals: state.manuals, notifications: state.notifications } : { [target]: state[target] || [] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nguyenhungsolar-${target}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Đã xuất dữ liệu.");
}

function handleImportJson(file) {
  if (!isAdmin()) return showToast("Chỉ admin mới được nhập dữ liệu.");
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.categories) state.categories = data.categories;
      if (data.products) state.products = data.products;
      if (data.manuals) state.manuals = data.manuals;
      if (data.notifications) state.notifications = data.notifications;
      fillFilters(); renderAll(); renderAdminLists();
      showToast("Đã nhập dữ liệu.");
    } catch { showToast("File JSON không hợp lệ."); }
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
  const width = canvas.clientWidth || 420;
  const height = canvas.clientHeight || 220;
  const values = [state.categories.length || 1, state.products.length || 1, state.manuals.length || 1, state.notifications.length || 1];
  const labels = ["Danh mục", "Sản phẩm", "Tài liệu", "Thông báo"];
  const colors = ["#2563eb", "#7c3aed", "#10b981", "#f59e0b"];
  const max = Math.max(...values, 1);
  canvas.width = width * (window.devicePixelRatio || 1);
  canvas.height = height * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const chartX = 22, chartY = 22, chartW = width - 44, chartH = height - 56, gap = 14, barW = (chartW - gap * 3) / 4, baseY = chartY + chartH;
  ctx.fillStyle = "#fff";
  drawRoundedRect(ctx, 0, 0, width, height, 20);
  ctx.fill();
  values.forEach((v, i) => {
    const x = chartX + i * (barW + gap);
    const barH = Math.max(18, (v / max) * (chartH - 18));
    const y = baseY - barH;
    ctx.fillStyle = colors[i];
    drawRoundedRect(ctx, x, y, barW, barH, 16);
    ctx.fill();
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
  const slots = $("#quickNavSlots"), pool = $("#quickNavPool");
  if (!slots || !pool) return;
  const selected = NAV_ITEMS.filter(i => selectedQuickNav.includes(i.id)).slice(0, 4);
  const unselected = NAV_ITEMS.filter(i => !selectedQuickNav.includes(i.id));
  slots.innerHTML = selected.length ? selected.map((item, idx) => `<div class="quick-nav-item" draggable="true" data-id="${item.id}" data-slot="${idx}"><span><i class="fa-solid ${item.icon}"></i> ${escapeHtml(item.label)}</span><small>Slot ${idx + 1}</small></div>`).join("") : `<div class="quick-nav-empty">Thả mục vào đây</div>`;
  pool.innerHTML = unselected.map(item => `<div class="quick-nav-item" draggable="true" data-id="${item.id}"><span><i class="fa-solid ${item.icon}"></i> ${escapeHtml(item.label)}</span><small>Kéo lên trên</small></div>`).join("");
  [...slots.querySelectorAll(".quick-nav-item"), ...pool.querySelectorAll(".quick-nav-item")].forEach(el => {
    el.addEventListener("dragstart", (e) => { draggingNavId = el.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", draggingNavId); el.classList.add("dragging"); });
    el.addEventListener("dragend", () => { draggingNavId = null; $$(".quick-nav-item").forEach(x => x.classList.remove("drag-over")); el.classList.remove("dragging"); });
  });
  [...slots.querySelectorAll(".quick-nav-item")].forEach(el => {
    el.addEventListener("dragover", (e) => { e.preventDefault(); $$(".quick-nav-item").forEach(x => x.classList.remove("drag-over")); el.classList.add("drag-over"); });
    el.addEventListener("drop", (e) => { e.preventDefault(); if (!draggingNavId) return; moveQuickNavToIndex(draggingNavId, Number(el.dataset.slot)); });
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
  const img = $("#siteLogo"), placeholder = $("#logoPlaceholder");
  if (img) { img.src = dataUrl; img.style.display = "block"; }
  if (placeholder) placeholder.style.display = "none";
  if ($("#logoPreviewBox")) $("#logoPreviewBox").innerHTML = `<img src="${dataUrl}" alt="Logo">`;
}

async function applyBanner(dataUrl) {
  localStorage.setItem(STORAGE_KEYS.banner, dataUrl);
  const box = $("#bannerPreviewBox"), hero = $("#heroBannerBox");
  if (box) box.innerHTML = `<img src="${dataUrl}" alt="Banner">`;
  if (hero) hero.innerHTML = `<img src="${dataUrl}" alt="Banner">`;
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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileName: file.name, fileBase64, mimeType: file.type || "application/octet-stream", bucket })
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Upload lỗi");
  return json.fileUrl;
}

async function handleLogoInput(file) {
  if (!isAdmin()) return showToast("Chỉ admin mới được thay đổi logo.");
  if (!file) return;
  const dataUrl = await dataUrlFromFile(file);
  await applyLogo(dataUrl);
  try { localStorage.setItem(STORAGE_KEYS.logoSupabase, await uploadToSupabaseStorage(file, "images")); } catch {}
  showToast("Đã cập nhật logo.");
}

async function handleBannerInput(file) {
  if (!isAdmin()) return showToast("Chỉ admin mới được thay đổi banner.");
  if (!file) return;
  const dataUrl = await dataUrlFromFile(file);
  await applyBanner(dataUrl);
  try { localStorage.setItem(STORAGE_KEYS.bannerSupabase, await uploadToSupabaseStorage(file, "images")); } catch {}
  showToast("Đã cập nhật banner.");
}

function restoreMedia() {
  const logo = localStorage.getItem(STORAGE_KEYS.logo);
  const banner = localStorage.getItem(STORAGE_KEYS.banner);
  const logoUrl = localStorage.getItem(STORAGE_KEYS.logoSupabase);
  const bannerUrl = localStorage.getItem(STORAGE_KEYS.bannerSupabase);
  const finalLogo = logoUrl || logo;
  const finalBanner = bannerUrl || banner;
  if (finalLogo) applyLogo(finalLogo);
  if (finalBanner) applyBanner(finalBanner);
}

function clearLogo() {
  if (!isAdmin()) return showToast("Chỉ admin mới được xóa logo.");
  if (!confirm("Bạn có chắc muốn xóa logo không?")) return;
  localStorage.removeItem(STORAGE_KEYS.logo);
  localStorage.removeItem(STORAGE_KEYS.logoSupabase);
  const img = $("#siteLogo"), placeholder = $("#logoPlaceholder");
  if (img) { img.removeAttribute("src"); img.style.display = "none"; }
  if (placeholder) placeholder.style.display = "flex";
  if ($("#logoPreviewBox")) $("#logoPreviewBox").textContent = "Logo trống";
  showToast("Đã xóa logo.");
}

function clearBanner() {
  if (!isAdmin()) return showToast("Chỉ admin mới được xóa banner.");
  if (!confirm("Bạn có chắc muốn xóa banner không?")) return;
  localStorage.removeItem(STORAGE_KEYS.banner);
  localStorage.removeItem(STORAGE_KEYS.bannerSupabase);
  if ($("#bannerPreviewBox")) $("#bannerPreviewBox").textContent = "Banner trống";
  if ($("#heroBannerBox")) $("#heroBannerBox").innerHTML = `<i class="fa-solid fa-panorama"></i><span>Vị trí banner</span>`;
  showToast("Đã xóa banner.");
}

function pickBrandLogo() { if (isAdmin()) $("#logoInput")?.click(); }
function pickProductImage() { if (isAdmin()) $("#bannerInput")?.click(); }
function escapeHtml(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

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
  [...state.products, ...sampleData.products].forEach(x => { if (String(x.name || "").toLowerCase().includes(q) || String(x.category || "").toLowerCase().includes(q)) results.push({ type: "product", text: x.name }); });
  [...state.manuals, ...sampleData.manuals].forEach(x => { if (String(x.title || "").toLowerCase().includes(q) || String(x.category || "").toLowerCase().includes(q)) results.push({ type: "manual", text: x.title }); });
  [...state.categories, ...sampleData.categories].forEach(x => { if (String(x.name || "").toLowerCase().includes(q)) results.push({ type: "category", text: x.name }); });
  return results.slice(0, 6);
}

function renderSuggestions(keyword) {
  const box = $("#searchSuggest");
  if (!box) return;
  const items = searchAll(keyword);
  if (!keyword.trim() || !items.length) { box.innerHTML = ""; box.style.display = "none"; return; }
  box.innerHTML = items.map(i => `<div class="suggest-item">${escapeHtml(i.text)}</div>`).join("");
  box.style.display = "block";
}

function normalizeCategoryName(item) { return item.name || item.category || item.categoryName || ""; }

async function addCategory() {
  if (!isAdmin()) return showToast("Không có quyền.");
  const name = $("#categoryNameInput")?.value.trim();
  if (!name) return showToast("Nhập tên danh mục.");
  try {
    const data = await apiFetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    state.categories.unshift(data.data);
    $("#categoryNameInput").value = "";
    fillFilters(); renderAll(); renderAdminLists();
    showToast("Đã thêm danh mục.");
  } catch (e) { showToast(e.message); }
}

async function deleteCategory(id) {
  if (!isAdmin()) return;
  if (!confirm("Xóa danh mục này?")) return;
  try {
    await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
    state.categories = state.categories.filter(x => String(x.id) !== String(id));
    fillFilters(); renderAll(); renderAdminLists();
    showToast("Đã xóa danh mục.");
  } catch (e) { showToast(e.message); }
}

async function addProduct() {
  if (!isAdmin()) return showToast("Không có quyền.");
  const name = $("#productNameInput")?.value.trim();
  const category = $("#productCategoryInput")?.value || "";
  const status = $("#productStatusInput")?.value || "active";
  if (!name) return showToast("Nhập tên sản phẩm.");
  state.products.unshift({ id: String(Date.now()), name, category, status });
  $("#productNameInput").value = "";
  renderAll(); renderAdminLists();
  showToast("Đã thêm sản phẩm.");
}

async function deleteProduct(id) {
  if (!isAdmin()) return;
  if (!confirm("Xóa sản phẩm này?")) return;
  state.products = state.products.filter(x => String(x.id) !== String(id));
  renderAll(); renderAdminLists();
  showToast("Đã xóa sản phẩm.");
}

async function addManual() {
  if (!isAdmin()) return showToast("Không có quyền.");
  const title = $("#manualTitleInput")?.value.trim();
  const category = $("#manualCategoryInput")?.value || "";
  const status = $("#manualStatusInput")?.value || "pending";
  if (!title) return showToast("Nhập tên tài liệu.");
  state.manuals.unshift({ id: String(Date.now()), title, category, status });
  $("#manualTitleInput").value = "";
  renderAll(); renderAdminLists();
  showToast("Đã thêm tài liệu.");
}

async function approveManual(id) {
  if (!isAdmin()) return;
  const item = state.manuals.find(x => String(x.id) === String(id));
  if (!item) return;
  item.status = "approved";
  renderAll(); renderAdminLists();
  showToast("Đã phê duyệt tài liệu.");
}

async function deleteManual(id) {
  if (!isAdmin()) return;
  if (!confirm("Xóa tài liệu này?")) return;
  state.manuals = state.manuals.filter(x => String(x.id) !== String(id));
  renderAll(); renderAdminLists();
  showToast("Đã xóa tài liệu.");
}

function fillFilters() {
  const categories = state.categories.length ? state.categories : sampleData.categories;
  const opts = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  if ($("#productCategoryFilter")) $("#productCategoryFilter").innerHTML = opts;
  if ($("#docFilter")) $("#docFilter").innerHTML = opts;
  if ($("#productCategoryInput")) $("#productCategoryInput").innerHTML = categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  if ($("#manualCategoryInput")) $("#manualCategoryInput").innerHTML = categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
}

async function renderAll() {
  fillFilters();
  renderCategories();
  renderProducts();
  renderDocuments();
  renderNotifications();
  renderProfile();
  renderChart();
  renderQuickNav();
  renderAdminLists();
  restoreMedia();
}

function bindEvents() {
  $("#themeBtn")?.addEventListener("click", () => { darkMode = !darkMode; document.documentElement.classList.toggle("dark", darkMode); });
  $("#logoutBtn")?.addEventListener("click", () => { clearAuthState(); showToast("Đã đăng xuất"); });
  $("#heroSearchBtn")?.addEventListener("click", () => { const value = $("#heroSearch")?.value || $("#globalSearch")?.value || ""; renderSuggestions(value); showPage("products"); renderProducts(); });
  $("#globalSearch")?.addEventListener("input", e => renderSuggestions(e.target.value));
  $("#productSearch")?.addEventListener("input", renderProducts);
  $("#productCategoryFilter")?.addEventListener("change", renderProducts);
  $("#productStatusFilter")?.addEventListener("change", renderProducts);
  $("#docSearch")?.addEventListener("input", renderDocuments);
  $("#docFilter")?.addEventListener("change", renderDocuments);
  $("#docStatusFilter")?.addEventListener("change", renderDocuments);
  $("#emailAuthForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    try { await login($("#authEmail")?.value.trim() || "", $("#authPassword")?.value || ""); showToast("Đăng nhập thành công."); showPage("home"); } catch (err) { showToast(err.message || "Đăng nhập thất bại"); }
  });
  $("#logoInput")?.addEventListener("change", e => handleLogoInput(e.target.files?.[0]));
  $("#bannerInput")?.addEventListener("change", e => handleBannerInput(e.target.files?.[0]));
  window.addEventListener("resize", () => { if ($("#admin")?.classList.contains("active")) renderChart(); });
}

async function init() {
  $("#loading")?.remove();
  bindQuickNav();
  bindEvents();
  await loadRemoteData();
  showPage("home");
  await renderAll();
  renderProfile();
  refreshAdminAccess();
}

window.showPage = showPage;
window.openAdmin = openAdmin;
window.closeModal = closeModal;
window.exportSelectedData = exportSelectedData;
window.handleImportJson = handleImportJson;
window.pickBrandLogo = pickBrandLogo;
window.pickProductImage = pickProductImage;
window.clearLogo = clearLogo;
window.clearBanner = clearBanner;
window.goHome = goHome;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.addProduct = addProduct;
window.deleteProduct = deleteProduct;
window.addManual = addManual;
window.deleteManual = deleteManual;
window.approveManual = approveManual;
window.toggleAccountMenu = toggleAccountMenu;

window.addEventListener("load", init);
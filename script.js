"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const STORAGE_KEYS = { user: "manual_user", theme: "manual_theme", token: "manual_token" };

const ROADMAP = {
    phase: 4,
    current: "Giai đoạn 4",
    currentText: "Hoàn thiện trải nghiệm: profile, detail pages, UX polish, bookmarks, ratings, logs.",
    next: ["Hoàn thiện SEO / metadata", "Tối ưu quyền truy cập", "Bổ sung analytics nâng cao"]
};

let state = {
    currentPage: localStorage.getItem("page") || "home",
    theme: localStorage.getItem(STORAGE_KEYS.theme) === "true",
    user: JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null"),
    token: localStorage.getItem(STORAGE_KEYS.token) || "",
    search: "",
    slugRoute: new URLSearchParams(location.search).get("slug") || ""
};

let categories = [], products = [], brands = [], manuals = [], notifications = [], bookmarks = [], ratings = [], attachments = [], activityLogs = [], downloadLogs = [], usersCount = 0;
let modalContext = null;

function authHeaders() { return state.token ? { Authorization: `Bearer ${state.token}` } : {}; }

function apiFetch(path, options = {}) {
    return fetch(path, {
        headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
        ...options
    }).then(async res => {
        let data;
        try { data = await res.json(); } catch { return { success: false, message: "Phản hồi server không hợp lệ." }; }
        if (!res.ok) return { success: false, message: data?.message || `HTTP ${res.status}`, data };
        return data;
    });
}

function showToast(message) {
    const toast = $(".toast");
    if (!toast) return;
    toast.querySelector("span").textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function isAdmin() { return ["super_admin", "admin", "editor"].includes(state.user?.role); }
function isLoggedIn() { return !!state.user; }

function slugify(v) {
    return (v || "")
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function saveAuth(payload) {
    state.user = payload?.user || null;
    state.token = payload?.token || "";
    if (state.user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user)); else localStorage.removeItem(STORAGE_KEYS.user);
    if (state.token) localStorage.setItem(STORAGE_KEYS.token, state.token); else localStorage.removeItem(STORAGE_KEYS.token);
    updateAuthUI();
    renderProfile();
}

function applyTheme() {
    document.documentElement.classList.toggle("dark", state.theme);
    localStorage.setItem(STORAGE_KEYS.theme, String(state.theme));
    const btn = $("#themeBtn");
    if (btn) btn.innerHTML = state.theme ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

function updateAuthUI() {
    const loginBtn = $("#loginBtn"), logoutBtn = $("#logoutBtn"), roleLabel = $("#userRoleLabel");
    if (!loginBtn || !logoutBtn || !roleLabel) return;
    if (state.user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-flex";
        roleLabel.textContent = isAdmin() ? "Quản trị viên" : "Khách đã đăng nhập";
    } else {
        loginBtn.style.display = "inline-flex";
        logoutBtn.style.display = "none";
        roleLabel.textContent = "Khách truy cập";
    }
}

function setMeta(title, description) {
    document.title = title || "Manual Center";
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
        desc = document.createElement("meta");
        desc.name = "description";
        document.head.appendChild(desc);
    }
    desc.content = description || "Manual Center";
}

function updateSeoByPage(pageId) {
    if (pageId === "home") setMeta("Manual Center | Trang chủ", "Kho tài liệu và sản phẩm doanh nghiệp.");
    if (pageId === "categories") setMeta("Manual Center | Danh mục", "Xem danh mục sản phẩm trên Manual Center.");
    if (pageId === "products") setMeta("Manual Center | Sản phẩm", "Danh sách sản phẩm và tài liệu liên quan.");
    if (pageId === "documents") setMeta("Manual Center | Tài liệu", "Trung tâm tài liệu và tải xuống.");
    if (pageId === "admin") setMeta("Manual Center | Quản trị", "Trang quản trị Manual Center.");
}

function showPage(pageId) {
    if (pageId === "admin" && !isAdmin()) {
        showToast("Chỉ admin mới được truy cập.");
        pageId = "login";
    }
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    const page = $("#" + pageId);
    if (!page) return;
    page.classList.add("active");
    state.currentPage = pageId;
    localStorage.setItem("page", pageId);
    if (pageId === "notifications") markAllNotificationsRead();
    updateSeoByPage(pageId);
    renderPage(pageId);
}

function renderPage(pageId) {
    if (pageId === "home") renderHome();
    if (pageId === "categories") renderCategories();
    if (pageId === "products") renderProducts();
    if (pageId === "documents") renderDocuments();
    if (pageId === "notifications") renderNotifications();
    if (pageId === "profile") renderProfile();
    if (pageId === "admin") renderAdmin();
}

function normalizeText(v) { return (v || "").toString().toLowerCase(); }

async function loadData() {
    const [catRes, prodRes, brandRes, manRes, notiRes, bmRes, ratingRes, attRes, logRes, dlogRes, usersRes] = await Promise.all([
        apiFetch("/api/categories"), apiFetch("/api/products"), apiFetch("/api/brands"), apiFetch("/api/manuals"),
        apiFetch("/api/notifications"), apiFetch("/api/bookmarks"), apiFetch("/api/ratings"), apiFetch("/api/attachments"),
        apiFetch("/api/activity-logs"), apiFetch("/api/download-logs"), apiFetch("/api/users-count")
    ]);
    if (catRes?.success) categories = catRes.data || [];
    if (prodRes?.success) products = prodRes.data || [];
    if (brandRes?.success) brands = brandRes.data || [];
    if (manRes?.success) manuals = manRes.data || [];
    if (notiRes?.success) notifications = notiRes.data || [];
    if (bmRes?.success) bookmarks = bmRes.data || [];
    if (ratingRes?.success) ratings = ratingRes.data || [];
    if (attRes?.success) attachments = attRes.data || [];
    if (logRes?.success) activityLogs = logRes.data || [];
    if (dlogRes?.success) downloadLogs = dlogRes.data || [];
    if (usersRes?.success) usersCount = usersRes.count || 0;
}

const getCategoryName = id => categories.find(c => String(c.id) === String(id))?.name || "Danh mục";
const getBrandName = id => brands.find(b => String(b.id) === String(id))?.name || "Thương hiệu";
const getProductName = id => products.find(p => String(p.id) === String(id))?.name || "";
const getCategorySlug = id => categories.find(c => String(c.id) === String(id))?.slug || slugify(getCategoryName(id));
const getBrandSlug = id => brands.find(b => String(b.id) === String(id))?.slug || slugify(getBrandName(id));
const getProductSlug = id => products.find(p => String(p.id) === String(id))?.slug || slugify(getProductName(id));
const getManualSlug = id => manuals.find(m => String(m.id) === String(id))?.slug || slugify(manuals.find(m => String(m.id) === String(id))?.title || "");
const getManualRating = id => {
    const items = ratings.filter(r => String(r.manualId) === String(id));
    return items.length ? (items.reduce((s, r) => s + (Number(r.value) || 0), 0) / items.length).toFixed(1) : "0.0";
};

function renderSearchSuggest() {
    const box = $("#searchSuggest");
    if (!box) return;
    const q = normalizeText($("#globalSearch")?.value || "");
    if (!q) { box.style.display = "none"; box.innerHTML = ""; return; }
    const items = [
        ...categories.filter(c => normalizeText(`${c.name} ${c.icon} ${c.slug}`).includes(q)).slice(0, 4).map(c => ({ type: "category", id: c.id, label: c.name })),
        ...products.filter(p => normalizeText(`${p.name} ${getBrandName(p.brandId)} ${p.description} ${p.slug}`).includes(q)).slice(0, 4).map(p => ({ type: "product", id: p.id, label: p.name })),
        ...manuals.filter(m => normalizeText(`${m.title} ${m.description} ${m.fileType} ${m.slug}`).includes(q)).slice(0, 4).map(m => ({ type: "manual", id: m.id, label: m.title }))
    ];
    box.innerHTML = items.length ? items.map(item => `<div class="suggest-item" data-type="${item.type}" data-id="${item.id}">${item.label} <span>${item.type}</span></div>`).join("") : `<div class="suggest-item" data-type="none" data-id="">Không có kết quả</div>`;
    box.style.display = "block";
}

function renderHome() {
    $("#statProducts").textContent = products.length;
    $("#statManuals").textContent = manuals.length;
    $("#statCategories").textContent = categories.length;
    $("#statNotifications").textContent = notifications.filter(n => !n.seen).length;
    $("#homeProducts").innerHTML = products.slice(0, 6).map(p => `<div class="card clickable" onclick="openProductBySlug('${getProductSlug(p.id)}')"><h3>${p.name}</h3><p>${getBrandName(p.brandId)} · ${getCategoryName(p.categoryId)}</p></div>`).join("") || `<div class="empty-state">Không có sản phẩm.</div>`;
    $("#homeManuals").innerHTML = manuals.slice(0, 6).map(m => `<div class="card clickable" onclick="openManualBySlug('${getManualSlug(m.id)}')"><h3>${m.title}</h3><p>${m.status}</p><div class="manual-info"><span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span><span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span></div></div>`).join("") || `<div class="empty-state">Không có tài liệu.</div>`;
}

function renderCategories() {
    $("#categoryGrid").innerHTML = categories.map(c => `<div class="card clickable" onclick="filterByCategory('${c.id}')"><h3>${c.name}</h3><p><i class="${c.icon || "fa-solid fa-folder"}"></i></p><div class="manual-info"><span class="badge">${c.slug || slugify(c.name)}</span></div></div>`).join("") || `<div class="empty-state">Không có danh mục.</div>`;
}
function filterByCategory(categoryId) { $("#productCategoryFilter").value = categoryId; showPage("products"); renderProducts(); }

function renderProducts() {
    const q = normalizeText($("#productSearch")?.value || "");
    const category = $("#productCategoryFilter")?.value || "all";
    const status = $("#productStatusFilter")?.value || "all";
    const filtered = products.filter(p => {
        const text = normalizeText(`${p.name} ${getBrandName(p.brandId)} ${p.description} ${p.slug}`);
        return (!q || text.includes(q)) && (category === "all" || String(p.categoryId || "") === category) && (status === "all" || p.status === status);
    });
    $("#productGrid").innerHTML = filtered.map(p => `<div class="card clickable" onclick="openProductBySlug('${getProductSlug(p.id)}')"><h3>${p.name}</h3><p>${getBrandName(p.brandId)}</p><p>${getCategoryName(p.categoryId)}</p><div class="manual-info"><span class="badge"><i class="fa-regular fa-file-lines"></i> ${manuals.filter(m => String(m.productId) === String(p.id)).length} tài liệu</span><span class="badge">${getProductSlug(p.id)}</span></div></div>`).join("") || `<div class="empty-state">Không có sản phẩm phù hợp.</div>`;
}

function renderProductDetail(productId) {
    const p = products.find(item => String(item.id) === String(productId));
    if (!p) return;
    setMeta(`${p.name} | Manual Center`, p.description || "Chi tiết sản phẩm Manual Center.");
    $("#productDetailBrand").textContent = getBrandName(p.brandId) || "Thương hiệu";
    $("#productDetailName").textContent = p.name || "";
    $("#productDetailDesc").textContent = p.description || "";
    const related = manuals.filter(m => String(m.productId || "") === String(productId));
    $("#productManualCount").textContent = related.length;
    $("#relatedManuals").innerHTML = related.map(m => `<div class="card clickable" onclick="openManualBySlug('${getManualSlug(m.id)}')"><h3>${m.title}</h3><p>${m.status}</p><span class="badge">${getManualSlug(m.id)}</span></div>`).join("") || `<div class="empty-state">Chưa có tài liệu liên quan.</div>`;
    showPage("productDetail");
}

function renderDocuments() {
    const keyword = normalizeText($("#docSearch")?.value || state.search);
    const filter = $("#docFilter")?.value || "all";
    const statusFilter = $("#docStatusFilter")?.value || "all";
    const filtered = manuals.filter(m => {
        const text = normalizeText(`${m.title} ${m.description} ${m.fileType} ${m.status} ${getProductName(m.productId)} ${getCategoryName(m.categoryId)} ${m.slug}`);
        return (!keyword || text.includes(keyword)) && (filter === "all" || String(m.categoryId || "") === filter) && (statusFilter === "all" || m.status === statusFilter);
    });
    $("#manualGrid").innerHTML = filtered.map(m => `<div class="card clickable" onclick="openManualBySlug('${getManualSlug(m.id)}')"><h3>${m.title}</h3><p>${m.description || ""}</p><div class="manual-info"><span class="badge">${m.status}</span><span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span><span class="badge"><i class="fa-solid fa-download"></i> ${m.downloadCount || 0}</span><span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span><span class="badge">${getManualSlug(m.id)}</span></div></div>`).join("") || `<div class="empty-state">Không tìm thấy tài liệu phù hợp.</div>`;
    $("#emptyState").style.display = filtered.length ? "none" : "block";
}

function renderNotifications() {
    $("#notificationList").innerHTML = notifications.length ? notifications.map(n => `<div class="card"><h3>${n.text || n.title || "Thông báo"}</h3><p>${n.seen ? "Đã đọc" : "Chưa đọc"}</p></div>`).join("") : `<div class="empty-state">Không có thông báo.</div>`;
}

async function markAllNotificationsRead() {
    const unread = notifications.filter(n => !n.seen);
    if (!unread.length) return;
    await Promise.all(unread.map(n => apiFetch(`/api/notifications/${n.id}/read`, { method: "PUT" }).catch(() => null)));
    notifications = notifications.map(n => ({ ...n, seen: true }));
    renderNotifications(); renderHome();
}

function renderProfile() {
    const userBookmarks = bookmarks.filter(b => String(b.userId) === String(state.user?.id || ""));
    const userRatings = ratings.filter(r => String(r.userId) === String(state.user?.id || ""));
    const userLogs = activityLogs.filter(l => String(l.userId) === String(state.user?.id || ""));
    $("#profileBox").innerHTML = state.user ? `<div class="profile-header"><div><strong>${state.user.email || state.user.phone}</strong><br><span class="badge">${state.user.role}</span></div></div><div class="info-grid"><div class="info-card"><strong>${userBookmarks.length}</strong><div>Bookmark</div></div><div class="info-card"><strong>${userRatings.length}</strong><div>Ratings</div></div><div class="info-card"><strong>${userLogs.length}</strong><div>Hoạt động</div></div><div class="info-card"><strong>${manuals.filter(m => String(m.uploadedBy || "") === String(state.user.id)).length}</strong><div>Tài liệu của tôi</div></div></div>` : "Bạn chưa đăng nhập.";
    $("#currentPhaseText").textContent = `${ROADMAP.current}: ${ROADMAP.currentText}`;
    $("#nextPriorityList").innerHTML = ROADMAP.next.map(item => `<li>${item}</li>`).join("");
}

function renderAdmin() {
    $("#totalUsers").textContent = usersCount;
    $("#totalProducts").textContent = products.length;
    $("#totalDocs").textContent = manuals.length;
    $("#totalViews").textContent = manuals.reduce((s, m) => s + (m.viewCount || 0), 0);
    $("#dashboardDownloads").textContent = manuals.reduce((s, m) => s + (m.downloadCount || 0), 0);
    $("#dashboardPending").textContent = manuals.filter(m => m.status === "pending").length;
    $("#dashboardToday").textContent = manuals.filter(m => new Date(m.createdAt || Date.now()).toDateString() === new Date().toDateString()).length;
    $("#dashboardBookmarks").textContent = bookmarks.length;
    $("#adminCategoryList").innerHTML = categories.map(c => `<div class="list-item"><span><strong>${c.name}</strong><br><small>${c.slug || slugify(c.name)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-secondary" type="button" onclick="openCategoryModal('${c.id}')">Sửa</button><button class="btn-secondary" onclick="deleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join("") || `<div class="empty-state">Chưa có danh mục.</div>`;
    $("#adminBrandList").innerHTML = brands.map(b => `<div class="list-item"><span><strong>${b.name}</strong><br><small>${b.slug || slugify(b.name)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-secondary" type="button" onclick="openBrandModal('${b.id}')">Sửa</button><button class="btn-secondary" onclick="deleteBrand('${b.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join("") || `<div class="empty-state">Chưa có thương hiệu.</div>`;
    $("#adminProductList").innerHTML = products.map(p => `<div class="list-item"><span><strong>${p.name}</strong><br><small>${getBrandName(p.brandId)} · ${getCategoryName(p.categoryId)} · ${getProductSlug(p.id)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-secondary" type="button" onclick="openProductModal('${p.id}')">Sửa</button><button class="btn-secondary" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join("") || `<div class="empty-state">Chưa có sản phẩm.</div>`;
    $("#adminManualList").innerHTML = manuals.filter(m => m.status === "pending").map(m => `<div class="list-item"><span><strong>${m.title}</strong><br><small>${getProductName(m.productId) || "Chưa gán sản phẩm"} · ${getCategoryName(m.categoryId)} · ${getManualSlug(m.id)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-primary" type="button" onclick="approveManual('${m.id}')">Duyệt</button><button class="btn-secondary" type="button" onclick="rejectManual('${m.id}')">Từ chối</button><button class="btn-secondary" type="button" onclick="deleteManual('${m.id}')">Xóa</button></div></div>`).join("") || `<div class="empty-state">Không có tài liệu chờ duyệt.</div>`;
}

function syncFilters() {
    $("#docFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    $("#productCategoryFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    $("#newProductCategory").innerHTML = `<option value="">Chọn danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    $("#newProductBrand").innerHTML = `<option value="">Chọn thương hiệu</option>` + brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
}

async function loadDataAndRender() {
    await loadData();
    syncFilters();
    renderPage(state.currentPage);
    renderProfile();
    renderAdmin();
    updateAuthUI();
    applyTheme();
    renderSearchSuggest();
    revealOnScroll();
    renderManualStats();
    if (state.slugRoute) openRouteBySlug(state.slugRoute);
}

function ensureDetailBlocks() {
    if (!$("#detailMeta")) {
        const meta = document.createElement("div");
        meta.id = "detailMeta";
        meta.className = "manual-info";
        meta.innerHTML = `<span class="badge"><i class="fa-regular fa-bookmark"></i> <span id="manualBookmarkCount">0</span> bookmark</span><span class="badge"><i class="fa-regular fa-star"></i> <span id="manualRatingCount">0</span> đánh giá</span><span class="badge"><i class="fa-regular fa-clock"></i> <span id="manualActivityCount">0</span> hoạt động</span><span class="badge"><i class="fa-solid fa-download"></i> <span id="manualDownloadLogCount">0</span> log tải</span>`;
        $("#detailStatus")?.insertAdjacentElement("afterend", meta);
    }
    if (!$("#ratingBox")) {
        const box = document.createElement("div");
        box.id = "ratingBox";
        box.className = "manual-action";
        $("#previewBox")?.before(box);
    }
    if (!$("#attachmentSection")) {
        const section = document.createElement("div");
        section.id = "attachmentSection";
        section.className = "preview-box";
        section.innerHTML = `<div class="preview-header"><h3>Attachments</h3><span class="badge">Files</span></div><div id="attachmentList" class="list-box"></div>`;
        $("#previewBox")?.after(section);
    }
    if (!$("#manualLogSection")) {
        const section = document.createElement("div");
        section.id = "manualLogSection";
        section.className = "preview-box";
        section.innerHTML = `<div class="preview-header"><h3>Hoạt động gần đây</h3><span class="badge">Logs</span></div><div id="logList" class="list-box"></div>`;
        $("#attachmentSection")?.after(section);
    }
}

async function openRouteBySlug(slug) {
    const product = products.find(p => getProductSlug(p.id) === slug);
    if (product) return renderProductDetail(product.id);
    const manual = manuals.find(m => getManualSlug(m.id) === slug);
    if (manual) return openDetail(manual.id);
    const category = categories.find(c => (c.slug || slugify(c.name)) === slug);
    if (category) return filterByCategory(category.id);
}

async function openManualBySlug(slug) {
    const manual = manuals.find(m => getManualSlug(m.id) === slug);
    if (manual) return openDetail(manual.id);
}

async function openProductBySlug(slug) {
    const product = products.find(p => getProductSlug(p.id) === slug);
    if (product) return renderProductDetail(product.id);
}

async function openDetail(id) {
    const doc = manuals.find(m => String(m.id) === String(id));
    if (!doc) return;
    ensureDetailBlocks();
    $("#detailCategory").textContent = getCategoryName(doc.categoryId);
    $("#detailName").textContent = doc.title;
    $("#detailDesc").textContent = doc.description || "";
    $("#detailViews").textContent = doc.viewCount || 0;
    $("#detailDownloads").textContent = doc.downloadCount || 0;
    $("#detailStatus").textContent = doc.status;
    $("#detailDownloadBtn").onclick = () => downloadManual(id);
    $("#previewFrame").src = doc.fileUrl || "about:blank";
    $("#ratingBox").innerHTML = `<button class="btn-secondary" type="button" onclick="addRating('${id}', 5)">5★</button><button class="btn-secondary" type="button" onclick="addRating('${id}', 4)">4★</button><button class="btn-secondary" type="button" onclick="addRating('${id}', 3)">3★</button><button class="btn-secondary" type="button" onclick="toggleBookmark('${id}')">Bookmark</button>`;
    renderManualAttachments(id);
    renderManualInsights(id);
    renderManualLogs(id);
    showPage("manual");
    await apiFetch(`/api/manuals/${id}`, { method: "GET" });
    await apiFetch(`/api/manuals/${id}/counter`, { method: "PATCH", body: JSON.stringify({ field: "view" }) });
    await apiFetch("/api/activity-logs", { method: "POST", body: JSON.stringify({ action: "view_manual", manualId: id, userId: state.user?.id || null }) });
    await loadDataAndRender();
}

function renderManualLogs(manualId) {
    const logs = activityLogs.filter(l => String(l.manualId) === String(manualId)).slice(0, 6);
    const box = $("#logList");
    if (!box) return;
    box.innerHTML = logs.length ? logs.map(l => `<div class="list-item"><span>${l.action}</span><span>${new Date(l.createdAt || Date.now()).toLocaleString("vi-VN")}</span></div>`).join("") : `<div class="empty-state">Chưa có log.</div>`;
}
async function openProductDetail(id) { renderProductDetail(id); }

async function downloadManual(id) {
    const doc = manuals.find(m => String(m.id) === String(id));
    if (!doc) return;
    if (doc.status !== "approved" && !isAdmin()) return showToast("Tài liệu chưa được duyệt.");
    showToast("Đang tải tài liệu...");
    await apiFetch(`/api/manuals/${id}/counter`, { method: "PATCH", body: JSON.stringify({ field: "download" }) });
    await apiFetch("/api/download-logs", { method: "POST", body: JSON.stringify({ manualId: id, userId: state.user?.id || null, fileUrl: doc.fileUrl || "" }) });
    await apiFetch("/api/activity-logs", { method: "POST", body: JSON.stringify({ action: "download_manual", manualId: id, userId: state.user?.id || null }) });
    await loadDataAndRender();
}
async function toggleBookmark(id) {
    if (!isLoggedIn()) return showToast("Vui lòng đăng nhập.");
    const exists = bookmarks.find(b => String(b.manualId) === String(id) && String(b.userId) === String(state.user.id));
    if (exists) {
        await apiFetch(`/api/bookmarks/${exists.id}`, { method: "DELETE" });
        showToast("Đã bỏ bookmark.");
    } else {
        await apiFetch("/api/bookmarks", { method: "POST", body: JSON.stringify({ manualId: id, userId: state.user.id }) });
        showToast("Đã bookmark.");
    }
    await apiFetch("/api/activity-logs", { method: "POST", body: JSON.stringify({ action: "toggle_bookmark", manualId: id, userId: state.user.id, metadata: { bookmarked: !exists } }) });
    await loadDataAndRender();
}
async function addRating(id, value) {
    if (!isLoggedIn()) return showToast("Vui lòng đăng nhập.");
    const exists = ratings.find(r => String(r.manualId) === String(id) && String(r.userId) === String(state.user.id));
    if (exists) await apiFetch(`/api/ratings/${exists.id}`, { method: "PUT", body: JSON.stringify({ value }) });
    else await apiFetch("/api/ratings", { method: "POST", body: JSON.stringify({ manualId: id, userId: state.user.id, value }) });
    showToast(exists ? "Đã cập nhật đánh giá." : "Đã gửi đánh giá.");
    await apiFetch("/api/activity-logs", { method: "POST", body: JSON.stringify({ action: "rate_manual", manualId: id, userId: state.user.id, metadata: { value } }) });
    await loadDataAndRender();
}

function openModal(title, fields, onSave) {
    modalContext = onSave;
    const modal = $("#modalBox");
    const overlay = $("#modalOverlay");
    modal.innerHTML = `
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="btn-secondary" type="button" onclick="closeModal()">Đóng</button>
        </div>
        <form class="modal-form" id="modalForm">
            ${fields}
            <div class="modal-actions">
                <button class="btn-secondary" type="button" onclick="closeModal()">Hủy</button>
                <button class="btn-primary" type="submit">Lưu</button>
            </div>
        </form>
    `;
    modal.classList.add("show");
    overlay.classList.add("show");
    $("#modalForm").onsubmit = async (e) => {
        e.preventDefault();
        await onSave(new FormData(e.target));
        closeModal();
    };
}
function closeModal() {
    $("#modalBox")?.classList.remove("show");
    $("#modalOverlay")?.classList.remove("show");
    $("#modalBox").innerHTML = "";
    modalContext = null;
}

function openCategoryModal(id = "") {
    const item = categories.find(c => String(c.id) === String(id));
    openModal(item ? "Sửa danh mục" : "Thêm danh mục", `
        <div class="form-group"><label>Tên danh mục</label><input name="name" value="${item?.name || ""}"></div>
        <div class="form-group"><label>Icon</label><input name="icon" value="${item?.icon || "fa-solid fa-folder"}"></div>
        <div class="form-group"><label>Slug</label><input name="slug" value="${item?.slug || slugify(item?.name || "")}"></div>
    `, async (form) => {
        const payload = { name: form.get("name")?.toString().trim(), icon: form.get("icon")?.toString().trim(), slug: form.get("slug")?.toString().trim() || slugify(form.get("name")) };
        const res = item ? await apiFetch(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }) : await apiFetch("/api/categories", { method: "POST", body: JSON.stringify(payload) });
        if (res?.success) await loadDataAndRender();
    });
}

function openBrandModal(id = "") {
    const item = brands.find(b => String(b.id) === String(id));
    openModal(item ? "Sửa thương hiệu" : "Thêm thương hiệu", `
        <div class="form-group"><label>Tên thương hiệu</label><input name="name" value="${item?.name || ""}"></div>
        <div class="form-group"><label>Logo / icon URL</label><input name="logoUrl" value="${item?.logoUrl || ""}"></div>
        <div class="form-group"><label>Slug</label><input name="slug" value="${item?.slug || slugify(item?.name || "")}"></div>
    `, async (form) => {
        const payload = { name: form.get("name")?.toString().trim(), logoUrl: form.get("logoUrl")?.toString().trim(), slug: form.get("slug")?.toString().trim() || slugify(form.get("name")) };
        const res = item ? await apiFetch(`/api/brands/${id}`, { method: "PATCH", body: JSON.stringify(payload) }) : await apiFetch("/api/brands", { method: "POST", body: JSON.stringify(payload) });
        if (res?.success) await loadDataAndRender();
    });
}

function openProductModal(id = "") {
    const item = products.find(p => String(p.id) === String(id));
    openModal(item ? "Sửa sản phẩm" : "Thêm sản phẩm", `
        <div class="form-group"><label>Tên sản phẩm</label><input name="name" value="${item?.name || ""}"></div>
        <div class="form-group"><label>Brand</label><select name="brandId">${brands.map(b => `<option value="${b.id}" ${String(item?.brandId || "")===String(b.id)?"selected":""}>${b.name}</option>`).join("")}</select></div>
        <div class="form-group"><label>Danh mục</label><select name="categoryId">${categories.map(c => `<option value="${c.id}" ${String(item?.categoryId || "")===String(c.id)?"selected":""}>${c.name}</option>`).join("")}</select></div>
        <div class="form-group"><label>Trạng thái</label><select name="status"><option value="active" ${item?.status==="active"?"selected":""}>active</option><option value="hidden" ${item?.status==="hidden"?"selected":""}>hidden</option><option value="draft" ${item?.status==="draft"?"selected":""}>draft</option></select></div>
        <div class="form-group"><label>Slug</label><input name="slug" value="${item?.slug || slugify(item?.name || "")}"></div>
        <div class="form-group"><label>Mô tả</label><input name="description" value="${item?.description || ""}"></div>
    `, async (form) => {
        const payload = { name: form.get("name")?.toString().trim(), brandId: form.get("brandId") || null, categoryId: form.get("categoryId") || null, status: form.get("status") || "active", slug: form.get("slug")?.toString().trim() || slugify(form.get("name")), description: form.get("description")?.toString().trim() };
        const res = item ? await apiFetch(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }) : await apiFetch("/api/products", { method: "POST", body: JSON.stringify(payload) });
        if (res?.success) await loadDataAndRender();
    });
}

function exportJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function importJsonFile(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            onDone(parsed);
        } catch {
            showToast("File JSON không hợp lệ.");
        }
    };
    reader.readAsText(file);
}

function addCategory() { openCategoryModal(); }
function addBrand() { openBrandModal(); }
function addProduct() { openProductModal(); }

async function approveManual(id) { const res = await apiFetch(`/api/manuals/${id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }); if (res?.success) await loadDataAndRender(); }
async function rejectManual(id) { const res = await apiFetch(`/api/manuals/${id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }); if (res?.success) await loadDataAndRender(); }
async function deleteManual(id) { await apiFetch(`/api/manuals/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteCategory(id) { await apiFetch(`/api/categories/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteBrand(id) { await apiFetch(`/api/brands/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteProduct(id) { await apiFetch(`/api/products/${id}`, { method: "DELETE" }); await loadDataAndRender(); }

async function exportAllData() {
    exportJson("manual-center-export.json", { categories, brands, products, manuals, attachments, bookmarks, ratings, notifications, activityLogs, downloadLogs });
}

async function importAllData(file) {
    importJsonFile(file, async (data) => {
        if (!data || typeof data !== "object") return showToast("Dữ liệu import không hợp lệ.");
        showToast("Đã đọc file import.");
    });
}

function renderManualAttachments(manualId) {
    const detailTarget = $("#attachmentList");
    if (!detailTarget) return;
    const items = attachments.filter(a => String(a.manualId) === String(manualId));
    detailTarget.innerHTML = items.length ? items.map(a => `<div class="list-item"><span><strong>${a.name}</strong><br><small>${a.fileType || ""}</small></span><a class="btn-secondary" href="${a.fileUrl}" target="_blank" rel="noopener">Mở file</a></div>`).join("") : `<div class="empty-state">Chưa có file đính kèm.</div>`;
}
function renderManualInsights(manualId) {
    $("#manualBookmarkCount").textContent = bookmarks.filter(b => String(b.manualId) === String(manualId)).length;
    $("#manualRatingCount").textContent = ratings.filter(r => String(r.manualId) === String(manualId)).length;
    $("#manualActivityCount").textContent = activityLogs.filter(l => String(l.manualId) === String(manualId)).length;
    $("#manualDownloadLogCount").textContent = downloadLogs.filter(l => String(l.manualId) === String(manualId)).length;
}

function revealOnScroll() {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add("show"); }), { threshold: 0.08 });
    $$(".reveal").forEach(el => observer.observe(el));
}
function renderManualStats() {
    $("#currentPhaseText").textContent = `${ROADMAP.current}: ${ROADMAP.currentText}`;
    $("#nextPriorityList").innerHTML = ROADMAP.next.map(item => `<li>${item}</li>`).join("");
}

window.showPage = showPage;
window.openAdmin = () => showPage("admin");
window.openDetail = openDetail;
window.openProductDetail = openProductBySlug;
window.openManualBySlug = openManualBySlug;
window.downloadManual = downloadManual;
window.toggleBookmark = toggleBookmark;
window.addRating = addRating;
window.addCategory = addCategory;
window.addBrand = addBrand;
window.addProduct = addProduct;
window.approveManual = approveManual;
window.rejectManual = rejectManual;
window.deleteManual = deleteManual;
window.deleteCategory = deleteCategory;
window.deleteBrand = deleteBrand;
window.deleteProduct = deleteProduct;
window.openCategoryModal = openCategoryModal;
window.openBrandModal = openBrandModal;
window.openProductModal = openProductModal;
window.closeModal = closeModal;
window.exportAllData = exportAllData;
window.importAllData = importAllData;
window.toggleDrawer = function (open) {
    document.body.classList.toggle("drawer-open", open);
    const menuBtn = $("#menuBtn");
    if (menuBtn) menuBtn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
};
window.filterByCategory = filterByCategory;

$("#themeBtn")?.addEventListener("click", () => { state.theme = !state.theme; applyTheme(); });
$("#logoutBtn")?.addEventListener("click", () => { saveAuth({ user: null, token: "" }); showToast("Đã đăng xuất."); showPage("home"); });
$("#notifyBtn")?.addEventListener("click", () => showPage("notifications"));

$("#heroSearchBtn")?.addEventListener("click", () => {
    state.search = $("#heroSearch")?.value.trim() || "";
    renderCategories(); renderDocuments(); renderProducts(); renderSearchSuggest(); showPage("categories");
});
$("#globalSearch")?.addEventListener("input", e => { state.search = e.target.value.trim(); renderSearchSuggest(); renderCategories(); renderDocuments(); renderProducts(); });
$("#globalSearch")?.addEventListener("keydown", e => { if (e.key === "Enter") { renderCategories(); renderDocuments(); renderProducts(); showPage("categories"); } });
$("#productSearch")?.addEventListener("input", renderProducts);
$("#productCategoryFilter")?.addEventListener("change", renderProducts);
$("#productStatusFilter")?.addEventListener("change", renderProducts);
$("#docSearch")?.addEventListener("input", renderDocuments);
$("#docFilter")?.addEventListener("change", renderDocuments);
$("#docStatusFilter")?.addEventListener("change", renderDocuments);

$("#emailAuthForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#authEmail")?.value.trim();
    const password = $("#authPassword")?.value.trim();
    const loginRes = await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (loginRes?.success) { saveAuth(loginRes); showToast("Đăng nhập thành công."); showPage("home"); }
    else {
        const registerRes = await apiFetch("/api/register", { method: "POST", body: JSON.stringify({ email, password, authType: "email" }) });
        if (registerRes?.success) { saveAuth(registerRes); showToast("Đăng ký thành công."); showPage("home"); }
        else showToast(registerRes?.message || loginRes?.message || "Lỗi đăng nhập.");
    }
});

$("#searchSuggest")?.addEventListener("click", e => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;
    const type = item.dataset.type, id = item.dataset.id;
    if (type === "product") openProductDetail(id);
    else if (type === "manual") openManualBySlug(getManualSlug(id));
    else if (type === "category") filterByCategory(id);
    else { state.search = item.textContent.trim(); $("#globalSearch").value = state.search; renderCategories(); renderDocuments(); renderProducts(); }
    $("#searchSuggest").style.display = "none";
});

document.addEventListener("click", e => { if (!$("#headerSearch")?.contains(e.target)) { const box = $("#searchSuggest"); if (box) box.style.display = "none"; } });
document.addEventListener("keydown", e => { if (e.key === "Escape") { window.toggleDrawer(false); closeModal(); } });

window.addEventListener("load", async () => {
    const loading = $("#loading");
    setTimeout(() => { loading.style.opacity = "0"; loading.style.pointerEvents = "none"; setTimeout(() => loading.remove(), 250); }, 500);
    await loadDataAndRender();
    if (state.slugRoute) openRouteBySlug(state.slugRoute);
    showPage(state.currentPage);
});
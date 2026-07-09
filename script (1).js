"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const STORAGE_KEYS = { user: "manual_user", theme: "manual_theme" };

const ROADMAP = {
    phase: 4,
    current: "Giai đoạn 4",
    currentText: "Hoàn thiện trải nghiệm: profile, detail pages, UX polish, bookmarks, ratings, logs.",
    next: [
        "Hoàn thiện SEO / metadata",
        "Tối ưu quyền truy cập",
        "Bổ sung analytics nâng cao"
    ]
};

let state = {
    currentPage: localStorage.getItem("page") || "home",
    theme: localStorage.getItem(STORAGE_KEYS.theme) === "true",
    user: JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null"),
    search: ""
};

let categories = [];
let products = [];
let manuals = [];
let notifications = [];
let bookmarks = [];
let ratings = [];
let attachments = [];
let activityLogs = [];
let downloadLogs = [];

function apiFetch(path, options = {}) {
    return fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
    }).then(async res => {
        try { return await res.json(); } catch { return { success: false, message: "Phản hồi server không hợp lệ." }; }
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

function isAdmin() { return state.user?.role === "admin"; }
function isLoggedIn() { return !!state.user; }

function saveUser(user) {
    state.user = user;
    if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.user);
    updateAuthUI();
    renderProfile();
}

function applyTheme() {
    document.documentElement.classList.toggle("dark", state.theme);
    localStorage.setItem(STORAGE_KEYS.theme, String(state.theme));
    $("#themeBtn").innerHTML = state.theme ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

function updateAuthUI() {
    const loginBtn = $("#loginBtn");
    const logoutBtn = $("#logoutBtn");
    const roleLabel = $("#userRoleLabel");
    if (state.user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-flex";
        roleLabel.textContent = state.user.role === "admin" ? "Quản trị viên" : "Khách đã đăng nhập";
    } else {
        loginBtn.style.display = "inline-flex";
        logoutBtn.style.display = "none";
        roleLabel.textContent = "Khách truy cập";
    }
}

function showPage(pageId) {
    if (pageId === "admin" && !isAdmin()) {
        showToast("Chỉ admin mới được truy cập.");
        pageId = "login";
    }
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    const page = $("#" + pageId);
    if (page) {
        page.classList.add("active");
        state.currentPage = pageId;
        localStorage.setItem("page", pageId);
    }
}

function normalizeText(v) { return (v || "").toString().toLowerCase(); }
function matchSearch(item) { return !state.search || normalizeText(JSON.stringify(item)).includes(normalizeText(state.search)); }

async function loadData() {
    const [catRes, prodRes, manRes, notiRes, bmRes, ratingRes, attRes, logRes, dlogRes] = await Promise.all([
        apiFetch("/api/categories"),
        apiFetch("/api/products"),
        apiFetch("/api/manuals"),
        apiFetch("/api/notifications"),
        apiFetch("/api/bookmarks"),
        apiFetch("/api/ratings"),
        apiFetch("/api/attachments"),
        apiFetch("/api/activity-logs"),
        apiFetch("/api/download-logs")
    ]);
    if (catRes?.success) categories = catRes.data || [];
    if (prodRes?.success) products = prodRes.data || [];
    if (manRes?.success) manuals = manRes.data || [];
    if (notiRes?.success) notifications = notiRes.data || [];
    if (bmRes?.success) bookmarks = bmRes.data || [];
    if (ratingRes?.success) ratings = ratingRes.data || [];
    if (attRes?.success) attachments = attRes.data || [];
    if (logRes?.success) activityLogs = logRes.data || [];
    if (dlogRes?.success) downloadLogs = dlogRes.data || [];
}

function getCategoryName(id) {
    return categories.find(c => String(c.id) === String(id))?.name || "Danh mục";
}

function getProductName(id) {
    return products.find(p => String(p.id) === String(id))?.name || "";
}

function getManualRating(id) {
    const items = ratings.filter(r => String(r.manualId) === String(id));
    if (!items.length) return "0.0";
    return (items.reduce((sum, r) => sum + (Number(r.value) || 0), 0) / items.length).toFixed(1);
}

function isBookmarked(id) {
    return bookmarks.some(b => String(b.manualId) === String(id) && String(b.userId) === String(state.user?.id || ""));
}

function renderSearchSuggest() {
    const box = $("#searchSuggest");
    if (!box) return;
    const q = normalizeText($("#globalSearch")?.value || "");
    if (!q) return box.style.display = "none";
    const items = [
        ...products.filter(p => normalizeText(p.name).includes(q)).slice(0, 4).map(p => ({ type: "product", label: p.name })),
        ...manuals.filter(m => normalizeText(m.title).includes(q)).slice(0, 4).map(m => ({ type: "manual", label: m.title }))
    ];
    box.innerHTML = items.length ? items.map(item => `<div class="suggest-item">${item.label} <span>${item.type}</span></div>`).join("") : `<div class="suggest-item">Không có kết quả</div>`;
    box.style.display = "block";
}

function renderHome() {
    $("#statProducts").textContent = products.length;
    $("#statManuals").textContent = manuals.length;
    $("#statCategories").textContent = categories.length;
    $("#statNotifications").textContent = notifications.filter(n => !n.seen).length;

    $("#homeProducts").innerHTML = products.filter(matchSearch).slice(0, 6).map(p => `
        <div class="card clickable" onclick="openProductDetail('${p.id}')">
            <img src="${p.imageUrl || 'images/manual-01.jpg'}" alt="${p.name}">
            <h3>${p.name}</h3>
            <p>${p.brand || ""}</p>
        </div>
    `).join("");

    $("#homeManuals").innerHTML = manuals.filter(matchSearch).slice(0, 6).map(m => `
        <div class="card clickable" onclick="openDetail('${m.id}')">
            <h3>${m.title}</h3>
            <p>${m.status}</p>
            <div class="manual-info">
                <span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span>
                <span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span>
            </div>
        </div>
    `).join("");

    $("#homeCategories").innerHTML = categories.slice(0, 6).map(c => `
        <div class="card">
            <h3>${c.name}</h3>
            <p>${c.icon}</p>
        </div>
    `).join("");
}

function renderProducts() {
    const q = normalizeText($("#productSearch")?.value || "");
    const category = $("#productCategoryFilter")?.value || "all";
    const status = $("#productStatusFilter")?.value || "all";
    const filtered = products.filter(p => {
        const text = normalizeText(`${p.name} ${p.brand} ${p.description}`);
        const okQ = !q || text.includes(q);
        const okCategory = category === "all" || String(p.categoryId || "") === category;
        const okStatus = status === "all" || p.status === status;
        return okQ && okCategory && okStatus;
    });
    $("#productGrid").innerHTML = filtered.map(p => `
        <div class="card clickable" onclick="openProductDetail('${p.id}')">
            <img src="${p.imageUrl || 'images/manual-01.jpg'}" alt="${p.name}">
            <h3>${p.name}</h3>
            <p>${p.brand || ""}</p>
            <p>${p.description || ""}</p>
            <div class="manual-info">
                <span class="badge"><i class="fa-regular fa-file-lines"></i> ${(manuals.filter(m => String(m.productId) === String(p.id))).length} tài liệu</span>
            </div>
        </div>
    `).join("");
}

function renderProductDetail(productId) {
    const p = products.find(item => String(item.id) === String(productId));
    if (!p) return;
    $("#productDetailBrand").textContent = p.brand || "Thương hiệu";
    $("#productDetailName").textContent = p.name || "";
    $("#productDetailDesc").textContent = p.description || "";
    const related = manuals.filter(m => String(m.productId || "") === String(productId));
    $("#productManualCount").textContent = related.length;
    $("#relatedManuals").innerHTML = related.map(m => `
        <div class="card clickable" onclick="openDetail('${m.id}')">
            <h3>${m.title}</h3>
            <p>${m.status}</p>
            <div class="manual-info">
                <span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span>
                <span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span>
            </div>
        </div>
    `).join("") || `<div class="empty-state">Chưa có tài liệu liên quan.</div>`;
    showPage("productDetail");
}

function renderDocuments() {
    const keyword = normalizeText($("#docSearch")?.value || state.search);
    const filter = $("#docFilter")?.value || "all";
    const statusFilter = $("#docStatusFilter")?.value || "all";
    const filtered = manuals.filter(m => {
        const text = normalizeText(`${m.title} ${m.description} ${m.fileType} ${m.status} ${getProductName(m.productId)} ${getCategoryName(m.categoryId)}`);
        const byKeyword = !keyword || text.includes(keyword);
        const byCategory = filter === "all" || String(m.categoryId || "") === filter;
        const byStatus = statusFilter === "all" || m.status === statusFilter;
        return byKeyword && byCategory && byStatus;
    });

    $("#manualGrid").innerHTML = filtered.map(m => `
        <div class="card clickable" onclick="openDetail('${m.id}')">
            <h3>${m.title}</h3>
            <p>${m.description || ""}</p>
            <div class="manual-info">
                <span class="badge">${m.status}</span>
                <span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span>
                <span class="badge"><i class="fa-solid fa-download"></i> ${m.downloadCount || 0}</span>
                <span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span>
                <span class="badge"><i class="fa-regular fa-bookmark"></i> ${isBookmarked(m.id) ? "Saved" : "Save"}</span>
            </div>
        </div>
    `).join("");
    $("#emptyState").style.display = filtered.length ? "none" : "block";
}

function renderMyDocs() {
    const mine = manuals.filter(m => String(m.uploadedBy || "") === String(state.user?.id || ""));
    $("#myDocsGrid").innerHTML = mine.length ? mine.map(m => `
        <div class="card clickable" onclick="openDetail('${m.id}')">
            <h3>${m.title}</h3>
            <p>${m.status}</p>
            <div class="manual-info">
                <span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span>
                <span class="badge"><i class="fa-solid fa-download"></i> ${m.downloadCount || 0}</span>
                <span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span>
            </div>
        </div>
    `).join("") : `<div class="empty-state">Bạn chưa upload tài liệu nào.</div>`;
}

function renderBookmarks() {
    const qCat = $("#bookmarkCategoryFilter")?.value || "all";
    const qStatus = $("#bookmarkStatusFilter")?.value || "all";
    const mine = bookmarks.filter(b => String(b.userId) === String(state.user?.id || ""));
    const filtered = mine.filter(b => {
        const doc = manuals.find(m => String(m.id) === String(b.manualId));
        if (!doc) return false;
        const okCat = qCat === "all" || String(doc.categoryId || "") === qCat;
        const okStatus = qStatus === "all" || doc.status === qStatus;
        return okCat && okStatus;
    });
    $("#bookmarkGrid").innerHTML = filtered.length ? filtered.map(b => {
        const doc = manuals.find(m => String(m.id) === String(b.manualId));
        return `
            <div class="card clickable" onclick="openDetail('${doc.id}')">
                <h3>${doc.title}</h3>
                <p>${doc.description || ""}</p>
                <div class="manual-info">
                    <span class="badge">${getCategoryName(doc.categoryId)}</span>
                    <span class="badge">${doc.status}</span>
                    <span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(doc.id)}</span>
                </div>
            </div>
        `;
    }).join("") : `<div class="empty-state">Chưa có bookmark nào.</div>`;
}

function renderRatings() {
    const mine = ratings.filter(r => String(r.userId) === String(state.user?.id || ""));
    $("#myRatingsGrid").innerHTML = mine.length ? mine.map(r => {
        const doc = manuals.find(m => String(m.id) === String(r.manualId));
        return `
            <div class="card">
                <h3>${doc?.title || "Tài liệu"}</h3>
                <p>Đánh giá hiện tại: <strong>${r.value}★</strong></p>
                <div class="manual-action">
                    <button class="btn-secondary" type="button" onclick="updateMyRating('${r.manualId}', 1)">1★</button>
                    <button class="btn-secondary" type="button" onclick="updateMyRating('${r.manualId}', 2)">2★</button>
                    <button class="btn-secondary" type="button" onclick="updateMyRating('${r.manualId}', 3)">3★</button>
                    <button class="btn-secondary" type="button" onclick="updateMyRating('${r.manualId}', 4)">4★</button>
                    <button class="btn-primary" type="button" onclick="updateMyRating('${r.manualId}', 5)">5★</button>
                </div>
            </div>
        `;
    }).join("") : `<div class="empty-state">Chưa có đánh giá nào.</div>`;
}

function renderActivityLogs() {
    const d = $("#activityDateFilter")?.value || "";
    const t = $("#activityTypeFilter")?.value || "all";
    const filtered = activityLogs.filter(l => {
        const okDate = !d || new Date(l.createdAt || Date.now()).toISOString().slice(0, 10) === d;
        const okType = t === "all" || l.action === t;
        return okDate && okType;
    });
    $("#activityLogList").innerHTML = filtered.length ? filtered.map(l => `
        <div class="list-item">
            <span>
                <strong>${l.action}</strong><br>
                <small>${l.metadata ? JSON.stringify(l.metadata) : ""}</small>
            </span>
            <span>${new Date(l.createdAt || Date.now()).toLocaleString("vi-VN")}</span>
        </div>
    `).join("") : `<div class="empty-state">Không có lịch sử phù hợp.</div>`;
}

function renderAttachments() {
    const manualId = $("#attachmentManualFilter")?.value || "";
    const filtered = manualId ? attachments.filter(a => String(a.manualId) === String(manualId)) : attachments;
    $("#attachmentManagerList").innerHTML = filtered.length ? filtered.map(a => `
        <div class="list-item">
            <span>
                <strong>${a.name}</strong><br>
                <small>${getManualName(a.manualId)}</small>
            </span>
            <span class="manual-action">
                <button class="btn-secondary" type="button" onclick="renameAttachmentPrompt('${a.id}')">Đổi tên</button>
                <button class="btn-secondary" type="button" onclick="deleteAttachment('${a.id}')">Xóa</button>
            </span>
        </div>
    `).join("") : `<div class="empty-state">Chưa có attachment.</div>`;
}

function getManualName(id) {
    return manuals.find(m => String(m.id) === String(id))?.title || "";
}

function renderNotifications() {
    $("#notificationList").innerHTML = notifications.length ? notifications.map(n => `
        <div class="card">
            <h3>${n.text}</h3>
            <p>${n.seen ? "Đã đọc" : "Chưa đọc"}</p>
        </div>
    `).join("") : `<div class="empty-state">Không có thông báo.</div>`;
}

function renderProfile() {
    const userBookmarks = bookmarks.filter(b => String(b.userId) === String(state.user?.id || ""));
    const userRatings = ratings.filter(r => String(r.userId) === String(state.user?.id || ""));
    const userLogs = activityLogs.filter(l => String(l.userId) === String(state.user?.id || ""));

    $("#profileBox").innerHTML = state.user
        ? `
            <div class="profile-header">
                <div>
                    <strong>${state.user.email || state.user.phone}</strong><br>
                    <span class="badge">${state.user.role}</span>
                </div>
            </div>
            <div class="info-grid">
                <div class="info-card"><strong>${userBookmarks.length}</strong><div>Bookmark</div></div>
                <div class="info-card"><strong>${userRatings.length}</strong><div>Ratings</div></div>
                <div class="info-card"><strong>${userLogs.length}</strong><div>Hoạt động</div></div>
                <div class="info-card"><strong>${manuals.filter(m => String(m.uploadedBy || "") === String(state.user.id)).length}</strong><div>Tài liệu của tôi</div></div>
            </div>
            <div class="list-box">
                <div class="list-item"><span>Email</span><span>${state.user.email || "-"}</span></div>
                <div class="list-item"><span>Phone</span><span>${state.user.phone || "-"}</span></div>
                <div class="list-item"><span>Vai trò</span><span>${state.user.role}</span></div>
            </div>
        `
        : "Bạn chưa đăng nhập.";
    $("#currentPhaseText").textContent = `${ROADMAP.current}: ${ROADMAP.currentText}`;
    $("#nextPriorityList").innerHTML = ROADMAP.next.map(item => `<li>${item}</li>`).join("");
}

function renderAdmin() {
    $("#totalUsers").textContent = 0;
    $("#totalProducts").textContent = products.length;
    $("#totalDocs").textContent = manuals.length;
    $("#totalViews").textContent = manuals.reduce((s, m) => s + (m.viewCount || 0), 0);
    $("#dashboardDownloads").textContent = manuals.reduce((s, m) => s + (m.downloadCount || 0), 0);
    $("#dashboardPending").textContent = manuals.filter(m => m.status === "pending").length;
    $("#dashboardToday").textContent = manuals.filter(m => new Date(m.createdAt || Date.now()).toDateString() === new Date().toDateString()).length;
    $("#dashboardBookmarks").textContent = bookmarks.length;

    $("#adminCategoryList").innerHTML = categories.map(c => `
        <div class="list-item">
            <span><strong>${c.name}</strong><br><small>${c.icon}</small></span>
            <button class="btn-secondary" onclick="deleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join("");

    $("#adminProductList").innerHTML = products.map(p => `
        <div class="list-item">
            <span><strong>${p.name}</strong><br><small>${p.brand || ""}</small></span>
            <button class="btn-secondary" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join("");

    $("#adminManualList").innerHTML = manuals.filter(m => m.status === "pending").map(m => `
        <div class="list-item">
            <span><strong>${m.title}</strong><br><small>${m.status}</small></span>
            <span class="manual-action">
                <button class="btn-primary" onclick="approveManual('${m.id}')"><i class="fa-solid fa-check"></i></button>
                <button class="btn-secondary" onclick="deleteManual('${m.id}')"><i class="fa-solid fa-trash"></i></button>
            </span>
        </div>
    `).join("");
}

async function loadDataAndRender() {
    await loadData();

    $("#docFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    $("#bookmarkCategoryFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    $("#productCategoryFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    $("#docProduct").innerHTML = `<option value="">Chọn sản phẩm</option>` + products.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
    $("#docCategory").innerHTML = `<option value="">Chọn danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    $("#attachmentManualFilter").innerHTML = `<option value="">Tất cả tài liệu</option>` + manuals.map(m => `<option value="${m.id}">${m.title}</option>`).join("");

    renderHome();
    renderProducts();
    renderDocuments();
    renderMyDocs();
    renderBookmarks();
    renderRatings();
    renderActivityLogs();
    renderAttachments();
    renderNotifications();
    renderProfile();
    renderAdmin();
    updateAuthUI();
    applyTheme();
    renderSearchSuggest();
    revealOnScroll();
}

async function openDetail(id) {
    const doc = manuals.find(m => String(m.id) === String(id));
    if (!doc) return;
    $("#detailCategory").textContent = getCategoryName(doc.categoryId);
    $("#detailName").textContent = doc.title;
    $("#detailDesc").textContent = doc.description || "";
    $("#detailViews").textContent = doc.viewCount || 0;
    $("#detailDownloads").textContent = doc.downloadCount || 0;
    $("#detailStatus").textContent = doc.status;
    $("#detailDownloadBtn").onclick = () => downloadManual(id);
    $("#previewFrame").src = doc.fileUrl || "about:blank";

    if (!$("#detailMeta")) {
        const meta = document.createElement("div");
        meta.id = "detailMeta";
        meta.className = "manual-info";
        meta.innerHTML = `
            <span class="badge"><i class="fa-regular fa-bookmark"></i> <span id="manualBookmarkCount">0</span> bookmark</span>
            <span class="badge"><i class="fa-regular fa-star"></i> <span id="manualRatingCount">0</span> đánh giá</span>
            <span class="badge"><i class="fa-regular fa-clock"></i> <span id="manualActivityCount">0</span> hoạt động</span>
            <span class="badge"><i class="fa-solid fa-download"></i> <span id="manualDownloadLogCount">0</span> log tải</span>
        `;
        $("#detailStatus")?.insertAdjacentElement("afterend", meta);
    }

    if (!$("#ratingBox")) {
        const box = document.createElement("div");
        box.id = "ratingBox";
        box.className = "manual-action";
        box.innerHTML = `
            <button class="btn-secondary" type="button" onclick="addRating('${id}', 5)">5★</button>
            <button class="btn-secondary" type="button" onclick="addRating('${id}', 4)">4★</button>
            <button class="btn-secondary" type="button" onclick="addRating('${id}', 3)">3★</button>
            <button class="btn-secondary" type="button" onclick="toggleBookmark('${id}')">Bookmark</button>
        `;
        $("#previewBox")?.before(box);
    }

    if (!$("#attachmentSection")) {
        const section = document.createElement("div");
        section.id = "attachmentSection";
        section.className = "preview-box";
        section.innerHTML = `
            <div class="preview-header">
                <h3>Attachments</h3>
                <span class="badge">Giai đoạn 3</span>
            </div>
            <div id="attachmentList" class="list-box"></div>
        `;
        $("#previewBox")?.after(section);
    }

    if (!$("#logSection")) {
        const section = document.createElement("div");
        section.id = "logSection";
        section.className = "preview-box";
        section.innerHTML = `
            <div class="preview-header">
                <h3>Hoạt động gần đây</h3>
                <span class="badge">Logs</span>
            </div>
            <div id="logList" class="list-box"></div>
        `;
        $("#attachmentSection")?.after(section);
    }

    renderAttachments(id);
    renderManualInsights(id);
    renderManualLogs(id);
    showPage("manual");
    await apiFetch(`/api/manuals/${id}`, { method: "GET" });
    await apiFetch(`/api/manuals/${id}/counter`, { method: "PATCH", body: JSON.stringify({ field: "view" }) });
    await apiFetch("/api/activity-logs", {
        method: "POST",
        body: JSON.stringify({ action: "view_manual", manualId: id, userId: state.user?.id || null })
    });
}

function renderManualLogs(manualId) {
    const logs = activityLogs.filter(l => String(l.manualId) === String(manualId)).slice(0, 6);
    $("#logList").innerHTML = logs.length ? logs.map(l => `
        <div class="list-item">
            <span>${l.action}</span>
            <span>${new Date(l.createdAt || Date.now()).toLocaleString("vi-VN")}</span>
        </div>
    `).join("") : `<div class="empty-state">Chưa có logs.</div>`;
}

async function openProductDetail(id) { renderProductDetail(id); }

async function downloadManual(id) {
    const doc = manuals.find(m => String(m.id) === String(id));
    if (!doc) return;
    if (doc.status !== "approved" && !isAdmin()) return showToast("Tài liệu chưa được duyệt.");
    showToast("Đang tải tài liệu...");
    await apiFetch(`/api/manuals/${id}/counter`, { method: "PATCH", body: JSON.stringify({ field: "download" }) });
    await apiFetch("/api/download-logs", {
        method: "POST",
        body: JSON.stringify({ manualId: id, userId: state.user?.id || null, fileUrl: doc.fileUrl || "" })
    });
    await apiFetch("/api/activity-logs", {
        method: "POST",
        body: JSON.stringify({ action: "download_manual", manualId: id, userId: state.user?.id || null })
    });
    await loadDataAndRender();
}

async function toggleBookmark(id) {
    if (!isLoggedIn()) return showToast("Vui lòng đăng nhập.");
    const exists = bookmarks.find(b => String(b.manualId) === String(id) && String(b.userId) === String(state.user.id));
    if (exists) {
        await apiFetch(`/api/bookmarks/${exists.id}`, { method: "DELETE" });
        showToast("Đã bỏ bookmark.");
    } else {
        await apiFetch("/api/bookmarks", {
            method: "POST",
            body: JSON.stringify({ manualId: id, userId: state.user.id })
        });
        showToast("Đã bookmark.");
    }
    await apiFetch("/api/activity-logs", {
        method: "POST",
        body: JSON.stringify({ action: "toggle_bookmark", manualId: id, userId: state.user.id })
    });
    await loadDataAndRender();
}

async function addRating(id, value) {
    if (!isLoggedIn()) return showToast("Vui lòng đăng nhập.");
    const exists = ratings.find(r => String(r.manualId) === String(id) && String(r.userId) === String(state.user.id));
    if (exists) {
        await apiFetch(`/api/ratings/${exists.id}`, { method: "PUT", body: JSON.stringify({ value }) });
        showToast("Đã cập nhật đánh giá.");
    } else {
        await apiFetch("/api/ratings", {
            method: "POST",
            body: JSON.stringify({ manualId: id, userId: state.user.id, value })
        });
        showToast("Đã gửi đánh giá.");
    }
    await apiFetch("/api/activity-logs", {
        method: "POST",
        body: JSON.stringify({ action: "rate_manual", manualId: id, userId: state.user.id, metadata: { value } })
    });
    await loadDataAndRender();
}

async function updateMyRating(manualId, value) {
    if (!isLoggedIn()) return showToast("Vui lòng đăng nhập.");
    const exists = ratings.find(r => String(r.manualId) === String(manualId) && String(r.userId) === String(state.user.id));
    if (!exists) return showToast("Bạn chưa đánh giá tài liệu này.");
    await apiFetch(`/api/ratings/${exists.id}`, { method: "PUT", body: JSON.stringify({ value }) });
    await apiFetch("/api/activity-logs", {
        method: "POST",
        body: JSON.stringify({ action: "rate_manual", manualId, userId: state.user.id, metadata: { value } })
    });
    showToast("Đã cập nhật rating.");
    await loadDataAndRender();
}

async function addCategory() {
    const name = $("#newCategoryName")?.value.trim();
    const icon = $("#newCategoryIcon")?.value.trim();
    if (!name) return showToast("Nhập tên danh mục.");
    const res = await apiFetch("/api/categories", { method: "POST", body: JSON.stringify({ name, icon }) });
    if (res?.success) await loadDataAndRender();
}

async function addProduct() {
    const name = $("#newProductName")?.value.trim();
    const brand = $("#newProductBrand")?.value.trim();
    if (!name) return showToast("Nhập tên sản phẩm.");
    const res = await apiFetch("/api/products", { method: "POST", body: JSON.stringify({ name, brand }) });
    if (res?.success) await loadDataAndRender();
}

async function approveManual(id) {
    const doc = manuals.find(m => String(m.id) === String(id));
    if (!doc) return;
    const res = await apiFetch(`/api/manuals/${id}`, { method: "PUT", body: JSON.stringify({ ...doc, status: "approved" }) });
    if (res?.success) await loadDataAndRender();
}

async function deleteManual(id) { await apiFetch(`/api/manuals/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteCategory(id) { await apiFetch(`/api/categories/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteProduct(id) { await apiFetch(`/api/products/${id}`, { method: "DELETE" }); await loadDataAndRender(); }

async function deleteAttachment(id) {
    await apiFetch(`/api/attachments/${id}`, { method: "DELETE" });
    await loadDataAndRender();
}

async function renameAttachmentPrompt(id) {
    const nextName = prompt("Nhập tên mới cho attachment:");
    if (!nextName) return;
    await apiFetch(`/api/attachments/${id}`, { method: "PATCH", body: JSON.stringify({ name: nextName }) });
    await loadDataAndRender();
}

async function uploadAttachments() {
    const manualId = $("#attachmentManualFilter")?.value;
    const name = $("#attachmentNameInput")?.value.trim();
    const files = $("#attachmentFileInput")?.files || [];
    if (!manualId) return showToast("Chọn tài liệu.");
    if (!files.length) return showToast("Chọn file đính kèm.");

    for (const file of files) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        const fileBase64 = btoa(binary);
        const uploadRes = await apiFetch("/api/upload", {
            method: "POST",
            body: JSON.stringify({ fileName: file.name, fileBase64, mimeType: file.type, bucket: "manuals" })
        });
        if (uploadRes?.success) {
            await apiFetch("/api/attachments", {
                method: "POST",
                body: JSON.stringify({
                    manualId,
                    name: name || file.name,
                    fileUrl: uploadRes.fileUrl,
                    fileType: file.type
                })
            });
        }
    }
    showToast("Đã upload attachment.");
    await loadDataAndRender();
}

async function editMyManual(id) { showToast("Chức năng sửa sẽ hoàn thiện tiếp ở backend quyền."); }
async function deleteMyManual(id) { await deleteManual(id); }

function renderManualInsights(manualId) {
    const bmCount = bookmarks.filter(b => String(b.manualId) === String(manualId)).length;
    const ratingCount = ratings.filter(r => String(r.manualId) === String(manualId)).length;
    const activityCount = activityLogs.filter(l => String(l.manualId) === String(manualId)).length;
    const downloadCount = downloadLogs.filter(l => String(l.manualId) === String(manualId)).length;
    $("#manualBookmarkCount").textContent = bmCount;
    $("#manualRatingCount").textContent = ratingCount;
    $("#manualActivityCount").textContent = activityCount;
    $("#manualDownloadLogCount").textContent = downloadCount;
}

function revealOnScroll() {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add("show"); }), { threshold: 0.08 });
    $$(".reveal").forEach(el => observer.observe(el));
}

window.showPage = showPage;
window.openAdmin = () => showPage("admin");
window.openDetail = openDetail;
window.openProductDetail = openProductDetail;
window.downloadManual = downloadManual;
window.toggleBookmark = toggleBookmark;
window.addRating = addRating;
window.updateMyRating = updateMyRating;
window.addCategory = addCategory;
window.addProduct = addProduct;
window.approveManual = approveManual;
window.deleteManual = deleteManual;
window.deleteCategory = deleteCategory;
window.deleteProduct = deleteProduct;
window.deleteAttachment = deleteAttachment;
window.renameAttachmentPrompt = renameAttachmentPrompt;
window.uploadAttachments = uploadAttachments;
window.editMyManual = editMyManual;
window.deleteMyManual = deleteMyManual;
window.toggleDrawer = function (open) {
    document.body.classList.toggle("drawer-open", open);
    const menuBtn = $("#menuBtn");
    if (menuBtn) menuBtn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
};

$("#themeBtn")?.addEventListener("click", () => { state.theme = !state.theme; applyTheme(); });
$("#logoutBtn")?.addEventListener("click", () => { saveUser(null); showToast("Đã đăng xuất."); showPage("home"); });
$("#notifyBtn")?.addEventListener("click", () => showPage("notifications"));

$("#heroSearchBtn")?.addEventListener("click", () => { state.search = $("#heroSearch")?.value.trim() || ""; renderDocuments(); renderProducts(); renderSearchSuggest(); showPage("documents"); });
$("#globalSearch")?.addEventListener("input", e => { state.search = e.target.value.trim(); renderSearchSuggest(); });
$("#globalSearch")?.addEventListener("keydown", e => { if (e.key === "Enter") { renderDocuments(); renderProducts(); showPage("documents"); } });

$("#productSearch")?.addEventListener("input", renderProducts);
$("#productCategoryFilter")?.addEventListener("change", renderProducts);
$("#productStatusFilter")?.addEventListener("change", renderProducts);
$("#docSearch")?.addEventListener("input", renderDocuments);
$("#docFilter")?.addEventListener("change", renderDocuments);
$("#docStatusFilter")?.addEventListener("change", renderDocuments);
$("#bookmarkCategoryFilter")?.addEventListener("change", renderBookmarks);
$("#bookmarkStatusFilter")?.addEventListener("change", renderBookmarks);
$("#activityDateFilter")?.addEventListener("change", renderActivityLogs);
$("#activityTypeFilter")?.addEventListener("change", renderActivityLogs);
$("#attachmentManualFilter")?.addEventListener("change", renderAttachments);

$("#emailAuthForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#authEmail")?.value.trim();
    const password = $("#authPassword")?.value.trim();
    const loginRes = await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (loginRes?.success) {
        saveUser(loginRes.user);
        showToast("Đăng nhập thành công.");
        showPage("home");
    } else {
        const registerRes = await apiFetch("/api/register", { method: "POST", body: JSON.stringify({ email, password, authType: "email" }) });
        if (registerRes?.success) {
            saveUser(registerRes.user);
            showToast("Đăng ký thành công.");
            showPage("home");
        } else showToast(registerRes?.message || loginRes?.message || "Lỗi đăng nhập.");
    }
});

$("#uploadForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isLoggedIn()) return showToast("Vui lòng đăng nhập.");
    const title = $("#docTitle")?.value.trim();
    const productId = $("#docProduct")?.value || null;
    const categoryId = $("#docCategory")?.value || null;
    const file = $("#docFile")?.files?.[0];
    const description = $("#docDescription")?.value.trim();
    if (!title || !file) return showToast("Thiếu tiêu đề hoặc file.");
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    const fileBase64 = btoa(binary);

    const uploadRes = await apiFetch("/api/upload", { method: "POST", body: JSON.stringify({ fileName: file.name, fileBase64, mimeType: file.type, bucket: "manuals" }) });
    if (!uploadRes?.success) return showToast(uploadRes?.message || "Upload thất bại.");

    const res = await apiFetch("/api/manuals", {
        method: "POST",
        body: JSON.stringify({
            title, productId, categoryId, fileUrl: uploadRes.fileUrl, fileType: file.type,
            status: isAdmin() ? "approved" : "pending", description, uploadedBy: state.user.id, allowDownload: true
        })
    });
    if (res?.success) {
        await apiFetch("/api/activity-logs", {
            method: "POST",
            body: JSON.stringify({ action: "upload_manual", manualId: res.data?.id || null, userId: state.user.id })
        });
        showToast(isAdmin() ? "Đã upload và hiển thị ngay." : "Đã upload, chờ admin duyệt.");
        await loadDataAndRender();
        showPage("documents");
    }
});

$("#searchSuggest")?.addEventListener("click", e => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;
    state.search = item.textContent.replace("product", "").replace("manual", "").trim();
    $("#globalSearch").value = state.search;
    renderDocuments();
    renderProducts();
    $("#searchSuggest").style.display = "none";
});

document.addEventListener("click", e => {
    if (!$("#headerSearch")?.contains(e.target)) {
        const box = $("#searchSuggest");
        if (box) box.style.display = "none";
    }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") window.toggleDrawer(false); });

window.addEventListener("load", async () => {
    const loading = $("#loading");
    setTimeout(() => {
        loading.style.opacity = "0";
        loading.style.pointerEvents = "none";
        setTimeout(() => loading.remove(), 250);
    }, 500);
    await loadDataAndRender();
    showPage(state.currentPage);
});
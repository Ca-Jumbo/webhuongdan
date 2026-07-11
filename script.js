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

const fileState = {
    categoryIcon: { file: null, preview: "" },
    brandLogo: { file: null, preview: "" },
    productImage: { file: null, preview: "" }
};

const safe = (v) => (v ?? "").toString();
const el = (id) => document.getElementById(id);

function authHeaders() { return state.token ? { Authorization: `Bearer ${state.token}` } : {}; }

async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(path, {
            headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
            ...options
        });
        let data = null;
        try { data = await res.json(); } catch { data = null; }
        if (!res.ok) return { success: false, message: data?.message || `HTTP ${res.status}` };
        return data || { success: true };
    } catch (err) {
        return { success: false, message: err.message || "Network error" };
    }
}

function showToast(message) {
    const toast = $(".toast");
    if (!toast) return;
    const span = toast.querySelector("span");
    if (span) span.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function isAdmin() { return ["super_admin", "admin", "editor"].includes(state.user?.role); }
function isLoggedIn() { return !!state.user; }

function slugify(v) {
    return safe(v).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
    const btn = el("themeBtn");
    if (btn) btn.innerHTML = state.theme ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

function updateAuthUI() {
    const loginBtn = el("loginBtn"), logoutBtn = el("logoutBtn"), roleLabel = el("userRoleLabel");
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
    const map = {
        home: ["Manual Center | Trang chủ", "Kho tài liệu và sản phẩm doanh nghiệp."],
        categories: ["Manual Center | Danh mục", "Xem danh mục sản phẩm trên Manual Center."],
        products: ["Manual Center | Sản phẩm", "Danh sách sản phẩm và tài liệu liên quan."],
        documents: ["Manual Center | Tài liệu", "Trung tâm tài liệu và tải xuống."],
        admin: ["Manual Center | Quản trị", "Trang quản trị Manual Center."]
    };
    if (map[pageId]) setMeta(map[pageId][0], map[pageId][1]);
}

function showPage(pageId) {
    if (pageId === "admin" && !isAdmin()) {
        showToast("Chỉ admin mới được truy cập.");
        pageId = "login";
    }
    $$(".page").forEach(page => page.classList.remove("active"));
    const page = el(pageId);
    if (!page) return;
    page.classList.add("active");
    state.currentPage = pageId;
    localStorage.setItem("page", pageId);
    if (pageId === "notifications") markAllNotificationsRead();
    updateSeoByPage(pageId);
    renderPage(pageId);
}

function renderPage(pageId) {
    const map = {
        home: renderHome,
        categories: renderCategories,
        products: renderProducts,
        documents: renderDocuments,
        notifications: renderNotifications,
        profile: renderProfile,
        admin: renderAdmin
    };
    if (map[pageId]) map[pageId]();
}

function normalizeText(v) { return safe(v).toLowerCase(); }

async function loadData() {
    const ids = ["categories","products","brands","manuals","notifications","bookmarks","ratings","attachments","activity-logs","download-logs","users-count"];
    const [catRes, prodRes, brandRes, manRes, notiRes, bmRes, ratingRes, attRes, logRes, dlogRes, usersRes] = await Promise.all(ids.map(x => apiFetch(`/api/${x}`)));
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
const getProductSlug = id => products.find(p => String(p.id) === String(id))?.slug || slugify(getProductName(id));
const getManualSlug = id => manuals.find(m => String(m.id) === String(id))?.slug || slugify(manuals.find(m => String(m.id) === String(id))?.title || "");
const getManualRating = id => {
    const items = ratings.filter(r => String(r.manualId) === String(id));
    return items.length ? (items.reduce((s, r) => s + (Number(r.value) || 0), 0) / items.length).toFixed(1) : "0.0";
};

function countProductsByCategory(categoryId) { return products.filter(p => String(p.categoryId) === String(categoryId)).length; }
function countManualsByCategory(categoryId) { return manuals.filter(m => String(m.categoryId) === String(categoryId)).length; }
function countManualsByProduct(productId) { return manuals.filter(m => String(m.productId) === String(productId)).length; }

function renderSearchSuggest() {
    const box = el("searchSuggest");
    if (!box) return;
    const q = normalizeText(el("globalSearch")?.value || "");
    if (!q) { box.style.display = "none"; box.innerHTML = ""; return; }

    const items = [
        ...categories.filter(c => normalizeText(`${c.name} ${c.icon}`).includes(q)).slice(0, 4).map(c => ({ type: "category", id: c.id, label: c.name })),
        ...products.filter(p => normalizeText(`${p.name} ${getBrandName(p.brandId)} ${p.description} ${p.slug}`).includes(q)).slice(0, 4).map(p => ({ type: "product", id: p.id, label: p.name })),
        ...manuals.filter(m => normalizeText(`${m.title} ${m.description} ${m.fileType} ${m.slug}`).includes(q)).slice(0, 4).map(m => ({ type: "manual", id: m.id, label: m.title }))
    ];

    box.innerHTML = items.length
        ? items.map(item => `<div class="suggest-item" data-type="${item.type}" data-id="${item.id}">${item.label} <span>${item.type}</span></div>`).join("")
        : `<div class="suggest-item" data-type="none" data-id="">Không có kết quả</div>`;
    box.style.display = "block";
}

function renderHome() {
    if (el("statProducts")) el("statProducts").textContent = products.length;
    if (el("statManuals")) el("statManuals").textContent = manuals.length;
    if (el("statCategories")) el("statCategories").textContent = categories.length;
    if (el("statNotifications")) el("statNotifications").textContent = notifications.filter(n => !n.seen).length;
    if (el("homeProducts")) el("homeProducts").innerHTML = products.slice(0, 6).map(p => `<div class="card clickable" onclick="openProductBySlug('${getProductSlug(p.id)}')"><h3>${p.name}</h3><p>${getBrandName(p.brandId)} · ${getCategoryName(p.categoryId)}</p></div>`).join("") || `<div class="empty-state">Không có sản phẩm.</div>`;
    if (el("homeManuals")) el("homeManuals").innerHTML = manuals.slice(0, 6).map(m => `<div class="card clickable" onclick="openManualBySlug('${getManualSlug(m.id)}')"><h3>${m.title}</h3><p>${m.status}</p><div class="manual-info"><span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span><span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span></div></div>`).join("") || `<div class="empty-state">Không có tài liệu.</div>`;
}

function renderCategories() {
    const productMode = el("categoryModeProduct")?.checked !== false;
    const manualMode = el("categoryModeManual")?.checked !== false;
    const filtered = categories.filter(c => (!productMode || countProductsByCategory(c.id) > 0) && (!manualMode || countManualsByCategory(c.id) > 0));

    if (el("categoryGrid")) {
        el("categoryGrid").innerHTML = filtered.map(c => `
            <div class="card clickable" onclick="filterByCategory('${c.id}')">
                <h3>${c.name}</h3>
                <p><i class="${c.icon || "fa-solid fa-folder"}"></i></p>
                <div class="manual-info">
                    <span class="badge">${c.slug || slugify(c.name)}</span>
                    <span class="badge"><i class="fa-solid fa-box"></i> ${countProductsByCategory(c.id)} sản phẩm</span>
                    <span class="badge"><i class="fa-solid fa-file-lines"></i> ${countManualsByCategory(c.id)} tài liệu</span>
                </div>
            </div>
        `).join("") || `<div class="empty-state">Không có danh mục phù hợp.</div>`;
    }
}

function filterByCategory(categoryId) {
    if (el("productCategoryFilter")) el("productCategoryFilter").value = categoryId;
    showPage("products");
    renderProducts();
}

function renderProducts() {
    const q = normalizeText(el("productSearch")?.value || "");
    const category = el("productCategoryFilter")?.value || "all";
    const status = el("productStatusFilter")?.value || "all";
    const filtered = products.filter(p => {
        const text = normalizeText(`${p.name} ${getBrandName(p.brandId)} ${p.description} ${p.slug}`);
        return (!q || text.includes(q)) && (category === "all" || String(p.categoryId || "") === category) && (status === "all" || p.status === status);
    });

    if (el("productGrid")) {
        el("productGrid").innerHTML = filtered.map(p => `
            <div class="card clickable" onclick="openProductBySlug('${getProductSlug(p.id)}')">
                <h3>${p.name}</h3>
                <p>${getBrandName(p.brandId)}</p>
                <p>${getCategoryName(p.categoryId)}</p>
                ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}">` : ""}
                <div class="manual-info">
                    <span class="badge"><i class="fa-regular fa-file-lines"></i> ${countManualsByProduct(p.id)} tài liệu</span>
                    <span class="badge">${getProductSlug(p.id)}</span>
                </div>
            </div>
        `).join("") || `<div class="empty-state">Không có sản phẩm phù hợp.</div>`;
    }
}

function renderProductDetail(productId) {
    const p = products.find(item => String(item.id) === String(productId));
    if (!p) return;
    setMeta(`${p.name} | Manual Center`, p.description || "Chi tiết sản phẩm Manual Center.");
    if (el("productDetailBrand")) el("productDetailBrand").textContent = getBrandName(p.brandId) || "Thương hiệu";
    if (el("productDetailName")) el("productDetailName").textContent = p.name || "";
    if (el("productDetailDesc")) el("productDetailDesc").textContent = p.description || "";
    const related = manuals.filter(m => String(m.productId || "") === String(productId));
    if (el("productManualCount")) el("productManualCount").textContent = related.length;
    if (el("relatedManuals")) el("relatedManuals").innerHTML = related.map(m => `<div class="card clickable" onclick="openManualBySlug('${getManualSlug(m.id)}')"><h3>${m.title}</h3><p>${m.status}</p><span class="badge">${getManualSlug(m.id)}</span></div>`).join("") || `<div class="empty-state">Chưa có tài liệu liên quan.</div>`;
    showPage("productDetail");
}

function renderDocuments() {
    const keyword = normalizeText(el("docSearch")?.value || state.search);
    const filter = el("docFilter")?.value || "all";
    const statusFilter = el("docStatusFilter")?.value || "all";
    const filtered = manuals.filter(m => {
        const text = normalizeText(`${m.title} ${m.description} ${m.fileType} ${m.status} ${getProductName(m.productId)} ${getCategoryName(m.categoryId)} ${m.slug}`);
        return (!keyword || text.includes(keyword)) && (filter === "all" || String(m.categoryId || "") === filter) && (statusFilter === "all" || m.status === statusFilter);
    });
    if (el("manualGrid")) el("manualGrid").innerHTML = filtered.map(m => `<div class="card clickable" onclick="openManualBySlug('${getManualSlug(m.id)}')"><h3>${m.title}</h3><p>${m.description || ""}</p><div class="manual-info"><span class="badge">${m.status}</span><span class="badge"><i class="fa-regular fa-eye"></i> ${m.viewCount || 0}</span><span class="badge"><i class="fa-solid fa-download"></i> ${m.downloadCount || 0}</span><span class="badge"><i class="fa-regular fa-star"></i> ${getManualRating(m.id)}</span><span class="badge">${getManualSlug(m.id)}</span></div></div>`).join("") || `<div class="empty-state">Không tìm thấy tài liệu phù hợp.</div>`;
    if (el("emptyState")) el("emptyState").style.display = filtered.length ? "none" : "block";
}

function renderNotifications() {
    if (el("notificationList")) el("notificationList").innerHTML = notifications.length ? notifications.map(n => `<div class="card"><h3>${n.text || n.title || "Thông báo"}</h3><p>${n.seen ? "Đã đọc" : "Chưa đọc"}</p></div>`).join("") : `<div class="empty-state">Không có thông báo.</div>`;
}

async function markAllNotificationsRead() {
    const unread = notifications.filter(n => !n.seen);
    if (!unread.length) return;
    await Promise.all(unread.map(n => apiFetch(`/api/notifications/${n.id}/read`, { method: "PUT" }).catch(() => null)));
    notifications = notifications.map(n => ({ ...n, seen: true }));
    renderNotifications();
    renderHome();
}

function renderProfile() {
    const userBookmarks = bookmarks.filter(b => String(b.userId) === String(state.user?.id || ""));
    const userRatings = ratings.filter(r => String(r.userId) === String(state.user?.id || ""));
    const userLogs = activityLogs.filter(l => String(l.userId) === String(state.user?.id || ""));
    if (el("profileBox")) {
        el("profileBox").innerHTML = state.user
            ? `<div class="profile-header"><div><strong>${state.user.email || state.user.phone}</strong><br><span class="badge">${state.user.role}</span></div></div><div class="info-grid"><div class="info-card"><strong>${userBookmarks.length}</strong><div>Bookmark</div></div><div class="info-card"><strong>${userRatings.length}</strong><div>Ratings</div></div><div class="info-card"><strong>${userLogs.length}</strong><div>Hoạt động</div></div><div class="info-card"><strong>${manuals.filter(m => String(m.uploadedBy || "") === String(state.user.id)).length}</strong><div>Tài liệu của tôi</div></div></div>`
            : "Bạn chưa đăng nhập.";
    }
    if (el("currentPhaseText")) el("currentPhaseText").textContent = `${ROADMAP.current}: ${ROADMAP.currentText}`;
    if (el("nextPriorityList")) el("nextPriorityList").innerHTML = ROADMAP.next.map(item => `<li>${item}</li>`).join("");
}

function renderAdmin() {
    if (el("totalUsers")) el("totalUsers").textContent = usersCount;
    if (el("totalProducts")) el("totalProducts").textContent = products.length;
    if (el("totalDocs")) el("totalDocs").textContent = manuals.length;
    if (el("totalViews")) el("totalViews").textContent = manuals.reduce((s, m) => s + (m.viewCount || 0), 0);
    if (el("dashboardDownloads")) el("dashboardDownloads").textContent = manuals.reduce((s, m) => s + (m.downloadCount || 0), 0);
    if (el("dashboardPending")) el("dashboardPending").textContent = manuals.filter(m => m.status === "pending").length;
    if (el("dashboardToday")) el("dashboardToday").textContent = manuals.filter(m => new Date(m.createdAt || Date.now()).toDateString() === new Date().toDateString()).length;
    if (el("dashboardBookmarks")) el("dashboardBookmarks").textContent = bookmarks.length;

    if (el("adminCategoryList")) el("adminCategoryList").innerHTML = categories.map(c => `<div class="list-item"><span><strong>${c.name}</strong><br><small>${c.slug || slugify(c.name)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-secondary" type="button" onclick="openCategoryModal('${c.id}')">Sửa</button><button class="btn-secondary" onclick="deleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join("") || `<div class="empty-state">Chưa có danh mục.</div>`;
    if (el("adminBrandList")) el("adminBrandList").innerHTML = brands.map(b => `<div class="list-item"><span><strong>${b.name}</strong><br><small>${b.slug || slugify(b.name)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-secondary" type="button" onclick="openBrandModal('${b.id}')">Sửa</button><button class="btn-secondary" onclick="deleteBrand('${b.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join("") || `<div class="empty-state">Chưa có thương hiệu.</div>`;
    if (el("adminProductList")) el("adminProductList").innerHTML = products.map(p => `<div class="list-item"><span><strong>${p.name}</strong><br><small>${getBrandName(p.brandId)} · ${getCategoryName(p.categoryId)} · ${getProductSlug(p.id)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-secondary" type="button" onclick="openProductModal('${p.id}')">Sửa</button><button class="btn-secondary" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join("") || `<div class="empty-state">Chưa có sản phẩm.</div>`;
    if (el("adminManualList")) el("adminManualList").innerHTML = manuals.filter(m => m.status === "pending").map(m => `<div class="list-item"><span><strong>${m.title}</strong><br><small>${getProductName(m.productId) || "Chưa gán sản phẩm"} · ${getCategoryName(m.categoryId)} · ${getManualSlug(m.id)}</small></span><div style="display:flex; gap:8px; flex-wrap:wrap;"><button class="btn-primary" type="button" onclick="approveManual('${m.id}')">Duyệt</button><button class="btn-secondary" type="button" onclick="rejectManual('${m.id}')">Từ chối</button><button class="btn-secondary" type="button" onclick="deleteManual('${m.id}')">Xóa</button></div></div>`).join("") || `<div class="empty-state">Không có tài liệu chờ duyệt.</div>`;
}

function syncFilters() {
    if (el("docFilter")) el("docFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    if (el("productCategoryFilter")) el("productCategoryFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    if (el("newProductCategory")) el("newProductCategory").innerHTML = `<option value="">Chọn danh mục</option>` + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    if (el("newProductBrand")) el("newProductBrand").innerHTML = `<option value="">Chọn thương hiệu</option>` + brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
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
    renderFilePreview("categoryIcon");
    renderFilePreview("brandLogo");
    renderFilePreview("productImage");
    if (state.slugRoute) openRouteBySlug(state.slugRoute);
}

function ensureDetailBlocks() {
    if (!el("detailMeta")) {
        const meta = document.createElement("div");
        meta.id = "detailMeta";
        meta.className = "manual-info";
        meta.innerHTML = `<span class="badge"><i class="fa-regular fa-bookmark"></i> <span id="manualBookmarkCount">0</span> bookmark</span><span class="badge"><i class="fa-regular fa-star"></i> <span id="manualRatingCount">0</span> đánh giá</span><span class="badge"><i class="fa-regular fa-clock"></i> <span id="manualActivityCount">0</span> hoạt động</span><span class="badge"><i class="fa-solid fa-download"></i> <span id="manualDownloadLogCount">0</span> log tải</span>`;
        el("detailStatus")?.insertAdjacentElement("afterend", meta);
    }
    if (!el("ratingBox")) {
        const box = document.createElement("div");
        box.id = "ratingBox";
        box.className = "manual-action";
        el("previewBox")?.before(box);
    }
    if (!el("attachmentSection")) {
        const section = document.createElement("div");
        section.id = "attachmentSection";
        section.className = "preview-box";
        section.innerHTML = `<div class="preview-header"><h3>Attachments</h3><span class="badge">Files</span></div><div id="attachmentList" class="list-box"></div>`;
        el("previewBox")?.after(section);
    }
    if (!el("manualLogSection")) {
        const section = document.createElement("div");
        section.id = "manualLogSection";
        section.className = "preview-box";
        section.innerHTML = `<div class="preview-header"><h3>Hoạt động gần đây</h3><span class="badge">Logs</span></div><div id="logList" class="list-box"></div>`;
        el("attachmentSection")?.after(section);
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
    if (el("detailCategory")) el("detailCategory").textContent = getCategoryName(doc.categoryId);
    if (el("detailName")) el("detailName").textContent = doc.title;
    if (el("detailDesc")) el("detailDesc").textContent = doc.description || "";
    if (el("detailViews")) el("detailViews").textContent = doc.viewCount || 0;
    if (el("detailDownloads")) el("detailDownloads").textContent = doc.downloadCount || 0;
    if (el("detailStatus")) el("detailStatus").textContent = doc.status;
    if (el("detailDownloadBtn")) el("detailDownloadBtn").onclick = () => downloadManual(id);
    if (el("previewFrame")) el("previewFrame").src = doc.fileUrl || "about:blank";
    if (el("ratingBox")) el("ratingBox").innerHTML = `<button class="btn-secondary" type="button" onclick="addRating('${id}', 5)">5★</button><button class="btn-secondary" type="button" onclick="addRating('${id}', 4)">4★</button><button class="btn-secondary" type="button" onclick="addRating('${id}', 3)">3★</button><button class="btn-secondary" type="button" onclick="toggleBookmark('${id}')">Bookmark</button>`;
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
    if (el("logList")) el("logList").innerHTML = logs.length ? logs.map(l => `<div class="list-item"><span>${l.action}</span><span>${new Date(l.createdAt || Date.now()).toLocaleString("vi-VN")}</span></div>`).join("") : `<div class="empty-state">Chưa có log.</div>`;
}

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
    const modal = el("modalBox");
    const overlay = el("modalOverlay");
    if (!modal || !overlay) return;
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
    el("modalForm").onsubmit = async (e) => {
        e.preventDefault();
        await onSave(new FormData(e.target));
        closeModal();
    };
}

function closeModal() {
    el("modalBox")?.classList.remove("show");
    el("modalOverlay")?.classList.remove("show");
    if (el("modalBox")) el("modalBox").innerHTML = "";
    modalContext = null;
}

async function uploadPickedFile(kind) {
    const picked = fileState[kind].file;
    if (!picked) return "";
    const base64 = await fileToBase64(picked);
    const res = await apiFetch("/api/upload", {
        method: "POST",
        body: JSON.stringify({ fileName: picked.name, fileBase64: base64.split(",")[1], mimeType: picked.type, bucket: "images" })
    });
    return res?.success ? res.fileUrl : "";
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function renderFilePreview(kind) {
    const map = {
        categoryIcon: { box: "categoryIconPreview", label: "Icon danh mục" },
        brandLogo: { box: "brandLogoPreview", label: "Logo thương hiệu" },
        productImage: { box: "productImagePreview", label: "Ảnh sản phẩm" }
    };
    const target = el(map[kind].box);
    if (!target) return;
    target.innerHTML = fileState[kind].preview
        ? `<img src="${fileState[kind].preview}" alt="${map[kind].label}"><button class="btn-secondary" type="button" onclick="clearPickedFile('${kind}')">Xóa</button>`
        : `<div class="badge">Chưa chọn ${map[kind].label}</div>`;
}

function pickFile(kind, accept = "image/*") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        fileState[kind].file = file;
        fileState[kind].preview = URL.createObjectURL(file);
        renderFilePreview(kind);
    };
    input.click();
}

function clearPickedFile(kind) {
    fileState[kind] = { file: null, preview: "" };
    renderFilePreview(kind);
}

function pickCategoryIcon() { pickFile("categoryIcon"); }
function pickBrandLogo() { pickFile("brandLogo"); }
function pickProductImage() { pickFile("productImage"); }

function openCategoryModal(id = "") {
    const item = categories.find(c => String(c.id) === String(id));
    openModal(item ? "Sửa danh mục" : "Thêm danh mục", `
        <div class="form-group"><label>Tên danh mục</label><input name="name" value="${item?.name || ""}"></div>
        <div class="form-group"><label>Slug</label><input name="slug" value="${item?.slug || slugify(item?.name || "")}"></div>
        <div class="form-group"><label>Icon URL</label><input name="icon" value="${item?.icon || "fa-solid fa-folder"}"></div>
        <div class="form-group"><label>Hoặc chọn icon từ máy</label><button class="btn-secondary" type="button" onclick="pickCategoryIcon()">Chọn icon từ máy</button></div>
    `, async (form) => {
        const iconUrl = await uploadPickedFile("categoryIcon");
        const payload = {
            name: form.get("name")?.toString().trim(),
            slug: form.get("slug")?.toString().trim() || slugify(form.get("name")),
            icon: iconUrl || form.get("icon")?.toString().trim() || "fa-solid fa-folder"
        };
        const res = item
            ? await apiFetch(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
            : await apiFetch("/api/categories", { method: "POST", body: JSON.stringify(payload) });
        if (res?.success) {
            clearPickedFile("categoryIcon");
            await loadDataAndRender();
        }
    });
}

function openBrandModal(id = "") {
    const item = brands.find(b => String(b.id) === String(id));
    openModal(item ? "Sửa thương hiệu" : "Thêm thương hiệu", `
        <div class="form-group"><label>Tên thương hiệu</label><input name="name" value="${item?.name || ""}"></div>
        <div class="form-group"><label>Slug</label><input name="slug" value="${item?.slug || slugify(item?.name || "")}"></div>
        <div class="form-group"><label>Logo URL</label><input name="logoUrl" value="${item?.logoUrl || ""}"></div>
        <div class="form-group"><label>Hoặc chọn logo từ máy</label><button class="btn-secondary" type="button" onclick="pickBrandLogo()">Chọn logo từ máy</button></div>
    `, async (form) => {
        const logoUrl = await uploadPickedFile("brandLogo");
        const payload = {
            name: form.get("name")?.toString().trim(),
            slug: form.get("slug")?.toString().trim() || slugify(form.get("name")),
            logoUrl: logoUrl || form.get("logoUrl")?.toString().trim() || ""
        };
        const res = item
            ? await apiFetch(`/api/brands/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
            : await apiFetch("/api/brands", { method: "POST", body: JSON.stringify(payload) });
        if (res?.success) {
            clearPickedFile("brandLogo");
            await loadDataAndRender();
        }
    });
}

function openProductModal(id = "") {
    const item = products.find(p => String(p.id) === String(id));
    openModal(item ? "Sửa sản phẩm" : "Thêm sản phẩm", `
        <div class="form-group"><label>Tên sản phẩm</label><input name="name" value="${item?.name || ""}"></div>
        <div class="form-group"><label>Brand</label><select name="brandId">${brands.map(b => `<option value="${b.id}" ${String(item?.brandId || "") === String(b.id) ? "selected" : ""}>${b.name}</option>`).join("")}</select></div>
        <div class="form-group"><label>Danh mục</label><select name="categoryId">${categories.map(c => `<option value="${c.id}" ${String(item?.categoryId || "") === String(c.id) ? "selected" : ""}>${c.name}</option>`).join("")}</select></div>
        <div class="form-group"><label>Trạng thái</label><select name="status"><option value="active" ${item?.status === "active" ? "selected" : ""}>active</option><option value="hidden" ${item?.status === "hidden" ? "selected" : ""}>hidden</option><option value="draft" ${item?.status === "draft" ? "selected" : ""}>draft</option></select></div>
        <div class="form-group"><label>Slug</label><input name="slug" value="${item?.slug || slugify(item?.name || "")}"></div>
        <div class="form-group"><label>Mô tả</label><input name="description" value="${item?.description || ""}"></div>
        <div class="form-group"><label>Ảnh sản phẩm</label><button class="btn-secondary" type="button" onclick="pickProductImage()">Chọn hình ảnh từ máy</button></div>
    `, async (form) => {
        const imageUrl = await uploadPickedFile("productImage");
        const payload = {
            name: form.get("name")?.toString().trim(),
            brandId: form.get("brandId") || null,
            categoryId: form.get("categoryId") || null,
            status: form.get("status") || "active",
            slug: form.get("slug")?.toString().trim() || slugify(form.get("name")),
            description: form.get("description")?.toString().trim(),
            imageUrl: imageUrl || item?.imageUrl || ""
        };
        const res = item
            ? await apiFetch(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
            : await apiFetch("/api/products", { method: "POST", body: JSON.stringify(payload) });
        if (res?.success) {
            clearPickedFile("productImage");
            await loadDataAndRender();
        }
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
        try { onDone(JSON.parse(reader.result)); } catch { showToast("File JSON không hợp lệ."); }
    };
    reader.readAsText(file);
}

async function approveManual(id) { const res = await apiFetch(`/api/manuals/${id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }); if (res?.success) await loadDataAndRender(); }
async function rejectManual(id) { const res = await apiFetch(`/api/manuals/${id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }); if (res?.success) await loadDataAndRender(); }
async function deleteManual(id) { await apiFetch(`/api/manuals/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteCategory(id) { await apiFetch(`/api/categories/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteBrand(id) { await apiFetch(`/api/brands/${id}`, { method: "DELETE" }); await loadDataAndRender(); }
async function deleteProduct(id) { await apiFetch(`/api/products/${id}`, { method: "DELETE" }); await loadDataAndRender(); }

async function exportAllData() {
    exportJson("manual-center-export.json", { categories, brands, products, manuals, attachments, bookmarks, ratings, notifications, activityLogs, downloadLogs });
}

async function handleImportJson(file) {
    if (!file) return;
    importJsonFile(file, (data) => showToast(data ? "Đã đọc file import." : "File import rỗng."));
}

function renderManualAttachments(manualId) {
    const box = el("attachmentList");
    if (!box) return;
    const items = attachments.filter(a => String(a.manualId) === String(manualId));
    box.innerHTML = items.length ? items.map(a => `<div class="list-item"><span><strong>${a.name}</strong><br><small>${a.fileType || ""}</small></span><a class="btn-secondary" href="${a.fileUrl}" target="_blank" rel="noopener">Mở file</a></div>`).join("") : `<div class="empty-state">Chưa có file đính kèm.</div>`;
}

function renderManualInsights(manualId) {
    if (el("manualBookmarkCount")) el("manualBookmarkCount").textContent = bookmarks.filter(b => String(b.manualId) === String(manualId)).length;
    if (el("manualRatingCount")) el("manualRatingCount").textContent = ratings.filter(r => String(r.manualId) === String(manualId)).length;
    if (el("manualActivityCount")) el("manualActivityCount").textContent = activityLogs.filter(l => String(l.manualId) === String(manualId)).length;
    if (el("manualDownloadLogCount")) el("manualDownloadLogCount").textContent = downloadLogs.filter(l => String(l.manualId) === String(manualId)).length;
}

function renderManualStats() {
    if (el("currentPhaseText")) el("currentPhaseText").textContent = `${ROADMAP.current}: ${ROADMAP.currentText}`;
    if (el("nextPriorityList")) el("nextPriorityList").innerHTML = ROADMAP.next.map(item => `<li>${item}</li>`).join("");
}

function revealOnScroll() {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add("show");
    }), { threshold: 0.08 });
    $$(".reveal").forEach(elm => observer.observe(elm));
}

window.showPage = showPage;
window.openAdmin = () => showPage("admin");
window.openDetail = openDetail;
window.openProductDetail = openProductBySlug;
window.openManualBySlug = openManualBySlug;
window.downloadManual = downloadManual;
window.toggleBookmark = toggleBookmark;
window.addRating = addRating;
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
window.handleImportJson = handleImportJson;
window.pickCategoryIcon = pickCategoryIcon;
window.pickBrandLogo = pickBrandLogo;
window.pickProductImage = pickProductImage;
window.clearPickedFile = clearPickedFile;
window.filterByCategory = filterByCategory;
window.toggleDrawer = function (open) {
    document.body.classList.toggle("drawer-open", open);
    const menuBtn = el("menuBtn");
    if (menuBtn) menuBtn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
};

el("themeBtn")?.addEventListener("click", () => { state.theme = !state.theme; applyTheme(); });
el("logoutBtn")?.addEventListener("click", () => { saveAuth({ user: null, token: "" }); showToast("Đã đăng xuất."); showPage("home"); });
el("notifyBtn")?.addEventListener("click", () => showPage("notifications"));
el("heroSearchBtn")?.addEventListener("click", () => { state.search = el("heroSearch")?.value.trim() || ""; renderCategories(); renderDocuments(); renderProducts(); renderSearchSuggest(); showPage("categories"); });
el("globalSearch")?.addEventListener("input", e => { state.search = e.target.value.trim(); renderSearchSuggest(); renderCategories(); renderDocuments(); renderProducts(); });
el("globalSearch")?.addEventListener("keydown", e => { if (e.key === "Enter") { renderCategories(); renderDocuments(); renderProducts(); showPage("categories"); } });
el("productSearch")?.addEventListener("input", renderProducts);
el("productCategoryFilter")?.addEventListener("change", renderProducts);
el("productStatusFilter")?.addEventListener("change", renderProducts);
el("docSearch")?.addEventListener("input", renderDocuments);
el("docFilter")?.addEventListener("change", renderDocuments);
el("docStatusFilter")?.addEventListener("change", renderDocuments);
el("categoryModeProduct")?.addEventListener("change", renderCategories);
el("categoryModeManual")?.addEventListener("change", renderCategories);

el("emailAuthForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = el("authEmail")?.value.trim();
    const password = el("authPassword")?.value.trim();
    const loginRes = await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (loginRes?.success) {
        saveAuth(loginRes);
        showToast("Đăng nhập thành công.");
        showPage("home");
    } else {
        const registerRes = await apiFetch("/api/register", { method: "POST", body: JSON.stringify({ email, password, authType: "email" }) });
        if (registerRes?.success) {
            saveAuth(registerRes);
            showToast("Đăng ký thành công.");
            showPage("home");
        } else {
            showToast(registerRes?.message || loginRes?.message || "Lỗi đăng nhập.");
        }
    }
});

el("searchSuggest")?.addEventListener("click", e => {
    const item = e.target.closest(".suggest-item");
    if (!item) return;
    const type = item.dataset.type, id = item.dataset.id;
    if (type === "product") openProductBySlug(id);
    else if (type === "manual") openManualBySlug(id);
    else if (type === "category") filterByCategory(id);
    else {
        state.search = item.textContent.trim();
        if (el("globalSearch")) el("globalSearch").value = state.search;
        renderCategories(); renderDocuments(); renderProducts();
    }
    if (el("searchSuggest")) el("searchSuggest").style.display = "none";
});

document.addEventListener("click", e => {
    if (!el("headerSearch")?.contains(e.target)) {
        const box = el("searchSuggest");
        if (box) box.style.display = "none";
    }
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        window.toggleDrawer(false);
        closeModal();
    }
});

window.addEventListener("load", async () => {
    const loading = el("loading");
    setTimeout(() => {
        if (!loading) return;
        loading.style.opacity = "0";
        loading.style.pointerEvents = "none";
        setTimeout(() => loading.remove(), 250);
    }, 500);
    await loadDataAndRender();
    if (state.slugRoute) openRouteBySlug(state.slugRoute);
    showPage(state.currentPage);
});
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const body = document.body;
const pages = $$(".page");

const STORAGE_KEYS = {
    user: "manual_user",
    theme: "manual_theme",
    otp: "manual_otp",
    sortMode: "manual_sort_mode"
};

const defaultCategories = [
    { id: 1, name: "Năng lượng mặt trời", icon: "fa-solid fa-solar-panel" },
    { id: 2, name: "Camera", icon: "fa-solid fa-video" },
    { id: 3, name: "Thiết bị âm thanh", icon: "fa-solid fa-volume-high" },
    { id: 4, name: "Màn hình LED", icon: "fa-solid fa-tv" },
    { id: 5, name: "Điện lạnh", icon: "fa-solid fa-snowflake" },
    { id: 6, name: "Khác", icon: "fa-solid fa-boxes-stacked" }
];

const defaultManuals = [
    { id: 1, name: "Solar Inverter FR-SOL 5KW", category: "Năng lượng mặt trời", view: 1260, download: 320, allowDownload: true, image: "images/manual-01.jpg", desc: "Hướng dẫn cài đặt và vận hành inverter năng lượng mặt trời.", date: "2026-07-01" },
    { id: 2, name: "Camera IP Setup Guide", category: "Camera", view: 890, download: 145, allowDownload: true, image: "images/manual-01.jpg", desc: "Tài liệu lắp đặt và cấu hình hệ thống camera.", date: "2026-06-28" },
    { id: 3, name: "LED Display Operation Manual", category: "Màn hình LED", view: 620, download: 90, allowDownload: false, image: "images/manual-01.jpg", desc: "Hướng dẫn vận hành và bảo trì màn hình LED.", date: "2026-06-20" }
];

let state = {
    currentPage: localStorage.getItem("page") || "home",
    theme: localStorage.getItem(STORAGE_KEYS.theme) === "true",
    filter: "all",
    search: "",
    sortMode: localStorage.getItem(STORAGE_KEYS.sortMode) || "latest",
    user: JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null"),
    selectedAuth: "email",
    selectedDetailId: 1
};

let categories = [...defaultCategories];
let manuals = [...defaultManuals];
let notifications = [];

function showToast(message) {
    const toast = $(".toast");
    if (!toast) return;
    toast.querySelector("span").textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function apiFetch(path, options = {}) {
    return fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
    }).then(async res => {
        try { return await res.json(); } catch { return { success: false, message: "Phản hồi server không hợp lệ." }; }
    });
}

async function loadData() {
    try {
        const [catRes, manRes, notiRes] = await Promise.all([
            apiFetch("/api/categories"),
            apiFetch("/api/manuals"),
            apiFetch("/api/notifications")
        ]);

        if (catRes?.success && Array.isArray(catRes.data) && catRes.data.length) categories = catRes.data;
        if (manRes?.success && Array.isArray(manRes.data) && manRes.data.length) manuals = manRes.data;
        if (notiRes?.success && Array.isArray(notiRes.data)) notifications = notiRes.data;
    } catch {
        showToast("Không tải được dữ liệu từ Supabase.");
    }
}

function isAdmin() {
    return state.user?.role === "admin";
}

function isLoggedIn() {
    return !!state.user;
}

function saveUser(user) {
    state.user = user;
    if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.user);
    updateAuthUI();
}

function getUnreadCount() {
    return notifications.filter(n => !n.seen).length;
}

function updateNotificationBadge() {
    const count = getUnreadCount();
    const btn = $("#notifyBtn");
    if (!btn) return;
    btn.innerHTML = `<i class="fa-regular fa-bell"></i>${count ? `<span id="notificationBadge" class="badge">${count}</span>` : ""}`;
}

function renderNotifications() {
    let panel = $("#notificationPanel");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "notificationPanel";
        panel.className = "panel-card hidden";
        panel.style.cssText = "position:fixed; right:20px; top:70px; width:320px; z-index:1001; max-height:60vh; overflow:auto;";
        document.body.appendChild(panel);
    }

    panel.innerHTML = notifications.length ? notifications.map(n => `
        <div class="admin-item">
            <div><strong>${n.text}</strong><br><small>${n.time_text || ""}</small></div>
        </div>
    `).join("") : `<div class="empty-state">Không có thông báo</div>`;
}

function toggleNotificationPanel() {
    const panel = $("#notificationPanel");
    if (!panel) return;
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
        notifications = notifications.map(n => ({ ...n, seen: true }));
        apiFetch("/api/notifications/mark-seen", { method: "POST" });
        updateNotificationBadge();
        renderNotifications();
    }
}

function updateAuthUI() {
    const loginBtn = $("#loginBtn");
    const logoutBtn = $("#logoutBtn");
    const roleLabel = $("#userRoleLabel");

    if (state.user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
        if (roleLabel) roleLabel.textContent = state.user.role === "admin" ? "Quản trị viên" : "Khách đã đăng nhập";
    } else {
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (roleLabel) roleLabel.textContent = "Khách truy cập";
    }
}

function showPage(pageId) {
    if (pageId === "admin" && !isAdmin()) {
        showToast("Chỉ admin mới được truy cập trang quản trị.");
        pageId = "login";
    }
    pages.forEach(page => page.classList.remove("active"));
    const page = $("#" + pageId);
    if (page) {
        page.classList.add("active");
        state.currentPage = pageId;
        localStorage.setItem("page", pageId);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function renderCategoryMenu() {
    const list = $("#categoryList");
    const grid = $("#categoryGrid");
    const uploadCategory = $("#docCategory");
    if (!list || !grid || !uploadCategory) return;

    list.innerHTML = `
        <li class="${state.filter === "all" ? "active" : ""}" data-filter="all"><i class="fa-solid fa-layer-group"></i>Tất cả</li>
        ${categories.map(cat => `<li data-filter="${cat.name.toLowerCase()}"><i class="${cat.icon}"></i>${cat.name}</li>`).join("")}
    `;

    grid.innerHTML = `
        <div class="category-card reveal" data-category="all">
            <div class="icon"><i class="fa-solid fa-layer-group"></i></div>
            <h3>Tất cả</h3>
            <p>Xem toàn bộ tài liệu trong hệ thống.</p>
        </div>
        ${categories.map(cat => `
            <div class="category-card reveal" data-category="${cat.name.toLowerCase()}">
                <div class="icon"><i class="${cat.icon}"></i></div>
                <h3>${cat.name}</h3>
                <p>Danh mục ${cat.name}.</p>
            </div>
        `).join("")}
    `;

    uploadCategory.innerHTML = `
        <option value="">-- Chọn danh mục --</option>
        ${categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join("")}
    `;
}

function updateStats() {
    const totalDownloads = manuals.reduce((sum, item) => sum + (item.download || 0), 0);
    const totalViews = manuals.reduce((sum, item) => sum + (item.view || 0), 0);

    $("#statCategories").textContent = categories.length;
    $("#statManuals").textContent = manuals.length;
    $("#statDownloads").textContent = totalDownloads.toLocaleString();
    $("#statPublic").textContent = manuals.filter(item => item.allowDownload).length;
    $("#totalManuals").textContent = manuals.length;
    $("#totalViews").textContent = totalViews.toLocaleString();
    $("#totalDownloads").textContent = totalDownloads.toLocaleString();
    $("#savedTheme").textContent = state.theme ? "ON" : "OFF";
}

function renderManuals() {
    const grid = $("#manualGrid");
    const emptyState = $("#emptyState");
    if (!grid) return;

    const keyword = `${state.search} ${$("#globalSearch")?.value || ""} ${$("#heroSearch")?.value || ""}`.toLowerCase().trim();
    let filtered = manuals.filter(item => {
        const matchesCategory = state.filter === "all" || item.category.toLowerCase().includes(state.filter);
        const matchesSearch = !keyword || `${item.name} ${item.category} ${item.desc}`.toLowerCase().includes(keyword);
        return matchesCategory && matchesSearch;
    });

    grid.innerHTML = filtered.map(item => `
        <div class="manual-card reveal">
            <div class="manual-thumb"><img src="${item.image}" alt="${item.name}"></div>
            <div class="manual-content">
                <div class="manual-category">${item.category}</div>
                <h3>${item.name}</h3>
                <p>${item.desc}</p>
                <div class="manual-info">
                    <span><i class="fa-regular fa-eye"></i> ${Number(item.view || 0).toLocaleString()}</span>
                    <span><i class="fa-solid fa-download"></i> ${Number(item.download || 0).toLocaleString()}</span>
                    <span class="badge ${item.allowDownload ? "permission-on" : "permission-off"}">${item.allowDownload ? "Có thể tải" : "Không tải"}</span>
                </div>
                <div class="manual-action">
                    <button class="btn-primary" type="button" onclick="openDetail('${item.id}')">Xem chi tiết</button>
                    <button class="btn-secondary" type="button" onclick="requireLoginForDownload('${item.id}')">${item.allowDownload ? "Tải tài liệu" : "Không cho tải"}</button>
                </div>
            </div>
        </div>
    `).join("");

    if (emptyState) emptyState.style.display = filtered.length ? "none" : "block";
    updateStats();
}

function openDetail(id) {
    const doc = manuals.find(item => String(item.id) === String(id));
    if (!doc) return;

    state.selectedDetailId = id;
    $("#detailCategory").textContent = doc.category;
    $("#detailName").textContent = doc.name;
    $("#detailDesc").textContent = doc.desc;
    $("#detailViews").textContent = Number(doc.view || 0).toLocaleString();
    $("#detailDownloads").textContent = Number(doc.download || 0).toLocaleString();
    $("#detailPermission").textContent = doc.allowDownload ? "Được phép tải" : "Không cho tải";
    $("#detailPermission").className = "badge " + (doc.allowDownload ? "permission-on" : "permission-off");
    $("#detailDownloadBtn").textContent = doc.allowDownload ? "Tải tài liệu" : "Không cho tải";
    $("#detailDownloadBtn").onclick = () => requireLoginForDownload(id);
    apiFetch(`/api/manuals/${id}/counter`, { method: "PATCH", body: JSON.stringify({ field: "view" }) }).then(loadDataAndRender);
    showPage("manual");
}

async function requireLoginForDownload(id) {
    const doc = manuals.find(item => String(item.id) === String(id));
    if (!doc) return;

    if (!isLoggedIn()) {
        showToast("Bạn cần đăng nhập để tải tài liệu.");
        showPage("login");
        return;
    }

    if (!doc.allowDownload && !isAdmin()) {
        showToast("Tài liệu này hiện không cho phép tải.");
        return;
    }

    await apiFetch(`/api/manuals/${id}/counter`, { method: "PATCH", body: JSON.stringify({ field: "download" }) });
    showToast("Đang chuẩn bị tải tài liệu...");
    await loadDataAndRender();
}

function renderAdminLists() {
    const catList = $("#adminCategoryList");
    const manList = $("#adminManualList");
    if (!catList || !manList) return;

    if (!isAdmin()) {
        catList.innerHTML = "";
        manList.innerHTML = "<div class='lock-note'>Không có quyền truy cập.</div>";
        return;
    }

    catList.innerHTML = categories.map(cat => `
        <div class="admin-item">
            <div><strong>${cat.name}</strong><br><small>${cat.icon}</small></div>
            <div class="admin-actions">
                <button class="delete-icon" type="button" onclick="deleteCategory('${cat.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join("");

    manList.innerHTML = manuals.map(item => `
        <div class="admin-item">
            <div>
                <strong>${item.name}</strong><br>
                <small>${item.category} • ${Number(item.view || 0).toLocaleString()} lượt xem • ${Number(item.download || 0).toLocaleString()} lượt tải</small>
            </div>
            <div class="admin-actions">
                <button class="toggle-icon" type="button" onclick="toggleDownload('${item.id}')"><i class="fa-solid ${item.allowDownload ? "fa-lock-open" : "fa-lock"}"></i></button>
                <button class="delete-icon" type="button" onclick="deleteManual('${item.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join("");
}

async function addCategory() {
    if (!isAdmin()) return showToast("Chỉ admin được thêm danh mục.");
    const name = $("#newCategoryName")?.value.trim();
    const icon = $("#newCategoryIcon")?.value.trim() || "fa-solid fa-layer-group";
    if (!name) return showToast("Vui lòng nhập tên danh mục.");
    const res = await apiFetch("/api/categories", { method: "POST", body: JSON.stringify({ name, icon }) });
    if (res?.success) {
        $("#newCategoryName").value = "";
        $("#newCategoryIcon").value = "";
        await loadDataAndRender();
        showToast("Đã thêm danh mục.");
    } else showToast(res?.message || "Không thể thêm danh mục.");
}

async function deleteCategory(id) {
    if (!isAdmin()) return showToast("Chỉ admin được xóa danh mục.");
    await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
    await loadDataAndRender();
    showToast("Đã xóa danh mục.");
}

async function deleteManual(id) {
    if (!isAdmin()) return showToast("Chỉ admin được xóa tài liệu.");
    await apiFetch(`/api/manuals/${id}`, { method: "DELETE" });
    await loadDataAndRender();
    showToast("Đã xóa tài liệu.");
}

async function toggleDownload(id) {
    if (!isAdmin()) return showToast("Chỉ admin được chỉnh quyền tải.");
    const doc = manuals.find(m => String(m.id) === String(id));
    if (!doc) return;
    await apiFetch(`/api/manuals/${id}/permission`, { method: "PATCH", body: JSON.stringify({ allowDownload: !doc.allowDownload }) });
    await loadDataAndRender();
}

function applyTheme() {
    body.classList.toggle("dark", state.theme);
    localStorage.setItem(STORAGE_KEYS.theme, String(state.theme));
    updateStats();
}

function runReveal() {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("show");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    elements.forEach(el => observer.observe(el));
}

function bindSearch(inputSelector) {
    const input = $(inputSelector);
    if (!input) return;
    input.addEventListener("input", function () {
        state.search = this.value.trim();
        renderManuals();
    });
}

async function loadDataAndRender() {
    await loadData();
    renderCategoryMenu();
    renderManuals();
    renderAdminLists();
    renderNotifications();
    updateNotificationBadge();
    updateStats();
    updateAuthUI();
    runReveal();
}

window.showPage = showPage;
window.openDetail = openDetail;
window.requireLoginForDownload = requireLoginForDownload;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.deleteManual = deleteManual;
window.toggleDownload = toggleDownload;
window.toggleDrawer = function (open) {
    document.body.classList.toggle("drawer-open", open);
    const menuBtn = $("#menuBtn");
    if (menuBtn) menuBtn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
};

window.addEventListener("load", async () => {
    const loading = $("#loading");
    if (loading) {
        setTimeout(() => {
            loading.style.opacity = "0";
            loading.style.pointerEvents = "none";
            setTimeout(() => loading.remove(), 250);
        }, 500);
    }

    await loadDataAndRender();
    applyTheme();
    showPage(state.currentPage);
});

bindSearch("#globalSearch");
bindSearch("#heroSearch");

$("#heroSearchBtn")?.addEventListener("click", () => {
    state.search = $("#heroSearch")?.value.trim() || "";
    renderManuals();
    showPage("home");
});

$("#notifyBtn")?.addEventListener("click", () => toggleNotificationPanel());

$("#logoutBtn")?.addEventListener("click", () => {
    saveUser(null);
    showToast("Đã đăng xuất.");
    showPage("home");
});

$("#emailAuthForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#authEmail")?.value.trim();
    const password = $("#authPassword")?.value.trim();
    if (!email || !password) return showToast("Vui lòng nhập email và mật khẩu.");

    const loginRes = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });

    if (loginRes?.success) {
        saveUser(loginRes.user);
        showToast("Đăng nhập thành công.");
        showPage(loginRes.user.role === "admin" ? "admin" : "home");
        return;
    }

    const registerRes = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });

    if (registerRes?.success) {
        saveUser(registerRes.user);
        showToast("Đăng ký thành công.");
        showPage("home");
    } else {
        showToast(registerRes?.message || loginRes?.message || "Không thể đăng nhập.");
    }
});

$("#googleAuthForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast("Google login cần cấu hình OAuth thật ở backend.");
});

$("#sendOtpBtn")?.addEventListener("click", () => {
    const phone = $("#authPhone")?.value.trim();
    if (!phone) return showToast("Nhập số điện thoại trước.");
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    localStorage.setItem(STORAGE_KEYS.otp, JSON.stringify({ phone, otp, time: Date.now() }));
    showToast("Đã tạo OTP demo: " + otp);
});

$("#otpAuthForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const phone = $("#authPhone")?.value.trim();
    const otp = $("#authOtp")?.value.trim();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.otp) || "null");
    if (!phone || !otp) return showToast("Vui lòng nhập số điện thoại và OTP.");
    if (!saved || saved.phone !== phone || saved.otp !== otp) return showToast("OTP không đúng.");
    saveUser({ email: phone, role: "user", auth: "otp" });
    showToast("Xác thực OTP thành công.");
    showPage("home");
});

$("#uploadForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isLoggedIn()) return showToast("Bạn cần đăng nhập để upload tài liệu.");

    const name = $("#docName")?.value.trim();
    const category = $("#docCategory")?.value;
    const file = $("#docFile")?.files?.[0];
    if (!name || !category || !file) return showToast("Vui lòng nhập đủ thông tin.");

    const res = await apiFetch("/api/manuals", {
        method: "POST",
        body: JSON.stringify({
            name,
            category,
            imageUrl: "images/manual-01.jpg",
            description: "Tài liệu mới vừa được thêm vào hệ thống."
        })
    });

    if (res?.success) {
        $("#docName").value = "";
        $("#docFile").value = "";
        await loadDataAndRender();
        showToast("Đã thêm tài liệu mới.");
        showPage("home");
    } else showToast(res?.message || "Không thể upload tài liệu.");
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        showPage("home");
        window.toggleDrawer(false);
        const panel = $("#notificationPanel");
        if (panel) panel.classList.add("hidden");
    }
});

document.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", function (e) {
        const ripple = document.createElement("span");
        const size = Math.max(this.clientWidth, this.clientHeight);
        const rect = this.getBoundingClientRect();
        ripple.className = "ripple";
        ripple.style.width = ripple.style.height = size + "px";
        ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
        ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 550);
    });
});
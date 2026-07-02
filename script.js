"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const body = document.body;
const pages = $$(".page");

const STORAGE_KEYS = {
    user: "manual_user",
    theme: "manual_theme",
    categories: "manual_categories",
    manuals: "manual_manuals",
    otp: "manual_otp",
    notifications: "manual_notifications"
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
    { id: 1, name: "Solar Inverter FR-SOL 5KW", category: "Năng lượng mặt trời", view: 1260, download: 320, allowDownload: true, image: "images/manual-01.jpg", desc: "Hướng dẫn cài đặt và vận hành inverter năng lượng mặt trời." },
    { id: 2, name: "Camera IP Setup Guide", category: "Camera", view: 890, download: 145, allowDownload: true, image: "images/manual-01.jpg", desc: "Tài liệu lắp đặt và cấu hình hệ thống camera." },
    { id: 3, name: "LED Display Operation Manual", category: "Màn hình LED", view: 620, download: 90, allowDownload: false, image: "images/manual-01.jpg", desc: "Hướng dẫn vận hành và bảo trì màn hình LED." }
];

const defaultNotifications = [
    { id: 1, text: "Có 3 tài liệu mới vừa được thêm.", seen: false, time: "Vừa xong" },
    { id: 2, text: "Admin vừa cập nhật quyền tải cho một tài liệu.", seen: false, time: "5 phút trước" },
    { id: 3, text: "Hệ thống đã đồng bộ danh mục thành công.", seen: true, time: "Hôm nay" }
];

let state = {
    currentPage: localStorage.getItem("page") || "home",
    theme: localStorage.getItem(STORAGE_KEYS.theme) === "true",
    filter: "all",
    search: "",
    user: JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null"),
    selectedAuth: "email",
    selectedDetailId: 1
};

let categories = loadData(STORAGE_KEYS.categories, defaultCategories);
let manuals = loadData(STORAGE_KEYS.manuals, defaultManuals);
let notifications = loadData(STORAGE_KEYS.notifications, defaultNotifications);

function loadData(key, fallback) {
    const data = localStorage.getItem(key);
    if (!data) return [...fallback];
    try { return JSON.parse(data); } catch { return [...fallback]; }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function persistAll() {
    saveData(STORAGE_KEYS.categories, categories);
    saveData(STORAGE_KEYS.manuals, manuals);
    saveData(STORAGE_KEYS.notifications, notifications);
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

function showToast(message) {
    const toast = $(".toast");
    if (!toast) return;
    toast.querySelector("span").textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleDrawer(open) {
    document.body.classList.toggle("drawer-open", open);
    const menuBtn = $("#menuBtn");
    if (menuBtn) menuBtn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
}

function closeMobileDrawer() {
    if (window.innerWidth <= 900) toggleDrawer(false);
}

function updateNotificationBadge() {
    const badge = $("#notificationBadge");
    if (!badge) return;
    const count = getUnreadCount();
    badge.textContent = count > 0 ? String(count) : "";
    badge.style.display = count > 0 ? "inline-flex" : "none";
}

function renderNotifications() {
    const list = $("#notificationList");
    if (!list) return;
    list.innerHTML = notifications.map(n => `
        <div class="notify-item ${n.seen ? "seen" : ""}">
            <div class="notify-dot"></div>
            <div>
                <strong>${n.text}</strong>
                <div class="notify-time">${n.time}</div>
            </div>
        </div>
    `).join("");
}

function toggleNotificationPanel(force) {
    const panel = $("#notificationPanel");
    if (!panel) return;
    const open = typeof force === "boolean" ? force : panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !open);
    if (open) {
        notifications = notifications.map(n => ({ ...n, seen: true }));
        persistAll();
        updateNotificationBadge();
        renderNotifications();
    }
}

function updateSearchSuggestions(value) {
    const box = $("#searchSuggestions");
    if (!box) return;
    const keyword = value.trim().toLowerCase();

    if (!keyword) {
        box.classList.add("hidden");
        box.innerHTML = "";
        return;
    }

    const matches = manuals
        .filter(m => `${m.name} ${m.category} ${m.desc}`.toLowerCase().includes(keyword))
        .slice(0, 5);

    box.innerHTML = matches.length ? matches.map(item => `
        <div class="suggestion-item" onclick="openDetail(${item.id})">
            <strong>${item.name}</strong>
            <small>${item.category}</small>
        </div>
    `).join("") : `<div class="suggestion-empty">Không có kết quả phù hợp</div>`;

    box.classList.remove("hidden");
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
    closeMobileDrawer();
    runReveal();
}

function openAdmin() {
    if (!isAdmin()) {
        showToast("Bạn cần đăng nhập tài khoản admin.");
        showPage("login");
        return;
    }
    showPage("admin");
}

function requireLoginForDownload(id) {
    const doc = manuals.find(item => item.id === id) || manuals.find(item => item.id === state.selectedDetailId);
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

    showToast("Đang chuẩn bị tải tài liệu...");
    doc.download += 1;
    persistAll();
    renderManuals();
    renderAdminLists();
    updateStats();
}

function updateAuthUI() {
    const loginBtn = $("#loginBtn");
    const logoutBtn = $("#logoutBtn");
    const roleLabel = $("#userRoleLabel");
    const authTabs = $$(".auth-tabs button");

    if (state.user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
        if (roleLabel) roleLabel.textContent = state.user.role === "admin" ? "Quản trị viên" : "Khách đã đăng nhập";
    } else {
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (roleLabel) roleLabel.textContent = "Khách truy cập";
    }

    authTabs.forEach(btn => btn.classList.toggle("active", btn.dataset.auth === state.selectedAuth));
    $("#emailAuthForm")?.classList.toggle("hidden", state.selectedAuth !== "email");
    $("#googleAuthForm")?.classList.toggle("hidden", state.selectedAuth !== "google");
    $("#otpAuthForm")?.classList.toggle("hidden", state.selectedAuth !== "otp");
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

    list.querySelectorAll("li").forEach(item => {
        item.addEventListener("click", function () {
            const filter = this.dataset.filter || "all";
            state.filter = filter;
            renderManuals();

            const firstMatch = manuals.find(m => filter === "all" || m.category.toLowerCase().includes(filter));
            if (firstMatch) openDetail(firstMatch.id);
            else scrollToSection("latestManuals");

            closeMobileDrawer();
        });
    });

    grid.querySelectorAll(".category-card").forEach(card => {
        card.addEventListener("click", function () {
            state.filter = this.dataset.category || "all";
            renderManuals();
            scrollToSection("latestManuals");
            closeMobileDrawer();
        });
    });

    updateStats();
}

function renderManuals() {
    const grid = $("#manualGrid");
    const emptyState = $("#emptyState");
    if (!grid) return;

    const keyword = `${state.search} ${$("#globalSearch")?.value || ""} ${$("#heroSearch")?.value || ""}`.toLowerCase().trim();
    const filtered = manuals.filter(item => {
        const matchesCategory = state.filter === "all" || item.category.toLowerCase().includes(state.filter);
        const matchesSearch = !keyword || `${item.name} ${item.category} ${item.desc}`.toLowerCase().includes(keyword);
        return matchesCategory && matchesSearch;
    });

    grid.innerHTML = filtered.map(item => `
        <div class="manual-card reveal">
            <div class="manual-thumb">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="manual-content">
                <div class="manual-category">${item.category}</div>
                <h3>${item.name}</h3>
                <p>${item.desc}</p>
                <div class="manual-info">
                    <span><i class="fa-regular fa-eye"></i> ${item.view.toLocaleString()}</span>
                    <span><i class="fa-solid fa-download"></i> ${item.download.toLocaleString()}</span>
                    <span class="badge ${item.allowDownload ? "permission-on" : "permission-off"}">${item.allowDownload ? "Có thể tải" : "Không tải"}</span>
                </div>
                <div class="manual-action">
                    <button class="btn-primary" type="button" onclick="openDetail(${item.id})">Xem chi tiết</button>
                    <button class="btn-secondary" type="button" onclick="requireLoginForDownload(${item.id})">${item.allowDownload ? "Tải tài liệu" : "Không cho tải"}</button>
                </div>
            </div>
        </div>
    `).join("");

    if (emptyState) emptyState.style.display = filtered.length ? "none" : "block";
    updateStats();
    renderAdminLists();
    runReveal();
}

function openDetail(id) {
    const doc = manuals.find(item => item.id === id);
    if (!doc) return;

    state.selectedDetailId = id;
    $("#detailCategory").textContent = doc.category;
    $("#detailName").textContent = doc.name;
    $("#detailDesc").textContent = doc.desc;
    $("#detailViews").textContent = doc.view.toLocaleString();
    $("#detailDownloads").textContent = doc.download.toLocaleString();
    $("#detailPermission").textContent = doc.allowDownload ? "Được phép tải" : "Không cho tải";
    $("#detailPermission").className = "badge " + (doc.allowDownload ? "permission-on" : "permission-off");
    $("#detailDownloadBtn").textContent = doc.allowDownload ? "Tải tài liệu" : "Không cho tải";
    $("#detailDownloadBtn").onclick = () => requireLoginForDownload(id);
    doc.view += 1;
    renderManuals();
    showPage("manual");
}

function updateStats() {
    const totalDownloads = manuals.reduce((sum, item) => sum + (item.download || 0), 0);
    const totalViews = manuals.reduce((sum, item) => sum + (item.view || 0), 0);

    const statCategories = $("#statCategories");
    const statManuals = $("#statManuals");
    const statDownloads = $("#statDownloads");
    const statPublic = $("#statPublic");
    const totalManuals = $("#totalManuals");
    const totalViewsEl = $("#totalViews");
    const totalDownloadsEl = $("#totalDownloads");
    const savedTheme = $("#savedTheme");

    if (statCategories) statCategories.textContent = categories.length;
    if (statManuals) statManuals.textContent = manuals.length;
    if (statDownloads) statDownloads.textContent = totalDownloads.toLocaleString();
    if (statPublic) statPublic.textContent = manuals.filter(item => item.allowDownload).length;

    if (totalManuals) totalManuals.textContent = manuals.length;
    if (totalViewsEl) totalViewsEl.textContent = totalViews.toLocaleString();
    if (totalDownloadsEl) totalDownloadsEl.textContent = totalDownloads.toLocaleString();
    if (savedTheme) savedTheme.textContent = state.theme ? "ON" : "OFF";
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
                <button class="delete-icon" type="button" title="Xóa danh mục" onclick="deleteCategory(${cat.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join("");

    manList.innerHTML = manuals.map(item => `
        <div class="admin-item">
            <div>
                <strong>${item.name}</strong><br>
                <small>${item.category} • ${item.view.toLocaleString()} lượt xem • ${item.download.toLocaleString()} lượt tải</small>
            </div>
            <div class="admin-actions">
                <button class="toggle-icon" type="button" title="Bật/tắt tải" onclick="toggleDownload(${item.id})"><i class="fa-solid ${item.allowDownload ? "fa-lock-open" : "fa-lock"}"></i></button>
                <button class="delete-icon" type="button" title="Xóa tài liệu" onclick="deleteManual(${item.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join("");
}

function addCategory() {
    if (!isAdmin()) return showToast("Chỉ admin được thêm danh mục.");
    const name = $("#newCategoryName").value.trim();
    const icon = $("#newCategoryIcon").value.trim() || "fa-solid fa-layer-group";
    if (!name) return showToast("Vui lòng nhập tên danh mục.");
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return showToast("Danh mục đã tồn tại.");
    categories.unshift({ id: Date.now(), name, icon });
    $("#newCategoryName").value = "";
    $("#newCategoryIcon").value = "";
    persistAll();
    renderCategoryMenu();
    showToast("Đã thêm danh mục.");
}

function deleteCategory(id) {
    if (!isAdmin()) return showToast("Chỉ admin được xóa danh mục.");
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    categories = categories.filter(c => c.id !== id);
    manuals = manuals.filter(m => m.category !== cat.name);
    persistAll();
    renderCategoryMenu();
    renderManuals();
    showToast("Đã xóa danh mục và các tài liệu liên quan.");
}

function deleteManual(id) {
    if (!isAdmin()) return showToast("Chỉ admin được xóa tài liệu.");
    manuals = manuals.filter(m => m.id !== id);
    persistAll();
    renderManuals();
    showToast("Đã xóa tài liệu.");
}

function toggleDownload(id) {
    if (!isAdmin()) return showToast("Chỉ admin được chỉnh quyền tải.");
    const doc = manuals.find(m => m.id === id);
    if (!doc) return;
    doc.allowDownload = !doc.allowDownload;
    persistAll();
    renderManuals();
    showToast(doc.allowDownload ? "Đã bật quyền tải." : "Đã tắt quyền tải.");
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

function addRippleEffect(btn) {
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
}

function bindSearch(inputSelector) {
    const input = $(inputSelector);
    if (!input) return;
    input.addEventListener("input", function () {
        state.search = this.value.trim();
        updateSearchSuggestions(this.value);
        renderManuals();
    });
    input.addEventListener("focus", function () {
        updateSearchSuggestions(this.value);
    });
}

window.addEventListener("load", () => {
    const loading = $("#loading");
    if (loading) {
        setTimeout(() => {
            loading.style.opacity = "0";
            loading.style.pointerEvents = "none";
            setTimeout(() => loading.remove(), 250);
        }, 500);
    }

    renderCategoryMenu();
    renderManuals();
    applyTheme();
    updateAuthUI();
    renderNotifications();
    updateNotificationBadge();

    if (state.currentPage === "admin" && !isAdmin()) state.currentPage = "home";
    showPage(state.currentPage);
    runReveal();
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

$("#detailDownloadBtn")?.addEventListener("click", () => requireLoginForDownload(state.selectedDetailId));

document.querySelectorAll("[data-auth]").forEach(btn => {
    btn.addEventListener("click", function () {
        state.selectedAuth = this.dataset.auth;
        updateAuthUI();
    });
});

$("#emailAuthForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#authEmail")?.value.trim();
    const password = $("#authPassword")?.value.trim();

    if (!email || !password) return showToast("Vui lòng nhập email và mật khẩu.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("Email không hợp lệ.");

    try {
        const loginRes = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        if (!loginRes.success) {
            const registerRes = await apiFetch("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            if (!registerRes.success) {
                showToast(registerRes.message || "Đăng nhập thất bại.");
                return;
            }

            saveUser(registerRes.user);
            showToast("Đăng ký email thành công.");
            showPage("home");
            return;
        }

        saveUser(loginRes.user);
        showToast(loginRes.user.role === "admin" ? "Đăng nhập admin thành công." : "Đăng nhập email thành công.");
        showPage(loginRes.user.role === "admin" ? "admin" : "home");
    } catch {
        showToast("Không kết nối được server.");
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

$("#uploadForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isLoggedIn()) return showToast("Bạn cần đăng nhập để upload tài liệu.");

    const name = $("#docName")?.value.trim();
    const category = $("#docCategory")?.value;
    const file = $("#docFile")?.files?.[0];

    if (!name || !category || !file) return showToast("Vui lòng nhập đủ thông tin.");

    manuals.unshift({
        id: Date.now(),
        name,
        category,
        view: 0,
        download: 0,
        allowDownload: true,
        image: "images/manual-01.jpg",
        desc: "Tài liệu mới vừa được thêm vào hệ thống."
    });

    persistAll();
    renderManuals();
    showToast("Đã thêm tài liệu mới.");
    showPage("home");
});

$(".logo")?.addEventListener("click", () => showPage("home"));
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        showPage("home");
        toggleDrawer(false);
        toggleNotificationPanel(false);
        $("#searchSuggestions")?.classList.add("hidden");
    }
});

document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box") && !e.target.closest("#searchSuggestions")) {
        $("#searchSuggestions")?.classList.add("hidden");
    }
    if (!e.target.closest("#notificationWrap")) {
        toggleNotificationPanel(false);
    }
});

document.querySelectorAll("button").forEach(addRippleEffect);

const topButton = document.createElement("button");
topButton.id = "topButton";
topButton.innerHTML = "↑";
document.body.appendChild(topButton);
Object.assign(topButton.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    width: "54px",
    height: "54px",
    borderRadius: "50%",
    background: "linear-gradient(135deg,var(--primary),#1d4ed8)",
    color: "#fff",
    display: "none"
});
window.addEventListener("scroll", () => {
    topButton.style.display = window.scrollY > 300 ? "block" : "none";
});
topButton.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

const darkButton = document.createElement("button");
darkButton.id = "darkMode";
darkButton.innerHTML = "🌙";
document.body.appendChild(darkButton);
Object.assign(darkButton.style, {
    position: "fixed",
    left: "20px",
    bottom: "20px",
    width: "54px",
    height: "54px",
    borderRadius: "50%",
    background: "#0f172a",
    color: "#fff"
});
darkButton.onclick = () => {
    state.theme = !state.theme;
    applyTheme();
};

function apiFetch(path, options = {}) {
    return fetch(path, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    }).then(res => res.json());
}

showPage(state.currentPage);
renderCategoryMenu();
renderManuals();
updateAuthUI();
updateNotificationBadge();
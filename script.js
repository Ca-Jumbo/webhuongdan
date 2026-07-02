"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const body = document.body;
const pages = $$(".page");
const sidebarItems = $$("#sidebar li");
let currentPage = "home";

window.addEventListener("load", () => {
    const loading = $("#loading");
    if (loading) {
        setTimeout(() => {
            loading.style.opacity = "0";
            loading.style.pointerEvents = "none";
            setTimeout(() => loading.remove(), 400);
        }, 700);
    }
});

function showPage(pageId) {
    pages.forEach(page => page.classList.remove("active"));
    const page = $("#" + pageId);
    if (page) {
        page.classList.add("active");
        currentPage = pageId;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

sidebarItems.forEach(item => {
    item.addEventListener("click", function () {
        sidebarItems.forEach(i => i.classList.remove("active"));
        this.classList.add("active");
    });
});

const searchInput = $(".search-box input");
const cards = $$(".manual-card");

if (searchInput) {
    searchInput.addEventListener("keyup", function () {
        const keyword = this.value.toLowerCase();
        cards.forEach(card => {
            card.style.display = card.innerText.toLowerCase().includes(keyword) ? "block" : "none";
        });
    });
}

const categoryCards = $$(".category-card");
categoryCards.forEach(card => {
    card.addEventListener("click", function () {
        const category = (this.dataset.category || "").toLowerCase();
        if (!category) return;

        cards.forEach(item => {
            const text = item.innerText.toLowerCase();
            item.style.display = (category === "all" || text.includes(category)) ? "block" : "none";
        });
    });
});

document.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
        btn.style.transform = "translateY(-2px)";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
    });
});

const topButton = document.createElement("button");
topButton.innerHTML = "↑";
topButton.id = "topButton";
document.body.appendChild(topButton);
Object.assign(topButton.style, {
    position: "fixed",
    right: "30px",
    bottom: "30px",
    width: "55px",
    height: "55px",
    borderRadius: "50%",
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    display: "none",
    zIndex: "999"
});

window.addEventListener("scroll", () => {
    topButton.style.display = window.scrollY > 300 ? "block" : "none";
});
topButton.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.querySelector("span").innerHTML = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function closeModal() {
    const modal = $("#modal");
    if (modal) modal.classList.remove("show");
}

const modal = $("#modal");
if (modal) {
    modal.addEventListener("click", (e) => {
        if (e.target.id === "modal") closeModal();
    });
}

document.querySelectorAll(".manual-download button").forEach(btn => {
    btn.onclick = () => showToast("Đang chuẩn bị tải tài liệu...");
});

document.querySelectorAll(".btn-outline").forEach(btn => {
    btn.addEventListener("click", () => showPage("manual"));
});

const loginButton = document.querySelector(".auth-btn");
if (loginButton) {
    loginButton.addEventListener("click", () => {
        showToast("Thao tác thành công");
        showPage("home");
    });
}

function toggleDark() {
    body.classList.toggle("dark");
    localStorage.setItem("theme", body.classList.contains("dark"));
}

if (localStorage.getItem("theme") === "true") {
    body.classList.add("dark");
}

const darkButton = document.createElement("button");
darkButton.innerHTML = "🌙";
darkButton.id = "darkMode";
document.body.appendChild(darkButton);
Object.assign(darkButton.style, {
    position: "fixed",
    left: "30px",
    bottom: "30px",
    width: "55px",
    height: "55px",
    borderRadius: "50%",
    background: "#0f172a",
    color: "white",
    cursor: "pointer",
    border: "none",
    zIndex: "999"
});
darkButton.onclick = toggleDark;

const uploadInputs = document.querySelectorAll('input[type="file"]');
uploadInputs.forEach(input => {
    input.addEventListener("change", function () {
        if (!this.files.length) return;
        showToast("Đã chọn: " + this.files[0].name);
    });
});

const Storage = {
    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
    load(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    remove(key) {
        localStorage.removeItem(key);
    }
};

let manuals = Storage.load("manuals");
if (manuals.length === 0) {
    manuals = [
        { id: 1, name: "Mitsubishi FR-E800", category: "Biến tần", view: 1245, download: 320 },
        { id: 2, name: "Siemens S7-1200", category: "PLC", view: 890, download: 145 },
        { id: 3, name: "Grundfos CR", category: "Máy bơm", view: 620, download: 90 }
    ];
    Storage.save("manuals", manuals);
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const email = this.querySelector('input[type="email"]');
        if (email && !validateEmail(email.value)) {
            showToast("Email không hợp lệ.");
            return;
        }
        showToast("Biểu mẫu hợp lệ.");
    });
});

const lazyImages = document.querySelectorAll("img");
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = 1;
            observer.unobserve(entry.target);
        }
    });
});
lazyImages.forEach(img => {
    img.style.opacity = 0;
    img.style.transition = ".6s";
    observer.observe(img);
});

window.addEventListener("scroll", () => {
    const header = document.querySelector("header");
    if (!header) return;
    header.style.boxShadow = window.scrollY > 30 ? "0 8px 25px rgba(0,0,0,.12)" : "";
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

showPage("home");
showToast("Chào mừng đến Manual Center");

const logo = document.querySelector(".logo");
if (logo) {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", () => showPage("home"));
}

const uploadForm = document.querySelector("#uploadForm");
if (uploadForm) {
    uploadForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.querySelector("#docName")?.value.trim();
        const category = document.querySelector("#docCategory")?.value;
        const file = document.querySelector("#docFile")?.files?.[0];

        if (!name || !category || !file) {
            showToast("Vui lòng nhập đủ thông tin.");
            return;
        }

        const item = {
            id: Date.now(),
            name,
            category,
            fileName: file.name,
            view: 0,
            download: 0
        };

        manuals.unshift(item);
        Storage.save("manuals", manuals);
        showToast("Đã thêm tài liệu mới vào hệ thống.");
        uploadForm.reset();
    });
}
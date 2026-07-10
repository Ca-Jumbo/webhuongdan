const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "manual_center_secret";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
const dbReady = !!SUPABASE_URL && !!(SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

function requireDB(res) {
    if (!dbReady) {
        res.status(503).json({ success: false, message: "Supabase chưa sẵn sàng." });
        return false;
    }
    return true;
}

function createToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ success: false, message: "Thiếu token." });
    try {
        req.auth = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Token không hợp lệ." });
    }
}

function adminOnly(req, res, next) {
    if (!req.auth || !["super_admin", "admin", "editor"].includes(req.auth.role)) {
        return res.status(403).json({ success: false, message: "Không có quyền." });
    }
    next();
}

function normalizeUser(row) {
    return {
        id: row.id,
        email: row.email || "",
        phone: row.phone || "",
        role: row.role || "user",
        authType: row.auth_type || "email"
    };
}
function normalizeCategory(row) { return { id: row.id, name: row.name, icon: row.icon || "fa-solid fa-folder", parentId: row.parent_id || null }; }
function normalizeProduct(row) { return { id: row.id, name: row.name, brand: row.brand || "", categoryId: row.category_id || null, description: row.description || "", imageUrl: row.image_url || "", status: row.status || "active", viewCount: row.view_count || 0, createdAt: row.created_at }; }
function normalizeManual(row) { return { id: row.id, title: row.title, productId: row.product_id || null, categoryId: row.category_id || null, fileUrl: row.file_url || "", thumbnailUrl: row.thumbnail_url || "", fileSize: row.file_size || 0, fileType: row.file_type || "", allowDownload: row.allow_download ?? true, status: row.status || "pending", description: row.description || "", uploadedBy: row.uploaded_by || null, viewCount: row.view_count || 0, downloadCount: row.download_count || 0, createdAt: row.created_at }; }
function normalizeBookmark(row) { return { id: row.id, manualId: row.manual_id, userId: row.user_id, createdAt: row.created_at }; }
function normalizeRating(row) { return { id: row.id, manualId: row.manual_id, userId: row.user_id, value: row.value, createdAt: row.created_at }; }
function normalizeAttachment(row) { return { id: row.id, manualId: row.manual_id, name: row.name, fileUrl: row.file_url, fileType: row.file_type || "", createdAt: row.created_at }; }
function normalizeNotification(row) { return { id: row.id, userId: row.user_id, title: row.title || "", text: row.text || row.message || "", seen: !!(row.seen || row.is_read), createdAt: row.created_at }; }
function normalizeActivityLog(row) {
    let metadata = row.metadata;
    if (typeof metadata === "string") {
        try { metadata = JSON.parse(metadata); } catch { metadata = metadata; }
    }
    return { id: row.id, userId: row.user_id, action: row.action, tableName: row.table_name, manualId: row.manual_id, recordId: row.record_id, metadata, createdAt: row.created_at };
}

async function seedAdmin() {
    if (!dbReady) return;
    const email = "admin@example.com";
    const password = "admin123";
    const { data: existed } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (existed) return;
    const passwordHash = await bcrypt.hash(password, 10);
    await supabase.from("users").insert({ email, password_hash: passwordHash, role: "super_admin", auth_type: "email", full_name: "Administrator", is_active: true });
}

app.get("/api/health", (req, res) => res.json({ success: true, dbReady }));

app.post("/api/register", async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { email, phone, password, authType = "email" } = req.body;
        if (!email && !phone) return res.status(400).json({ success: false, message: "Thiếu email hoặc phone" });
        if (authType === "email" && !password) return res.status(400).json({ success: false, message: "Thiếu mật khẩu" });

        const { data: exists } = await supabase.from("users").select("id").eq(email ? "email" : "phone", email || phone).maybeSingle();
        if (exists) return res.status(400).json({ success: false, message: "Tài khoản đã tồn tại" });

        const payload = {
            email: email || null,
            phone: phone || null,
            password_hash: password ? await bcrypt.hash(password, 10) : null,
            role: "user",
            auth_type: authType
        };

        const { data, error } = await supabase.from("users").insert(payload).select("*").single();
        if (error) throw error;
        res.json({ success: true, token: createToken(data), user: normalizeUser(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/login", async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { email, phone, password } = req.body;
        const key = email || phone;
        if (!key) return res.status(400).json({ success: false, message: "Thiếu thông tin đăng nhập" });

        const col = email ? "email" : "phone";
        const { data: user, error } = await supabase.from("users").select("*").eq(col, key).maybeSingle();
        if (error) throw error;
        if (!user) return res.status(400).json({ success: false, message: "Sai thông tin đăng nhập" });

        if (user.password_hash) {
            if (!password) return res.status(400).json({ success: false, message: "Thiếu mật khẩu" });
            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) return res.status(400).json({ success: false, message: "Sai thông tin đăng nhập" });
        }

        res.json({ success: true, token: createToken(user), user: normalizeUser(user) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/users-count", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    const { count, error } = await supabase.from("users").select("*", { count: "exact", head: true });
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, count: count || 0 });
});

app.get("/api/categories", async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("categories").select("*").order("created_at", { ascending: true });
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeCategory) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/categories", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { name, icon, parentId = null } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Thiếu tên danh mục" });
        const { data, error } = await supabase.from("categories").insert({ name, icon: icon || "fa-solid fa-folder", parent_id: parentId }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeCategory(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/categories/:id", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/products", async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeProduct) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/products", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("products").insert({
            name: req.body.name,
            brand: req.body.brand || "",
            category_id: req.body.categoryId || null,
            description: req.body.description || "",
            image_url: req.body.imageUrl || "",
            status: req.body.status || "active"
        }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeProduct(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/products/:id", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { error } = await supabase.from("products").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/manuals", async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("manuals").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeManual) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/manuals/:id", async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("manuals").select("*").eq("id", req.params.id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });
        res.json({ success: true, data: normalizeManual(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/manuals", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("manuals").insert({
            title: req.body.title,
            product_id: req.body.productId || null,
            category_id: req.body.categoryId || null,
            file_url: req.body.fileUrl || "",
            thumbnail_url: req.body.thumbnailUrl || "",
            file_size: req.body.fileSize || 0,
            file_type: req.body.fileType || "",
            allow_download: req.body.allowDownload ?? true,
            status: req.body.status || "pending",
            description: req.body.description || "",
            uploaded_by: req.auth.id
        }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeManual(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.patch("/api/manuals/:id", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const patch = {};
        ["title","productId","categoryId","fileUrl","thumbnailUrl","fileSize","fileType","allowDownload","status","description"].forEach(k => {
            if (req.body[k] !== undefined) patch[k] = req.body[k];
        });

        const dataPatch = {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.productId !== undefined ? { product_id: patch.productId } : {}),
            ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
            ...(patch.fileUrl !== undefined ? { file_url: patch.fileUrl } : {}),
            ...(patch.thumbnailUrl !== undefined ? { thumbnail_url: patch.thumbnailUrl } : {}),
            ...(patch.fileSize !== undefined ? { file_size: patch.fileSize } : {}),
            ...(patch.fileType !== undefined ? { file_type: patch.fileType } : {}),
            ...(patch.allowDownload !== undefined ? { allow_download: patch.allowDownload } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {})
        };

        const { data, error } = await supabase.from("manuals").update(dataPatch).eq("id", req.params.id).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeManual(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.patch("/api/manuals/:id/approve", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("manuals").update({ status: "approved" }).eq("id", req.params.id).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeManual(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/manuals/:id", authRequired, adminOnly, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { error } = await supabase.from("manuals").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.patch("/api/manuals/:id/counter", async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const field = req.body.field === "download" ? "download_count" : "view_count";
        const { data: current } = await supabase.from("manuals").select("*").eq("id", req.params.id).maybeSingle();
        if (!current) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });
        const nextValue = (current[field] || 0) + 1;
        const { data, error } = await supabase.from("manuals").update({ [field]: nextValue }).eq("id", req.params.id).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeManual(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/upload", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { fileName, fileBase64, mimeType, bucket = "manuals" } = req.body;
        if (!fileName || !fileBase64) return res.status(400).json({ success: false, message: "Thiếu file upload." });
        const buffer = Buffer.from(fileBase64, "base64");
        const safeName = `${Date.now()}-${fileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `uploads/${safeName}`;

        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, buffer, {
            contentType: mimeType || "application/octet-stream",
            upsert: false
        });
        if (uploadError) throw uploadError;

        const { data: signed, error: signError } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24);
        if (signError) throw signError;

        res.json({ success: true, fileUrl: signed.signedUrl, path: filePath, bucket, signed: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/notifications", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const query = supabase.from("notifications").select("*").order("created_at", { ascending: false });
        const { data, error } = req.auth.role === "super_admin" || req.auth.role === "admin"
            ? await query
            : await query.eq("user_id", req.auth.id);
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeNotification) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put("/api/notifications/:id/read", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("notifications").update({ seen: true, is_read: true }).eq("id", req.params.id).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeNotification(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/bookmarks", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("bookmarks").select("*").eq("user_id", req.auth.id).order("created_at", { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeBookmark) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/bookmarks", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { manualId } = req.body;
        if (!manualId) return res.status(400).json({ success: false, message: "Thiếu dữ liệu bookmark" });
        const { data, error } = await supabase.from("bookmarks").insert({ manual_id: manualId, user_id: req.auth.id }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeBookmark(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/bookmarks/:id", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { error } = await supabase.from("bookmarks").delete().eq("id", req.params.id).eq("user_id", req.auth.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/ratings", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("ratings").select("*").eq("user_id", req.auth.id).order("created_at", { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeRating) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/ratings", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { manualId, value } = req.body;
        if (!manualId || !value) return res.status(400).json({ success: false, message: "Thiếu dữ liệu đánh giá" });
        const { data, error } = await supabase.from("ratings").upsert({ manual_id: manualId, user_id: req.auth.id, value }, { onConflict: "manual_id,user_id" }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeRating(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put("/api/ratings/:id", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { value } = req.body;
        if (!value) return res.status(400).json({ success: false, message: "Thiếu value" });
        const { data, error } = await supabase.from("ratings").update({ value }).eq("id", req.params.id).eq("user_id", req.auth.id).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeRating(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/ratings/:id", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { error } = await supabase.from("ratings").delete().eq("id", req.params.id).eq("user_id", req.auth.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/attachments", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("attachments").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeAttachment) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/attachments", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { manualId, name, fileUrl, fileType } = req.body;
        if (!manualId || !name || !fileUrl) return res.status(400).json({ success: false, message: "Thiếu dữ liệu attachment" });
        const { data, error } = await supabase.from("attachments").insert({ manual_id: manualId, name, file_url: fileUrl, file_type: fileType || "" }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeAttachment(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.patch("/api/attachments/:id", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const patch = {};
        if (req.body.name !== undefined) patch.name = req.body.name;
        if (req.body.fileUrl !== undefined) patch.file_url = req.body.fileUrl;
        if (req.body.fileType !== undefined) patch.file_type = req.body.fileType;
        const { data, error } = await supabase.from("attachments").update(patch).eq("id", req.params.id).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeAttachment(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/attachments/:id", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { error } = await supabase.from("attachments").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/activity-logs", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: (data || []).map(normalizeActivityLog) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/activity-logs", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { action, manualId = null, metadata = null } = req.body;
        if (!action) return res.status(400).json({ success: false, message: "Thiếu action" });
        const { data, error } = await supabase.from("activity_logs").insert({
            action,
            manual_id: manualId,
            user_id: req.auth.id,
            metadata: metadata || {}
        }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data: normalizeActivityLog(data) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/download-logs", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { data, error } = await supabase.from("download_logs").select("*").eq("user_id", req.auth.id).order("created_at", { ascending: false });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/download-logs", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    try {
        const { manualId = null, fileUrl = "" } = req.body;
        const { data, error } = await supabase.from("download_logs").insert({
            manual_id: manualId,
            user_id: req.auth.id,
            file_url: fileUrl
        }).select("*").single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/me", authRequired, async (req, res) => {
    if (!requireDB(res)) return;
    const { data, error } = await supabase.from("users").select("*").eq("id", req.auth.id).maybeSingle();
    if (error) return res.status(500).json({ success: false, message: error.message });
    if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy user." });
    res.json({ success: true, user: normalizeUser(data) });
});

(async () => {
    if (dbReady) await seedAdmin();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
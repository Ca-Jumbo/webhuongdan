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
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "manual_center_secret";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const dbReady = !!SUPABASE_URL && !!SUPABASE_KEY;

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

async function seedAdmin() {
  if (!dbReady) return;
  const email = "admin@gmail.com";
  const password = "admin123";

  const { data: existed } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existed) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await supabase.from("users").insert({
    email,
    password_hash: passwordHash,
    role: "admin",
    auth_type: "email"
  });
  console.log("Admin seeded: admin@gmail.com / admin123");
}

function toManual(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    view: row.view_count || 0,
    download: row.download_count || 0,
    allowDownload: row.allow_download ?? true,
    image: row.image_url || "images/manual-01.jpg",
    desc: row.description || "",
    date: row.created_at || new Date().toISOString()
  };
}

app.get("/api/health", (req, res) => {
  res.json({ success: true, dbReady });
});

app.post("/api/auth/register", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Thiếu email hoặc mật khẩu" });

    const { data: exists } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (exists) return res.status(400).json({ success: false, message: "Email đã tồn tại" });

    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from("users").insert({
      email,
      password_hash: passwordHash,
      role: "user",
      auth_type: "email"
    }).select("*").single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Đăng ký thành công",
      token: createToken(data),
      user: { id: data.id, email: data.email, role: data.role, authType: data.auth_type }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Thiếu email hoặc mật khẩu" });

    const { data: user, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!user || !user.password_hash) return res.status(400).json({ success: false, message: "Sai thông tin đăng nhập" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ success: false, message: "Sai thông tin đăng nhập" });

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token: createToken(user),
      user: { id: user.id, email: user.email, role: user.role, authType: user.auth_type }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/categories", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { data, error } = await supabase.from("categories").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/categories", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Thiếu tên danh mục" });

    const { data, error } = await supabase.from("categories").insert({
      name,
      icon: icon || "fa-solid fa-layer-group"
    }).select("*").single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
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
    res.json({ success: true, data: (data || []).map(toManual) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/manuals", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const payload = {
      name: req.body.name,
      category: req.body.category,
      image_url: req.body.imageUrl || "images/manual-01.jpg",
      description: req.body.description || "",
      allow_download: req.body.allowDownload ?? true,
      view_count: req.body.viewCount ?? 0,
      download_count: req.body.downloadCount ?? 0
    };
    const { data, error } = await supabase.from("manuals").insert(payload).select("*").single();
    if (error) throw error;
    res.json({ success: true, data: toManual(data) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch("/api/manuals/:id/permission", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { data, error } = await supabase.from("manuals").update({
      allow_download: req.body.allowDownload
    }).eq("id", req.params.id).select("*").single();

    if (error) throw error;
    res.json({ success: true, data: toManual(data) });
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
    res.json({ success: true, data: toManual(data) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/manuals/:id", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { error } = await supabase.from("manuals").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/notifications", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/notifications/mark-seen", async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { error } = await supabase.from("notifications").update({ seen: true }).eq("seen", false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

(async () => {
  if (dbReady) await seedAdmin();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
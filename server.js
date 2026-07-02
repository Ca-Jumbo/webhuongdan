const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "manual_center_secret";

app.use(express.static(path.join(__dirname)));

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String },
    role: { type: String, default: "user" },
    authType: { type: String, enum: ["email", "otp", "google"], required: true }
  },
  { timestamps: true }
);

const manualSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    fileUrl: { type: String, default: "" },
    allowDownload: { type: Boolean, default: true },
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Manual = mongoose.model("Manual", manualSchema);

let dbReady = false;

async function connectDB() {
  if (!MONGODB_URI) {
    console.log("MongoDB URI chưa được cấu hình.");
    return false;
  }

  try {
    mongoose.set("bufferCommands", false);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    dbReady = true;
    console.log("MongoDB connected");
    return true;
  } catch (err) {
    dbReady = false;
    console.error("MongoDB connection error:", err.message);
    return false;
  }
}

function requireDB(res) {
  if (!dbReady) {
    res.status(503).json({
      success: false,
      message: "Database chưa sẵn sàng. Vui lòng kiểm tra MONGODB_URI và kết nối Atlas."
    });
    return false;
  }
  return true;
}

function createToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function seedAdmin() {
  if (!dbReady) return;

  const adminEmail = "admin@gmail.com";
  const adminPassword = "admin123";

  const existed = await User.findOne({ email: adminEmail });
  if (existed) return;

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await User.create({
    email: adminEmail,
    passwordHash,
    role: "admin",
    authType: "email"
  });

  console.log("Admin seeded: admin@gmail.com / admin123");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    dbReady
  });
});

app.post("/api/auth/register", async (req, res) => {
  if (!requireDB(res)) return;

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Thiếu email hoặc mật khẩu" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: "Email đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      role: "user",
      authType: "email"
    });

    const token = createToken(user);
    res.json({
      success: true,
      message: "Đăng ký thành công",
      token,
      user: { email: user.email, role: user.role, authType: user.authType }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  if (!requireDB(res)) return;

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Thiếu email hoặc mật khẩu" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ success: false, message: "Sai thông tin đăng nhập" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ success: false, message: "Sai thông tin đăng nhập" });
    }

    const token = createToken(user);
    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      user: { email: user.email, role: user.role, authType: user.authType }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/manuals", async (req, res) => {
  if (!requireDB(res)) return;

  try {
    const manuals = await Manual.find().sort({ createdAt: -1 });
    res.json({ success: true, data: manuals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/manuals", async (req, res) => {
  if (!requireDB(res)) return;

  try {
    const manual = await Manual.create(req.body);
    res.json({ success: true, data: manual });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch("/api/manuals/:id/permission", async (req, res) => {
  if (!requireDB(res)) return;

  try {
    const { allowDownload } = req.body;
    const manual = await Manual.findByIdAndUpdate(
      req.params.id,
      { allowDownload },
      { new: true }
    );
    res.json({ success: true, data: manual });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/manuals/:id", async (req, res) => {
  if (!requireDB(res)) return;

  try {
    await Manual.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Đã xóa tài liệu" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

(async () => {
  await connectDB();
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

/* =============================
   MIDDLEWARE
============================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* =============================
   KONEKSI DATABASE
============================= */
const db = mysql.createConnection({
  host: 'localhost',
  user: 'apiuser',
  password: 'Oranggabut712!',
  database: 'apikeydb'
});

db.connect(err => {
  if (err) {
    console.error("❌ Gagal konek DB:", err);
    return;
  }
  console.log("✅ Database connected!");
});

/* =============================
   GENERATE API KEY
============================= */
function generateApiKey() {
  return `sk-sm-v1-${crypto.randomBytes(16).toString("hex")}`;
}

/* =============================
   ROUTE: CREATE API KEY
============================= */
app.post('/create', (req, res) => {
  const apiKey = generateApiKey();

  const sql = `
    INSERT INTO api_keys(api_key, created_at, status)
    VALUES(?, NOW(), 'active')
  `;

  db.query(sql, [apiKey], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err });

    res.json({
      success: true,
      apiKey,
      apiKeyId: result.insertId
    });
  });
});

/* =============================
   ROUTE: SIMPAN USER
============================= */
app.post('/user/create', async (req, res) => {
  const { firstname, lastname, email, apikey } = req.body;

  if (!firstname || !lastname || !email || !apikey) {
    return res.status(400).json({ error: "Semua kolom harus diisi" });
  }

  // Password default (karena tabel users butuh password)
  const defaultPassword = await bcrypt.hash("default123", 10);

  const sql = `
    INSERT INTO users(firstname, lastname, email, password, api_key_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [firstname, lastname, email, defaultPassword, apikey], err => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true });
  });
});

/* =============================
   ADMIN REGISTER
============================= */
app.post('/admin/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "Semua kolom harus diisi" });

  const hashed = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO admins(name, email, password) VALUES (?, ?, ?)";

  db.query(sql, [name, email, hashed], err => {
    if (err) return res.status(500).json({ error: "Gagal mendaftar admin" });
    res.json({ success: true });
  });
});

/* =============================
   ADMIN LOGIN
============================= */
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM admins WHERE email = ?", [email], async (err, result) => {
    if (err || result.length === 0)
      return res.status(400).json({ error: "Email atau password salah" });

    const admin = result[0];

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(400).json({ error: "Email atau password salah" });

    res.json({ success: true, adminId: admin.id, name: admin.name });
  });
});

/* =============================
   ADMIN DASHBOARD
============================= */
app.get('/admin/dashboard', (req, res) => {
  const sql = `
    SELECT 
      u.id,
      u.firstname,
      u.lastname,
      u.email,
      a.api_key,
      a.created_at,
      CASE 
        WHEN a.created_at < NOW() - INTERVAL 30 DAY THEN 'off'
        ELSE 'on'
      END AS status
    FROM users u
    LEFT JOIN api_keys a ON a.id = u.api_key_id
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err });

    res.json({ users: result });
  });
});

/* =============================
   START SERVER
============================= */
app.listen(3000, () => {
  console.log("🚀 Server berjalan di http://localhost:3000");
});

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const app = express();

/* =============================
   MIDDLEWARE
============================= */
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
    console.error('❌ Gagal terhubung DB:', err);
    return;
  }
  console.log('✅ MySQL Connected');
});

/* =============================
   FUNGSI GENERATE API KEY
============================= */
function generateApiKey() {
  return `sk-sm-v1-${crypto.randomBytes(8).toString('hex')}`;
}

/* =============================
   ROUTE: GENERATE + SIMPAN API KEY
============================= */
app.post('/create', (req, res) => {
  const apiKey = generateApiKey();

  const sql = `INSERT INTO api_keys (api_key, created_at, status)
               VALUES (?, NOW(), "active")`;

  db.query(sql, [apiKey], (err, result) => {
    if (err) return res.status(500).json({ success: false, msg: "Gagal simpan API key" });

    res.json({ success: true, apiKey, apiKeyId: result.insertId });
  });
});

/* =============================
   ROUTE: SAVE USER (DISAMAKAN DENGAN DB)
============================= */
app.post('/user/create', async (req, res) => {
  const { firstname, lastname, email, apikey, password } = req.body;

  if (!firstname || !lastname || !email || !apikey || !password)
    return res.status(400).json({ error: "Semua kolom wajib diisi" });

  const hashed = await bcrypt.hash(password, 10);

  const sql = `
    INSERT INTO users (firstname, lastname, email, password, api_key_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [firstname, lastname, email, hashed, apikey], err => {
    if (err) return res.status(500).json({ error: "Gagal menyimpan user" });
    res.json({ success: true });
  });
});

/* =============================
   ADMIN LOGIN & REGISTER
============================= */
app.post('/admin/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Semua kolom wajib diisi" });

  const hashed = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO admin (email, password) VALUES (?, ?)";

  db.query(sql, [email, hashed], err => {
    if (err) return res.status(500).json({ error: "Gagal mendaftar admin" });
    res.json({ success: true });
  });
});

app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM admin WHERE email = ?", [email], async (err, results) => {
    if (err || results.length === 0)
      return res.status(400).json({ error: "Email atau password salah" });

    const admin = results[0];
    const valid = await bcrypt.compare(password, admin.password);

    if (!valid)
      return res.status(400).json({ error: "Email atau password salah" });

    res.json({ success: true, adminId: admin.id });
  });
});

/* =============================
   DELETE USER + API KEY
============================= */
app.delete('/admin/user/:id', (req, res) => {
  const userId = req.params.id;

  db.query("SELECT api_key_id FROM users WHERE id = ?", [userId], (err, results) => {
    if (err || results.length === 0)
      return res.status(404).json({ error: "User tidak ditemukan" });

    const apiKeyId = results[0].api_key_id;

    db.query("DELETE FROM users WHERE id = ?", (err) => {
      if (err) return res.status(500).json({ error: "Gagal hapus user" });

      db.query("DELETE FROM api_keys WHERE id = ?", [apiKeyId], (err) => {
        if (err) return res.status(500).json({ error: "Gagal hapus API key" });

        res.json({ success: true });
      });
    });
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
      a.api_key AS apiKey,
      CASE 
        WHEN a.created_at < NOW() - INTERVAL 30 DAY THEN 'off'
        ELSE 'on'
      END AS status
    FROM users u
    LEFT JOIN api_keys a ON a.id = u.api_key_id
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data" });
    res.json({ users: results });
  });
});

/* =============================
   START SERVER
============================= */
app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));

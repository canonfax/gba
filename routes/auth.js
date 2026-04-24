// ═══════════════════════════════════════════
//  routes/auth.js – Admin hitelesítés
// ═══════════════════════════════════════════

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'gyulabringa_secret_2025';

// ── Middleware: token ellenőrzés ──
function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Bejelentkezés szükséges' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Érvénytelen vagy lejárt token' });
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Hiányzó adatok' });

  const admin = db.prepare('SELECT * FROM admin WHERE email = ?').get(email);
  if (!admin) return res.status(401).json({ error: 'Hibás email vagy jelszó' });

  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) return res.status(401).json({ error: 'Hibás email vagy jelszó' });

  const token = jwt.sign(
    { id: admin.id, email: admin.email, nev: admin.nev },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ ok: true, token, nev: admin.nev });
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

// POST /api/auth/change-password
router.post('/change-password', authRequired, async (req, res) => {
  const { current, newpass } = req.body;
  if (!current || !newpass) return res.status(400).json({ error: 'Hiányzó adatok' });
  if (newpass.length < 6) return res.status(400).json({ error: 'A jelszó legalább 6 karakter legyen' });

  const admin = db.prepare('SELECT * FROM admin WHERE id = ?').get(req.admin.id);
  const ok = await bcrypt.compare(current, admin.password);
  if (!ok) return res.status(401).json({ error: 'Jelenlegi jelszó helytelen' });

  const hash = await bcrypt.hash(newpass, 10);
  db.prepare('UPDATE admin SET password = ? WHERE id = ?').run(hash, req.admin.id);
  res.json({ ok: true });
});

module.exports = { router, authRequired };

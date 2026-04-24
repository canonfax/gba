const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'gyulabringa_secret_2025';

function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Bejelentkezés szükséges' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Érvénytelen token' }); }
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Hiányzó adatok' });
  try {
    const admin = await db.get2('SELECT * FROM admin WHERE email = ?', [email]);
    if (!admin) return res.status(401).json({ error: 'Hibás email vagy jelszó' });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: 'Hibás email vagy jelszó' });
    const token = jwt.sign({ id: admin.id, email: admin.email, nev: admin.nev }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ ok: true, token, nev: admin.nev });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authRequired, (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

router.post('/change-password', authRequired, async (req, res) => {
  const { current, newpass } = req.body;
  if (!current || !newpass || newpass.length < 6)
    return res.status(400).json({ error: 'Hibás adatok' });
  try {
    const admin = await db.get2('SELECT * FROM admin WHERE id = ?', [req.admin.id]);
    const ok = await bcrypt.compare(current, admin.password);
    if (!ok) return res.status(401).json({ error: 'Jelenlegi jelszó helytelen' });
    const hash = await bcrypt.hash(newpass, 10);
    await db.run2('UPDATE admin SET password = ? WHERE id = ?', [hash, req.admin.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = { router, authRequired };

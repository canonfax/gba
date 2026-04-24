// ═══════════════════════════════════════════
//  server.js – GyulaBringa fő szerver
//  Express + SQLite + statikus fájlok
// ═══════════════════════════════════════════

const express  = require('express');
const path     = require('path');
const cors     = require('cors');

// Adatbázis inicializálás
const db = require('./db');

// Routes
const { router: authRouter } = require('./routes/auth');
const foglalasRouter = require('./routes/foglalas');
const munkalapRouter = require('./routes/munkalap');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Statikus fájlok ──
// A weboldal
app.use(express.static(path.join(__dirname, 'public')));
// Az admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ── API végpontok ──
app.use('/api/auth',     authRouter);
app.use('/api/foglalas', foglalasRouter);
app.use('/api/munkalap', munkalapRouter);

// ── Admin panel – minden /admin/* útvonal az admin/index.html-t tölti be ──
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ── Fallback – minden más a public/index.html-t tölti be (SPA) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Szerver indítás ──
app.listen(PORT, () => {
  console.log(`\n🚲 GyulaBringa szerver fut: http://localhost:${PORT}`);
  console.log(`📋 Admin panel:             http://localhost:${PORT}/admin`);
  console.log(`🔧 API:                     http://localhost:${PORT}/api`);
  console.log(`\nKörnyezet: ${process.env.NODE_ENV || 'development'}\n`);
});

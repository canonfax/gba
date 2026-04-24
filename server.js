// ═══════════════════════════════════════════
//  server.js – GyulaBringa fő szerver
// ═══════════════════════════════════════════

const express = require('express');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statikus fájlok
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ── Adatbázis inicializálás ELŐSZÖR, utána routes ──
const db = require('./db');

db.init().then(() => {

  // Routes – csak az init után töltjük be!
  const { router: authRouter } = require('./routes/auth');
  const foglalasRouter = require('./routes/foglalas');
  const munkalapRouter = require('./routes/munkalap');

  app.use('/api/auth',     authRouter);
  app.use('/api/foglalas', foglalasRouter);
  app.use('/api/munkalap', munkalapRouter);

  // Admin fallback
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
  });

  // Weboldal fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n🚲 GyulaBringa szerver fut: http://localhost:${PORT}`);
    console.log(`📋 Admin panel:             http://localhost:${PORT}/admin`);
    console.log(`\nAdmin email: ${process.env.ADMIN_EMAIL || 'gyulabringa@gmail.com'}`);
    console.log(`Admin jelszó: ${process.env.ADMIN_PASS  || 'admin1234'}\n`);
  });

}).catch(err => {
  console.error('❌ Adatbázis hiba:', err);
  process.exit(1);
});

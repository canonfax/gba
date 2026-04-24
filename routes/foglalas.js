// ═══════════════════════════════════════════
//  routes/foglalas.js – Foglalás kezelés
// ═══════════════════════════════════════════

const express    = require('express');
const { v4: uuid } = require('uuid');
const db         = require('../db');
const { authRequired } = require('./auth');
const { sendFoglalasEmail, sendJovahagyasEmail, sendElutasitasEmail } = require('../mailer');
const router     = express.Router();

// ── Publikus: Foglalás beküldése ──
// POST /api/foglalas
router.post('/', async (req, res) => {
  const { nev, telefon, email, szolgaltatas, bike_tipus, datum, idopont, megjegyzes } = req.body;

  if (!nev || !telefon || !szolgaltatas || !datum || !idopont) {
    return res.status(400).json({ error: 'Kötelező mezők hiányoznak' });
  }

  // Ellenőrzés: van-e már foglalás ugyanarra az időpontra
  const existing = db.prepare(
    `SELECT id FROM foglalasok 
     WHERE datum = ? AND idopont = ? AND allapot IN ('fuggeben','jovahagyva')`
  ).get(datum, idopont);

  if (existing) {
    return res.status(409).json({ error: 'Ez az időpont már foglalt. Kérjük válassz másikat!' });
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO foglalasok (id, nev, telefon, email, szolgaltatas, bike_tipus, datum, idopont, megjegyzes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nev, telefon, email || null, szolgaltatas, bike_tipus || null, datum, idopont, megjegyzes || null);

  // Email az adminnak
  try {
    await sendFoglalasEmail({ id, nev, telefon, email, szolgaltatas, bike_tipus, datum, idopont, megjegyzes });
  } catch (e) {
    console.error('Email küldési hiba:', e.message);
  }

  res.json({ ok: true, id, uzenet: 'Foglalásod megérkezett! Hamarosan visszaigazoljuk.' });
});

// ── Publikus: Szabad időpontok lekérdezése ──
// GET /api/foglalas/szabad?datum=2025-05-01
router.get('/szabad', (req, res) => {
  const { datum } = req.query;
  if (!datum) return res.status(400).json({ error: 'Dátum szükséges' });

  const osszes = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00'];
  const foglalt = db.prepare(
    `SELECT idopont FROM foglalasok 
     WHERE datum = ? AND allapot IN ('fuggeben','jovahagyva')`
  ).all(datum).map(r => r.idopont);

  const szabad = osszes.filter(t => !foglalt.includes(t));
  res.json({ datum, szabad, foglalt });
});

// ── Admin: Összes foglalás ──
// GET /api/foglalas/admin
router.get('/admin', authRequired, (req, res) => {
  const { allapot } = req.query;
  let sql = 'SELECT * FROM foglalasok';
  const params = [];
  if (allapot) { sql += ' WHERE allapot = ?'; params.push(allapot); }
  sql += ' ORDER BY datum DESC, idopont DESC';
  res.json(db.prepare(sql).all(...params));
});

// ── Admin: Foglalás jóváhagyása ──
// POST /api/foglalas/:id/jovahagyvas
router.post('/:id/jovahagyas', authRequired, async (req, res) => {
  const f = db.prepare('SELECT * FROM foglalasok WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Nem található' });

  db.prepare(`UPDATE foglalasok SET allapot = 'jovahagyva', frissitve = datetime('now') WHERE id = ?`)
    .run(req.params.id);

  // Email az ügyfélnek
  if (f.email) {
    try { await sendJovahagyasEmail(f); } catch (e) { console.error(e.message); }
  }

  res.json({ ok: true });
});

// ── Admin: Foglalás elutasítása ──
// POST /api/foglalas/:id/elutasitas
router.post('/:id/elutasitas', authRequired, async (req, res) => {
  const { ok: indok } = req.body;
  const f = db.prepare('SELECT * FROM foglalasok WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Nem található' });

  db.prepare(`UPDATE foglalasok SET allapot = 'elutasitva', frissitve = datetime('now') WHERE id = ?`)
    .run(req.params.id);

  if (f.email) {
    try { await sendElutasitasEmail(f, indok); } catch (e) { console.error(e.message); }
  }

  res.json({ ok: true });
});

// ── Admin: Foglalásból munkalap ──
// POST /api/foglalas/:id/munkalap
router.post('/:id/munkalap', authRequired, (req, res) => {
  const f = db.prepare('SELECT * FROM foglalasok WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Nem található' });

  const mid = uuid();
  db.prepare(`
    INSERT INTO munkalapok (id, foglalas_id, ugyfel_nev, ugyfel_tel, ugyfel_email,
      bike_tipus, feladat, megjegyzes, allapot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nyitott')
  `).run(mid, f.id, f.nev, f.telefon, f.email, f.bike_tipus, f.szolgaltatas, f.megjegyzes);

  db.prepare(`UPDATE foglalasok SET allapot = 'munkalap', frissitve = datetime('now') WHERE id = ?`)
    .run(f.id);

  res.json({ ok: true, munkalap_id: mid });
});

// ── Admin: Foglalás törlése ──
// DELETE /api/foglalas/:id
router.delete('/:id', authRequired, (req, res) => {
  const r = db.prepare('DELETE FROM foglalasok WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Nem található' });
  res.json({ ok: true });
});

module.exports = router;

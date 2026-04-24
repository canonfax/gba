// ═══════════════════════════════════════════
//  routes/munkalap.js – Munkalap kezelés
// ═══════════════════════════════════════════

const express    = require('express');
const { v4: uuid } = require('uuid');
const db         = require('../db');
const { authRequired } = require('./auth');
const router     = express.Router();

// ── Összes munkalap ──
// GET /api/munkalap?allapot=nyitott
router.get('/', authRequired, (req, res) => {
  const { allapot } = req.query;
  let sql = `
    SELECT m.*,
      COALESCE(SUM(t.mennyiseg * t.egyseg_ar), 0) as szamolt_ar,
      COUNT(t.id) as tetel_szam
    FROM munkalapok m
    LEFT JOIN munkalap_tetelek t ON t.munkalap_id = m.id
  `;
  const params = [];
  if (allapot) { sql += ' WHERE m.allapot = ?'; params.push(allapot); }
  sql += ' GROUP BY m.id ORDER BY m.letrehozva DESC';
  res.json(db.prepare(sql).all(...params));
});

// ── Egy munkalap részletei ──
// GET /api/munkalap/:id
router.get('/:id', authRequired, (req, res) => {
  const m = db.prepare('SELECT * FROM munkalapok WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Nem található' });
  const tetelek = db.prepare('SELECT * FROM munkalap_tetelek WHERE munkalap_id = ? ORDER BY id').all(req.params.id);
  res.json({ ...m, tetelek });
});

// ── Új munkalap (manuálisan) ──
// POST /api/munkalap
router.post('/', authRequired, (req, res) => {
  const { ugyfel_nev, ugyfel_tel, ugyfel_email, bike_marka, bike_tipus, bike_ev,
          feladat, megjegyzes, prioritas, becsult_ar } = req.body;

  if (!ugyfel_nev || !ugyfel_tel || !feladat) {
    return res.status(400).json({ error: 'Kötelező mezők hiányoznak' });
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO munkalapok (id, ugyfel_nev, ugyfel_tel, ugyfel_email,
      bike_marka, bike_tipus, bike_ev, feladat, megjegyzes, prioritas, becsult_ar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ugyfel_nev, ugyfel_tel, ugyfel_email || null,
         bike_marka || null, bike_tipus || null, bike_ev || null,
         feladat, megjegyzes || null, prioritas || 'normal', becsult_ar || null);

  res.json({ ok: true, id });
});

// ── Munkalap módosítása ──
// PUT /api/munkalap/:id
router.put('/:id', authRequired, (req, res) => {
  const m = db.prepare('SELECT id FROM munkalapok WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Nem található' });

  const { ugyfel_nev, ugyfel_tel, ugyfel_email, bike_marka, bike_tipus, bike_ev,
          feladat, megjegyzes, allapot, prioritas, becsult_ar, vegso_ar } = req.body;

  db.prepare(`
    UPDATE munkalapok SET
      ugyfel_nev = COALESCE(?, ugyfel_nev),
      ugyfel_tel = COALESCE(?, ugyfel_tel),
      ugyfel_email = COALESCE(?, ugyfel_email),
      bike_marka = COALESCE(?, bike_marka),
      bike_tipus = COALESCE(?, bike_tipus),
      bike_ev = COALESCE(?, bike_ev),
      feladat = COALESCE(?, feladat),
      megjegyzes = COALESCE(?, megjegyzes),
      allapot = COALESCE(?, allapot),
      prioritas = COALESCE(?, prioritas),
      becsult_ar = COALESCE(?, becsult_ar),
      vegso_ar = COALESCE(?, vegso_ar),
      lezarva = CASE WHEN ? = 'kesz' AND allapot != 'kesz' THEN datetime('now') ELSE lezarva END,
      frissitve = datetime('now')
    WHERE id = ?
  `).run(ugyfel_nev, ugyfel_tel, ugyfel_email, bike_marka, bike_tipus, bike_ev,
         feladat, megjegyzes, allapot, prioritas, becsult_ar, vegso_ar,
         allapot, req.params.id);

  res.json({ ok: true });
});

// ── Munkalap törlése ──
// DELETE /api/munkalap/:id
router.delete('/:id', authRequired, (req, res) => {
  const r = db.prepare('DELETE FROM munkalapok WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Nem található' });
  res.json({ ok: true });
});

// ── Tétel hozzáadása ──
// POST /api/munkalap/:id/tetel
router.post('/:id/tetel', authRequired, (req, res) => {
  const { megnevezes, tipus, mennyiseg, egyseg_ar } = req.body;
  if (!megnevezes) return res.status(400).json({ error: 'Megnevezés kötelező' });

  const r = db.prepare(`
    INSERT INTO munkalap_tetelek (munkalap_id, megnevezes, tipus, mennyiseg, egyseg_ar)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, megnevezes, tipus || 'munka',
         parseFloat(mennyiseg) || 1, parseFloat(egyseg_ar) || 0);

  // Végső ár frissítése
  const osszeg = db.prepare(
    'SELECT SUM(mennyiseg * egyseg_ar) as total FROM munkalap_tetelek WHERE munkalap_id = ?'
  ).get(req.params.id).total || 0;
  db.prepare('UPDATE munkalapok SET vegso_ar = ?, frissitve = datetime(\'now\') WHERE id = ?')
    .run(osszeg, req.params.id);

  res.json({ ok: true, id: r.lastInsertRowid });
});

// ── Tétel törlése ──
// DELETE /api/munkalap/tetel/:tid
router.delete('/tetel/:tid', authRequired, (req, res) => {
  const t = db.prepare('SELECT munkalap_id FROM munkalap_tetelek WHERE id = ?').get(req.params.tid);
  if (!t) return res.status(404).json({ error: 'Nem található' });

  db.prepare('DELETE FROM munkalap_tetelek WHERE id = ?').run(req.params.tid);

  // Végső ár újraszámolása
  const osszeg = db.prepare(
    'SELECT COALESCE(SUM(mennyiseg * egyseg_ar), 0) as total FROM munkalap_tetelek WHERE munkalap_id = ?'
  ).get(t.munkalap_id).total;
  db.prepare('UPDATE munkalapok SET vegso_ar = ?, frissitve = datetime(\'now\') WHERE id = ?')
    .run(osszeg, t.munkalap_id);

  res.json({ ok: true });
});

// ── Statisztika ──
// GET /api/munkalap/stat/osszesito
router.get('/stat/osszesito', authRequired, (req, res) => {
  const stat = {
    nyitott:      db.prepare("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='nyitott'").get().n,
    folyamatban:  db.prepare("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='folyamatban'").get().n,
    kesz:         db.prepare("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='kesz'").get().n,
    archiv:       db.prepare("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='archiv'").get().n,
    bevétel_ma:   db.prepare("SELECT COALESCE(SUM(vegso_ar),0) as n FROM munkalapok WHERE allapot='kesz' AND date(lezarva)=date('now')").get().n,
    bevétel_honap:db.prepare("SELECT COALESCE(SUM(vegso_ar),0) as n FROM munkalapok WHERE allapot='kesz' AND strftime('%Y-%m',lezarva)=strftime('%Y-%m','now')").get().n,
    fuggeben_foglalas: db.prepare("SELECT COUNT(*) as n FROM foglalasok WHERE allapot='fuggeben'").get().n,
  };
  res.json(stat);
});

module.exports = router;

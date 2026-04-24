const express = require('express');
const { v4: uuid } = require('uuid');
const db      = require('../db');
const { authRequired } = require('./auth');
const router  = express.Router();

// Összes munkalap
router.get('/', authRequired, async (req, res) => {
  const { allapot } = req.query;
  try {
    const sql = `
      SELECT m.*, COALESCE(SUM(t.mennyiseg*t.egyseg_ar),0) as szamolt_ar, COUNT(t.id) as tetel_szam
      FROM munkalapok m LEFT JOIN munkalap_tetelek t ON t.munkalap_id=m.id
      ${allapot ? 'WHERE m.allapot=?' : ''}
      GROUP BY m.id ORDER BY m.letrehozva DESC`;
    res.json(await db.all2(sql, allapot ? [allapot] : []));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Egy munkalap
router.get('/:id', authRequired, async (req, res) => {
  try {
    const m = await db.get2('SELECT * FROM munkalapok WHERE id=?', [req.params.id]);
    if (!m) return res.status(404).json({ error: 'Nem található' });
    const tetelek = await db.all2('SELECT * FROM munkalap_tetelek WHERE munkalap_id=? ORDER BY id', [req.params.id]);
    res.json({ ...m, tetelek });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Új munkalap
router.post('/', authRequired, async (req, res) => {
  const { ugyfel_nev, ugyfel_tel, ugyfel_email, bike_marka, bike_tipus, bike_ev, feladat, megjegyzes, prioritas, becsult_ar } = req.body;
  if (!ugyfel_nev || !ugyfel_tel || !feladat) return res.status(400).json({ error: 'Kötelező mezők hiányoznak' });
  try {
    const id = uuid();
    await db.run2(
      `INSERT INTO munkalapok (id,ugyfel_nev,ugyfel_tel,ugyfel_email,bike_marka,bike_tipus,bike_ev,feladat,megjegyzes,prioritas,becsult_ar)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id, ugyfel_nev, ugyfel_tel, ugyfel_email||null, bike_marka||null, bike_tipus||null, bike_ev||null, feladat, megjegyzes||null, prioritas||'normal', becsult_ar||null]
    );
    res.json({ ok: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Munkalap módosítása
router.put('/:id', authRequired, async (req, res) => {
  const { ugyfel_nev, ugyfel_tel, ugyfel_email, bike_marka, bike_tipus, bike_ev, feladat, megjegyzes, allapot, prioritas, becsult_ar, vegso_ar } = req.body;
  try {
    const m = await db.get2('SELECT id, allapot FROM munkalapok WHERE id=?', [req.params.id]);
    if (!m) return res.status(404).json({ error: 'Nem található' });
    const lezarva = allapot === 'kesz' && m.allapot !== 'kesz' ? "datetime('now')" : 'lezarva';
    await db.run2(`
      UPDATE munkalapok SET
        ugyfel_nev=COALESCE(?,ugyfel_nev), ugyfel_tel=COALESCE(?,ugyfel_tel),
        ugyfel_email=COALESCE(?,ugyfel_email), bike_marka=COALESCE(?,bike_marka),
        bike_tipus=COALESCE(?,bike_tipus), bike_ev=COALESCE(?,bike_ev),
        feladat=COALESCE(?,feladat), megjegyzes=COALESCE(?,megjegyzes),
        allapot=COALESCE(?,allapot), prioritas=COALESCE(?,prioritas),
        becsult_ar=COALESCE(?,becsult_ar), vegso_ar=COALESCE(?,vegso_ar),
        lezarva=${lezarva}, frissitve=datetime('now')
      WHERE id=?`,
      [ugyfel_nev, ugyfel_tel, ugyfel_email, bike_marka, bike_tipus, bike_ev, feladat, megjegyzes, allapot, prioritas, becsult_ar, vegso_ar, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Törlés
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const r = await db.run2('DELETE FROM munkalapok WHERE id=?', [req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Nem található' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Tétel hozzáadása
router.post('/:id/tetel', authRequired, async (req, res) => {
  const { megnevezes, tipus, mennyiseg, egyseg_ar } = req.body;
  if (!megnevezes) return res.status(400).json({ error: 'Megnevezés kötelező' });
  try {
    const r = await db.run2(
      'INSERT INTO munkalap_tetelek (munkalap_id,megnevezes,tipus,mennyiseg,egyseg_ar) VALUES (?,?,?,?,?)',
      [req.params.id, megnevezes, tipus||'munka', parseFloat(mennyiseg)||1, parseFloat(egyseg_ar)||0]
    );
    const { total } = await db.get2('SELECT COALESCE(SUM(mennyiseg*egyseg_ar),0) as total FROM munkalap_tetelek WHERE munkalap_id=?', [req.params.id]);
    await db.run2("UPDATE munkalapok SET vegso_ar=?, frissitve=datetime('now') WHERE id=?", [total, req.params.id]);
    res.json({ ok: true, id: r.lastID });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Tétel törlése
router.delete('/tetel/:tid', authRequired, async (req, res) => {
  try {
    const t = await db.get2('SELECT munkalap_id FROM munkalap_tetelek WHERE id=?', [req.params.tid]);
    if (!t) return res.status(404).json({ error: 'Nem található' });
    await db.run2('DELETE FROM munkalap_tetelek WHERE id=?', [req.params.tid]);
    const { total } = await db.get2('SELECT COALESCE(SUM(mennyiseg*egyseg_ar),0) as total FROM munkalap_tetelek WHERE munkalap_id=?', [t.munkalap_id]);
    await db.run2("UPDATE munkalapok SET vegso_ar=?, frissitve=datetime('now') WHERE id=?", [total, t.munkalap_id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Statisztika
router.get('/stat/osszesito', authRequired, async (req, res) => {
  try {
    const [ny, fo, ke, ar, aH, aM, ff] = await Promise.all([
      db.get2("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='nyitott'"),
      db.get2("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='folyamatban'"),
      db.get2("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='kesz'"),
      db.get2("SELECT COUNT(*) as n FROM munkalapok WHERE allapot='archiv'"),
      db.get2("SELECT COALESCE(SUM(vegso_ar),0) as n FROM munkalapok WHERE allapot='kesz' AND date(lezarva)=date('now')"),
      db.get2("SELECT COALESCE(SUM(vegso_ar),0) as n FROM munkalapok WHERE allapot='kesz' AND strftime('%Y-%m',lezarva)=strftime('%Y-%m','now')"),
      db.get2("SELECT COUNT(*) as n FROM foglalasok WHERE allapot='fuggeben'"),
    ]);
    res.json({ nyitott: ny.n, folyamatban: fo.n, kesz: ke.n, archiv: ar.n,
      'bevétel_ma': aH.n, 'bevétel_honap': aM.n, fuggeben_foglalas: ff.n });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

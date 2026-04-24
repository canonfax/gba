const express = require('express');
const { v4: uuid } = require('uuid');
const db      = require('../db');
const { authRequired } = require('./auth');
const { sendFoglalasEmail, sendJovahagyasEmail, sendElutasitasEmail } = require('../mailer');
const router  = express.Router();

// Publikus: Foglalás beküldése
router.post('/', async (req, res) => {
  const { nev, telefon, email, szolgaltatas, bike_tipus, datum, idopont, megjegyzes } = req.body;
  if (!nev || !telefon || !szolgaltatas || !datum || !idopont)
    return res.status(400).json({ error: 'Kötelező mezők hiányoznak' });
  try {
    const existing = await db.get2(
      `SELECT id FROM foglalasok WHERE datum=? AND idopont=? AND allapot IN ('fuggeben','jovahagyva')`,
      [datum, idopont]
    );
    if (existing) return res.status(409).json({ error: 'Ez az időpont már foglalt!' });
    const id = uuid();
    await db.run2(
      `INSERT INTO foglalasok (id,nev,telefon,email,szolgaltatas,bike_tipus,datum,idopont,megjegyzes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, nev, telefon, email||null, szolgaltatas, bike_tipus||null, datum, idopont, megjegyzes||null]
    );
    try { await sendFoglalasEmail({ id, nev, telefon, email, szolgaltatas, bike_tipus, datum, idopont, megjegyzes }); }
    catch(e) { console.error('Email hiba:', e.message); }
    res.json({ ok: true, id, uzenet: 'Foglalásod megérkezett! Hamarosan visszaigazoljuk.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Publikus: Szabad időpontok
router.get('/szabad', async (req, res) => {
  const { datum } = req.query;
  if (!datum) return res.status(400).json({ error: 'Dátum szükséges' });
  try {
    const osszes = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00'];
    const rows = await db.all2(
      `SELECT idopont FROM foglalasok WHERE datum=? AND allapot IN ('fuggeben','jovahagyva')`,
      [datum]
    );
    const foglalt = rows.map(r => r.idopont);
    res.json({ datum, szabad: osszes.filter(t => !foglalt.includes(t)), foglalt });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: Összes foglalás
router.get('/admin', authRequired, async (req, res) => {
  const { allapot } = req.query;
  try {
    const sql = allapot
      ? 'SELECT * FROM foglalasok WHERE allapot=? ORDER BY datum DESC, idopont DESC'
      : 'SELECT * FROM foglalasok ORDER BY datum DESC, idopont DESC';
    res.json(await db.all2(sql, allapot ? [allapot] : []));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: Jóváhagyás
router.post('/:id/jovahagyas', authRequired, async (req, res) => {
  try {
    const f = await db.get2('SELECT * FROM foglalasok WHERE id=?', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'Nem található' });
    await db.run2(`UPDATE foglalasok SET allapot='jovahagyva', frissitve=datetime('now') WHERE id=?`, [req.params.id]);
    if (f.email) { try { await sendJovahagyasEmail(f); } catch(e) { console.error(e.message); } }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: Elutasítás
router.post('/:id/elutasitas', authRequired, async (req, res) => {
  const { ok: indok } = req.body;
  try {
    const f = await db.get2('SELECT * FROM foglalasok WHERE id=?', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'Nem található' });
    await db.run2(`UPDATE foglalasok SET allapot='elutasitva', frissitve=datetime('now') WHERE id=?`, [req.params.id]);
    if (f.email) { try { await sendElutasitasEmail(f, indok); } catch(e) { console.error(e.message); } }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: Foglalásból munkalap
router.post('/:id/munkalap', authRequired, async (req, res) => {
  try {
    const f = await db.get2('SELECT * FROM foglalasok WHERE id=?', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'Nem található' });
    const mid = uuid();
    await db.run2(
      `INSERT INTO munkalapok (id,foglalas_id,ugyfel_nev,ugyfel_tel,ugyfel_email,bike_tipus,feladat,megjegyzes,allapot)
       VALUES (?,?,?,?,?,?,?,?,'nyitott')`,
      [mid, f.id, f.nev, f.telefon, f.email, f.bike_tipus, f.szolgaltatas, f.megjegyzes]
    );
    await db.run2(`UPDATE foglalasok SET allapot='munkalap', frissitve=datetime('now') WHERE id=?`, [f.id]);
    res.json({ ok: true, munkalap_id: mid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: Törlés
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const r = await db.run2('DELETE FROM foglalasok WHERE id=?', [req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Nem található' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

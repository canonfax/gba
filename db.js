// ═══════════════════════════════════════════
//  db.js – SQLite adatbázis (sqlite3 csomag)
//  Windows-on is működik fordítás nélkül
// ═══════════════════════════════════════════

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const bcrypt  = require('bcryptjs');
const fs      = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'gyulabringa.db');
const db = new sqlite3.Database(DB_PATH);

// Promise wrapperek – a sqlite3 csomag callback alapú,
// ezeket a helpereket használjuk az async/await helyett
db.run2  = (sql, params=[]) => new Promise((res, rej) => db.run(sql, params, function(e) { e ? rej(e) : res(this); }));
db.get2  = (sql, params=[]) => new Promise((res, rej) => db.get(sql, params, (e, r) => e ? rej(e) : res(r)));
db.all2  = (sql, params=[]) => new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r)));

// WAL mód és foreign keys
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // ── Táblák létrehozása ──
  db.run(`CREATE TABLE IF NOT EXISTS admin (
    id       INTEGER PRIMARY KEY,
    email    TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nev      TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS foglalasok (
    id           TEXT PRIMARY KEY,
    nev          TEXT NOT NULL,
    telefon      TEXT NOT NULL,
    email        TEXT,
    szolgaltatas TEXT NOT NULL,
    bike_tipus   TEXT,
    datum        TEXT NOT NULL,
    idopont      TEXT NOT NULL,
    megjegyzes   TEXT,
    allapot      TEXT NOT NULL DEFAULT 'fuggeben',
    letrehozva   TEXT NOT NULL DEFAULT (datetime('now')),
    frissitve    TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS munkalapok (
    id           TEXT PRIMARY KEY,
    foglalas_id  TEXT REFERENCES foglalasok(id),
    ugyfel_nev   TEXT NOT NULL,
    ugyfel_tel   TEXT NOT NULL,
    ugyfel_email TEXT,
    bike_marka   TEXT,
    bike_tipus   TEXT,
    bike_ev      TEXT,
    feladat      TEXT NOT NULL,
    megjegyzes   TEXT,
    allapot      TEXT NOT NULL DEFAULT 'nyitott',
    prioritas    TEXT NOT NULL DEFAULT 'normal',
    becsult_ar   REAL,
    vegso_ar     REAL,
    letrehozva   TEXT NOT NULL DEFAULT (datetime('now')),
    frissitve    TEXT NOT NULL DEFAULT (datetime('now')),
    lezarva      TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS munkalap_tetelek (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    munkalap_id TEXT NOT NULL REFERENCES munkalapok(id) ON DELETE CASCADE,
    megnevezes  TEXT NOT NULL,
    tipus       TEXT NOT NULL DEFAULT 'munka',
    mennyiseg   REAL NOT NULL DEFAULT 1,
    egyseg_ar   REAL NOT NULL DEFAULT 0,
    letrehozva  TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // ── Admin létrehozása ha még nincs ──
  const adminEmail = process.env.ADMIN_EMAIL || 'gyulabringa@gmail.com';
  const adminPass  = process.env.ADMIN_PASS  || 'admin1234';

  db.get('SELECT id FROM admin WHERE id = 1', [], async (err, row) => {
    if (!row) {
      const hash = await bcrypt.hash(adminPass, 10);
      db.run('INSERT INTO admin (id, email, password, nev) VALUES (1, ?, ?, ?)',
        [adminEmail, hash, 'Gergely Dániel']);
      console.log(`✅ Admin létrehozva: ${adminEmail}`);
    }
  });
});

module.exports = db;

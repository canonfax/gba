// ═══════════════════════════════════════════
//  db.js – SQLite adatbázis inicializálás
//  Táblák: admin, foglalasok, munkalapok, munkalap_tetelek
// ═══════════════════════════════════════════

const Database = require('better-sqlite3');
const path     = require('path');
const bcrypt   = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'gyulabringa.db');
const db      = new Database(DB_PATH);

// WAL mód – gyorsabb, biztonságosabb
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Táblák létrehozása ──
db.exec(`

  -- Admin felhasználó
  CREATE TABLE IF NOT EXISTS admin (
    id        INTEGER PRIMARY KEY,
    email     TEXT    NOT NULL UNIQUE,
    password  TEXT    NOT NULL,
    nev       TEXT    NOT NULL
  );

  -- Foglalások (ügyfelek által beküldött)
  CREATE TABLE IF NOT EXISTS foglalasok (
    id            TEXT    PRIMARY KEY,
    nev           TEXT    NOT NULL,
    telefon       TEXT    NOT NULL,
    email         TEXT,
    szolgaltatas  TEXT    NOT NULL,
    bike_tipus    TEXT,
    datum         TEXT    NOT NULL,
    idopont       TEXT    NOT NULL,
    megjegyzes    TEXT,
    allapot       TEXT    NOT NULL DEFAULT 'fuggeben',
    -- fuggeben | jovahagyva | elutasitva | munkalap
    letrehozva    TEXT    NOT NULL DEFAULT (datetime('now')),
    frissitve     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Munkalapok
  CREATE TABLE IF NOT EXISTS munkalapok (
    id            TEXT    PRIMARY KEY,
    foglalas_id   TEXT    REFERENCES foglalasok(id),
    ugyfel_nev    TEXT    NOT NULL,
    ugyfel_tel    TEXT    NOT NULL,
    ugyfel_email  TEXT,
    bike_marka    TEXT,
    bike_tipus    TEXT,
    bike_ev       TEXT,
    feladat       TEXT    NOT NULL,
    megjegyzes    TEXT,
    allapot       TEXT    NOT NULL DEFAULT 'nyitott',
    -- nyitott | folyamatban | kesz | archiv
    prioritas     TEXT    NOT NULL DEFAULT 'normal',
    -- alacsony | normal | magas | surgos
    becsult_ar    REAL,
    vegso_ar      REAL,
    letrehozva    TEXT    NOT NULL DEFAULT (datetime('now')),
    frissitve     TEXT    NOT NULL DEFAULT (datetime('now')),
    lezarva       TEXT
  );

  -- Munkalap tételek (elvégzett munkák, alkatrészek)
  CREATE TABLE IF NOT EXISTS munkalap_tetelek (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    munkalap_id   TEXT    NOT NULL REFERENCES munkalapok(id) ON DELETE CASCADE,
    megnevezes    TEXT    NOT NULL,
    tipus         TEXT    NOT NULL DEFAULT 'munka',
    -- munka | alkatresz | egyeb
    mennyiseg     REAL    NOT NULL DEFAULT 1,
    egyseg_ar     REAL    NOT NULL DEFAULT 0,
    letrehozva    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

`);

// ── Alapértelmezett admin létrehozása ha még nincs ──
const adminEmail = process.env.ADMIN_EMAIL || 'gyulabringa@gmail.com';
const adminPass  = process.env.ADMIN_PASS  || 'admin1234';
const adminNev   = 'Gergely Dániel';

const existing = db.prepare('SELECT id FROM admin WHERE id = 1').get();
if (!existing) {
  const hash = bcrypt.hashSync(adminPass, 10);
  db.prepare('INSERT INTO admin (id, email, password, nev) VALUES (1, ?, ?, ?)')
    .run(adminEmail, hash, adminNev);
  console.log(`✅ Admin létrehozva: ${adminEmail}`);
}

module.exports = db;

// ═══════════════════════════════════════════
//  mailer.js – Email értesítések (Nodemailer)
// ═══════════════════════════════════════════

const nodemailer = require('nodemailer');

// Transporter – Gmail SMTP
// Railway-en be kell állítani: MAIL_USER, MAIL_PASS env változókat
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER || 'gyulabringa@gmail.com',
      pass: process.env.MAIL_PASS || '',  // Gmail App Password
    },
  });
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gyulabringa@gmail.com';
const SHOP_NAME   = 'GyulaBringa – Shimano Service Center';

// ── Adminnak: új foglalás érkezett ──
async function sendFoglalasEmail(f) {
  if (!process.env.MAIL_PASS) return; // Ha nincs beállítva, kihagyjuk
  const t = getTransporter();
  await t.sendMail({
    from: `"${SHOP_NAME}" <${process.env.MAIL_USER}>`,
    to:   ADMIN_EMAIL,
    subject: `🔔 Új foglalás érkezett – ${f.nev}`,
    html: `
      <h2 style="color:#009AD9;">Új időpontfoglalás</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Ügyfél neve:</td><td style="padding:8px;">${f.nev}</td></tr>
        <tr style="background:#f4f7fb;"><td style="padding:8px;font-weight:bold;color:#555;">Telefon:</td><td style="padding:8px;"><a href="tel:${f.telefon}">${f.telefon}</a></td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Email:</td><td style="padding:8px;">${f.email || '–'}</td></tr>
        <tr style="background:#f4f7fb;"><td style="padding:8px;font-weight:bold;color:#555;">Szolgáltatás:</td><td style="padding:8px;">${f.szolgaltatas}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Kerékpár típus:</td><td style="padding:8px;">${f.bike_tipus || '–'}</td></tr>
        <tr style="background:#f4f7fb;"><td style="padding:8px;font-weight:bold;color:#555;">Dátum:</td><td style="padding:8px;"><strong>${f.datum} ${f.idopont}</strong></td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Megjegyzés:</td><td style="padding:8px;">${f.megjegyzes || '–'}</td></tr>
      </table>
      <p style="margin-top:20px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin" 
           style="background:#009AD9;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">
          Admin panel megnyitása
        </a>
      </p>
    `,
  });
}

// ── Ügyfélnek: foglalás jóváhagyva ──
async function sendJovahagyasEmail(f) {
  if (!process.env.MAIL_PASS || !f.email) return;
  const t = getTransporter();
  await t.sendMail({
    from: `"${SHOP_NAME}" <${process.env.MAIL_USER}>`,
    to:   f.email,
    subject: `✅ Időpontod visszaigazolva – GyulaBringa`,
    html: `
      <h2 style="color:#009AD9;">Időpontod visszaigazolva!</h2>
      <p>Kedves <strong>${f.nev}</strong>!</p>
      <p>Örömmel tájékoztatunk, hogy időpontfoglalásod visszaigazoltuk.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr style="background:#f4f7fb;"><td style="padding:8px;font-weight:bold;color:#555;">Időpont:</td><td style="padding:8px;"><strong>${f.datum} ${f.idopont}</strong></td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Szolgáltatás:</td><td style="padding:8px;">${f.szolgaltatas}</td></tr>
        <tr style="background:#f4f7fb;"><td style="padding:8px;font-weight:bold;color:#555;">Cím:</td><td style="padding:8px;">5700 Gyula, Nagyváradi út 23.</td></tr>
      </table>
      <p>Ha kérdésed van, hívj minket: <a href="tel:+3666611379">+36 66/611-379</a></p>
      <p style="color:#555;font-size:0.9em;">GyulaBringa – Shimano Service Center</p>
    `,
  });
}

// ── Ügyfélnek: foglalás elutasítva ──
async function sendElutasitasEmail(f, indok) {
  if (!process.env.MAIL_PASS || !f.email) return;
  const t = getTransporter();
  await t.sendMail({
    from: `"${SHOP_NAME}" <${process.env.MAIL_USER}>`,
    to:   f.email,
    subject: `❌ Időpontfoglalás – GyulaBringa`,
    html: `
      <h2 style="color:#009AD9;">Időpontfoglalásról tájékoztatás</h2>
      <p>Kedves <strong>${f.nev}</strong>!</p>
      <p>Sajnálattal tájékoztatunk, hogy a kért időpontot (<strong>${f.datum} ${f.idopont}</strong>) nem tudjuk biztosítani.</p>
      ${indok ? `<p><strong>Indoklás:</strong> ${indok}</p>` : ''}
      <p>Kérjük, foglalj új időpontot, vagy vedd fel velünk a kapcsolatot:</p>
      <p><a href="tel:+3666611379">+36 66/611-379</a> | <a href="tel:+36305484260">+36 30/5484-260</a></p>
      <p style="color:#555;font-size:0.9em;">GyulaBringa – Shimano Service Center</p>
    `,
  });
}

module.exports = { sendFoglalasEmail, sendJovahagyasEmail, sendElutasitasEmail };

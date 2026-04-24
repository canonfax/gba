// ═══════════════════════════════════════════
//  foglalas.js – Időpontfoglaló frontend
// ═══════════════════════════════════════════

let aktSzolg   = '';
let aktBike    = '';
let aktDatum   = '';
let aktIdopont = '';

// ── Lépés kezelés ──
function goStep(n) {
  [1,2,3].forEach(i => {
    document.getElementById(`step-${i}`).style.display = i === n ? 'block' : 'none';
    const s = document.getElementById(`s${i}`);
    s.classList.toggle('active', i === n);
    s.classList.toggle('done',   i < n);
    const line = document.getElementById(`sl${i}`);
    if (line) line.classList.toggle('done', i < n);
  });
}

// ── Naptár generálás (10 munkanap) ──
function generateDays() {
  const row = document.getElementById('naptar-row');
  const days = [];
  const napok = ['V','H','K','Sze','Cs','P','Szo'];
  const d = new Date();
  d.setDate(d.getDate() + 1); // holnaptól

  while (days.length < 10) {
    const dow = d.getDay();
    if (dow !== 0) { // hétfő-szombat
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  row.innerHTML = days.map(day => {
    const iso  = day.toISOString().split('T')[0];
    const nap  = napok[day.getDay()];
    const szam = day.getDate() + '. ' + (day.getMonth()+1) + '.';
    return `
      <button class="nap-btn ${iso === aktDatum ? 'active' : ''}" data-datum="${iso}">
        <span class="nap-btn-nap">${nap}</span>
        <span class="nap-btn-szam">${szam}</span>
      </button>
    `;
  }).join('');

  row.querySelectorAll('.nap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      row.querySelectorAll('.nap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      aktDatum = btn.dataset.datum;
      loadSlots(aktDatum);
    });
  });
}

// ── Szabad időpontok betöltése ──
async function loadSlots(datum) {
  const grid = document.getElementById('slot-grid');
  const info = document.getElementById('slot-info');
  grid.innerHTML = '';
  info.textContent = 'Betöltés...';
  aktIdopont = '';

  try {
    const r = await fetch(`/api/foglalas/szabad?datum=${datum}`);
    const d = await r.json();

    if (!d.szabad.length) {
      info.textContent = 'Erre a napra nincs szabad időpont.';
      return;
    }
    info.textContent = `${d.szabad.length} szabad időpont`;

    const osszes = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00'];
    grid.innerHTML = osszes.map(t => {
      const szabad = d.szabad.includes(t);
      return `<div class="slot ${szabad ? '' : 'foglalt'}" data-time="${t}">
        ${t}${!szabad ? '<br><small>Foglalt</small>' : ''}
      </div>`;
    }).join('');

    grid.querySelectorAll('.slot:not(.foglalt)').forEach(slot => {
      slot.addEventListener('click', () => {
        grid.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        aktIdopont = slot.dataset.time;
      });
    });
  } catch { info.textContent = 'Hiba a betöltés során.'; }
}

// ── Foglalás küldése ──
async function sendFoglalas() {
  const nev    = document.getElementById('b-nev').value.trim();
  const tel    = document.getElementById('b-tel').value.trim();
  const email  = document.getElementById('b-email').value.trim();
  const megj   = document.getElementById('b-megj').value.trim();

  if (!nev || !tel) { toast('Név és telefon kötelező!', 'error'); return; }

  const btn = document.getElementById('step3-submit');
  btn.disabled = true;
  btn.textContent = 'Küldés...';

  try {
    const r = await fetch('/api/foglalas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nev, telefon: tel, email: email || undefined,
        szolgaltatas: aktSzolg, bike_tipus: aktBike || undefined,
        datum: aktDatum, idopont: aktIdopont,
        megjegyzes: megj || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);

    document.getElementById('foglalas-form-wrap').style.display = 'none';
    document.getElementById('booking-success').style.display    = 'block';
  } catch(e) {
    toast(e.message || 'Hiba a küldés során', 'error');
    btn.disabled = false;
    btn.textContent = '📅 Foglalás küldése';
  }
}

function toast(msg, type='info') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {

  // Szolgáltatás választó
  document.querySelectorAll('.service-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.service-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      aktSzolg = btn.dataset.service;
    });
  });

  // Kerékpár típus
  document.querySelectorAll('.bike-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bike-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      aktBike = btn.dataset.bike;
    });
  });

  // 1→2
  document.getElementById('step1-next').addEventListener('click', () => {
    if (!aktSzolg) { toast('Válassz egy szolgáltatást!', 'error'); return; }
    goStep(2);
    generateDays();
  });

  // 2→1
  document.getElementById('step2-back').addEventListener('click', () => goStep(1));

  // 2→3
  document.getElementById('step2-next').addEventListener('click', () => {
    if (!aktDatum)   { toast('Válassz dátumot!', 'error'); return; }
    if (!aktIdopont) { toast('Válassz időpontot!', 'error'); return; }
    // Összefoglaló
    document.getElementById('foglalas-osszegzas').innerHTML = `
      <strong>${aktSzolg}</strong><br>
      ${aktBike ? `🚲 ${aktBike}<br>` : ''}
      📅 ${aktDatum} – ${aktIdopont}
    `;
    goStep(3);
  });

  // 3→2
  document.getElementById('step3-back').addEventListener('click', () => goStep(2));

  // Küldés
  document.getElementById('step3-submit').addEventListener('click', sendFoglalas);

});

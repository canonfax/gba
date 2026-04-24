// ═══════════════════════════════════════════
//  admin.js – Admin panel teljes logika
// ═══════════════════════════════════════════

const API   = '';  // Ugyanazon a szerveren fut
let token   = localStorage.getItem('gb_admin_token') || '';
let aktTab  = 'dashboard';
let aktFoglAllapot = '';
let aktMunkAllapot = '';

// ── Toast ──
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// ── API hívás ──
async function api(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + url, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Hiba');
  return d;
}

function fmtDate(s) { return s ? new Date(s).toLocaleDateString('hu-HU') : '–'; }
function fmtDT(s)   { return s ? new Date(s).toLocaleString('hu-HU', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '–'; }
function fmtFt(n)   { return n ? Math.round(n).toLocaleString('hu-HU') + ' Ft' : '–'; }

function badgeHTML(allapot) {
  const labels = {
    fuggeben:'Függőben', jovahagyva:'Jóváhagyva', elutasitva:'Elutasítva', munkalap:'Munkalap',
    nyitott:'Nyitott', folyamatban:'Folyamatban', kesz:'Kész', archiv:'Archív',
    surgos:'Sürgős', magas:'Magas', normal:'Normál', alacsony:'Alacsony',
  };
  return `<span class="badge badge-${allapot}">${labels[allapot] || allapot}</span>`;
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.textContent = '';
  try {
    const d = await api('POST', '/api/auth/login', { email, password: pass });
    token = d.token;
    localStorage.setItem('gb_admin_token', token);
    document.getElementById('sidebar-user').textContent = '👤 ' + d.nev;
    showPanel();
  } catch(e) { errEl.textContent = e.message; }
}

async function checkToken() {
  if (!token) return;
  try {
    const d = await api('GET', '/api/auth/me');
    document.getElementById('sidebar-user').textContent = '👤 ' + d.admin.nev;
    showPanel();
  } catch { token = ''; localStorage.removeItem('gb_admin_token'); }
}

function showPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-wrap').style.display   = 'flex';
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('hu-HU', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  switchTab('dashboard');
}

function logout() {
  token = ''; localStorage.removeItem('gb_admin_token');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-wrap').style.display   = 'none';
}

// ══════════════════════════════════════════
//  TAB KEZELÉS
// ══════════════════════════════════════════
function switchTab(name) {
  aktTab = name;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');

  // Munkalap részletek elrejtése
  const detail = document.getElementById('munkalap-detail');
  const list   = document.getElementById('munkalapok-list');
  if (detail && name === 'munkalapok') { detail.style.display = 'none'; list.style.display = 'flex'; }

  if (name === 'dashboard')   loadDashboard();
  if (name === 'foglalasok')  loadFoglalasok();
  if (name === 'munkalapok')  loadMunkalapok();
  if (name === 'naptar')      loadNaptar();
}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
async function loadDashboard() {
  try {
    const stat = await api('GET', '/api/munkalap/stat/osszesito');
    document.getElementById('stat-grid').innerHTML = `
      <div class="stat-card stat-orange">
        <span class="stat-card-ico">📅</span>
        <div class="stat-card-n">${stat.fuggeben_foglalas}</div>
        <div class="stat-card-l">Függőben lévő foglalás</div>
      </div>
      <div class="stat-card">
        <span class="stat-card-ico">📋</span>
        <div class="stat-card-n">${stat.nyitott + stat.folyamatban}</div>
        <div class="stat-card-l">Aktív munkalap</div>
      </div>
      <div class="stat-card stat-green">
        <span class="stat-card-ico">💰</span>
        <div class="stat-card-n">${Math.round(stat.bevétel_ma).toLocaleString('hu-HU')}</div>
        <div class="stat-card-l">Mai bevétel (Ft)</div>
      </div>
      <div class="stat-card stat-green">
        <span class="stat-card-ico">📈</span>
        <div class="stat-card-n">${Math.round(stat.bevétel_honap).toLocaleString('hu-HU')}</div>
        <div class="stat-card-l">Havi bevétel (Ft)</div>
      </div>
    `;

    // Friss foglalások
    const foglalasok = await api('GET', '/api/foglalas/admin?allapot=fuggeben');
    const dashF = document.getElementById('dash-foglalasok');
    if (!foglalasok.length) { dashF.innerHTML = '<div class="empty-state">Nincs függőben lévő foglalás</div>'; }
    else dashF.innerHTML = foglalasok.slice(0,5).map(f => `
      <div class="list-item" style="margin-bottom:.5rem;">
        <div class="list-item-info">
          <div class="list-item-title">${esc(f.nev)} – ${f.datum} ${f.idopont}</div>
          <div class="list-item-meta"><span>${esc(f.szolgaltatas)}</span><span>${f.telefon}</span></div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-success btn-sm" onclick="jovahagyas('${f.id}')">✓ OK</button>
          <button class="btn btn-danger btn-sm" onclick="elutasitas('${f.id}')">✗</button>
        </div>
      </div>
    `).join('');

    // Nyitott munkalapok
    const munkalapok = await api('GET', '/api/munkalap?allapot=nyitott');
    const dashM = document.getElementById('dash-munkalapok');
    if (!munkalapok.length) { dashM.innerHTML = '<div class="empty-state">Nincs nyitott munkalap</div>'; }
    else dashM.innerHTML = munkalapok.slice(0,5).map(m => `
      <div class="list-item" style="margin-bottom:.5rem;">
        <div class="list-item-info">
          <div class="list-item-title">${esc(m.ugyfel_nev)}</div>
          <div class="list-item-meta"><span>${esc(m.feladat).substring(0,40)}...</span>${badgeHTML(m.prioritas)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="openMunkalap('${m.id}')">Megnyit</button>
      </div>
    `).join('');

    // Badge frissítés
    document.getElementById('badge-foglalas').textContent = stat.fuggeben_foglalas || '';
  } catch(e) { console.error(e); }
}

// ══════════════════════════════════════════
//  FOGLALÁSOK
// ══════════════════════════════════════════
async function loadFoglalasok(allapot = aktFoglAllapot) {
  aktFoglAllapot = allapot;
  const el = document.getElementById('foglalasok-list');
  el.innerHTML = '<div class="empty-state">Betöltés...</div>';
  try {
    const url = '/api/foglalas/admin' + (allapot ? `?allapot=${allapot}` : '');
    const list = await api('GET', url);
    if (!list.length) { el.innerHTML = '<div class="empty-state">Nincs találat.</div>'; return; }
    el.innerHTML = list.map(f => `
      <div class="list-item" id="fogl-${f.id}">
        <div class="list-item-info">
          <div class="list-item-title">${esc(f.nev)} &nbsp;${badgeHTML(f.allapot)}</div>
          <div class="list-item-meta">
            <span>📅 ${f.datum} ${f.idopont}</span>
            <span>📞 ${f.telefon}</span>
            ${f.email ? `<span>✉️ ${esc(f.email)}</span>` : ''}
            <span>🔧 ${esc(f.szolgaltatas)}</span>
            ${f.bike_tipus ? `<span>🚲 ${esc(f.bike_tipus)}</span>` : ''}
            ${f.megjegyzes ? `<span>💬 ${esc(f.megjegyzes)}</span>` : ''}
          </div>
        </div>
        <div class="list-item-actions">
          ${f.allapot === 'fuggeben' ? `
            <button class="btn btn-success btn-sm" onclick="jovahagyas('${f.id}')">✓ Jóváhagy</button>
            <button class="btn btn-danger btn-sm" onclick="elutasitas('${f.id}')">✗ Elutasít</button>
          ` : ''}
          ${f.allapot === 'jovahagyva' ? `
            <button class="btn btn-primary btn-sm" onclick="foglToMunkalap('${f.id}')">📋 Munkalap</button>
          ` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteFoglalas('${f.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  } catch(e) { el.innerHTML = `<div class="empty-state">Hiba: ${e.message}</div>`; }
}

async function jovahagyas(id) {
  if (!confirm('Jóváhagyod ezt a foglalást?')) return;
  try {
    await api('POST', `/api/foglalas/${id}/jovahagyas`);
    toast('Foglalás jóváhagyva! Email elküldve.', 'success');
    loadFoglalasok(); loadDashboard();
  } catch(e) { toast(e.message, 'error'); }
}

async function elutasitas(id) {
  const indok = prompt('Elutasítás oka (opcionális):') ?? '';
  try {
    await api('POST', `/api/foglalas/${id}/elutasitas`, { ok: indok });
    toast('Foglalás elutasítva.', 'warning');
    loadFoglalasok(); loadDashboard();
  } catch(e) { toast(e.message, 'error'); }
}

async function foglToMunkalap(id) {
  if (!confirm('Létrehozzunk munkalapot ebből a foglalásból?')) return;
  try {
    const d = await api('POST', `/api/foglalas/${id}/munkalap`);
    toast('Munkalap létrehozva!', 'success');
    loadFoglalasok();
    switchTab('munkalapok');
    setTimeout(() => openMunkalap(d.munkalap_id), 300);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteFoglalas(id) {
  if (!confirm('Törlöd ezt a foglalást?')) return;
  try {
    await api('DELETE', `/api/foglalas/${id}`);
    toast('Foglalás törölve.'); loadFoglalasok(); loadDashboard();
  } catch(e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════
//  MUNKALAPOK
// ══════════════════════════════════════════
async function loadMunkalapok(allapot = aktMunkAllapot) {
  aktMunkAllapot = allapot;
  const el = document.getElementById('munkalapok-list');
  el.innerHTML = '<div class="empty-state">Betöltés...</div>';
  try {
    const url = '/api/munkalap' + (allapot ? `?allapot=${allapot}` : '');
    const list = await api('GET', url);
    if (!list.length) { el.innerHTML = '<div class="empty-state">Nincs találat.</div>'; return; }
    el.innerHTML = list.map(m => `
      <div class="list-item" id="munk-${m.id}">
        <div class="list-item-info">
          <div class="list-item-title">${esc(m.ugyfel_nev)} &nbsp;${badgeHTML(m.allapot)}&nbsp;${badgeHTML(m.prioritas)}</div>
          <div class="list-item-meta">
            <span>📞 ${m.ugyfel_tel}</span>
            ${m.bike_marka ? `<span>🚲 ${esc(m.bike_marka)} ${esc(m.bike_tipus||'')}</span>` : ''}
            <span>🔧 ${esc(m.feladat).substring(0,50)}${m.feladat.length>50?'...':''}</span>
            ${m.vegso_ar ? `<span>💰 ${fmtFt(m.vegso_ar)}</span>` : ''}
            <span>📅 ${fmtDate(m.letrehozva)}</span>
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-ghost btn-sm" onclick="openMunkalap('${m.id}')">📂 Megnyit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMunkalap('${m.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  } catch(e) { el.innerHTML = `<div class="empty-state">Hiba: ${e.message}</div>`; }
}

async function openMunkalap(id) {
  document.getElementById('munkalapok-list').style.display  = 'none';
  document.getElementById('munkalap-detail').style.display  = 'block';
  document.getElementById('detail-content').innerHTML = '<div class="empty-state">Betöltés...</div>';

  try {
    const m = await api('GET', `/api/munkalap/${id}`);
    document.getElementById('detail-title').textContent = `#${m.id.substring(0,8)} – ${m.ugyfel_nev}`;

    // Állapot gombok
    document.getElementById('detail-actions').innerHTML = `
      ${m.allapot !== 'folyamatban' ? `<button class="btn btn-primary btn-sm" onclick="setAllapot('${id}','folyamatban')">▶ Folyamatban</button>` : ''}
      ${m.allapot !== 'kesz'        ? `<button class="btn btn-success btn-sm" onclick="setAllapot('${id}','kesz')">✓ Kész</button>` : ''}
      ${m.allapot !== 'archiv'      ? `<button class="btn btn-ghost btn-sm" onclick="setAllapot('${id}','archiv')">📦 Archív</button>` : ''}
    `;

    const tetelTotal = m.tetelek.reduce((s,t) => s + t.mennyiseg * t.egyseg_ar, 0);

    document.getElementById('detail-content').innerHTML = `
      <div class="detail-grid">
        <div>
          <div class="detail-card">
            <div class="detail-card-title">👤 Ügyfél</div>
            <div class="detail-row"><span class="detail-row-label">Név</span><span class="detail-row-val">${esc(m.ugyfel_nev)}</span></div>
            <div class="detail-row"><span class="detail-row-label">Telefon</span><span class="detail-row-val"><a href="tel:${m.ugyfel_tel}">${m.ugyfel_tel}</a></span></div>
            ${m.ugyfel_email ? `<div class="detail-row"><span class="detail-row-label">Email</span><span class="detail-row-val"><a href="mailto:${m.ugyfel_email}">${esc(m.ugyfel_email)}</a></span></div>` : ''}
          </div>
          <div class="detail-card" style="margin-top:1rem;">
            <div class="detail-card-title">🚲 Kerékpár</div>
            <div class="detail-row"><span class="detail-row-label">Márka</span><span class="detail-row-val">${esc(m.bike_marka||'–')}</span></div>
            <div class="detail-row"><span class="detail-row-label">Típus</span><span class="detail-row-val">${esc(m.bike_tipus||'–')}</span></div>
            <div class="detail-row"><span class="detail-row-label">Évjárat</span><span class="detail-row-val">${esc(m.bike_ev||'–')}</span></div>
          </div>
          <div class="detail-card" style="margin-top:1rem;">
            <div class="detail-card-title">🔧 Munka</div>
            <div class="detail-row"><span class="detail-row-label">Feladat</span><span class="detail-row-val" style="max-width:60%;text-align:right;">${esc(m.feladat)}</span></div>
            ${m.megjegyzes ? `<div class="detail-row"><span class="detail-row-label">Megjegyzés</span><span class="detail-row-val" style="max-width:60%;text-align:right;">${esc(m.megjegyzes)}</span></div>` : ''}
            <div class="detail-row"><span class="detail-row-label">Állapot</span><span class="detail-row-val">${badgeHTML(m.allapot)}</span></div>
            <div class="detail-row"><span class="detail-row-label">Prioritás</span><span class="detail-row-val">${badgeHTML(m.prioritas)}</span></div>
            <div class="detail-row"><span class="detail-row-label">Létrehozva</span><span class="detail-row-val">${fmtDT(m.letrehozva)}</span></div>
            ${m.lezarva ? `<div class="detail-row"><span class="detail-row-label">Lezárva</span><span class="detail-row-val">${fmtDT(m.lezarva)}</span></div>` : ''}
          </div>
        </div>
        <div>
          <div class="detail-card">
            <div class="detail-card-title">💰 Tételek & Ár</div>
            <div class="detail-row"><span class="detail-row-label">Becsült ár</span><span class="detail-row-val">${fmtFt(m.becsult_ar)}</span></div>
            <div class="detail-row"><span class="detail-row-label">Végső ár</span><span class="detail-row-val" style="color:var(--green);font-size:1.1rem;">${fmtFt(tetelTotal || m.vegso_ar)}</span></div>
            
            <div class="tetelek-wrap">
              ${m.tetelek.length ? m.tetelek.map(t => `
                <div class="tetel-item">
                  <div class="tetel-nev">${esc(t.megnevezes)} <span class="tetel-tipo">(${t.tipus})</span></div>
                  <div class="tetel-ar">${t.mennyiseg} × ${fmtFt(t.egyseg_ar)}</div>
                  <button class="tetel-del" onclick="deleteTetel(${t.id},'${id}')">✕</button>
                </div>
              `).join('') : '<div class="empty-state" style="padding:1rem 0;">Még nincs tétel</div>'}
              ${m.tetelek.length ? `<div class="tetel-total">Összesen: ${fmtFt(tetelTotal)}</div>` : ''}
            </div>

            <div class="add-tetel-form">
              <div class="detail-card-title" style="margin-bottom:.75rem;">+ Tétel hozzáadása</div>
              <div class="form-row" style="grid-template-columns:1fr;">
                <div class="form-group">
                  <label>Megnevezés *</label>
                  <input type="text" id="t-nev" placeholder="pl. Hidraulikus légtelenítés">
                </div>
              </div>
              <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;">
                <div class="form-group">
                  <label>Típus</label>
                  <select id="t-tipus">
                    <option value="munka">Munka</option>
                    <option value="alkatresz">Alkatrész</option>
                    <option value="egyeb">Egyéb</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Mennyiség</label>
                  <input type="number" id="t-menny" value="1" min="0.1" step="0.1">
                </div>
                <div class="form-group">
                  <label>Egységár (Ft)</label>
                  <input type="number" id="t-ar" placeholder="5000">
                </div>
              </div>
              <button class="btn btn-primary" style="width:100%;margin-top:.5rem;" onclick="addTetel('${id}')">+ Hozzáad</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch(e) { document.getElementById('detail-content').innerHTML = `<div class="empty-state">Hiba: ${e.message}</div>`; }
}

async function setAllapot(id, allapot) {
  try {
    await api('PUT', `/api/munkalap/${id}`, { allapot });
    toast(`Állapot frissítve: ${allapot}`, 'success');
    openMunkalap(id);
  } catch(e) { toast(e.message, 'error'); }
}

async function addTetel(munkalapId) {
  const megnevezes = document.getElementById('t-nev').value.trim();
  const tipus      = document.getElementById('t-tipus').value;
  const mennyiseg  = document.getElementById('t-menny').value;
  const egyseg_ar  = document.getElementById('t-ar').value;
  if (!megnevezes) { toast('Megnevezés kötelező!', 'error'); return; }
  try {
    await api('POST', `/api/munkalap/${munkalapId}/tetel`, { megnevezes, tipus, mennyiseg, egyseg_ar });
    toast('Tétel hozzáadva!', 'success');
    openMunkalap(munkalapId);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteTetel(tetelId, munkalapId) {
  try {
    await api('DELETE', `/api/munkalap/tetel/${tetelId}`);
    openMunkalap(munkalapId);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteMunkalap(id) {
  if (!confirm('Törlöd ezt a munkalapot?')) return;
  try {
    await api('DELETE', `/api/munkalap/${id}`);
    toast('Munkalap törölve.'); loadMunkalapok();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Új munkalap form ──
async function submitUjMunkalap(e) {
  e.preventDefault();
  const body = {
    ugyfel_nev:   document.getElementById('nm-nev').value.trim(),
    ugyfel_tel:   document.getElementById('nm-tel').value.trim(),
    ugyfel_email: document.getElementById('nm-email').value.trim(),
    bike_marka:   document.getElementById('nm-marka').value.trim(),
    bike_tipus:   document.getElementById('nm-tipus').value,
    bike_ev:      document.getElementById('nm-ev').value.trim(),
    feladat:      document.getElementById('nm-feladat').value.trim(),
    prioritas:    document.getElementById('nm-prioritas').value,
    becsult_ar:   document.getElementById('nm-ar').value,
    megjegyzes:   document.getElementById('nm-megj').value.trim(),
  };
  try {
    const d = await api('POST', '/api/munkalap', body);
    toast('Munkalap létrehozva!', 'success');
    e.target.reset();
    switchTab('munkalapok');
    setTimeout(() => openMunkalap(d.id), 300);
  } catch(err) { toast(err.message, 'error'); }
}

// ══════════════════════════════════════════
//  NAPTÁR
// ══════════════════════════════════════════
let naptarHet = 0;

async function loadNaptar() {
  const grid  = document.getElementById('naptar-grid');
  const title = document.getElementById('naptar-title');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Betöltés...</div>';

  const now  = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1 + naptarHet * 7); // Hétfő

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const fmt = d => d.toISOString().split('T')[0];
  title.textContent = `${fmt(days[0])} – ${fmt(days[6])}`;

  try {
    // Foglalások és munkalapok párhuzamosan
    const [foglalasok, munkalapok] = await Promise.all([
      api('GET', '/api/foglalas/admin'),
      api('GET', '/api/munkalap'),
    ]);

    const dayNames = ['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap'];
    const today = fmt(new Date());

    grid.innerHTML = days.map((d, i) => {
      const ds = fmt(d);
      const dayFogl = foglalasok.filter(f => f.datum === ds && ['fuggeben','jovahagyva'].includes(f.allapot));
      const dayMunk = munkalapok.filter(m => fmt(new Date(m.letrehozva)) === ds && ['nyitott','folyamatban'].includes(m.allapot));

      return `
        <div class="naptar-day ${ds === today ? 'today' : ''}">
          <div class="naptar-day-head">${dayNames[i]}</div>
          <div class="naptar-day-date">${d.getDate()}.</div>
          ${dayFogl.map(f => `
            <div class="naptar-event naptar-event-foglalas" title="${esc(f.nev)} – ${f.idopont}">
              📅 ${f.idopont} ${esc(f.nev)}
            </div>
          `).join('')}
          ${dayMunk.map(m => `
            <div class="naptar-event naptar-event-munkalap" title="${esc(m.ugyfel_nev)}" onclick="switchTab('munkalapok');setTimeout(()=>openMunkalap('${m.id}'),200)">
              🔧 ${esc(m.ugyfel_nev)}
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
  } catch(e) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--red);">Hiba: ${e.message}</div>`; }
}

// ── Segédek ──
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  checkToken();

  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Tab navigáció
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Foglalás szűrők
  document.querySelectorAll('#tab-foglalasok .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-foglalasok .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadFoglalasok(btn.dataset.allapot);
    });
  });

  // Munkalap szűrők
  document.querySelectorAll('#tab-munkalapok .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-munkalapok .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadMunkalapok(btn.dataset.allapot);
    });
  });

  // Vissza gomb (munkalap részletek)
  document.getElementById('back-to-list').addEventListener('click', () => {
    document.getElementById('munkalap-detail').style.display = 'none';
    document.getElementById('munkalapok-list').style.display = 'flex';
    loadMunkalapok();
  });

  // Új munkalap form
  document.getElementById('uj-munkalap-form').addEventListener('submit', submitUjMunkalap);

  // Naptár navigáció
  document.getElementById('prev-week').addEventListener('click', () => { naptarHet--; loadNaptar(); });
  document.getElementById('next-week').addEventListener('click', () => { naptarHet++; loadNaptar(); });

  // Hamburger mobilon
  document.getElementById('hamburger-admin').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });
});

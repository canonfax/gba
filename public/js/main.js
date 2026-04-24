// ═══════════════════════════════════════════
//  main.js – Közös logika
//  Nav, animációk, cookie sáv
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── Hamburger ──
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu?.classList.toggle('open');
    document.body.style.overflow = mobileMenu?.classList.contains('open') ? 'hidden' : '';
  });

  // ── Aktív nav link ──
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });

  // ── Scroll animáció ──
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));

  // ── Toast ──
  window.showToast = function(msg, type = 'info') {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
  };

  // ── Cookie sáv ──
  initCookieBanner();

});

// ══════════════════════════════════════════
//  COOKIE SÁV
// ══════════════════════════════════════════
function initCookieBanner() {
  const saved = localStorage.getItem('gb_cookie_consent');
  if (saved) return; // Már döntött

  // Sáv létrehozása
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML = `
    <div class="cookie-inner">
      <div class="cookie-text">
        <div class="cookie-title">🍪 Sütiket használunk</div>
        <div class="cookie-desc">
          Ez az oldal sütiket (cookie-kat) használ a működéshez és a felhasználói élmény javításához.
          Bővebb tájékoztatás: <a href="/pages/cookie.html">Cookie tájékoztató</a> |
          <a href="/pages/gdpr.html">Adatkezelési tájékoztató</a>
        </div>
        <div class="cookie-settings" id="cookie-settings-panel">
          <div class="cookie-setting-row">
            <div>
              <div class="cookie-setting-label">Szükséges sütik</div>
              <div class="cookie-setting-sub">A weboldal működéséhez elengedhetetlen</div>
            </div>
            <label class="toggle">
              <input type="checkbox" checked disabled>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="cookie-setting-row">
            <div>
              <div class="cookie-setting-label">Analitikai sütik</div>
              <div class="cookie-setting-sub">Látogatottsági statisztikák (jelenleg nem aktív)</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="cookie-analytics">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="cookie-setting-row">
            <div>
              <div class="cookie-setting-label">Marketing sütik</div>
              <div class="cookie-setting-sub">Hirdetések személyre szabása (jelenleg nem aktív)</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="cookie-marketing">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
      <div class="cookie-btns">
        <button class="cookie-btn cookie-btn-accept"    id="cookie-accept">Mindent elfogadok</button>
        <button class="cookie-btn cookie-btn-necessary" id="cookie-necessary">Csak szükséges</button>
        <button class="cookie-btn cookie-btn-settings"  id="cookie-settings-btn">⚙️ Beállítások</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  // Megjelenítés
  setTimeout(() => banner.classList.add('show'), 800);

  // Beállítások toggle
  document.getElementById('cookie-settings-btn').addEventListener('click', () => {
    const panel = document.getElementById('cookie-settings-panel');
    panel.classList.toggle('open');
    document.getElementById('cookie-settings-btn').textContent =
      panel.classList.contains('open') ? '⚙️ Bezárás' : '⚙️ Beállítások';
  });

  // Mindent elfogad
  document.getElementById('cookie-accept').addEventListener('click', () => {
    saveConsent({ necessary: true, analytics: true, marketing: true });
    hideBanner(banner);
  });

  // Csak szükséges
  document.getElementById('cookie-necessary').addEventListener('click', () => {
    saveConsent({ necessary: true, analytics: false, marketing: false });
    hideBanner(banner);
  });

  function saveConsent(prefs) {
    localStorage.setItem('gb_cookie_consent', JSON.stringify({
      ...prefs, timestamp: new Date().toISOString()
    }));
  }

  function hideBanner(el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }
}

// Cookie beállítások lekérdezése más JS fájlokból
window.getCookieConsent = function() {
  const saved = localStorage.getItem('gb_cookie_consent');
  return saved ? JSON.parse(saved) : null;
};

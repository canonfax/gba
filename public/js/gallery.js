// ═══════════════════════════════════════════
//  gallery.js – Galéria lightbox logika
// ═══════════════════════════════════════════

const galleryImgs = [
  { src: '/images/service_1.jpg', cap: 'Shimano Service Center műhely' },
  { src: '/images/shop.jpg',      cap: 'Shimano alkatrészfal' },
  { src: '/images/shimano_fal.jpg', cap: 'Shimano Service Center pult' },
  { src: '/images/mtb.jpg',       cap: 'Mountain bike' },
  { src: '/images/bicycle.jpg',   cap: 'Kerékpározás' },
  { src: '/images/trail.jpg',     cap: 'Trail riding' },
];
let galleryIndex = 0;

function openLightbox(i) {
  galleryIndex = i;
  document.getElementById('lightbox-img').src       = galleryImgs[i].src;
  document.getElementById('lightbox-img').alt       = galleryImgs[i].cap;
  document.getElementById('lightbox-caption').textContent = galleryImgs[i].cap;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function prevImg() {
  galleryIndex = (galleryIndex - 1 + galleryImgs.length) % galleryImgs.length;
  openLightbox(galleryIndex);
}

function nextImg() {
  galleryIndex = (galleryIndex + 1) % galleryImgs.length;
  openLightbox(galleryIndex);
}

document.addEventListener('DOMContentLoaded', () => {
  // Szűrő
  document.getElementById('gallery-filter')?.addEventListener('click', e => {
    if (!e.target.classList.contains('filter-btn')) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    const cat = e.target.dataset.cat;
    document.querySelectorAll('.gallery-item').forEach(item => {
      item.style.display = (cat === 'all' || item.dataset.cat === cat) ? '' : 'none';
    });
  });

  // Billentyűzet
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox')?.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  prevImg();
    if (e.key === 'ArrowRight') nextImg();
  });
});

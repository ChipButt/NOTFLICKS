const STORAGE = { films: 'notflicks.films.v1', settings: 'notflicks.settings.v1', selected: 'notflicks.selected.v1' };
const $ = (id) => document.getElementById(id);
const films = (() => { try { return JSON.parse(localStorage.getItem(STORAGE.films)) || []; } catch { return []; } })();
const settings = (() => { try { return { showControls:false, sound:true, avoidSame:true, ...(JSON.parse(localStorage.getItem(STORAGE.settings)) || {}) }; } catch { return { showControls:false, sound:true, avoidSame:true }; } })();
const forceControls = new URLSearchParams(location.search).get('controls') === '1';

let index = Math.max(0, Math.min(films.length - 1, Number(localStorage.getItem(STORAGE.selected)) || 0));
let locked = false;
let spinning = false;
let dragging = false;
let dragStartX = 0;
let dragStartTime = 0;
let wheelBurst = 0;
let wheelDirection = 1;
let wheelTimer = 0;
let audioCtx;
let renderToken = 0;

const track = $('track');
const carousel = $('carousel');
const controls = $('cameraControls');

if (!films.length) {
  $('screen').hidden = true;
  $('emptyState').hidden = false;
} else {
  controls.classList.toggle('visible', !!settings.showControls || forceControls);
  buildCarousel();
  select(index, false, false);
  preloadArtwork();
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[c]));
}
function buildCarousel() {
  track.innerHTML = films.map((film, i) => `
    <div class="poster-card" data-index="${i}" aria-label="${escapeHtml(film.title)}">
      ${film.poster ? `<img src="${escapeHtml(film.poster)}" draggable="false" alt="${escapeHtml(film.title)} poster" />` : `<div class="poster-placeholder">${escapeHtml(film.title)}</div>`}
    </div>`).join('');
  track.addEventListener('click', e => {
    const card = e.target.closest('.poster-card');
    if (card && !locked && !spinning) select(Number(card.dataset.index));
  });
}
function preloadArtwork() {
  films.forEach(f => [f.poster, f.backdrop].filter(Boolean).forEach(src => { const img = new Image(); img.src = src; }));
}
function cardMetrics() {
  const card = track.querySelector('.poster-card');
  if (!card) return { width: 170, gap: 18 };
  const style = getComputedStyle(track);
  return { width: card.getBoundingClientRect().width, gap: parseFloat(style.columnGap || style.gap) || 18 };
}
function updateTrack(animate = true) {
  const { width, gap } = cardMetrics();
  track.style.transition = animate ? 'transform 340ms cubic-bezier(.2,.8,.2,1)' : 'none';
  track.style.transform = `translate3d(${-(index * (width + gap) + width / 2)}px,-50%,0)`;
  track.querySelectorAll('.poster-card').forEach((el, i) => el.classList.toggle('is-selected', i === index));
}
function select(next, animate = true, withTick = true) {
  if (!films.length) return;
  const old = index;
  index = ((next % films.length) + films.length) % films.length;
  localStorage.setItem(STORAGE.selected, index);
  updateTrack(animate);
  updateFilmDetails();
  if (withTick && old !== index) tick();
}
function updateFilmDetails() {
  const film = films[index];
  $('heroTitle').textContent = film.title || 'Untitled';
  $('heroYear').textContent = film.year || '';
  $('heroRating').textContent = film.rating ? `★ ${film.rating}` : '';
  $('heroOverview').textContent = film.overview || '';
  $('selectedTitle').textContent = film.title || 'Untitled';
  $('selectedYear').textContent = film.year || '';
  const bg = film.backdrop || film.poster || '';
  $('heroBackdrop').style.backgroundImage = bg
    ? `url("${String(bg).replace(/"/g, '%22')}")`
    : 'radial-gradient(circle at 65% 30%, rgba(47,156,255,.22), transparent 33%), linear-gradient(135deg,#071522,#02050a)';
}
function tick() {
  if (!settings.sound) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 900 + Math.random() * 90;
    gain.gain.setValueAtTime(.055, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .026);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + .03);
  } catch {}
}
function move(delta) {
  if (!locked && !spinning && films.length) select(index + delta);
}
function toggleLock() {
  locked = !locked;
  $('lockBadge').hidden = !locked;
  $('lockButton').textContent = locked ? 'UNLOCK' : 'LOCK';
}
function randomTarget() {
  if (films.length < 2) return index;
  let target = Math.floor(Math.random() * films.length);
  if (settings.avoidSame !== false) while (target === index) target = Math.floor(Math.random() * films.length);
  return target;
}
async function spin() {
  if (locked || spinning || films.length < 2) return;
  spinning = true;
  $('spinBanner').hidden = false;
  const token = ++renderToken;
  const target = randomTarget();
  const cycles = 2 + Math.floor(Math.random() * 3);
  const forwardSteps = cycles * films.length + ((target - index + films.length) % films.length || films.length);
  for (let step = 0; step < forwardSteps && token === renderToken; step++) {
    select(index + 1, false, true);
    const t = step / Math.max(1, forwardSteps - 1);
    const delay = 34 + Math.pow(t, 3.2) * 265;
    await sleep(delay);
  }
  if (token === renderToken) {
    select(target, true, false);
    await sleep(330);
    tick();
  }
  $('spinBanner').hidden = true;
  spinning = false;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

carousel?.addEventListener('wheel', (event) => {
  if (locked || spinning) return;
  event.preventDefault();
  const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  wheelDirection = amount >= 0 ? 1 : -1;
  wheelBurst += Math.abs(amount);
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    if (wheelBurst > 360) spin();
    else if (wheelBurst > 18) move(wheelDirection);
    wheelBurst = 0;
  }, 95);
}, { passive: false });

carousel?.addEventListener('pointerdown', e => {
  if (locked || spinning) return;
  dragging = true;
  dragStartX = e.clientX;
  dragStartTime = performance.now();
  carousel.setPointerCapture?.(e.pointerId);
});
carousel?.addEventListener('pointerup', e => {
  if (!dragging || locked || spinning) return;
  dragging = false;
  const dx = e.clientX - dragStartX;
  const dt = Math.max(1, performance.now() - dragStartTime);
  const velocity = Math.abs(dx / dt);
  if (velocity > 1.25 || Math.abs(dx) > 260) spin();
  else if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
});
carousel?.addEventListener('pointercancel', () => dragging = false);

window.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  if (event.code === 'Space') { event.preventDefault(); spin(); }
  if (event.key.toLowerCase() === 'l') toggleLock();
  if (event.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  if (event.shiftKey && event.key.toLowerCase() === 'a') location.href = 'setup.html';
});
$('prevButton')?.addEventListener('click', () => move(-1));
$('nextButton')?.addEventListener('click', () => move(1));
$('spinButton')?.addEventListener('click', spin);
$('lockButton')?.addEventListener('click', toggleLock);
$('fullscreenButton')?.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
window.addEventListener('resize', () => films.length && updateTrack(false));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

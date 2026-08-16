const STORAGE = { films: 'notflicks.films.v1', settings: 'notflicks.settings.v1', selected: 'notflicks.selected.v1' };
const $ = (id) => document.getElementById(id);
const films = (() => { try { return JSON.parse(localStorage.getItem(STORAGE.films)) || []; } catch { return []; } })();
const settings = (() => { try { return { showControls:false, sound:true, avoidSame:true, ...(JSON.parse(localStorage.getItem(STORAGE.settings)) || {}) }; } catch { return { showControls:false, sound:true, avoidSame:true }; } })();
const forceControls = new URLSearchParams(location.search).get('controls') === '1';
const REPEATS = 11;
const MIDDLE_REPEAT = Math.floor(REPEATS / 2);

let filmIndex = Math.max(0, Math.min(films.length - 1, Number(localStorage.getItem(STORAGE.selected)) || 0));
let virtualIndex = films.length ? MIDDLE_REPEAT * films.length + filmIndex : 0;
let locked = false;
let spinning = false;
let dragging = false;
let dragStartX = 0;
let dragStartTime = 0;
let wheelBurst = 0;
let wheelDirection = 1;
let wheelTimer = 0;
let audioCtx;

const track = $('track');
const carousel = $('carousel');
const controls = $('cameraControls');

if (!films.length) {
  $('screen').hidden = true;
  $('emptyState').hidden = false;
} else {
  controls.classList.toggle('visible', !!settings.showControls || forceControls);
  buildCarousel();
  updateTrack(0);
  updateFilmDetails();
  preloadArtwork();
}

function escapeHtml(value='') {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}
function mod(value, length) { return ((value % length) + length) % length; }
function buildCarousel() {
  const cards = [];
  for (let repeat = 0; repeat < REPEATS; repeat++) {
    films.forEach((film, i) => {
      const vIndex = repeat * films.length + i;
      cards.push(`<div class="poster-card" data-film-index="${i}" data-virtual-index="${vIndex}" aria-label="${escapeHtml(film.title)}">
        ${film.poster ? `<img src="${escapeHtml(film.poster)}" draggable="false" alt="${escapeHtml(film.title)} poster" />` : `<div class="poster-placeholder">${escapeHtml(film.title)}</div>`}
      </div>`);
    });
  }
  track.innerHTML = cards.join('');
  track.addEventListener('click', e => {
    const card = e.target.closest('.poster-card');
    if (!card || locked || spinning) return;
    virtualIndex = Number(card.dataset.virtualIndex);
    filmIndex = Number(card.dataset.filmIndex);
    commitSelection(280, true);
    setTimeout(recenter, 300);
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
function updateTrack(duration = 0) {
  const { width, gap } = cardMetrics();
  track.style.transition = duration > 0 ? `transform ${duration}ms cubic-bezier(.2,.8,.2,1)` : 'none';
  track.style.transform = `translate3d(${-(virtualIndex * (width + gap) + width / 2)}px,-50%,0)`;
  track.querySelectorAll('.poster-card.is-selected').forEach(el => el.classList.remove('is-selected'));
  track.querySelector(`.poster-card[data-virtual-index="${virtualIndex}"]`)?.classList.add('is-selected');
}
function commitSelection(duration = 260, withTick = true) {
  filmIndex = mod(virtualIndex, films.length);
  localStorage.setItem(STORAGE.selected, filmIndex);
  updateTrack(duration);
  updateFilmDetails();
  if (withTick) tick();
}
function recenter() {
  if (!films.length || spinning) return;
  virtualIndex = MIDDLE_REPEAT * films.length + filmIndex;
  updateTrack(0);
}
function updateFilmDetails() {
  const film = films[filmIndex];
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
    osc.frequency.value = 860 + Math.random() * 120;
    gain.gain.setValueAtTime(.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .028);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + .032);
  } catch {}
}
function move(delta) {
  if (locked || spinning || !films.length) return;
  virtualIndex += delta;
  commitSelection(230, true);
  setTimeout(recenter, 250);
}
function toggleLock() {
  locked = !locked;
  $('lockBadge').hidden = !locked;
  $('lockButton').textContent = locked ? 'UNLOCK' : 'LOCK';
}
function randomTarget() {
  if (films.length < 2) return filmIndex;
  let target = Math.floor(Math.random() * films.length);
  if (settings.avoidSame !== false) while (target === filmIndex) target = Math.floor(Math.random() * films.length);
  return target;
}
async function spin() {
  if (locked || spinning || films.length < 2) return;
  spinning = true;
  $('spinBanner').hidden = false;
  virtualIndex = MIDDLE_REPEAT * films.length + filmIndex;
  updateTrack(0);

  const target = randomTarget();
  const cycles = 2 + Math.floor(Math.random() * 3);
  const deltaToTarget = mod(target - filmIndex, films.length) || films.length;
  const totalSteps = cycles * films.length + deltaToTarget;

  for (let step = 0; step < totalSteps; step++) {
    const progress = step / Math.max(1, totalSteps - 1);
    const delay = 34 + Math.pow(progress, 3.15) * 280;
    const transition = Math.max(24, Math.min(125, delay * .72));
    virtualIndex += 1;
    filmIndex = mod(virtualIndex, films.length);
    localStorage.setItem(STORAGE.selected, filmIndex);
    updateTrack(transition);
    updateFilmDetails();
    tick();
    await sleep(delay);
  }

  filmIndex = target;
  localStorage.setItem(STORAGE.selected, filmIndex);
  await sleep(90);
  tick();
  spinning = false;
  $('spinBanner').hidden = true;
  recenter();
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
window.addEventListener('resize', () => films.length && updateTrack(0));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

const STORAGE = {
  films: 'notflicks.films.v1',
  settings: 'notflicks.settings.v1',
  token: 'notflicks.tmdbToken.v1'
};

const $ = (id) => document.getElementById(id);
const titleInput = $('titleInput');
const tokenInput = $('tokenInput');
const library = $('library');
const libraryEmpty = $('libraryEmpty');
const filmCountPill = $('filmCountPill');
const resolveStatus = $('resolveStatus');
const showControlsToggle = $('showControlsToggle');
const soundToggle = $('soundToggle');
const avoidSameToggle = $('avoidSameToggle');
const manualDialog = $('manualDialog');

let films = loadJSON(STORAGE.films, []);
let settings = { showControls: false, sound: true, avoidSame: true, ...loadJSON(STORAGE.settings, {}) };

tokenInput.value = localStorage.getItem(STORAGE.token) || '';
showControlsToggle.checked = !!settings.showControls;
soundToggle.checked = settings.sound !== false;
avoidSameToggle.checked = settings.avoidSame !== false;

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save() {
  localStorage.setItem(STORAGE.films, JSON.stringify(films));
  settings.showControls = showControlsToggle.checked;
  settings.sound = soundToggle.checked;
  settings.avoidSame = avoidSameToggle.checked;
  localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  localStorage.setItem(STORAGE.token, tokenInput.value.trim());
  render();
}
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function escapeHtml(value='') {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}
function posterUrl(path) { return path ? `https://image.tmdb.org/t/p/w500${path}` : ''; }
function backdropUrl(path) { return path ? `https://image.tmdb.org/t/p/w1280${path}` : ''; }
function parseLine(raw) {
  const text = raw.trim();
  const m = text.match(/^(.*?)(?:\s*\((\d{4})\)|\s+(\d{4}))?$/);
  return { title: (m?.[1] || text).trim(), year: m?.[2] || m?.[3] || '' };
}

async function resolveFilms() {
  const token = tokenInput.value.trim();
  const lines = titleInput.value.split(/\r?\n/).map(parseLine).filter(x => x.title);
  if (!lines.length) { resolveStatus.textContent = 'Enter at least one film title.'; return; }
  if (!token) { resolveStatus.textContent = 'Add a TMDB Read Access Token, or use Add manually.'; return; }
  localStorage.setItem(STORAGE.token, token);
  $('resolveButton').disabled = true;
  let added = 0;
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    resolveStatus.textContent = `Finding ${i + 1} of ${lines.length}: ${item.title}`;
    try {
      const url = new URL('https://api.themoviedb.org/3/search/movie');
      url.searchParams.set('query', item.title);
      url.searchParams.set('include_adult', 'false');
      url.searchParams.set('language', 'en-GB');
      if (item.year) url.searchParams.set('year', item.year);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      const data = await res.json();
      const result = data.results?.[0];
      if (!result) {
        films.push({ id: uid(), title: item.title, year: item.year, poster: '', backdrop: '', overview: '', rating: '' });
      } else {
        films.push({
          id: uid(), tmdbId: result.id, title: result.title || item.title,
          year: (result.release_date || '').slice(0,4), poster: posterUrl(result.poster_path),
          backdrop: backdropUrl(result.backdrop_path), overview: result.overview || '',
          rating: result.vote_average ? Number(result.vote_average).toFixed(1) : ''
        });
      }
      added++;
    } catch (err) {
      films.push({ id: uid(), title: item.title, year: item.year, poster: '', backdrop: '', overview: '', rating: '' });
      added++;
    }
  }
  titleInput.value = '';
  save();
  resolveStatus.textContent = `Added ${added} film${added === 1 ? '' : 's'}. Check the library below.`;
  $('resolveButton').disabled = false;
}

function render() {
  filmCountPill.textContent = `${films.length} FILM${films.length === 1 ? '' : 'S'}`;
  libraryEmpty.hidden = films.length > 0;
  library.innerHTML = films.map((film, index) => `
    <article class="film-row" data-id="${film.id}">
      ${film.poster ? `<img src="${escapeHtml(film.poster)}" alt="" />` : `<div class="poster-placeholder">NO ART</div>`}
      <div><h3>${escapeHtml(film.title || 'Untitled')}</h3><div class="row-meta">${escapeHtml(film.year || 'Year unknown')}${film.tmdbId ? ' · TMDB MATCH' : ' · MANUAL'}</div></div>
      <div class="row-actions">
        <button data-action="up" title="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button data-action="down" title="Move down" ${index === films.length - 1 ? 'disabled' : ''}>↓</button>
        <button data-action="remove" title="Remove">×</button>
      </div>
    </article>`).join('');
}

library.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('.film-row');
  if (!button || !row) return;
  const index = films.findIndex(f => f.id === row.dataset.id);
  if (index < 0) return;
  const action = button.dataset.action;
  if (action === 'remove') films.splice(index, 1);
  if (action === 'up' && index > 0) [films[index - 1], films[index]] = [films[index], films[index - 1]];
  if (action === 'down' && index < films.length - 1) [films[index + 1], films[index]] = [films[index], films[index + 1]];
  save();
});

$('resolveButton').addEventListener('click', resolveFilms);
$('showTokenButton').addEventListener('click', () => {
  const showing = tokenInput.type === 'text';
  tokenInput.type = showing ? 'password' : 'text';
  $('showTokenButton').textContent = showing ? 'SHOW' : 'HIDE';
});
[tokenInput, showControlsToggle, soundToggle, avoidSameToggle].forEach(el => el.addEventListener('change', save));
$('shuffleButton').addEventListener('click', () => {
  for (let i = films.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [films[i], films[j]] = [films[j], films[i]];
  }
  save();
});
$('clearButton').addEventListener('click', () => {
  if (!films.length || confirm('Remove every film from NOTFLICKS?')) { films = []; save(); }
});
$('addManualButton').addEventListener('click', () => manualDialog.showModal());
$('manualForm').addEventListener('submit', (event) => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const title = $('manualTitle').value.trim();
  if (!title) return;
  films.push({
    id: uid(), title,
    year: $('manualYear').value.trim(),
    poster: $('manualPoster').value.trim(),
    backdrop: $('manualBackdrop').value.trim(),
    overview: $('manualOverview').value.trim(), rating: ''
  });
  $('manualForm').reset();
  manualDialog.close();
  save();
});
render();

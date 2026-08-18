const STORAGE = {
  films: 'notflicks.films.v1',
  settings: 'notflicks.settings.v1'
};

const $ = (id) => document.getElementById(id);
const titleInput = $('titleInput');
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
let editingId = null;

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
  render();
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function escapeHtml(value = '') {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}

function parseLine(raw) {
  const text = raw.trim();
  const m = text.match(/^(.*?)(?:\s*\((\d{4})\)|\s+(\d{4}))?$/);
  return { title: (m?.[1] || text).trim(), year: m?.[2] || m?.[3] || '' };
}

function cleanTitle(value = '') {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function inferredYear(text = '') {
  const match = String(text).match(/\b(?:18|19|20)\d{2}\b/);
  return match ? match[0] : '';
}

function scoreWikiPage(page, item) {
  const title = cleanTitle(page.title || '');
  const wanted = cleanTitle(item.title);
  const extract = cleanTitle(page.extract || '');
  let score = 0;

  if (title === wanted) score += 24;
  if (title.startsWith(wanted)) score += 16;
  if (title.includes(wanted)) score += 8;
  if (title.includes('(film') || title.includes('(movie')) score += 12;
  if (extract.includes(' film') || extract.includes(' movie')) score += 8;
  if (page.original?.source || page.thumbnail?.source) score += 10;
  if (item.year && (title.includes(item.year) || extract.includes(item.year))) score += 18;
  if (title.includes('disambiguation')) score -= 30;

  return score;
}

async function findWikipediaFilm(item) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${item.title}${item.year ? ` ${item.year}` : ''} film`);
  url.searchParams.set('gsrnamespace', '0');
  url.searchParams.set('gsrlimit', '6');
  url.searchParams.set('prop', 'pageimages|extracts');
  url.searchParams.set('piprop', 'thumbnail|original');
  url.searchParams.set('pithumbsize', '1000');
  url.searchParams.set('pilicense', 'any');
  url.searchParams.set('exintro', '1');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('exsentences', '4');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);

  const data = await response.json();
  const pages = data.query?.pages || [];
  if (!pages.length) return null;

  const ranked = pages
    .map(page => ({ page, score: scoreWikiPage(page, item) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.page;
  if (!best) return null;

  const poster = best.original?.source || best.thumbnail?.source || '';
  const overview = best.extract || '';

  return {
    id: uid(),
    source: 'wikipedia',
    wikipediaTitle: best.title || '',
    title: item.title,
    year: item.year || inferredYear(overview),
    poster,
    backdrop: poster,
    overview,
    rating: ''
  };
}

async function resolveFilms() {
  const lines = titleInput.value.split(/\r?\n/).map(parseLine).filter(item => item.title);
  if (!lines.length) {
    resolveStatus.textContent = 'Enter at least one film title.';
    return;
  }

  $('resolveButton').disabled = true;
  let added = 0;
  let artworkFound = 0;

  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    resolveStatus.textContent = `Finding ${i + 1} of ${lines.length}: ${item.title}`;

    try {
      const match = await findWikipediaFilm(item);
      if (match) {
        films.push(match);
        if (match.poster) artworkFound++;
      } else {
        films.push({
          id: uid(), source: 'manual', title: item.title, year: item.year,
          poster: '', backdrop: '', overview: '', rating: ''
        });
      }
    } catch (error) {
      console.warn('Artwork lookup failed:', item.title, error);
      films.push({
        id: uid(), source: 'manual', title: item.title, year: item.year,
        poster: '', backdrop: '', overview: '', rating: ''
      });
    }

    added++;
  }

  titleInput.value = '';
  save();
  resolveStatus.textContent = `Added ${added} film${added === 1 ? '' : 's'} · artwork found for ${artworkFound}.`;
  $('resolveButton').disabled = false;
}

function googleImagesUrl(film) {
  const query = `${film.title}${film.year ? ` ${film.year}` : ''} movie poster`;
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

function sourceLabel(film) {
  if (film.source === 'wikipedia') return film.poster ? 'WIKIPEDIA ART' : 'WIKIPEDIA MATCH · NO ART';
  if (film.tmdbId) return 'TMDB MATCH';
  return film.poster ? 'CUSTOM ART' : 'NO ARTWORK';
}

function render() {
  filmCountPill.textContent = `${films.length} FILM${films.length === 1 ? '' : 'S'}`;
  libraryEmpty.hidden = films.length > 0;

  library.innerHTML = films.map((film, index) => `
    <article class="film-row" data-id="${film.id}">
      ${film.poster
        ? `<img src="${escapeHtml(film.poster)}" alt="" />`
        : `<div class="poster-placeholder">NO ART</div>`}
      <div>
        <h3>${escapeHtml(film.title || 'Untitled')}</h3>
        <div class="row-meta">${escapeHtml(film.year || 'Year unknown')} · ${sourceLabel(film)}</div>
      </div>
      <div class="row-actions">
        <button data-action="google" title="Search Google Images">GOOGLE</button>
        <button data-action="edit" title="Edit film and artwork">EDIT</button>
        <button data-action="up" title="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button data-action="down" title="Move down" ${index === films.length - 1 ? 'disabled' : ''}>↓</button>
        <button data-action="remove" title="Remove">×</button>
      </div>
    </article>`).join('');
}

function openManualDialog(film = null) {
  editingId = film?.id || null;
  $('manualDialogTitle').textContent = film ? 'Edit film' : 'Add film manually';
  $('manualSave').textContent = film ? 'Save changes' : 'Add film';
  $('manualTitle').value = film?.title || '';
  $('manualYear').value = film?.year || '';
  $('manualPoster').value = film?.poster || '';
  $('manualBackdrop').value = film?.backdrop || '';
  $('manualOverview').value = film?.overview || '';
  manualDialog.showModal();
}

library.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('.film-row');
  if (!button || !row) return;

  const index = films.findIndex(film => film.id === row.dataset.id);
  if (index < 0) return;

  const action = button.dataset.action;
  const film = films[index];

  if (action === 'google') {
    window.open(googleImagesUrl(film), '_blank', 'noopener,noreferrer');
    return;
  }

  if (action === 'edit') {
    openManualDialog(film);
    return;
  }

  if (action === 'remove') films.splice(index, 1);
  if (action === 'up' && index > 0) [films[index - 1], films[index]] = [films[index], films[index - 1]];
  if (action === 'down' && index < films.length - 1) [films[index + 1], films[index]] = [films[index], films[index + 1]];
  save();
});

$('resolveButton').addEventListener('click', resolveFilms);
[showControlsToggle, soundToggle, avoidSameToggle].forEach(element => element.addEventListener('change', save));

$('shuffleButton').addEventListener('click', () => {
  for (let i = films.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [films[i], films[j]] = [films[j], films[i]];
  }
  save();
});

$('clearButton').addEventListener('click', () => {
  if (!films.length || confirm('Remove every film from NOTFLICKS?')) {
    films = [];
    save();
  }
});

$('addManualButton').addEventListener('click', () => openManualDialog());

$('manualForm').addEventListener('submit', (event) => {
  if (event.submitter?.value === 'cancel') {
    editingId = null;
    return;
  }

  event.preventDefault();
  const title = $('manualTitle').value.trim();
  if (!title) return;

  const values = {
    title,
    year: $('manualYear').value.trim(),
    poster: $('manualPoster').value.trim(),
    backdrop: $('manualBackdrop').value.trim(),
    overview: $('manualOverview').value.trim(),
    rating: ''
  };

  if (editingId) {
    const index = films.findIndex(film => film.id === editingId);
    if (index >= 0) films[index] = { ...films[index], ...values, source: values.poster ? 'custom' : films[index].source };
  } else {
    films.push({ id: uid(), source: values.poster ? 'custom' : 'manual', ...values });
  }

  editingId = null;
  $('manualForm').reset();
  manualDialog.close();
  save();
});

render();

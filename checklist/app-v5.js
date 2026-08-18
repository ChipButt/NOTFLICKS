(() => {
  'use strict';

  const API = String(window.SHOW_CHECKLIST_API_URL || '').replace(/\/$/, '');
  const CACHE_KEY = 'planuf-checklist-cache-v5';
  const LEGACY_KEYS = ['planuf-checklist-cache-v4', 'planuf-checklist-cache-v3'];
  const PIN_KEY = 'planuf-checklist-pin-v2';
  const MAX_UPLOAD = 20 * 1024 * 1024;
  const MIN_COLOURS = 1;
  const MAX_COLOURS = 10;

  const STANDARD_ITEMS = [
    ['Show Logo', 'document'],
    ['Vertical Thumbnail — 4000 × 6000', 'image'],
    ['Square Thumbnail — 6000 × 6000', 'image'],
    ['Featured Carousel Wide — 3840 × 1440', 'image'],
    ['Featured Carousel Mobile — 3000 × 2625', 'image'],
    ['Show Font', 'font'],
    ['Colour Scheme', 'palette'],
    ['Intro Music', 'audio'],
    ['Outro Music', 'audio'],
    ['Intro Video', 'video'],
    ['Transitional Slide(s)', 'document']
  ];

  const TYPE_LABELS = {
    document: 'Document / artwork', image: 'Image', font: 'Font', palette: 'Colour palette',
    audio: 'Audio', video: 'Video', file: 'File'
  };
  const ACCEPT = {
    document: '.pdf,image/*,.svg', image: 'image/*,.svg', font: '.ttf,.otf,.woff,.woff2',
    audio: 'audio/*', video: 'video/*', file: '*/*'
  };
  const DEFAULT_PALETTE = [
    '#8C7CF3', '#A395FF', '#F4F1FF', '#241C43', '#120F24',
    '#6F5FD4', '#C8C0FF', '#322858', '#E5E0FF', '#0A0814'
  ];

  const $ = id => document.getElementById(id);
  let state = loadLocal();
  let stateSha = '';
  let dirty = false;
  let busy = false;
  const loadedFonts = [];

  init();

  function uid(prefix) {
    return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }
  function clampColourCount(value) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.min(MAX_COLOURS, Math.max(MIN_COLOURS, n)) : 5;
  }
  function makeItem(title, type) {
    return {
      id: uid('item'), title, type, done: false, notes: '', file: null,
      ...(type === 'palette' ? { colourCount: 5, colours: [...DEFAULT_PALETTE] } : {})
    };
  }
  function standardItems() { return STANDARD_ITEMS.map(([title, type]) => makeItem(title, type)); }
  function freshState() {
    const show = { id: uid('show'), name: 'My Show', items: standardItems() };
    return { version: 5, updatedAt: null, activeShowId: show.id, shows: [show] };
  }
  function loadLocal() {
    for (const key of [CACHE_KEY, ...LEGACY_KEYS]) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (value?.shows?.length) return value;
      } catch {}
    }
    return freshState();
  }
  function saveLocal() { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); }
  function configured() { return API.startsWith('https://') && !API.includes('PASTE_YOUR_'); }
  function currentShow() { return state.shows.find(s => s.id === state.activeShowId) || state.shows[0]; }

  function normaliseState(addPalette = true) {
    let changed = false;
    if (!state?.shows?.length) { state = freshState(); changed = true; }
    if (state.version !== 5) { state.version = 5; changed = true; }
    for (const show of state.shows) {
      if (!show.id) { show.id = uid('show'); changed = true; }
      if (!show.name) { show.name = 'Untitled Show'; changed = true; }
      if (!Array.isArray(show.items)) { show.items = []; changed = true; }
      for (const item of show.items) {
        if (!item.id) { item.id = uid('item'); changed = true; }
        if (!item.title) { item.title = 'Checklist Item'; changed = true; }
        if (!TYPE_LABELS[item.type]) { item.type = 'file'; changed = true; }
        if (typeof item.notes !== 'string') { item.notes = ''; changed = true; }
        item.done = !!item.done;
        if (item.type === 'palette') {
          const incoming = Array.isArray(item.colours) ? item.colours : [];
          const count = clampColourCount(item.colourCount ?? Math.min(incoming.length || 5, MAX_COLOURS));
          const colours = Array.from({ length: MAX_COLOURS }, (_, i) => normaliseHex(incoming[i]) || DEFAULT_PALETTE[i]);
          if (item.colourCount !== count || JSON.stringify(colours) !== JSON.stringify(item.colours)) changed = true;
          item.colourCount = count;
          item.colours = colours;
        }
      }
      if (addPalette && !show.items.some(i => i.type === 'palette')) {
        const fontIndex = show.items.findIndex(i => i.type === 'font' || /font/i.test(i.title));
        show.items.splice(fontIndex >= 0 ? fontIndex + 1 : show.items.length, 0, makeItem('Colour Scheme', 'palette'));
        changed = true;
      }
    }
    if (!state.shows.some(s => s.id === state.activeShowId)) {
      state.activeShowId = state.shows[0].id;
      changed = true;
    }
    saveLocal();
    return changed;
  }

  async function init() {
    bindGlobal();
    normaliseState(true);
    render();
    await loadShared(false);
  }

  function bindGlobal() {
    $('reload').addEventListener('click', () => loadShared(true));
    $('save').addEventListener('click', saveShared);
    $('pinBtn').addEventListener('click', openPinDialog);
    $('pinForm').addEventListener('submit', event => {
      event.preventDefault();
      const pin = $('pin').value.trim();
      if (!pin) return;
      sessionStorage.setItem(PIN_KEY, pin);
      $('pinDialog').close();
      toast('Edit PIN saved for this tab.');
    });
    $('forgetPin').addEventListener('click', () => {
      sessionStorage.removeItem(PIN_KEY);
      $('pin').value = '';
      toast('Edit PIN forgotten.');
    });
    document.querySelectorAll('[data-close]').forEach(button => {
      button.addEventListener('click', () => $(button.dataset.close).close());
    });
    $('shows').addEventListener('change', event => {
      state.activeShowId = event.target.value;
      saveLocal();
      render();
    });
    $('addShow').addEventListener('click', () => {
      const name = prompt('Show name');
      if (!name?.trim()) return;
      const show = { id: uid('show'), name: name.trim(), items: standardItems() };
      state.shows.push(show);
      state.activeShowId = show.id;
      markDirty();
      render();
    });
    $('renameShow').addEventListener('click', () => {
      const show = currentShow();
      const name = prompt('Show name', show.name);
      if (!name?.trim()) return;
      show.name = name.trim();
      markDirty();
      render();
    });
    $('deleteShow').addEventListener('click', () => {
      if (state.shows.length < 2) return toast('At least one show must remain.', 'err');
      const show = currentShow();
      if (!confirm(`Delete ${show.name}?`)) return;
      state.shows = state.shows.filter(s => s.id !== show.id);
      state.activeShowId = state.shows[0].id;
      markDirty();
      render();
    });
    $('addItem').addEventListener('click', () => {
      const name = prompt('Checklist item name');
      if (!name?.trim()) return;
      const typeRaw = prompt('Type: document, image, font, palette, audio, video or file', 'document') || 'document';
      const type = TYPE_LABELS[typeRaw.toLowerCase()] ? typeRaw.toLowerCase() : 'file';
      currentShow().items.push(makeItem(name.trim(), type));
      markDirty();
      render();
    });
  }

  function openPinDialog() {
    $('pin').value = sessionStorage.getItem(PIN_KEY) || '';
    $('pinDialog').showModal();
    setTimeout(() => $('pin').focus(), 30);
  }
  async function requirePin() {
    const existing = sessionStorage.getItem(PIN_KEY);
    if (existing) return existing;
    openPinDialog();
    return new Promise(resolve => {
      $('pinDialog').addEventListener('close', () => resolve(sessionStorage.getItem(PIN_KEY) || ''), { once: true });
    });
  }

  function markDirty() {
    dirty = true;
    saveLocal();
    updateStatus();
  }
  function updateStatus(message = '', kind = '') {
    const el = $('status');
    el.className = `status${kind ? ` ${kind}` : ''}`;
    if (message) { el.textContent = message; return; }
    if (!configured()) { el.textContent = 'Shared API not configured'; el.classList.add('bad'); }
    else if (busy) el.textContent = 'Working…';
    else if (dirty) { el.textContent = 'Unsaved shared changes'; el.classList.add('dirty'); }
    else if (state.updatedAt) { el.textContent = `Shared · ${new Date(state.updatedAt).toLocaleString()}`; el.classList.add('ok'); }
    else el.textContent = 'Ready to save shared';
  }

  function render() {
    clearFonts();
    const show = currentShow();
    $('showTitle').textContent = show.name;
    document.title = `${show.name} — Show Production Checklist`;
    $('shows').replaceChildren(...state.shows.map(s => {
      const option = document.createElement('option');
      option.value = s.id; option.textContent = s.name; option.selected = s.id === show.id; return option;
    }));
    $('deleteShow').disabled = state.shows.length < 2;
    renderProgress();
    const grid = $('grid');
    grid.replaceChildren();
    if (!show.items.length) grid.innerHTML = '<div class="empty">No checklist items yet.</div>';
    else show.items.forEach(item => grid.appendChild(buildCard(show, item)));
    updateStatus();
  }

  function renderProgress() {
    const show = currentShow();
    const complete = show.items.filter(i => i.done).length;
    const percent = show.items.length ? Math.round((complete / show.items.length) * 100) : 0;
    $('progressText').textContent = `${complete} of ${show.items.length} complete`;
    $('progressPct').textContent = `${percent}%`;
    $('progressBar').style.width = `${percent}%`;
  }

  function buildCard(show, item) {
    const card = document.createElement('article');
    card.className = `card card-${item.type}`;
    card.innerHTML = `<div class="cardhead"><input class="check" type="checkbox" aria-label="Mark complete"><div><h3></h3><div class="kind"></div></div><button class="x" type="button" title="Delete item">×</button></div><div class="content-slot"></div><label class="notes"><span>Notes</span><textarea rows="3" placeholder="Add notes…"></textarea></label>`;
    card.querySelector('h3').textContent = item.title;
    card.querySelector('.kind').textContent = item.type === 'palette' ? `${item.colourCount}-colour palette` : TYPE_LABELS[item.type];
    const check = card.querySelector('.check');
    check.checked = item.done;
    check.addEventListener('change', () => { item.done = check.checked; markDirty(); renderProgress(); });
    card.querySelector('.x').addEventListener('click', () => {
      if (!confirm(`Delete ${item.title}?`)) return;
      show.items = show.items.filter(i => i.id !== item.id); markDirty(); render();
    });
    const notes = card.querySelector('textarea');
    notes.value = item.notes;
    notes.addEventListener('input', () => { item.notes = notes.value; markDirty(); });
    const slot = card.querySelector('.content-slot');
    if (item.type === 'palette') buildPaletteEditor(item, slot, card); else buildAssetEditor(show, item, slot);
    return card;
  }

  function buildPaletteEditor(item, slot, card) {
    const wrap = document.createElement('div');
    wrap.className = 'palette-editor';
    wrap.innerHTML = `<label class="palette-count"><span>Number of colours</span><select class="palette-count-select" aria-label="Number of colours"></select></label><div class="palette-strip" aria-label="Colour palette"></div><div class="palette-fields"></div><div class="assetbuttons"><button class="btn alt paste-colours" type="button"></button><button class="btn alt reset-colours" type="button">Reset Palette</button></div>`;
    slot.appendChild(wrap);
    const countSelect = wrap.querySelector('.palette-count-select');
    for (let n = MIN_COLOURS; n <= MAX_COLOURS; n++) {
      const option = document.createElement('option'); option.value = String(n); option.textContent = `${n} colour${n === 1 ? '' : 's'}`; option.selected = n === item.colourCount; countSelect.appendChild(option);
    }
    const strip = wrap.querySelector('.palette-strip');
    const fields = wrap.querySelector('.palette-fields');
    const pasteButton = wrap.querySelector('.paste-colours');
    const renderPalette = () => {
      const visible = item.colours.slice(0, item.colourCount);
      strip.style.gridTemplateColumns = `repeat(${item.colourCount}, minmax(0, 1fr))`;
      strip.replaceChildren(...visible.map((hex, index) => {
        const swatch = document.createElement('div'); swatch.className = 'palette-swatch'; swatch.style.background = hex; swatch.title = `Colour ${index + 1}: ${hex}`;
        const label = document.createElement('span'); label.textContent = hex; label.style.color = contrastText(hex); swatch.appendChild(label); return swatch;
      }));
      fields.replaceChildren();
      visible.forEach((hex, index) => {
        const row = document.createElement('label'); row.className = 'colour-field';
        row.innerHTML = `<span>Colour ${index + 1}</span><div class="colour-controls"><input class="colour-picker" type="color"><input class="colour-code" type="text" maxlength="7" spellcheck="false" aria-label="Colour ${index + 1} code"></div>`;
        const picker = row.querySelector('.colour-picker'); const code = row.querySelector('.colour-code'); picker.value = hex; code.value = hex;
        picker.addEventListener('input', () => { item.colours[index] = picker.value.toUpperCase(); code.value = item.colours[index]; renderPalette(); markDirty(); });
        code.addEventListener('change', () => { const value = normaliseHex(code.value); if (!value) { code.value = item.colours[index]; return toast('Use a hex colour such as #8C7CF3.', 'err'); } item.colours[index] = value; renderPalette(); markDirty(); });
        fields.appendChild(row);
      });
      pasteButton.textContent = `Paste ${item.colourCount} Colour Code${item.colourCount === 1 ? '' : 's'}`;
      card.querySelector('.kind').textContent = `${item.colourCount}-colour palette`;
    };
    countSelect.addEventListener('change', () => { item.colourCount = clampColourCount(countSelect.value); markDirty(); renderPalette(); });
    pasteButton.addEventListener('click', () => {
      const current = item.colours.slice(0, item.colourCount).join(', ');
      const input = prompt(`Paste ${item.colourCount} hex colour code${item.colourCount === 1 ? '' : 's'} separated by spaces, commas or new lines.`, current);
      if (!input) return;
      const found = input.split(/[\s,;|]+/).map(normaliseHex).filter(Boolean);
      if (found.length !== item.colourCount) return toast(`Please enter exactly ${item.colourCount} valid hex colour code${item.colourCount === 1 ? '' : 's'}.`, 'err');
      found.forEach((hex, index) => { item.colours[index] = hex; }); markDirty(); renderPalette();
    });
    wrap.querySelector('.reset-colours').addEventListener('click', () => { item.colours = [...DEFAULT_PALETTE]; markDirty(); renderPalette(); });
    renderPalette();
  }

  function buildAssetEditor(show, item, slot) {
    const wrap = document.createElement('div'); wrap.className = 'asset-editor';
    wrap.innerHTML = `<div class="preview"><span>No file attached</span></div><div class="meta"></div><div class="assetbuttons"><button class="btn upload" type="button">Upload Shared File</button><button class="btn alt link" type="button">Attach Link</button><button class="btn alt clear" type="button">Remove File</button><input class="picker" type="file" hidden></div>`;
    slot.appendChild(wrap);
    const picker = wrap.querySelector('.picker'); picker.accept = ACCEPT[item.type] || '*/*';
    wrap.querySelector('.upload').addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => { const file = picker.files?.[0]; if (file) uploadSharedFile(show, item, file); picker.value = ''; });
    wrap.querySelector('.link').addEventListener('click', () => {
      const url = prompt('Paste a direct/public URL', item.file?.url || ''); if (!url) return;
      try { new URL(url); } catch { return toast('That URL is not valid.', 'err'); }
      item.file = { name: decodeURIComponent(url.split('/').pop()?.split('?')[0] || item.title), type: guessMime(url), url, size: 0 }; item.done = true; markDirty(); render();
    });
    wrap.querySelector('.clear').addEventListener('click', () => { item.file = null; item.done = false; markDirty(); render(); });
    wrap.querySelector('.clear').hidden = !item.file;
    if (item.file) { wrap.querySelector('.meta').textContent = item.file.name || 'Attached file'; renderPreview(item, wrap.querySelector('.preview')); }
  }

  async function uploadSharedFile(show, item, file) {
    if (file.size > MAX_UPLOAD) return toast('Files larger than 20 MB should be attached as a link.', 'err');
    if (!configured()) return toast('Shared API is not configured.', 'err');
    const pin = await requirePin(); if (!pin) return; busy = true; updateStatus('Uploading…');
    try {
      const form = new FormData(); form.append('file', file); form.append('showId', show.id); form.append('itemId', item.id);
      const response = await fetch(`${API}/asset`, { method: 'POST', headers: { 'X-Edit-Pin': pin.trim(), 'X-State-Sha': stateSha }, body: form });
      if (response.status === 401) { sessionStorage.removeItem(PIN_KEY); throw new Error('Edit PIN rejected. Press Edit PIN and enter it again.'); }
      if (response.status === 409) throw new Error('Someone else changed the checklist. Reload Shared before uploading.');
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
      item.file = { name: file.name, type: file.type || guessMime(file.name), size: file.size, path: result.path }; item.done = true; markDirty(); render(); toast('File uploaded. Save Shared Changes to publish the updated checklist.');
    } catch (error) { toast(error.message || 'Upload failed.', 'err'); } finally { busy = false; updateStatus(); }
  }

  function renderPreview(item, box) {
    box.replaceChildren(); const file = item.file; const url = file.path ? `${API}/asset?path=${encodeURIComponent(file.path)}&type=${encodeURIComponent(file.type || '')}` : file.url;
    if (!url) { box.textContent = 'No preview available'; return; }
    const mime = file.type || guessMime(file.name || url);
    if (item.type === 'font') return renderFontPreview(url, file.name, box);
    if (mime.startsWith('image/') || item.type === 'image') { const img = new Image(); img.src = url; img.alt = item.title; box.appendChild(img); return; }
    if (mime.startsWith('audio/') || item.type === 'audio') { const audio = document.createElement('audio'); audio.controls = true; audio.src = url; box.appendChild(audio); return; }
    if (mime.startsWith('video/') || item.type === 'video') { const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.src = url; box.appendChild(video); return; }
    if (mime === 'application/pdf' || /\.pdf(?:$|\?)/i.test(url)) { const iframe = document.createElement('iframe'); iframe.src = url; iframe.title = item.title; box.appendChild(iframe); return; }
    const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.className = 'btn alt'; link.textContent = 'Open attached file'; box.appendChild(link);
  }

  async function renderFontPreview(url, name, box) {
    try {
      const family = `PlanufFont_${uid('f').replace(/-/g, '')}`; const font = new FontFace(family, `url(${JSON.stringify(url)})`); await font.load(); document.fonts.add(font); loadedFonts.push(font);
      const sample = document.createElement('div'); sample.className = 'fontsample'; sample.style.fontFamily = `'${family}'`; sample.textContent = currentShow().name; box.appendChild(sample);
    } catch { box.textContent = `Font attached: ${name || 'font file'}`; }
  }
  function clearFonts() { while (loadedFonts.length) { const font = loadedFonts.pop(); try { document.fonts.delete(font); } catch {} } }

  async function loadShared(force) {
    if (!configured()) { updateStatus(); return false; }
    if (force && dirty && !confirm('Replace unsaved local changes with the latest shared checklist?')) return false;
    busy = true; updateStatus('Loading shared…');
    try {
      const response = await fetch(`${API}/state`, { cache: 'no-store' }); const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Shared checklist could not be loaded (${response.status}).`);
      stateSha = payload.sha || '';
      if (payload.data?.shows) { state = payload.data; dirty = false; const migrated = normaliseState(true); if (migrated) dirty = true; render(); if (migrated) toast('Checklist data was upgraded for the 10-colour palette. Save Shared Changes to publish it.'); }
      return true;
    } catch (error) { updateStatus('Shared load error', 'bad'); toast(error.message, 'err'); return false; } finally { busy = false; updateStatus(); }
  }

  async function saveShared() {
    if (!configured()) return toast('Shared API is not configured.', 'err');
    const pin = await requirePin(); if (!pin) return; busy = true; updateStatus('Saving shared…');
    try {
      state.updatedAt = new Date().toISOString();
      const response = await fetch(`${API}/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Edit-Pin': pin.trim() }, body: JSON.stringify({ data: state, baseSha: stateSha }) });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) { sessionStorage.removeItem(PIN_KEY); $('pin').value = ''; throw new Error('EDIT_PIN was rejected. The saved PIN has been cleared; press Edit PIN and enter the Cloudflare value again.'); }
      if (response.status === 409) throw new Error('Someone else saved a newer version. Reload Shared before saving again.');
      if (!response.ok) throw new Error(payload.error || `Shared save failed (${response.status}).`);
      stateSha = payload.sha || stateSha; dirty = false; saveLocal(); updateStatus(); toast('Shared checklist saved. Other devices will load this version.');
    } catch (error) { dirty = true; updateStatus('Save failed', 'bad'); toast(error.message, 'err'); } finally { busy = false; updateStatus(); }
  }

  function normaliseHex(value) {
    if (!value) return null; let hex = String(value).trim().replace(/^#/, '').toUpperCase(); if (/^[0-9A-F]{3}$/.test(hex)) hex = hex.split('').map(c => c + c).join(''); return /^[0-9A-F]{6}$/.test(hex) ? `#${hex}` : null;
  }
  function contrastText(hex) {
    const v = normaliseHex(hex) || '#000000'; const n = parseInt(v.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111111' : '#FFFFFF';
  }
  function guessMime(value) {
    const path = String(value || '').split('?')[0].toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(path)) return `image/${path.endsWith('.svg') ? 'svg+xml' : path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'jpeg' : path.split('.').pop()}`;
    if (/\.pdf$/.test(path)) return 'application/pdf'; if (/\.(mp3|wav|m4a|aac|ogg)$/.test(path)) return 'audio/mpeg'; if (/\.(mp4|mov|webm|m4v)$/.test(path)) return 'video/mp4'; if (/\.(ttf|otf|woff|woff2)$/.test(path)) return 'font/woff2'; return 'application/octet-stream';
  }
  function toast(message, kind = '') { const el = document.createElement('div'); el.className = `toast${kind ? ` ${kind}` : ''}`; el.textContent = message; $('toastbox').appendChild(el); setTimeout(() => el.remove(), 4300); }
})();
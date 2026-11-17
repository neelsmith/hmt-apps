// Browser UI for the Venetus A facsimile app: a light table of all pages and a
// pannable, zoomable viewer with the indexed text regions drawn over the image.
// Uses the shared sources inlined ahead of this file (see index.html).
(function () {
  const $ = id => document.getElementById(id);
  const proto = location.protocol;
  const THUMB_W = 240;
  const TIP_MAX_CHARS = 700;
  const TIP_MAX_ITEMS = 4;

  /** @type {any[]} */ let canvases = [];
  /** @type {any} */ let release = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {any} */ let dse = null;
  /** @type {Map<string, string>} */ let titles = new Map();
  /** @type {any} */ let viewer = null;
  let current = -1;
  let tableScroll = 0;
  let lastTipKey = '';

  const url = (c, region, size) => matchProtocol(iiifImageUrl(c.service, region, size), proto);
  const regionsOf = c => (dse && c.imageUrn && dse.byImage.get(c.imageUrn)) || [];
  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

  // --- status and loading ---------------------------------------------------

  function setStatus(msg) { $('status').textContent = msg; }

  function updateStatus() {
    if (!canvases.length) return;
    let regions = 0, pages = 0;
    for (const c of canvases) { const n = regionsOf(c).length; if (n) { regions += n; pages++; } }
    const parts = [plural(canvases.length, 'image', 'images')];
    if (dse) parts.push(`${plural(regions, 'indexed region', 'indexed regions')} on ${plural(pages, 'page', 'pages')}`);
    else parts.push('loading indexed text…');
    let msg = parts.join(' · ');
    if (dse && dse.skipped) msg += ` · ${plural(dse.skipped, 'index row', 'index rows')} without a usable region not drawn`;
    if (dse && !dse.found) msg = `${plural(canvases.length, 'image', 'images')} · this release has no ${DSE_URN} index`;
    setStatus(msg);
  }

  function showProblem(msg) {
    $('problem').textContent = msg;
    $('drop').hidden = false;
  }

  function onManifest(json) {
    const m = parseManifest(json);
    if (!m.canvases.length) throw new Error('the manifest has no usable images');
    canvases = m.canvases;
    buildGrid();
    $('table-view').hidden = current >= 0;
    updateStatus();
    showFromHash();
  }

  function onRelease(rel) {
    release = rel;
    textIndex = buildTextIndex(rel);
    titles = catalogTitles(rel);
    dse = indexDse(rel);
    if (!$('problem').textContent.startsWith('Could not load the manifest')) { $('problem').textContent = ''; $('drop').hidden = true; }
    updateCounts();
    updateStatus();
    if (current >= 0) renderRegions();
  }

  async function loadManifest() {
    try {
      const resp = await fetch(VA_MANIFEST_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onManifest(await resp.json());
    } catch (e) {
      setStatus('');
      showProblem(`Could not load the manifest (${e.message || e}).`);
    }
  }

  async function loadRelease() {
    try { onRelease(await fetchRelease()); }
    catch (e) {
      updateStatus();
      showProblem(`Could not load the HMT release (${e.message || e}). Page images still work; indexed text needs the release.`);
    }
  }

  async function loadFiles(files) {
    for (const file of files) {
      try {
        const text = await file.text();
        if (/\.json$/i.test(file.name) || text.trimStart().startsWith('{')) onManifest(JSON.parse(text));
        else onRelease(parseRelease(text));
        $('problem').textContent = '';
        $('drop').hidden = true;
      } catch (e) {
        showProblem(`${file.name}: ${e.message || e}`);
      }
    }
  }

  // --- light table ----------------------------------------------------------

  function buildGrid() {
    const grid = $('grid');
    grid.textContent = '';
    const frag = document.createDocumentFragment();
    canvases.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cell'; b.dataset.index = String(i);
      b.title = c.fullLabel;
      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      thumb.style.aspectRatio = `${c.width} / ${c.height}`;
      const img = document.createElement('img');
      img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
      img.src = url(c, 'full', `${THUMB_W},`);
      thumb.appendChild(img);
      const lbl = document.createElement('span');
      lbl.className = 'lbl'; lbl.textContent = c.gridLabel;
      const count = document.createElement('span');
      count.className = 'count'; count.hidden = true;
      b.append(thumb, lbl, count);
      frag.appendChild(b);
    });
    grid.appendChild(frag);
    applyFilter();
  }

  function updateCounts() {
    const cells = $('grid').children;
    canvases.forEach((c, i) => {
      const n = regionsOf(c).length;
      const badge = cells[i].querySelector('.count');
      badge.hidden = n === 0;
      badge.textContent = String(n);
      cells[i].title = n ? `${c.fullLabel}: ${plural(n, 'indexed region', 'indexed regions')}` : c.fullLabel;
    });
    applyFilter();
  }

  function matches(c, q) {
    if (!q) return true;
    if (/^\d+[rv]$/.test(q)) return c.id.toLowerCase() === q;
    if (/^\d+$/.test(q)) return c.id === q + 'r' || c.id === q + 'v';
    return c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  }

  function applyFilter() {
    const q = $('find').value.trim().toLowerCase();
    const only = $('only-indexed').checked;
    const cells = $('grid').children;
    let shown = 0;
    canvases.forEach((c, i) => {
      const ok = matches(c, q) && (!only || regionsOf(c).length > 0);
      cells[i].hidden = !ok;
      if (ok) shown++;
    });
    $('shown').textContent = canvases.length ? `${shown} of ${canvases.length} shown` : '';
    $('empty').hidden = shown > 0 || !canvases.length;
  }

  // --- navigation (location hash) -----------------------------------------

  function hashPage() {
    const m = /(?:^#|&)page=([^&]+)/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function showFromHash() {
    const id = hashPage();
    const idx = id === null ? -1 : canvases.findIndex(c => c.id === id);
    if (idx < 0) showTable(); else showViewer(idx);
  }

  function showTable() {
    if (viewer) viewer.close();
    current = -1;
    hideTip();
    $('viewer-view').hidden = true;
    $('table-view').hidden = !canvases.length;
    $('table-view').scrollTop = tableScroll;
    document.title = 'Venetus A facsimile';
  }

  function goTo(idx, replace) {
    const target = '#page=' + encodeURIComponent(canvases[idx].id);
    if (replace) location.replace(target); else location.hash = target;
  }

  // --- viewer ---------------------------------------------------------------

  function kind() { return document.querySelector('input[name=kind]:checked').value; }

  function showViewer(idx) {
    if (idx === current && !$('viewer-view').hidden) return;
    if (current < 0) tableScroll = $('table-view').scrollTop;
    current = idx;
    const c = canvases[idx];
    $('table-view').hidden = true;
    $('viewer-view').hidden = false;
    if (!viewer) {
      viewer = new IiifViewer($('viewer'));
      viewer.overlay.id = 'rois';
      bindHover();
    }
    hideTip();
    $('viewer-title').textContent = c.label;
    document.title = `${c.label} – Venetus A facsimile`;
    $('prev').disabled = idx === 0;
    $('next').disabled = idx === canvases.length - 1;
    viewer.open({
      width: c.width, height: c.height,
      urlFor: (region, size) => url(c, region, size),
      placeholders: [url(c, 'full', `${THUMB_W},`)],
    });
    renderRegions();
    viewer.root.focus({ preventScroll: true });
  }

  function renderRegions() {
    if (!viewer || current < 0) return;
    const c = canvases[current];
    const overlay = viewer.overlay;
    overlay.textContent = '';
    const regions = regionsOf(c);
    const counts = { iliad: 0, scholia: 0, other: 0 };
    const NS = 'http://www.w3.org/2000/svg';
    const frag = document.createDocumentFragment();
    for (const r of regions) {
      const k = passageKind(r.passage);
      counts[k]++;
      const rect = document.createElementNS(NS, 'rect');
      const p = roiToRect(r.roi, c.width, c.height);
      rect.setAttribute('x', p.x); rect.setAttribute('y', p.y);
      rect.setAttribute('width', p.w); rect.setAttribute('height', p.h);
      rect.setAttribute('class', `roi ${k}`);
      rect.dataset.passage = r.passage;
      frag.appendChild(rect);
    }
    overlay.appendChild(frag);
    applyLayers();
    const note = $('viewer-note');
    if (!dse) note.textContent = release ? '' : 'Loading indexed text…';
    else if (!regions.length) note.textContent = 'No indexed text on this page.';
    else {
      const bits = [];
      if (counts.iliad) bits.push(`${counts.iliad} Iliad`);
      if (counts.scholia) bits.push(`${counts.scholia} scholia`);
      if (counts.other) bits.push(`${counts.other} other`);
      note.textContent = `${plural(regions.length, 'region', 'regions')}: ${bits.join(', ')}`;
    }
  }

  function applyLayers() {
    if (!viewer) return;
    for (const k of ['iliad', 'scholia', 'other']) {
      viewer.overlay.classList.toggle(`hide-${k}`, !$(`show-${k}`).checked);
    }
    hideTip();
  }

  // --- hover tooltip --------------------------------------------------------

  function hideTip() {
    $('tip').hidden = true;
    lastTipKey = '';
    if (viewer) for (const el of viewer.overlay.querySelectorAll('.hot')) el.classList.remove('hot');
  }

  function renderTipItem(passage) {
    const div = document.createElement('div');
    div.className = 'item';
    const what = document.createElement('div');
    what.className = 'what';
    const b = document.createElement('b');
    b.textContent = passageLabel(passage, titles);
    what.appendChild(b);
    div.appendChild(what);
    const body = document.createElement('div');
    body.className = 'greek'; body.lang = 'grc';
    const { parts } = textIndex.size ? passageText(textIndex, passage, kind()) : { parts: [] };
    if (!parts.length) {
      body.className = 'none';
      body.textContent = release ? 'Text not available in this release.' : 'Text loading…';
    } else {
      let remaining = TIP_MAX_CHARS;
      for (const p of parts) {
        if (remaining <= 0) break;
        const text = p.text.length > remaining ? p.text.slice(0, remaining) + '…' : p.text;
        remaining -= text.length;
        const span = document.createElement('span');
        if (p.part === 'lemma') span.className = 'lemma';
        span.textContent = text;
        if (body.childNodes.length) body.append(' ');
        body.appendChild(span);
      }
    }
    div.appendChild(body);
    return div;
  }

  function showTipAt(clientX, clientY) {
    const els = document.elementsFromPoint(clientX, clientY).filter(el => el.classList && el.classList.contains('roi'));
    const key = els.map(el => el.dataset.passage).join('\n') + '|' + kind() + '|' + (release ? 1 : 0);
    const tip = $('tip');
    if (!els.length) { hideTip(); return; }
    if (key !== lastTipKey) {
      lastTipKey = key;
      for (const el of viewer.overlay.querySelectorAll('.hot')) el.classList.remove('hot');
      for (const el of els) el.classList.add('hot');
      tip.textContent = '';
      for (const el of els.slice(0, TIP_MAX_ITEMS)) tip.appendChild(renderTipItem(el.dataset.passage));
      if (els.length > TIP_MAX_ITEMS) {
        const more = document.createElement('div');
        more.className = 'what'; more.textContent = `+ ${els.length - TIP_MAX_ITEMS} more here`;
        tip.appendChild(more);
      }
    }
    tip.hidden = false;
    const wrap = $('viewer-wrap').getBoundingClientRect();
    const x0 = clientX - wrap.left, y0 = clientY - wrap.top;
    let x = x0 + 14, y = y0 + 18;
    if (x + tip.offsetWidth > wrap.width - 4) x = x0 - 14 - tip.offsetWidth;
    if (y + tip.offsetHeight > wrap.height - 4) y = y0 - 14 - tip.offsetHeight;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, y) + 'px';
  }

  function bindHover() {
    const root = viewer.root;
    let pending = null;
    root.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || viewer.dragging) return;
      pending = e;
      requestAnimationFrame(() => { if (pending) { showTipAt(pending.clientX, pending.clientY); pending = null; } });
    });
    root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { pending = null; hideTip(); } });
    root.addEventListener('pointerdown', () => { if (viewer.pointers.size === 0) $('tip').hidden = true; });
    root.addEventListener('click', e => { if (!viewer.dragging && e.pointerType !== 'mouse') showTipAt(e.clientX, e.clientY); });
    root.addEventListener('wheel', () => hideTip(), { passive: true });
  }

  // --- wiring ---------------------------------------------------------------

  $('grid').addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (cell) goTo(Number(cell.dataset.index), false);
  });
  $('find').addEventListener('input', applyFilter);
  $('only-indexed').addEventListener('change', applyFilter);
  $('cell-size').addEventListener('input', e => { $('grid').style.setProperty('--cell-w', e.target.value + 'px'); });

  $('back').addEventListener('click', () => { location.hash = ''; });
  $('prev').addEventListener('click', () => { if (current > 0) goTo(current - 1, true); });
  $('next').addEventListener('click', () => { if (current < canvases.length - 1) goTo(current + 1, true); });
  $('zoom-in').addEventListener('click', () => viewer && viewer.zoomBy(1.5));
  $('zoom-out').addEventListener('click', () => viewer && viewer.zoomBy(1 / 1.5));
  $('fit').addEventListener('click', () => viewer && viewer.fit());
  for (const k of ['iliad', 'scholia', 'other']) $(`show-${k}`).addEventListener('change', applyLayers);
  for (const r of document.querySelectorAll('input[name=kind]')) r.addEventListener('change', hideTip);

  window.addEventListener('hashchange', showFromHash);
  document.addEventListener('keydown', e => {
    if ($('viewer-view').hidden || e.target.closest('input[type=text], input[type=search]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { location.hash = ''; }
    else if ((e.key === '[' || e.key === 'PageUp') && current > 0) { e.preventDefault(); goTo(current - 1, true); }
    else if ((e.key === ']' || e.key === 'PageDown') && current < canvases.length - 1) { e.preventDefault(); goTo(current + 1, true); }
  });

  $('file').addEventListener('change', e => loadFiles([...e.target.files]));
  window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  window.addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    if (e.dataTransfer.files.length) loadFiles([...e.dataTransfer.files]);
  });

  loadManifest();
  loadRelease();
})();

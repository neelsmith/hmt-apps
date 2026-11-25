// Browser UI for the Venetus A facsimile app: a light table of all pages and a
// pannable, zoomable viewer with the indexed text regions drawn over the image.
// The pages come from the codex model of the Venetus A in the HMT release (`urn:cite2:hmt:msA.v1:`); each page is
// shown by the documentary image indexed to it (the image of its DSE records, else the catalog's image).
// Uses the shared sources inlined ahead of this file (see index.html).
(function () {
  const VA_CODEX = 'urn:cite2:hmt:msA.v1:';   // the codex of the Venetus A
  const $ = id => document.getElementById(id);
  const proto = location.protocol;
  const THUMB_W = 240;
  const TIP_MAX_CHARS = 700;
  const TIP_MAX_ITEMS = 4;

  /**
   * The pages of the Venetus A that have an image, in codex order.
   * @type {{id: string, urn: string, label: string, fullLabel: string, gridLabel: string, imageUrn: string, service: string, regions: any[], elsewhere: number, width?: number, height?: number}[]}
   */
  let canvases = [];
  /** @type {any} */ let release = null;
  /** @type {any} */ let locator = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {{found: boolean, skipped: number} | null} */ let dse = null;
  /** @type {Map<string, string>} */ let titles = new Map();
  /** @type {Map<string, Promise<{width: number, height: number}>>} */ const sizes = new Map();
  /** @type {any} */ let viewer = null;
  /** @type {any} */ let roiUi = null;   // regions of interest drawn on the open page image
  let current = -1;
  let currentText = null;     // the `text` parameter whose region is marked on the open page
  let openToken = 0;
  let tableScroll = 0;
  let lastTipKey = '';
  let notice = '';
  let noImage = 0;

  const url = (c, region, size) => matchProtocol(iiifImageUrl(c.service, region, size), proto);
  const regionsOf = c => c.regions;
  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

  // --- status and loading ---------------------------------------------------

  function setStatus(msg) { $('status').textContent = msg; }

  function updateStatus() {
    if (!release) return;
    if (!canvases.length) { setStatus(`${release.library.name}: no pages of the Venetus A (${VA_CODEX}) with an image`); return; }
    let regions = 0, pages = 0;
    for (const c of canvases) { const n = regionsOf(c).length; if (n) { regions += n; pages++; } }
    const parts = [plural(canvases.length, 'page', 'pages')];
    if (dse && dse.found) parts.push(`${plural(regions, 'indexed region', 'indexed regions')} on ${plural(pages, 'page', 'pages')}`);
    let msg = parts.join(' · ');
    if (dse && dse.found && dse.skipped) msg += ` · ${plural(dse.skipped, 'index row', 'index rows')} without a usable region not drawn`;
    if (dse && !dse.found) msg += ` · this release has no ${DSE_URN} index`;
    if (noImage) msg += ` · ${plural(noImage, 'page', 'pages')} without an image left out`;
    if (notice) msg += ` · ${notice}`;
    setStatus(msg);
  }

  function showProblem(msg) {
    $('problem').textContent = msg;
    $('drop').hidden = false;
  }

  /** Build the pages of the Venetus A from a release, and show what the address asks for. */
  function onRelease(rel) {
    release = rel;
    textIndex = buildTextIndex(rel);
    titles = catalogTitles(rel);
    locator = createLocator(rel);
    const idx = indexRegionsBySurface(rel);
    dse = { found: idx.found, skipped: idx.skipped };
    const catalogImages = new Set(imageCollections(rel).flatMap(c => c.items.map(i => i.urn)));
    const codex = codices(rel).find(c => c.urn === VA_CODEX);
    canvases = []; noImage = 0; current = -1;
    for (const p of codex ? codex.pages : []) {
      const view = pageView(p, idx.bySurface.get(p.urn) ?? [], catalogImages);
      const service = view.image ? imageService(view.image) : null;
      if (!service) { noImage++; continue; }
      canvases.push({
        id: p.id, urn: p.urn, label: p.short || p.id, fullLabel: p.label || p.short || p.id,
        gridLabel: /^\d+[rv]$/.test(p.id) ? p.id : (p.short || p.id),
        imageUrn: view.image, service, regions: view.regions, elsewhere: view.elsewhere,
      });
    }
    if (!codex) showProblem(`This release has no codex ${VA_CODEX} (the Venetus A).`);
    else { $('problem').textContent = ''; $('drop').hidden = true; }
    buildGrid();
    $('table-view').hidden = false;
    updateStatus();
    showFromLocation();
  }

  async function loadRelease() {
    try { onRelease(await fetchRelease()); }
    catch (e) {
      setStatus('');
      showProblem(`Could not load the HMT release (${e.message || e}). The pages and images come from the release; load a saved copy.`);
    }
  }

  async function loadFiles(files) {
    for (const file of files) {
      try { onRelease(parseRelease(await file.text())); }
      catch (e) { showProblem(`${file.name}: ${e.message || e}`); }
    }
  }

  /** Pixel size of an image, from its IIIF info.json (asked once per image). */
  function imageSize(service) {
    let p = sizes.get(service);
    if (!p) {
      p = fetch(matchProtocol(`${service}/info.json`, proto))
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(j => parseInfo(j) || Promise.reject(new Error('no width and height in the image information')));
      p.catch(() => sizes.delete(service));
      sizes.set(service, p);
    }
    return p;
  }

  // --- light table ----------------------------------------------------------

  function buildGrid() {
    const grid = $('grid');
    grid.textContent = '';
    const frag = document.createDocumentFragment();
    canvases.forEach((c, i) => {
      const n = regionsOf(c).length;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cell'; b.dataset.index = String(i);
      b.title = n ? `${c.fullLabel}: ${plural(n, 'indexed region', 'indexed regions')}` : c.fullLabel;
      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      thumb.style.aspectRatio = '3 / 4';   // until the picture says which shape it is
      const img = document.createElement('img');
      img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
      img.addEventListener('load', () => { if (img.naturalWidth && img.naturalHeight) thumb.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`; });
      img.src = url(c, 'full', `${THUMB_W},`);
      thumb.appendChild(img);
      const lbl = document.createElement('span');
      lbl.className = 'lbl'; lbl.textContent = c.gridLabel;
      const count = document.createElement('span');
      count.className = 'count'; count.hidden = n === 0; count.textContent = String(n);
      b.append(thumb, lbl, count);
      frag.appendChild(b);
    });
    grid.appendChild(frag);
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

  // --- navigation (address of the page) -----------------------------------
  //
  // `?page=<page URN>` opens a page, as in `?page=urn:cite2:hmt:msA.v1:12r`; `?image=<image URN>` opens the page that
  // has that image (and then `page` is ignored); `?text=<CTS passage URN>` (for a range, its first passage) opens the
  // page that has that passage when neither is given.  Whichever page is opened, the region of the `text` passage on
  // its image is marked like a region just drawn by Shift-drag.  A `text` stays in the address (`?page=…&text=…`);
  // the page buttons drop it.  There is no `#`.

  /** Show what the address asks for: a page, the page of an image or a passage, or the light table. */
  function showFromLocation() {
    if (!release) return;
    notice = '';
    const p = readParams(location.search);
    for (const k of ['page', 'image']) if (p[k]) p[k] = p[k].split('@')[0].trim();   // a region of an image is ignored
    if (p.image) p.page = null;                                                       // an image decides alone
    const r = resolvePage(locator, p);
    if (!r) { showTable(); updateStatus(); return; }
    if ('error' in r) { notice = r.error; setQuery({}, true); showTable(); updateStatus(); return; }
    const idx = canvases.findIndex(c => c.urn === r.page);
    if (idx < 0) {
      notice = `${r.page} is not a page of the Venetus A (${VA_CODEX}) with an image`;
      setQuery({}, true); showTable(); updateStatus(); return;
    }
    const canonical = decodeURIComponent(formatQuery(p.image ? { image: p.image, text: p.text } : { page: r.page, text: p.text }));
    if (decodeURIComponent(location.search) !== canonical) setQuery(p.image ? { image: p.image, text: p.text } : { page: r.page, text: p.text }, true);
    showViewer(idx, p.text);
    updateStatus();
  }

  function showTable() {
    openToken++;
    if (viewer) { viewer.close(); roiUi.close(); }
    current = -1;
    hideTip();
    $('viewer-view').hidden = true;
    $('table-view').hidden = !canvases.length;
    $('table-view').scrollTop = tableScroll;
    document.title = 'Venetus A facsimile';
  }

  /** Go to a page: put it in the address and show it. */
  function goTo(idx, replace) {
    setQuery({ page: canvases[idx].urn }, replace);
    showViewer(idx);
  }

  /** Back to the light table. */
  function toTable() {
    setQuery({}, false);
    showTable();
  }

  // --- viewer ---------------------------------------------------------------

  function kind() { return document.querySelector('input[name=kind]:checked').value; }

  async function showViewer(idx, text = null) {
    if (idx === current && text === currentText && !$('viewer-view').hidden) return;
    currentText = text;
    if (current < 0) tableScroll = $('table-view').scrollTop;
    current = idx;
    const token = ++openToken;
    const c = canvases[idx];
    $('table-view').hidden = true;
    $('viewer-view').hidden = false;
    if (!viewer) {
      viewer = new IiifViewer($('viewer'));
      viewer.overlay.id = 'rois';
      bindHover();
      roiUi = new RoiUi(viewer, { button: $('roi-select'), panel: $('roi-panel') });
    }
    hideTip();
    viewer.close();
    roiUi.close();
    viewer.overlay.textContent = '';
    $('viewer-title').textContent = c.label;
    document.title = `${c.label} – Venetus A facsimile`;
    $('prev').disabled = idx === 0;
    $('next').disabled = idx === canvases.length - 1;
    $('viewer-note').textContent = 'Loading the image…';
    try {
      if (!c.width) Object.assign(c, await imageSize(c.service));
    } catch (e) {
      if (token === openToken) $('viewer-note').textContent = `Could not load the image of ${c.label} (${e.message || e}).`;
      return;
    }
    if (token !== openToken) return;
    viewer.open({
      width: c.width, height: c.height,
      urlFor: (region, size) => url(c, region, size),
      placeholders: [url(c, 'full', `${THUMB_W},`)],
    });
    renderRegions();
    const marked = text ? locator.regionsOfText(text, c.imageUrn) : [];   // the passage of `text`, marked as if just drawn
    roiUi.open(c.imageUrn, marked);
    if (text && !marked.length) $('viewer-note').textContent += ` · no region of ${text} on this image`;
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
    if (!dse || !dse.found) note.textContent = '';
    else if (!regions.length) note.textContent = 'No indexed text on this page.';
    else {
      const bits = [];
      if (counts.iliad) bits.push(`${counts.iliad} Iliad`);
      if (counts.scholia) bits.push(`${counts.scholia} scholia`);
      if (counts.other) bits.push(`${counts.other} other`);
      note.textContent = `${plural(regions.length, 'region', 'regions')}: ${bits.join(', ')}`;
    }
    if (c.elsewhere) note.textContent += ` · ${plural(c.elsewhere, 'region', 'regions')} on another image not shown`;
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

  /** The text of a passage as the hover shows it (diplomatic or normalized), lemma and comment of a scholion with a space between. */
  function passageString(passage) {
    return textIndex.size ? passageText(textIndex, passage, kind()).parts.map(p => p.text).join(' ') : '';
  }

  let toastTimer = 0;
  function toast(msg, bad) {
    const t = $('copied');
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /** Copy the text of the topmost region under the pointer. */
  async function copyAt(clientX, clientY) {
    const el = document.elementsFromPoint(clientX, clientY).find(e => e.classList && e.classList.contains('roi'));
    if (!el) return;
    const passage = el.dataset.passage;
    const label = passageLabel(passage, titles);
    const text = passageString(passage);
    if (!text) { toast(`No text of ${label} in this release`, true); return; }
    // the passage URN, then its text
    toast((await copyToClipboard(`${passage}\n${text}`)) ? `Copied the URN and text of ${label} to the clipboard` : `Could not copy ${label}`, false);
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
    root.addEventListener('click', e => {
      if (viewer.dragging) return;
      if (e.target instanceof Element && e.target.closest('.roi-layer')) return;   // clicking a region of interest of your own
      if (e.pointerType !== 'mouse') showTipAt(e.clientX, e.clientY);   // touch has no hover: a tap shows the text too
      copyAt(e.clientX, e.clientY);
    });
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

  $('back').addEventListener('click', toTable);
  $('prev').addEventListener('click', () => { if (current > 0) goTo(current - 1, true); });
  $('next').addEventListener('click', () => { if (current < canvases.length - 1) goTo(current + 1, true); });
  $('zoom-in').addEventListener('click', () => viewer && viewer.zoomBy(1.5));
  $('zoom-out').addEventListener('click', () => viewer && viewer.zoomBy(1 / 1.5));
  $('fit').addEventListener('click', () => viewer && viewer.fit());
  for (const k of ['iliad', 'scholia', 'other']) $(`show-${k}`).addEventListener('change', applyLayers);
  for (const r of document.querySelectorAll('input[name=kind]')) r.addEventListener('change', hideTip);

  window.addEventListener('popstate', showFromLocation);   // Back, Forward
  document.addEventListener('keydown', e => {
    if ($('viewer-view').hidden || e.target.closest('input[type=text], input[type=search]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') toTable();
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

  loadRelease();
})();

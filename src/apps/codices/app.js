// Browser UI for the codices app: choose a codex, browse its pages as a light box of thumbnails, open one; the page image
// of the DSE records is shown with a rectangle over each indexed text passage,
// hovering a rectangle shows the diplomatic text, and clicking it copies the
// text to the clipboard.  Uses the shared sources
// inlined ahead of this file (see index.html).
//
// Address: `?page=<page URN>`, `?page=<codex URN>` for the light box of a codex, or `?image=<image URN>` or `?text=<passage URN>`, which are turned into a page through
// the DSE records and the catalog (no `#`); the address is rewritten as `?page=…`.  Links, bookmarks and Back work.
(function () {
  const $ = id => document.getElementById(id);
  const proto = location.protocol;
  const THUMB_W = 240;
  const TIP_MAX_CHARS = 700;
  const TIP_MAX_ITEMS = 4;
  const NS = 'http://www.w3.org/2000/svg';
  const KIND = 'diplomatic';

  /** @type {Codex[]} */ let books = [];
  /** @type {Codex | null} */ let book = null;
  /** @type {any} */ let release = null;
  /** @type {any} */ let locator = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {Map<string, string>} */ let titles = new Map();
  /** @type {Map<string, PageRegion[]>} */ let bySurface = new Map();
  /** @type {Set<string>} */ let catalogImages = new Set();
  /** @type {Map<string, Promise<{width: number, height: number}>>} */ const sizes = new Map();
  /** @type {any} */ let viewer = null;
  /** @type {any} */ let roiUi = null;   // regions of interest drawn on the open page image
  let current = -1;            // index of the page in `book.pages`; -1 while the light box shows
  /** @type {Codex | null} */ let gridOf = null;   // the codex whose thumbnails are in the grid
  let renderToken = 0;         // identifies the latest grid, so late thumbnail events can be ignored
  let tableScroll = 0;         // scroll position of the light box, kept while a page is open
  let openToken = 0;
  let lastTipKey = '';

  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  const urlFor = (service, region, size) => matchProtocol(iiifImageUrl(service, region, size), proto);
  const setStatus = msg => { $('status').textContent = msg; };
  const regionsOn = p => bySurface.get(p.urn) ?? [];

  // --- loading ---------------------------------------------------------------

  function start(rel) {
    release = rel;
    textIndex = buildTextIndex(rel);
    titles = catalogTitles(rel);
    bySurface = indexRegionsBySurface(rel).bySurface;
    catalogImages = new Set(imageCollections(rel).flatMap(c => c.items.map(i => i.urn)));
    books = codices(rel);
    locator = createLocator(rel);
    book = null; current = -1; gridOf = null; $('grid').textContent = '';
    const sel = $('codex');
    sel.textContent = '';
    sel.appendChild(new Option('Choose a codex…', ''));
    for (const c of books) {
      const n = c.pages.filter(p => pageView(p, regionsOn(p), catalogImages).regions.length).length;
      const o = new Option(`${c.label} (${plural(c.pages.length, 'page', 'pages')}${n ? `, ${n.toLocaleString('en')} with indexed text` : ', no indexed text'})`, c.urn);
      o.disabled = c.pages.length === 0;
      sel.appendChild(o);
    }
    sel.disabled = books.length === 0;
    setStatus(books.length ? `${rel.library.name}: ${plural(books.length, 'codex', 'codices')}` : `${rel.library.name}: no codices found`);
    $('drop').hidden = true;
    route();
  }

  function showProblem(msg) {
    setStatus('');
    $('problem').textContent = msg;
    $('drop').hidden = false;
  }

  async function loadFile(file) {
    setStatus(`Reading ${file.name}…`);
    try { start(await readReleaseFile(file)); }
    catch (e) { showProblem(`${file.name}: ${e.message || e}`); }
  }

  // --- menus -------------------------------------------------------------------

  /** Make a codex the one whose pages are shown (or none). */
  function selectBook(c) {
    if (c !== book) { book = c; gridOf = null; $('grid').textContent = ''; $('find').value = ''; $('only-text').checked = false; tableScroll = 0; }
    $('codex').value = c ? c.urn : '';
  }

  function syncControls() {
    $('prev').disabled = !book || current <= 0;
    $('next').disabled = !book || current < 0 || current >= book.pages.length - 1;
  }

  // --- navigation (address of the page) ----------------------------------------------

  /** Show a page (by URN) and put it in the address of the page. */
  function go(urn, replace) {
    focusKey = '';
    setQuery({ page: urn }, replace);
    showPage(urn);
  }


  /** Passage (DSE key) the address asks for with `text`: its regions stay visible, and the layers start off. */
  let focusKey = '';
  function setFocus(text) {
    focusKey = text ? firstPassageKey(text) || '' : '';
    if (focusKey) for (const k of ['iliad', 'scholia', 'other']) $(`show-${k}`).checked = false;
  }

  function route() {
    const params = readParams(location.search);
    setFocus(params.text);
    const codex = params.page ? books.find(c => c.urn === params.page) : null;
    if (codex) { selectBook(codex); showTable(); return; }   // the address names a codex: its light box
    const r = resolvePage(locator, params);
    if (!r) { selectBook(null); showTable(); return; }
    if ('error' in r) { selectBook(null); showTable(r.error); return; }
    const canon = { page: r.page, text: focusKey ? params.text : null };
    if (decodeURIComponent(location.search) !== decodeURIComponent(formatQuery(canon))) setQuery(canon, true);   // the canonical address
    showPage(r.page);
  }

  // --- light box ----------------------------------------------------------------

  /** @param {string} [message]  A note above the grid (or instead of it, when no codex is chosen). */
  function showTable(message) {
    openToken++;
    if (viewer) { viewer.close(); roiUi.close(); }
    current = -1;
    hideTip();
    $('viewer-view').hidden = true;
    $('table-view').hidden = false;
    renderGrid(message);
    $('table-view').scrollTop = tableScroll;
    document.title = book ? `${book.label} – Codices` : 'Codices';
  }

  /** Every page of the codex as a thumbnail (the browser loads them as they scroll into view). */
  function renderGrid(message) {
    const grid = $('grid');
    $('note').hidden = !message;
    $('note').textContent = message || '';
    const controls = ['find', 'only-text', 'cell-size'];
    if (!book) {
      grid.textContent = '';
      gridOf = null;
      $('intro').hidden = !!message;
      $('shown').textContent = '';
      $('empty').hidden = true;
      for (const id of controls) $(id).disabled = true;
      return;
    }
    $('intro').hidden = true;
    for (const id of controls) $(id).disabled = false;
    if (gridOf !== book) {
      gridOf = book;
      grid.textContent = '';
      const frag = document.createDocumentFragment();
      let loaded = 0, failed = 0;
      const mine = ++renderToken;
      const check = () => {
        if (mine !== renderToken || loaded > 0 || failed < 6) return;   // the first thumbnails all failed
        $('note').textContent = 'None of the thumbnails loaded. The image server may be unreachable, or these pages may not be served where this app expects them.';
        $('note').hidden = false;
      };
      book.pages.forEach((page, k) => {
        const view = pageView(page, regionsOn(page), catalogImages);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cell'; b.dataset.index = String(k); b.dataset.n = String(view.regions.length);
        b.title = page.label || page.id;
        const thumb = document.createElement('span');
        thumb.className = 'thumb';
        const img = document.createElement('img');
        img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
        const service = view.image ? imageService(view.image) : null;
        img.onload = () => {
          loaded++;
          if (img.naturalWidth && img.naturalHeight) thumb.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        };
        img.onerror = () => { failed++; thumb.classList.add('missing'); check(); };
        if (service) img.src = urlFor(service, 'full', `${THUMB_W},`); else { thumb.classList.add('missing'); failed++; check(); }
        thumb.appendChild(img);
        const lbl = document.createElement('span');
        lbl.className = 'lbl'; lbl.textContent = page.short;
        b.append(thumb, lbl);
        if (view.regions.length) {
          const n = document.createElement('span');
          n.className = 'badge'; n.textContent = String(view.regions.length);
          n.title = `${plural(view.regions.length, 'indexed passage', 'indexed passages')}`;
          b.appendChild(n);
        }
        frag.appendChild(b);
      });
      grid.appendChild(frag);
    }
    applyFilter();
  }

  /** Show the thumbnails that match the Find box and the "only pages with indexed text" box. */
  function applyFilter() {
    if (!book) return;
    const q = $('find').value.trim().toLowerCase();
    const only = $('only-text').checked;
    const cells = $('grid').children;
    let shown = 0;
    book.pages.forEach((p, k) => {
      const ok = (!q || `${p.short} ${p.label} ${p.id}`.toLowerCase().includes(q)) && (!only || cells[k].dataset.n !== '0');
      cells[k].hidden = !ok;
      if (ok) shown++;
    });
    $('shown').textContent = shown === book.pages.length
      ? plural(book.pages.length, 'page', 'pages')
      : `${shown.toLocaleString('en')} of ${plural(book.pages.length, 'page', 'pages')} shown`;
    $('empty').hidden = shown > 0;
  }

  // --- the page ------------------------------------------------------------------

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

  async function showPage(urn) {
    const owner = books.find(c => c.urn === (collectionOfObject(urn) ?? ''));
    const idx = owner ? owner.pages.findIndex(p => p.urn === urn) : -1;
    if (idx < 0) { selectBook(null); showTable(`No page ${urn} in this release.`); return; }
    selectBook(owner);
    if (current < 0) tableScroll = $('table-view').scrollTop;
    current = idx;
    syncControls();
    const page = book.pages[idx];
    const token = ++openToken;
    $('table-view').hidden = true;
    $('viewer-view').hidden = false;
    $('viewer-title').textContent = page.label || page.id;
    $('viewer-count').textContent = `${idx + 1} of ${book.pages.length} · ${book.label}`;
    $('viewer-error').hidden = true;
    hideTip();
    document.title = `${page.label || page.id} – Codices`;
    const view = pageView(page, regionsOn(page), catalogImages);
    if (!viewer) { viewer = new IiifViewer($('viewer')); viewer.overlay.id = 'rois'; bindHover(); roiUi = new RoiUi(viewer, { button: $('roi-select'), panel: $('roi-panel') }); }
    viewer.close();
    roiUi.close();
    const note = $('viewer-note');
    note.hidden = false;
    note.textContent = page.label || page.id;
    const service = view.image ? imageService(view.image) : null;
    try {
      if (!service) throw new Error(view.image ? `cannot work out where ${view.image} is served` : 'the release names no image for this page');
      const { width, height } = await imageSize(service);
      if (token !== openToken) return;
      viewer.open({
        width, height,
        urlFor: (region, size) => urlFor(service, region, size),
        placeholders: [urlFor(service, 'full', `${THUMB_W},`)],
      });
      drawRegions(view.regions, width, height);
      roiUi.open(view.image);
      viewer.root.focus({ preventScroll: true });
      const bits = [page.label || page.id];
      if (view.regions.length) bits.push(plural(view.regions.length, 'indexed passage', 'indexed passages'));
      else bits.push(release && view.source !== 'none' ? 'no indexed text on this page' : '');
      if (view.elsewhere) bits.push(`${plural(view.elsewhere, 'region', 'regions')} on another image not shown`);
      note.textContent = bits.filter(Boolean).join(' · ');
    } catch (e) {
      if (token !== openToken) return;
      $('viewer-error').textContent = `Could not load the image of ${page.label || page.id} (${e.message || e}).`;
      $('viewer-error').hidden = false;
    }
  }

  function drawRegions(regions, width, height) {
    const overlay = viewer.overlay;
    overlay.textContent = '';
    const frag = document.createDocumentFragment();
    for (const r of regions) {
      const rect = document.createElementNS(NS, 'rect');
      const p = roiToRect(r.roi, width, height);
      rect.setAttribute('x', p.x); rect.setAttribute('y', p.y);
      rect.setAttribute('width', p.w); rect.setAttribute('height', p.h);
      rect.setAttribute('class', `roi ${passageKind(r.passage)}${focusKey && dseKey(r.passage) === focusKey ? ' target' : ''}`);
      rect.dataset.passage = r.passage;
      frag.appendChild(rect);
    }
    overlay.appendChild(frag);
    applyLayers();
  }

  function applyLayers() {
    if (!viewer) return;
    for (const k of ['iliad', 'scholia', 'other']) viewer.overlay.classList.toggle(`hide-${k}`, !$(`show-${k}`).checked);
    hideTip();
  }

  // --- hover tooltip ---------------------------------------------------------------

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
    const { parts } = passageText(textIndex, passage, KIND);
    if (!parts.length) {
      body.className = 'none';
      body.textContent = 'Text not available in this release.';
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

  /** Full diplomatic text of a passage (lemma and comment of a scholion with a space between), or "". */
  function passageString(passage) {
    return passageText(textIndex, passage, KIND).parts.map(p => p.text).join(' ');
  }

  /** Copy to the clipboard; falls back to a hidden textarea where the clipboard API is missing (e.g. some file:// pages). */
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* try the fallback */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
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

  /** Copy the text of the topmost rectangle under the pointer. */
  async function copyAt(clientX, clientY) {
    const el = document.elementsFromPoint(clientX, clientY).find(e => e.classList && e.classList.contains('roi'));
    if (!el) return;
    const passage = el.dataset.passage;
    const label = passageLabel(passage, titles);
    const text = passageString(passage);
    if (!text) { toast(`No text of ${label} in this release`, true); return; }
    // the passage URN, then its text
    toast((await copyText(`${passage}\n${text}`)) ? `Copied the URN and text of ${label} to the clipboard` : `Could not copy ${label}`, false);
  }

  function showTipAt(clientX, clientY) {
    const els = document.elementsFromPoint(clientX, clientY).filter(el => el.classList && el.classList.contains('roi'));
    const key = els.map(el => el.dataset.passage).join('\n');
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
    root.addEventListener('click', e => {
      if (viewer.dragging) return;
      if (e.target instanceof Element && e.target.closest('.roi-layer')) return;   // clicking a region of interest of your own
      if (e.pointerType !== 'mouse') showTipAt(e.clientX, e.clientY);   // touch has no hover: a tap shows the text too
      copyAt(e.clientX, e.clientY);
    });
    root.addEventListener('wheel', () => hideTip(), { passive: true });
  }

  // --- wiring ----------------------------------------------------------------------

  $('codex').addEventListener('change', e => {
    tableScroll = 0;
    const urn = e.target.value;
    setQuery(urn ? { page: urn } : {}, false);
    route();
  });
  $('find').addEventListener('input', applyFilter);
  $('only-text').addEventListener('change', applyFilter);
  $('cell-size').addEventListener('input', e => { $('grid').style.setProperty('--cell-w', e.target.value + 'px'); });
  $('grid').addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (cell && book) go(book.pages[Number(cell.dataset.index)].urn, false);
  });
  $('back').addEventListener('click', () => { if (book) { setQuery({ page: book.urn }, false); route(); } });
  const step = d => { if (book && current >= 0 && book.pages[current + d]) go(book.pages[current + d].urn, true); };
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('zoom-in').addEventListener('click', () => viewer && viewer.zoomBy(1.5));
  $('zoom-out').addEventListener('click', () => viewer && viewer.zoomBy(1 / 1.5));
  $('fit').addEventListener('click', () => viewer && viewer.fit());
  for (const k of ['iliad', 'scholia', 'other']) $(`show-${k}`).addEventListener('change', applyLayers);

  window.addEventListener('popstate', () => { if (books.length) route(); });   // Back, Forward
  document.addEventListener('keydown', e => {
    if (current < 0 || e.target.closest('input, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && book) { setQuery({ page: book.urn }, false); route(); }
    else if (e.key === '[' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (e.key === ']' || e.key === 'PageDown') { e.preventDefault(); step(1); }
  });

  $('file').addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
  window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  window.addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  (async function init() {
    try { start(await fetchRelease()); }
    catch (e) { showProblem(`Could not load the HMT release (${e.message || e}). If you are offline, load a copy of the release from your computer.`); }
  })();
})();

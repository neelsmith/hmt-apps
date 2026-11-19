// Browser UI for the codices app: choose a codex, then a page; the page image
// of the DSE records is shown with a rectangle over each indexed text passage,
// hovering a rectangle shows the diplomatic text, and clicking it copies the
// text to the clipboard.  Uses the shared sources
// inlined ahead of this file (see index.html).
//
// Location hash: `#urn=<page URN>`, so links and the Back button work.
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
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {Map<string, string>} */ let titles = new Map();
  /** @type {Map<string, PageRegion[]>} */ let bySurface = new Map();
  /** @type {Set<string>} */ let catalogImages = new Set();
  /** @type {Map<string, Promise<{width: number, height: number}>>} */ const sizes = new Map();
  /** @type {any} */ let viewer = null;
  let current = -1;            // index of the page in `book.pages`
  let openToken = 0;
  let lastTipKey = '';
  let ownHash = null;

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
    book = null; current = -1;
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

  function chooseCodex(urn) {
    book = books.find(c => c.urn === urn) ?? null;
    const sel = $('page');
    sel.textContent = '';
    if (!book) { sel.disabled = true; return; }
    sel.appendChild(new Option('Choose a page…', ''));
    book.pages.forEach((p, i) => {
      const n = pageView(p, regionsOn(p), catalogImages).regions.length;   // regions that will be drawn
      // "●" marks pages with indexed text; a figure space keeps the others aligned with them
      sel.appendChild(new Option(n ? `● ${p.short} · ${n}` : `\u2007  ${p.short}`, String(i)));
    });
    sel.disabled = false;
  }

  function syncControls() {
    $('codex').value = book ? book.urn : '';
    $('page').value = book && current >= 0 ? String(current) : '';
    $('prev').disabled = !book || current <= 0;
    $('next').disabled = !book || current < 0 || current >= book.pages.length - 1;
  }

  // --- navigation (location hash) ----------------------------------------------

  /** Show a page (by URN), and put it in the location hash unless `fromHash`. */
  function go(urn, replace) {
    const hash = formatPageHash(urn);
    ownHash = hash;
    if (replace) location.replace(hash); else location.hash = hash;
    showPage(urn);
  }

  function route() {
    const urn = parsePageHash(location.hash);
    if (urn) showPage(urn); else clear();
  }

  function clear() {
    openToken++;
    if (viewer) viewer.close();
    current = -1;
    hideTip();
    $('intro').hidden = false;
    $('viewer-note').hidden = true;
    $('viewer-error').hidden = true;
    document.title = 'Codices';
    syncControls();
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
    if (idx < 0) { clear(); setStatus(`${release.library.name}: no page ${urn} in this release`); return; }
    if (owner !== book) chooseCodex(owner.urn);
    current = idx;
    syncControls();
    const page = book.pages[idx];
    const token = ++openToken;
    $('intro').hidden = true;
    $('viewer-error').hidden = true;
    hideTip();
    document.title = `${page.label || page.id} – Codices`;
    const view = pageView(page, regionsOn(page), catalogImages);
    if (!viewer) { viewer = new IiifViewer($('viewer')); viewer.overlay.id = 'rois'; bindHover(); }
    viewer.close();
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
      rect.setAttribute('class', `roi ${passageKind(r.passage)}`);
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
    toast((await copyText(text)) ? `Copied ${label} to the clipboard` : `Could not copy ${label}`, false);
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
      if (e.pointerType !== 'mouse') showTipAt(e.clientX, e.clientY);   // touch has no hover: a tap shows the text too
      copyAt(e.clientX, e.clientY);
    });
    root.addEventListener('wheel', () => hideTip(), { passive: true });
  }

  // --- wiring ----------------------------------------------------------------------

  $('codex').addEventListener('change', e => {
    const urn = e.target.value;
    chooseCodex(urn);
    current = -1;
    if (urn) { openToken++; if (viewer) viewer.close(); syncControls(); $('intro').hidden = false; $('viewer-note').hidden = true; $('viewer-error').hidden = true; hideTip(); }
    else { location.hash = ''; }
    $('intro').textContent = urn ? 'Choose a page. Hover over a rectangle to read its text; click to copy it.' : 'Choose a codex, then a page. Hover over a rectangle to read its text; click to copy it.';
    if (urn) { ownHash = null; history.replaceState(null, '', location.pathname + location.search); }
  });
  $('page').addEventListener('change', e => {
    if (e.target.value !== '' && book) go(book.pages[Number(e.target.value)].urn, false);
  });
  const step = d => { if (book && current >= 0 && book.pages[current + d]) go(book.pages[current + d].urn, true); };
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('zoom-in').addEventListener('click', () => viewer && viewer.zoomBy(1.5));
  $('zoom-out').addEventListener('click', () => viewer && viewer.zoomBy(1 / 1.5));
  $('fit').addEventListener('click', () => viewer && viewer.fit());
  for (const k of ['iliad', 'scholia', 'other']) $(`show-${k}`).addEventListener('change', applyLayers);

  window.addEventListener('hashchange', () => {
    if (ownHash === location.hash) { ownHash = null; return; }
    ownHash = null;
    if (books.length) route();
  });
  document.addEventListener('keydown', e => {
    if (current < 0 || e.target.closest('input, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '[' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
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

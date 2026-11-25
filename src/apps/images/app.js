// Browser UI for the images app: choose an image collection of the release,
// browse all its thumbnails at once (a light box with a Find box and a size slider), and open any image in a
// pannable, zoomable viewer.  Uses the shared sources inlined ahead of this
// file (see index.html).
//
// Address (no `#`): `?image=<collection URN>` is the light box of a collection,
// `?image=<image URN>` an image (`?image=<image URN>@x,y,w,h` also marks that region of it; Shift-drag marks others); `?page=<page URN>` or `?text=<passage URN>` are turned into an image through the
// DSE records and the catalog, and the address is rewritten as `?image=…`; so links, bookmarks and the Back button work.
(function () {
  const $ = id => document.getElementById(id);
  const proto = location.protocol;
  const THUMB_W = 240;

  /** @type {ImageCollection[]} */ let collections = [];
  /** @type {ImageCollection | null} */ let coll = null;
  /** @type {any} */ let locator = null;
  /** @type {ImageCollection | null} */ let gridOf = null;   // the collection whose thumbnails are in the grid
  let current = -1;           // index of the open image in `coll.items`, or -1
  let currentRoi = '';        // the region highlighted in the open image, as written in the address, or ""
  let tableScroll = 0;
  /** @type {any} */ let viewer = null;
  /** @type {any} */ let roiUi = null;   // regions of interest drawn on the open image
  /** @type {Map<string, Promise<{width: number, height: number}>>} */ const sizes = new Map();
  let openToken = 0;
  let renderToken = 0;       // identifies the latest grid, so late thumbnail events can be ignored

  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  const urlFor = (service, region, size) => matchProtocol(iiifImageUrl(service, region, size), proto);

  function setStatus(msg) { $('status').textContent = msg; }

  // --- loading ---------------------------------------------------------------

  function start(rel) {
    collections = imageCollections(rel);
    locator = createLocator(rel);
    coll = null; current = -1;
    const sel = $('collection');
    sel.textContent = '';
    const first = document.createElement('option');
    first.value = ''; first.textContent = 'Choose a collection…';
    sel.appendChild(first);
    for (const c of collections) {
      const o = document.createElement('option');
      o.value = c.urn;
      o.textContent = `${c.label} (${plural(c.items.length, 'image', 'images')})`;
      o.disabled = c.items.length === 0;
      sel.appendChild(o);
    }
    sel.disabled = collections.length === 0;
    const total = collections.reduce((n, c) => n + c.items.length, 0);
    setStatus(collections.length
      ? `${rel.library.name}: ${plural(collections.length, 'image collection', 'image collections')}, ${plural(total, 'image', 'images')}`
      : `${rel.library.name}: no image collections found`);
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

  // --- navigation (address of the page) --------------------------------------------

  /** Go to a collection page or an image: update the address and show it at once. */
  function go(where, replace) {
    setQuery(imageParams(where), replace);
    route();
  }

  function route() {
    const r = resolveImage(locator, readParams(location.search));
    if (r && 'error' in r) { selectCollection(null); showTable(r.error); return; }
    const roiText = r && 'roi' in r && r.roi ? r.roiText : '';   // an unusable region is dropped
    if (r && !isCollectionUrn(r.image) && decodeURIComponent(location.search) !== `?image=${r.image}${roiText ? '@' + roiText : ''}`) setQuery({ image: r.image + (roiText ? '@' + roiText : '') }, true);   // the canonical address
    const h = r ? { urn: r.image } : null;
    if (!h) { selectCollection(null); showTable(); return; }
    const cu = collectionOfObject(h.urn);
    const c = collections.find(x => x.urn === cu);
    if (!c) { selectCollection(null); showTable(`${h.urn} is not an image collection or image in this release.`); return; }
    if (isCollectionUrn(h.urn)) { selectCollection(c); showTable(); return; }
    const idx = c.items.findIndex(i => i.urn === h.urn);
    if (idx < 0) { selectCollection(c); showTable(`${h.urn} is not in this release.`); return; }
    selectCollection(c);
    showViewer(idx, r && 'roi' in r ? r.roi : null, roiText);
  }

  function selectCollection(c) {
    if (c !== coll) { coll = c; gridOf = null; $('grid').textContent = ''; $('find').value = ''; }
    $('collection').value = c ? c.urn : '';
  }

  // --- light box ----------------------------------------------------------------

  /** @param {string} [message]  Shown instead of the grid when no collection is chosen, or as a note above it. */
  function showTable(message) {
    openToken++;
    if (viewer) viewer.close();
    if (roiUi) roiUi.close();
    current = -1;
    $('viewer-view').hidden = true;
    $('table-view').hidden = false;
    renderGrid(message);
    $('table-view').scrollTop = tableScroll;
    document.title = coll ? `${coll.label} – Images` : 'Images';
  }

  /** Every thumbnail of the collection (the browser loads them as they scroll into view). */
  function renderGrid(message) {
    const grid = $('grid');
    $('note').hidden = !message || !coll;
    $('note').textContent = message || '';
    if (!coll) {
      grid.textContent = '';
      gridOf = null;
      $('intro').hidden = false;
      $('intro').textContent = message || (collections.length ? 'Choose a collection of images.' : '');
      $('shown').textContent = '';
      for (const id of ['find', 'cell-size']) $(id).disabled = true;
      return;
    }
    $('intro').hidden = true;
    for (const id of ['find', 'cell-size']) $(id).disabled = false;
    if (gridOf !== coll) {
      gridOf = coll;
      grid.textContent = '';
      const frag = document.createDocumentFragment();
      let loaded = 0, failed = 0;
      const mine = ++renderToken;
      const check = () => {
        if (mine !== renderToken || loaded > 0 || failed < 6) return;   // the first thumbnails all failed
        $('note').textContent = 'None of the thumbnails loaded. The image server may be unreachable, or this collection may not be served where this app expects it.';
        $('note').hidden = false;
      };
      coll.items.forEach((item, k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cell'; b.dataset.index = String(k);
        b.title = item.caption || item.id;
        const thumb = document.createElement('span');
        thumb.className = 'thumb';
        const img = document.createElement('img');
        img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
        const service = imageService(item.urn);
        img.onload = () => {
          loaded++;
          if (img.naturalWidth && img.naturalHeight) thumb.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        };
        img.onerror = () => { failed++; thumb.classList.add('missing'); check(); };
        if (service) img.src = urlFor(service, 'full', `${THUMB_W},`); else { thumb.classList.add('missing'); failed++; check(); }
        thumb.appendChild(img);
        const lbl = document.createElement('span');
        lbl.className = 'lbl'; lbl.textContent = item.label;
        b.append(thumb, lbl);
        frag.appendChild(b);
      });
      grid.appendChild(frag);
    }
    applyFilter();
  }

  /** Show the thumbnails whose captions match the Find box. */
  function applyFilter() {
    if (!coll) return;
    const q = $('find').value;
    const cells = $('grid').children;
    let shown = 0;
    coll.items.forEach((item, k) => {
      const ok = imageMatches(item, q);
      cells[k].hidden = !ok;
      if (ok) shown++;
    });
    $('shown').textContent = shown === coll.items.length
      ? plural(coll.items.length, 'image', 'images')
      : `${shown.toLocaleString('en')} of ${plural(coll.items.length, 'image', 'images')} shown`;
    $('empty').hidden = shown > 0;
  }

  // --- viewer --------------------------------------------------------------------

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

  /**
   * Open an image, highlighting a region of it if one is given.
   * @param {number} idx  Index in `coll.items`.
   * @param {{x: number, y: number, w: number, h: number} | null} [roi]  Fractions of the image size.
   * @param {string} [roiText]  The region as written in the address.
   */
  async function showViewer(idx, roi = null, roiText = '') {
    if (idx === current && roiText === currentRoi && !$('viewer-view').hidden) return;
    currentRoi = roiText;
    if (current < 0) tableScroll = $('table-view').scrollTop;
    current = idx;
    const item = coll.items[idx];
    const token = ++openToken;
    $('table-view').hidden = true;
    $('viewer-view').hidden = false;
    if (!viewer) {
      viewer = new IiifViewer($('viewer'));
      roiUi = new RoiUi(viewer, { button: $('roi-select'), panel: $('roi-panel') });
    }
    viewer.close();
    roiUi.close();
    $('viewer-title').textContent = item.label;
    $('viewer-count').textContent = `${idx + 1} of ${coll.items.length}`;
    $('viewer-note').textContent = (item.caption || item.id) + (roi ? ` · highlighted region @${roiText}` : '');
    $('rights').textContent = item.rights || 'No rights statement in the release.';
    $('viewer-error').hidden = true;
    $('prev').disabled = idx === 0;
    $('next').disabled = idx === coll.items.length - 1;
    document.title = `${item.label} – ${coll.label} – Images`;

    const service = imageService(item.urn);
    try {
      if (!service) throw new Error(`cannot work out where ${item.urn} is served`);
      const { width, height } = await imageSize(service);
      if (token !== openToken) return;
      viewer.open({
        width, height,
        urlFor: (region, size) => urlFor(service, region, size),
        placeholders: [urlFor(service, 'full', `${THUMB_W},`)],
      });
      roiUi.open(item.urn, roi ? [roi] : []);
      if (roi) zoomToRegion(roi, width, height);
      viewer.root.focus({ preventScroll: true });
    } catch (e) {
      if (token !== openToken) return;
      $('viewer-error').textContent = `Could not load this image (${e.message || e}).`;
      $('viewer-error').hidden = false;
    }
  }

  /** Bring a region of the open image into view: zoomed to it, but never past full resolution. */
  function zoomToRegion(roi, width, height) {
    const r = roiToRect(roi, width, height);
    const { w: vw, h: vh } = viewer.size;
    if (!vw || !vh) return;
    const sc = Math.max(viewer.minScale, Math.min(0.5 * vw / r.w, 0.5 * vh / r.h, 1));
    viewer.set({ sc, tx: vw / 2 - (r.x + r.w / 2) * sc, ty: vh / 2 - (r.y + r.h / 2) * sc });
  }

  function step(delta) {
    if (current < 0) return;
    const n = current + delta;
    if (n >= 0 && n < coll.items.length) go({ urn: coll.items[n].urn }, true);
  }

  function backToGrid() {
    go({ urn: coll.urn }, false);
  }

  // --- wiring ---------------------------------------------------------------------

  $('collection').addEventListener('change', e => {
    tableScroll = 0;
    const urn = e.target.value;
    if (urn) go({ urn }, false); else { setQuery({}, false); route(); }
  });
  $('find').addEventListener('input', applyFilter);
  $('cell-size').addEventListener('input', e => { $('grid').style.setProperty('--cell-w', e.target.value + 'px'); });
  $('grid').addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (cell) go({ urn: coll.items[Number(cell.dataset.index)].urn }, false);
  });

  $('back').addEventListener('click', backToGrid);
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('zoom-in').addEventListener('click', () => viewer && viewer.zoomBy(1.5));
  $('zoom-out').addEventListener('click', () => viewer && viewer.zoomBy(1 / 1.5));
  $('fit').addEventListener('click', () => viewer && viewer.fit());
  $('rights-toggle').addEventListener('click', () => {
    const open = $('rights').hidden;
    $('rights').hidden = !open;
    $('rights-toggle').setAttribute('aria-expanded', String(open));
  });

  window.addEventListener('popstate', () => { if (collections.length) route(); });   // Back, Forward
  document.addEventListener('keydown', e => {
    if ($('viewer-view').hidden || e.target.closest('input, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') backToGrid();
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

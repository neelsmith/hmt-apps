// Browser UI for the images app: choose an image collection of the release,
// browse it as pages of thumbnails (a light box), and open any image in a
// pannable, zoomable viewer.  Uses the shared sources inlined ahead of this
// file (see index.html).
//
// Address (no `#`): `?image=<collection URN>[&n=N]` is page N of the thumbnails of a collection,
// `?image=<image URN>` an image; `?page=<page URN>` or `?text=<passage URN>` are turned into an image through the
// DSE records and the catalog, and the address is rewritten as `?image=…`; so links, bookmarks and the Back button work.
(function () {
  const $ = id => document.getElementById(id);
  const proto = location.protocol;
  const THUMB_W = 240;

  /** @type {ImageCollection[]} */ let collections = [];
  /** @type {ImageCollection | null} */ let coll = null;
  /** @type {any} */ let locator = null;
  let pageSize = 24;
  let page = 1;
  let current = -1;           // index of the open image in `coll.items`, or -1
  let tableScroll = 0;
  /** @type {any} */ let viewer = null;
  /** @type {Map<string, Promise<{width: number, height: number}>>} */ const sizes = new Map();
  let openToken = 0;
  let renderToken = 0;       // identifies the latest light-box page, so late thumbnail events can be ignored

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
    if (r && 'error' in r) { selectCollection(null, 1); showTable(r.error); return; }
    if (r && !isCollectionUrn(r.image) && decodeURIComponent(location.search) !== `?image=${r.image}`) setQuery({ image: r.image }, true);   // the canonical address
    const h = r ? { urn: r.image, page: parseImageQuery(location.search)?.page ?? 1 } : null;
    if (!h) { selectCollection(null, 1); showTable(); return; }
    const cu = collectionOfObject(h.urn);
    const c = collections.find(x => x.urn === cu);
    if (!c) { selectCollection(null, 1); showTable(`${h.urn} is not an image collection or image in this release.`); return; }
    if (isCollectionUrn(h.urn)) { selectCollection(c, h.page); showTable(); return; }
    const idx = c.items.findIndex(i => i.urn === h.urn);
    if (idx < 0) { selectCollection(c, 1); showTable(`${h.urn} is not in this release.`); return; }
    const imagePage = Math.floor(idx / pageSize) + 1;
    if (imagePage !== page) tableScroll = 0;      // the light box will show another page
    selectCollection(c, imagePage);
    showViewer(idx);
  }

  function selectCollection(c, p) {
    if (c !== coll) { coll = c; $('grid').textContent = ''; }
    page = p;
    $('collection').value = c ? c.urn : '';
  }

  // --- light box ----------------------------------------------------------------

  /** @param {string} [message]  Shown instead of the grid when no collection is chosen, or as a note above it. */
  function showTable(message) {
    openToken++;
    if (viewer) viewer.close();
    current = -1;
    $('viewer-view').hidden = true;
    $('table-view').hidden = false;
    renderPage(message);
    $('table-view').scrollTop = tableScroll;
    document.title = coll ? `${coll.label} – Images` : 'Images';
  }

  function renderPage(message) {
    const grid = $('grid');
    $('note').hidden = !message || !!coll === false;
    $('note').textContent = message || '';
    grid.textContent = '';
    if (!coll) {
      $('intro').hidden = false;
      $('intro').textContent = message || (collections.length ? 'Choose a collection of images.' : '');
      for (const id of ['pager-top', 'pager-bottom']) $(id).hidden = true;
      $('shown').textContent = '';
      return;
    }
    $('intro').hidden = true;
    const pg = paginate(coll.items.length, pageSize, page);
    page = pg.page;
    const items = coll.items.slice(pg.start, pg.end);
    const frag = document.createDocumentFragment();
    let loaded = 0, failed = 0;
    const mine = ++renderToken;
    const checkAll = () => {
      if (mine !== renderToken) return;            // the user has moved on to another page
      if (loaded + failed === items.length && loaded === 0 && failed > 0) {
        $('note').textContent = 'None of the thumbnails on this page loaded. The image server may be unreachable, or this collection may not be served where this app expects it.';
        $('note').hidden = false;
      }
    };
    items.forEach((item, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cell'; b.dataset.index = String(pg.start + k);
      b.title = item.caption || item.id;
      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      const img = document.createElement('img');
      img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
      const service = imageService(item.urn);
      img.onload = () => { loaded++; checkAll(); };
      img.onerror = () => { failed++; thumb.classList.add('missing'); checkAll(); };
      if (service) img.src = urlFor(service, 'full', `${THUMB_W},`); else { thumb.classList.add('missing'); failed++; }
      thumb.appendChild(img);
      const lbl = document.createElement('span');
      lbl.className = 'lbl'; lbl.textContent = item.label;
      b.append(thumb, lbl);
      frag.appendChild(b);
    });
    grid.appendChild(frag);
    $('shown').textContent = `${pg.start + 1}–${pg.end} of ${plural(coll.items.length, 'image', 'images')}`;
    renderPager($('pager-top'), pg);
    renderPager($('pager-bottom'), pg);
  }

  function renderPager(el, pg) {
    el.hidden = pg.pages <= 1;
    el.textContent = '';
    const mk = (act, label, title, disabled) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.dataset.act = act;
      b.textContent = label; b.title = title; b.setAttribute('aria-label', title); b.disabled = disabled;
      return b;
    };
    const num = document.createElement('input');
    num.type = 'number'; num.min = '1'; num.max = String(pg.pages); num.value = String(pg.page);
    num.setAttribute('aria-label', 'Page number'); num.dataset.act = 'goto';
    const of = document.createElement('span');
    of.textContent = `of ${pg.pages}`;
    el.append(
      mk('first', '«', 'First page', pg.page === 1), mk('prev', '‹', 'Previous page', pg.page === 1),
      num, of,
      mk('next', '›', 'Next page', pg.page === pg.pages), mk('last', '»', 'Last page', pg.page === pg.pages));
  }

  function changePage(p) {
    if (!coll) return;
    tableScroll = 0;
    go({ urn: coll.urn, page: paginate(coll.items.length, pageSize, p).page }, true);
    $('table-view').scrollTop = 0;
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

  async function showViewer(idx) {
    if (idx === current && !$('viewer-view').hidden) return;
    if (current < 0) tableScroll = $('table-view').scrollTop;
    current = idx;
    const item = coll.items[idx];
    const token = ++openToken;
    $('table-view').hidden = true;
    $('viewer-view').hidden = false;
    if (!viewer) viewer = new IiifViewer($('viewer'));
    viewer.close();
    $('viewer-title').textContent = item.label;
    $('viewer-count').textContent = `${idx + 1} of ${coll.items.length}`;
    $('viewer-note').textContent = item.caption || item.id;
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
      viewer.root.focus({ preventScroll: true });
    } catch (e) {
      if (token !== openToken) return;
      $('viewer-error').textContent = `Could not load this image (${e.message || e}).`;
      $('viewer-error').hidden = false;
    }
  }

  function step(delta) {
    if (current < 0) return;
    const n = current + delta;
    if (n >= 0 && n < coll.items.length) go({ urn: coll.items[n].urn }, true);
  }

  function backToGrid() {
    go({ urn: coll.urn, page: Math.floor(current / pageSize) + 1 }, false);
  }

  // --- wiring ---------------------------------------------------------------------

  $('collection').addEventListener('change', e => {
    tableScroll = 0;
    const urn = e.target.value;
    if (urn) go({ urn, page: 1 }, false); else { setQuery({}, false); route(); }
  });
  $('page-size').addEventListener('change', e => {
    const first = coll ? (page - 1) * pageSize : 0;       // keep the first image on the page in view
    pageSize = parseInt(e.target.value, 10);
    if (coll) changePage(Math.floor(first / pageSize) + 1);
  });
  $('grid').addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (cell) go({ urn: coll.items[Number(cell.dataset.index)].urn }, false);
  });
  for (const id of ['pager-top', 'pager-bottom']) {
    $(id).addEventListener('click', e => {
      const act = e.target.closest('button') && e.target.closest('button').dataset.act;
      if (!act || !coll) return;
      const pages = paginate(coll.items.length, pageSize, 1).pages;
      changePage({ first: 1, prev: page - 1, next: page + 1, last: pages }[act]);
    });
    $(id).addEventListener('change', e => {
      if (e.target.dataset.act === 'goto') changePage(parseInt(e.target.value, 10));
    });
  }

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

// Browser UI for the DSE check light table: choose a codex, see all its pages as thumbnails, each with a badge with
// the number of DSE inconsistencies on the page, or a check mark if there are none (see src/page-problems.js).
// Choosing a page opens it in the codices app.  Uses the shared sources inlined ahead of this file (see index.html).
//
// Address: `?codex=<codex URN>` opens the light table of a codex.
(function () {
  const $ = id => document.getElementById(id);
  const proto = location.protocol;
  const THUMB_W = 240;
  const CODICES_APP = 'https://neelsmith.github.io/hmt-apps/codices.html';

  /** @type {CodexProblems[]} */ let list = [];
  /** @type {CodexProblems | null} */ let book = null;
  /** @type {Set<string>} */ let catalogImages = new Set();
  /** @type {Map<string, PageRegion[]>} */ let bySurface = new Map();
  let gridOf = null;
  let renderToken = 0;

  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  const urlFor = (service, region, size) => matchProtocol(iiifImageUrl(service, region, size), proto);
  const setStatus = msg => { $('status').textContent = msg; };

  function start(rel) {
    list = pageProblems(rel);
    bySurface = indexRegionsBySurface(rel).bySurface;
    catalogImages = new Set(imageCollections(rel).flatMap(c => c.items.map(i => i.urn)));
    book = null; gridOf = null; $('grid').textContent = '';
    const sel = $('codex');
    sel.textContent = '';
    sel.appendChild(new Option('Choose a codex…', ''));
    for (const c of list) {
      sel.appendChild(new Option(`${c.label} (${plural(c.pages.length, 'page', 'pages')}, ${c.total ? `${plural(c.total, 'inconsistency', 'inconsistencies')} on ${plural(c.pagesWithProblems, 'page', 'pages')}` : 'no inconsistencies'})`, c.urn));
    }
    sel.disabled = list.length === 0;
    const total = list.reduce((s, c) => s + c.total, 0);
    setStatus(list.length ? `${rel.library.name}: ${plural(list.length, 'codex', 'codices')}, ${plural(total, 'inconsistency', 'inconsistencies')} on their pages` : `${rel.library.name}: no codices found`);
    $('drop').hidden = true;
    const want = new URLSearchParams(location.search).get('codex');
    selectBook(list.find(c => c.urn === want) ?? null);
    renderGrid();
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

  function selectBook(c) {
    if (c !== book) { book = c; gridOf = null; $('grid').textContent = ''; $('find').value = ''; $('only-bad').checked = false; }
    $('codex').value = c ? c.urn : '';
    document.title = c ? `${c.label} – DSE check, light table` : 'DSE check, light table';
  }

  /** Words for the tooltip of a page. @param {PageProblems} pr */
  function describe(pr) {
    if (!pr.total) return pr.records ? `${plural(pr.records, 'DSE record', 'DSE records')}; no inconsistencies` : 'no DSE records (no indexed text); no inconsistencies';
    const bits = [];
    if (pr.badRecords) bits.push(`${plural(pr.badRecords, 'DSE record', 'DSE records')} naming a text not in the release`);
    if (pr.missingScholia) bits.push(`${plural(pr.missingScholia, 'scholion', 'scholia')} without a DSE record`);
    return `${plural(pr.total, 'inconsistency', 'inconsistencies')}: ${bits.join('; ')}`;
  }

  function renderGrid(message) {
    const grid = $('grid');
    $('note').hidden = !message;
    $('note').textContent = message || '';
    const controls = ['find', 'only-bad', 'cell-size'];
    if (!book) {
      grid.textContent = '';
      gridOf = null;
      $('intro').hidden = false;
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
        if (mine !== renderToken || loaded > 0 || failed < 6) return;
        $('note').textContent = 'None of the thumbnails loaded. The image server may be unreachable, or these pages may not be served where this app expects them.';
        $('note').hidden = false;
      };
      book.pages.forEach(page => {
        const pr = /** @type {PageProblems} */ (book.byPage.get(page.urn));
        const view = pageView(page, bySurface.get(page.urn) ?? [], catalogImages);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cell'; b.dataset.n = String(pr.total);
        b.title = `${page.label || page.id} — ${describe(pr)}`;
        b.setAttribute('aria-label', b.title);
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
        const badge = document.createElement('span');
        const clean = !pr.total && pr.records > 0;   // edited text, nothing wrong; a page without text just shows 0
        badge.className = `badge ${pr.total ? 'bad' : clean ? 'ok' : 'none'}`;
        badge.textContent = clean ? '✓' : String(pr.total);
        b.append(thumb, lbl, badge);
        b.addEventListener('click', () => window.open(CODICES_APP + formatPageQuery(page.urn), '_blank', 'noopener'));
        frag.appendChild(b);
      });
      grid.appendChild(frag);
    }
    applyFilter();
  }

  function applyFilter() {
    if (!book) return;
    const q = $('find').value.trim().toLowerCase();
    const only = $('only-bad').checked;
    const cells = $('grid').children;
    let shown = 0;
    book.pages.forEach((p, k) => {
      const ok = (!q || `${p.short} ${p.label} ${p.id}`.toLowerCase().includes(q)) && (!only || cells[k].dataset.n !== '0');
      cells[k].hidden = !ok;
      if (ok) shown++;
    });
    const n = book.pages.length;
    $('shown').textContent = shown === n
      ? `${plural(n, 'page', 'pages')}, ${plural(book.pagesWithProblems, 'page', 'pages')} with inconsistencies`
      : `${shown.toLocaleString('en')} of ${plural(n, 'page', 'pages')} shown`;
    $('empty').hidden = shown > 0;
  }

  $('codex').addEventListener('change', () => {
    const c = list.find(x => x.urn === $('codex').value) ?? null;
    selectBook(c);
    const u = new URL(location.href);
    if (c) u.searchParams.set('codex', c.urn); else u.searchParams.delete('codex');
    history.replaceState(null, '', u.pathname + u.search.replace(/%3A/gi, ':'));
    renderGrid();
  });
  $('find').addEventListener('input', applyFilter);
  $('only-bad').addEventListener('change', applyFilter);
  $('cell-size').addEventListener('input', () => $('grid').style.setProperty('--cell-w', `${$('cell-size').value}px`));
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

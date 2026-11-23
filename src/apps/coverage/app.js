// Browser UI for the coverage summary: three bar charts of how much the HMT has edited.
// Uses the shared sources inlined ahead of this file (see index.html).
(function () {
  const $ = id => document.getElementById(id);
  const n = x => x.toLocaleString('en');
  const plural = (x, one, many) => `${n(x)} ${x === 1 ? one : many}`;

  /** @type {{lines: IliadCoverage[], pages: ReturnType<typeof dsePagesByCodex>} | null} */
  let data = null;

  function setStatus(msg) { $('status').textContent = msg; }

  /** Draw a chart with its optional legend and data table. */
  function chart(plotId, tableId, legendId, spec, firstHeader) {
    const plot = $(plotId);
    drawBars(plot, spec);
    if (legendId) drawLegend($(legendId), spec.series);
    const t = $(tableId);
    t.textContent = '';
    t.appendChild(chartTable(spec, firstHeader));
  }

  /** Draw all three charts from `data`. */
  function draw() {
    if (!data) return;
    const { lines, pages } = data;

    const shown = lines.filter(l => l.total > 0);
    const books = Array.from({ length: BOOKS }, (_, i) => String(i + 1));
    $('d-lines').textContent = shown.length
      ? `Manuscripts with edited lines: ${shown.map(l => `${l.short} (${n(l.total)})`).join(', ')}.`
      : 'No manuscript has edited lines in this release.';
    chart('p-lines', 't-lines', 'l-lines', {
      categories: books,
      series: shown.map(l => ({
        name: l.short, values: l.byBook,
        tips: l.byBook.map((v, i) => `${l.short}, book ${i + 1}: ${plural(v, 'line', 'lines')}`),
      })),
      yTitle: 'Edited lines',
      description: `Bar chart of edited lines of the Iliad in books 1 to 24 for ${shown.map(l => l.short).join(', ')}.`,
    }, 'Book');

    const cs = pages.codices.filter(c => c.pages > 0);
    const names = cs.map(c => c.label);
    chart('p-pages', 't-pages', '', {
      categories: names, wrap: true,
      series: [{ name: 'Pages with DSE records', values: cs.map(c => c.pages), color: 'var(--s0)',
        tips: cs.map(c => `${c.label}: ${plural(c.pages, 'page', 'pages')} with DSE records`) }],
      yTitle: 'Pages',
      description: 'Bar chart of the number of pages with DSE records in each manuscript.',
    }, 'Manuscript');
    chart('p-pct', 't-pct', '', {
      categories: names, wrap: true, percent: true,
      format: v => `${Number.isInteger(v) ? v : v.toFixed(1)}%`,
      series: [{ name: 'Pages with DSE records (%)', values: cs.map(c => c.percent), color: 'var(--s1)',
        tips: cs.map(c => `${c.label}: ${n(c.pages)} of ${n(c.total)} pages (${c.percent}%)`) }],
      yTitle: 'Percent of pages',
      description: 'Bar chart of the percentage of the pages of each codex that have DSE records.',
    }, 'Manuscript');
  }

  /** Warnings about the data, shown above the charts. */
  function warnings(d) {
    const w = [];
    if (!d.pages.found) w.push('This release has no DSE records.');
    if (d.pages.skipped) w.push(`${plural(d.pages.skipped, 'DSE record was', 'DSE records were')} skipped because of a missing or malformed passage, region or surface.`);
    for (const c of d.pages.codices) {
      if (c.unlisted.length) w.push(`${c.label}: ${plural(c.unlisted.length, 'page', 'pages')} named in DSE records ${c.unlisted.length === 1 ? 'is' : 'are'} not in the codex’s list of pages (${c.unlisted.slice(0, 3).map(u => u.split(':').pop()).join(', ')}${c.unlisted.length > 3 ? ', …' : ''}).`);
    }
    if (d.pages.elsewhere.length) w.push(`${plural(d.pages.elsewhere.length, 'surface', 'surfaces')} named in DSE records belong to no codex of the release.`);
    for (const l of d.lines) if (l.other) w.push(`${l.short}: ${plural(l.other, 'passage', 'passages')} not counted (not a numbered line of books 1–24 or a title).`);
    const box = $('warnings');
    box.textContent = '';
    box.hidden = !w.length;
    if (w.length) {
      const h = document.createElement('strong');
      h.textContent = 'Warnings';
      const ul = document.createElement('ul');
      for (const t of w) { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }
      box.append(h, ul);
    }
  }

  function start(rel) {
    data = { lines: iliadLinesByBook(rel, buildTextIndex(rel)), pages: dsePagesByCodex(rel) };
    $('drop').hidden = true;
    $('report').hidden = false;
    warnings(data);
    draw();
    const edited = data.pages.codices.reduce((s, c) => s + c.pages, 0);
    setStatus(`${rel.library.name}: ${plural(data.lines.reduce((s, l) => s + l.total, 0), 'edited line', 'edited lines')}, ${plural(edited, 'page', 'pages')} with DSE records`);
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

  $('file').addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
  window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  window.addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(draw, 150); });

  (async function init() {
    try { start(await fetchRelease()); }
    catch (e) { showProblem(`Could not load the HMT release (${e.message || e}). If you are offline, load a copy of the release from your computer.`); }
  })();
})();

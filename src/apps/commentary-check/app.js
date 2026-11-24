// Browser UI for the commentary check: gaps in the index of scholia to Iliad passages, by list and by
// bar chart, and scholia indexed to an Iliad passage on another page.  Uses the shared sources
// inlined ahead of this file (see index.html).
(function () {
  const $ = id => document.getElementById(id);
  const LIMIT = 200;   // items rendered at once in a long list
  const n = x => x.toLocaleString('en');
  const plural = (x, one, many) => `${n(x)} ${x === 1 ? one : many}`;

  /** @type {CommentaryCheck | null} */ let check = null;

  /** @param {string} tag @param {string} [cls] @param {string} [text] */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function setStatus(msg) { $('status').textContent = msg; }

  /** Append `items` to `parent` in steps of LIMIT, with a "show more" button. */
  function renderLimited(parent, items, make) {
    let shown = 0;
    const more = el('button', 'btn more');
    const step = () => {
      for (const it of items.slice(shown, shown + LIMIT)) parent.appendChild(make(it));
      shown = Math.min(items.length, shown + LIMIT);
      more.hidden = shown >= items.length;
      more.textContent = `Show more (${n(items.length - shown)} left)`;
    };
    more.addEventListener('click', step);
    parent.after(more);
    step();
  }

  /** Findings grouped by group of scholia, in the order of the summary. */
  function byGroup(findings) {
    /** @type {Map<string, Finding[]>} */
    const m = new Map();
    for (const g of check.groups) m.set(g.urn, []);
    for (const f of findings) (m.get(f.group) ?? m.set(f.group, []).get(f.group)).push(f);
    return [...m].filter(([, list]) => list.length);
  }

  /** A folding entry per group of scholia, built when first opened. */
  function groupList(box, findings, build) {
    box.textContent = '';
    for (const [urn, list] of byGroup(findings)) {
      const d = el('details', 'entry');
      const sum = el('summary', '', `${list[0].groupLabel} `);
      sum.appendChild(el('span', 'n', plural(list.length, 'scholion', 'scholia')));
      d.appendChild(sum);
      let built = false;
      d.addEventListener('toggle', () => {
        if (!d.open || built) return;
        built = true;
        build(d, list);
      });
      box.appendChild(d);
    }
  }

  function chips(d, list, text) {
    const c = el('div', 'chips');
    d.appendChild(c);
    renderLimited(c, list, f => el('span', 'chip', text(f)));
  }

  /** Table of findings, built in steps. */
  function findingTable(d, list, headers, cells) {
    const wrap = el('div', 'tablewrap');
    const t = el('table');
    const head = el('tr');
    headers.forEach((h, i) => { const th = el('th', i < 1 ? 'l' : '', h); head.appendChild(th); });
    t.appendChild(head);
    wrap.appendChild(t);
    d.appendChild(wrap);
    renderLimited(t, list, f => {
      const tr = el('tr');
      cells(f).forEach((c, i) => tr.appendChild(el('td', i < 1 ? 'l mono' : 'mono', c)));
      return tr;
    });
  }

  /** Set the description of a section. */
  function section(id, findings, none, some) {
    $(`d-${id}`).textContent = findings.length ? some : none;
  }

  function chartOf(id, findings, what) {
    const rows = countByBook(findings);
    const plot = $(`p-${id}`), legend = $(`l-${id}`);
    plot.textContent = ''; legend.textContent = '';
    if (!rows.length) return;
    const books = Array.from({ length: BOOKS }, (_, i) => String(i + 1));
    const spec = {
      categories: books,
      series: rows.map(r => ({
        name: r.manuscript, values: r.byBook,
        tips: r.byBook.map((v, i) => `${r.manuscript}, book ${i + 1}: ${plural(v, what[0], what[1])}`),
      })),
      yTitle: what[2],
      description: `Bar chart of ${what[1]} by book of the Iliad for ${rows.map(r => r.manuscript).join(', ')}.`,
    };
    drawBars(plot, spec);
    drawLegend(legend, spec.series);
  }

  function render(c) {
    check = c;
    // summary table
    const t = $('summary');
    t.textContent = '';
    const head = el('tr');
    ['Group of scholia', 'Manuscript', 'In editions', 'In index', 'Not indexed', 'Not in editions'].forEach((h, i) => head.appendChild(el('th', i < 2 ? 'l' : '', h)));
    t.appendChild(head);
    for (const g of c.groups) {
      const tr = el('tr');
      tr.appendChild(el('td', 'l', g.label));
      tr.appendChild(el('td', 'l', g.manuscript));
      tr.appendChild(el('td', '', n(g.editions)));
      tr.appendChild(el('td', '', n(g.indexed)));
      tr.appendChild(el('td', g.unindexed ? 'bad' : '', n(g.unindexed)));
      tr.appendChild(el('td', g.missing ? 'bad' : '', n(g.missing)));
      t.appendChild(tr);
    }

    // 1. in editions, not indexed
    section('un', c.unindexed, 'Every scholion in the editions has an entry in the index.',
      `${plural(c.unindexed.length, 'scholion', 'scholia')} in the editions ${c.unindexed.length === 1 ? 'has' : 'have'} no entry in the index that names an Iliad passage.`);
    chartOf('un', c.unindexed, ['scholion', 'scholia', 'Scholia not indexed']);
    groupList($('list-un'), c.unindexed, (d, list) => chips(d, list, f => f.ref));

    // 2. indexed, not in editions
    section('mi', c.missing, 'Every scholion named by the index is in the editions.',
      `${plural(c.missing.length, 'scholion', 'scholia')} named by the index ${c.missing.length === 1 ? 'is' : 'are'} not in the editions.`);
    chartOf('mi', c.missing, ['scholion', 'scholia', 'Scholia not in editions']);
    groupList($('list-mi'), c.missing, (d, list) => chips(d, list, f => `${f.ref} → ${f.target}`));

    // 3. other page
    const p = c.pages;
    const unchecked = p.noScholionPage + p.noIliadPage + p.otherManuscript;
    $('d-off').textContent = `${plural(c.offPage.length, 'index entry', 'index entries')} of ${n(p.checked)} compared. `
      + `Not compared: ${n(p.noScholionPage)} without a DSE record for the scholion, ${n(p.noIliadPage)} without one for the Iliad passage`
      + (p.otherManuscript ? `, ${n(p.otherManuscript)} naming another manuscript’s Iliad` : '') + '.';
    groupList($('list-off'), c.offPage, (d, list) => findingTable(d, list,
      ['Scholion', 'Iliad', 'Scholion page', 'Iliad page'], f => [f.ref, f.target, f.scholionPages.join(', '), f.iliadPages.join(', ')]));

    // 4. unresolved
    $('d-bad').textContent = c.unresolved.length
      ? `${plural(c.unresolved.length, 'index entry', 'index entries')} could not be compared by page, and are listed here.`
      : 'Every Iliad passage named by the index was found.';
    groupList($('list-bad'), c.unresolved, (d, list) => findingTable(d, list, ['Scholion', 'Iliad', 'Problem'], f => [f.ref, f.target ?? '', f.problem ?? '']));
    for (const [id, list] of [['un', c.unindexed], ['mi', c.missing], ['off', c.offPage], ['bad', c.unresolved]]) {
      const h = $(`c-${id}`).querySelector('h2');
      h.querySelector('.badge')?.remove();
      const b = el('span', list.length ? 'badge' : 'badge ok', list.length ? plural(list.length, 'finding', 'findings') : 'none');
      b.style.marginLeft = '.6rem';
      h.appendChild(b);
    }
  }

  function start(rel) {
    const c = checkCommentary(rel, buildTextIndex(rel));
    $('drop').hidden = true;
    $('report').hidden = false;
    render(c);
    const total = c.unindexed.length + c.missing.length + c.offPage.length + c.unresolved.length;
    setStatus(c.found
      ? `${rel.library.name}: ${total ? plural(total, 'finding', 'findings') : 'no findings'} in ${plural(c.relations, 'index entry', 'index entries')}`
      : `${rel.library.name}: no commentary index in this release`);
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

  $('csv').addEventListener('click', () => {
    if (!check) return;
    const url = URL.createObjectURL(new Blob([commentaryCsv(check)], { type: 'text/csv;charset=utf-8' }));
    const a = el('a');
    a.href = url; a.download = 'commentary-check.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('file').addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
  window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  window.addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (check) { chartOf('un', check.unindexed, ['scholion', 'scholia', 'Scholia not indexed']); chartOf('mi', check.missing, ['scholion', 'scholia', 'Scholia not in editions']); } }, 150); });

  (async function init() {
    try { start(await fetchRelease()); }
    catch (e) { showProblem(`Could not load the HMT release (${e.message || e}). If you are offline, load a copy of the release from your computer.`); }
  })();
})();

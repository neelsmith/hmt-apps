// Browser UI for the string counter app: enter a Greek string (no diacritics needed), see a bar chart
// of how often each word token containing it occurs, click a bar to list the passages with that token,
// click a passage to see its page.  The table can be downloaded as CSV.
// Uses the shared sources inlined ahead of this file.
//
// Location hash: `#q=<string>&s=<all|iliad|scholia>&t=<diplomatic|normalized>[&b=<token>][&p=<passage>]`.
(function () {
  const $ = id => document.getElementById(id);
  const LIMIT = 60;                // passages listed at once
  const DEBOUNCE = 250;
  const SVG = 'http://www.w3.org/2000/svg';

  /** @type {any} */ let release = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {Map<string, string>} */ let versionLabels = new Map();
  /** @type {Map<string, string>} */ let pageLabels = new Map();
  /** @type {Map<string, string[]>} */ let surfacesOf = new Map();
  /** @type {any} */ let pageView = null;
  /** @type {Map<string, SearchIndex>} */ const indexes = new Map();
  let query = '';                  // the folded query of the results on show
  let typed = '';                  // as the user typed it
  /** @type {TokenCount[]} */ let allCounts = [];    // every word form found
  /** @type {TokenCount[]} */ let counts = [];       // those shown: at least `minCount` times, in the chosen order
  let results = [];
  /** @type {{version: string, section: string}[]} */ let choices = [];   // the texts that can be searched
  /** @type {Set<string>} */ let selected = new Set();                     // version URNs searched
  let selBar = '';                 // folded token of the chosen bar
  let selPassage = '';
  let ownHash = null;
  let timer = 0;

  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  const radio = name => document.querySelector(`input[name=${name}]:checked`).value;
  const textKind = () => radio('text');
  const order = () => radio('order');
  const minCount = () => Math.max(1, Math.floor(Number($('minc').value)) || 1);
  const setStatus = msg => { $('status').textContent = msg; };
  const searchIndex = () => {
    const k = textKind();
    let ix = indexes.get(k);
    if (!ix) { ix = buildSearchIndex(textIndex, k); indexes.set(k, ix); }
    return ix;
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function svg(tag, attrs, text) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // --- the choice of texts ------------------------------------------------------------------

  const SECTIONS = [['iliad', 'All Iliad'], ['scholia', 'All scholia'], ['other', 'All other texts']];

  /** The checklist: a box per section to take all its texts, then a box per text. */
  function drawTexts() {
    const box = $('textlist');
    box.textContent = '';
    const tools = el('div', 'tools');
    for (const [pick, label] of [['all', 'Select all'], ['none', 'Select none']]) {
      const b = el('button', 'btn', label);
      b.type = 'button'; b.dataset.pick = pick;
      tools.appendChild(b);
    }
    box.appendChild(tools);
    for (const [section, label] of SECTIONS) {
      const mine = choices.filter(c => c.section === section);
      if (!mine.length) continue;
      const sec = el('div', 'sec');
      const head = el('label');
      const all = document.createElement('input');
      all.type = 'checkbox'; all.dataset.section = section;
      head.append(all, ' ', label);
      sec.appendChild(head);
      for (const c of mine) {
        const l = el('label', 'kid');
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.dataset.version = c.version;
        l.append(cb, ' ', versionLabels.get(c.version) ?? c.version);
        sec.appendChild(l);
      }
      box.appendChild(sec);
    }
    syncTexts();
  }

  /** Bring the boxes and the summary into line with `selected`. */
  function syncTexts() {
    for (const cb of $('textlist').querySelectorAll('input[data-version]')) cb.checked = selected.has(cb.dataset.version);
    for (const [section, label] of SECTIONS) {
      const all = $('textlist').querySelector(`input[data-section=${section}]`);
      if (!all) continue;
      const mine = choices.filter(c => c.section === section), on = mine.filter(c => selected.has(c.version)).length;
      all.checked = on === mine.length;
      all.indeterminate = on > 0 && on < mine.length;
    }
    const n = selected.size, total = choices.length;
    const only = section => choices.filter(c => c.section === section);
    const is = list => list.length && list.length === n && list.every(c => selected.has(c.version));
    $('textsum').textContent = 'Texts: ' + (n === total ? `all ${total}` : !n ? 'none' : is(only('iliad')) ? 'all Iliad' : is(only('scholia')) ? 'all scholia' : `${n} of ${total}`);
  }

  // --- loading -------------------------------------------------------------------

  function start(rel) {
    release = rel;
    setStatus('Reading the texts…');
    setTimeout(() => {
      textIndex = buildTextIndex(rel);
      versionLabels = new Map(rel.ctsCatalog().map(c => [c.urn, `${c.workTitle} — ${c.versionLabel}`]));
      const ip = indexPages(rel);
      surfacesOf = ip.surfacesOf;
      pageLabels = new Map();
      for (const c of codices(rel)) for (const p of c.pages) pageLabels.set(p.urn, `${c.label}, ${p.short}`);
      pageView = createPageView({ release: rel, textIndex, versionLabels, pageLabels, surfacesOf, passagesOn: ip.passagesOn });
      indexes.clear();
      const ix = searchIndex();
      choices = textChoices(ix, [...versionLabels.keys()]);
      selected = new Set(choices.map(c => c.version));
      drawTexts();
      setStatus(`${rel.library.name}: ${plural(ix.entries.length, 'passage', 'passages')} to search`);
      for (const e of [$('q'), $('go')]) e.disabled = false;
      $('drop').hidden = true;
      route();
      if (!query) $('q').focus();
    }, 0);
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

  // --- marking (as in the string search app) ----------------------------------------------

  function appendMarked(parent, text) {
    let at = 0;
    for (const m of findMatches(text, query)) {
      if (m.start > at) parent.appendChild(document.createTextNode(text.slice(at, m.start)));
      parent.appendChild(el('mark', 'hit', text.slice(m.start, m.end)));
      at = m.end;
    }
    if (at < text.length) parent.appendChild(document.createTextNode(text.slice(at)));
  }

  function fillText(box, pk) {
    box.lang = 'grc';
    const entry = searchIndex().byKey.get(pk);
    const parts = entry ? entry.parts : passageText(textIndex, pk, textKind()).parts;
    if (!parts.length) { box.appendChild(el('span', 'hint', '(text not available in this release)')); return; }
    parts.forEach((p, i) => {
      if (parts.length === 1 && !p.part) { appendMarked(box, p.text); return; }
      if (i) box.appendChild(document.createTextNode(' '));
      const holder = el('span', p.part === 'lemma' ? 'lemma' : '');
      appendMarked(holder, p.text);
      box.appendChild(holder);
    });
  }

  const isHit = pk => entryMatches(searchIndex().byKey.get(pk), query);

  // --- searching and counting ----------------------------------------------------------------

  function setAbout(msg) { $('about').textContent = msg; }

  function clearResults(note) {
    results = []; allCounts = []; counts = []; selBar = ''; selPassage = '';
    $('chartbox').hidden = true;
    $('chart').replaceChildren();
    $('tablebox').replaceChildren();
    $('passages').replaceChildren(el('p', 'hint', 'Click a bar to list the passages with that word.'));
    $('page').replaceChildren(el('p', 'hint', 'Choose a passage to see its page.'));
    setAbout(note);
  }

  /** Run the search in the form; `how`: 'push' to add a history entry, 'replace' to replace it, 'none' for none. */
  function search(how) {
    clearTimeout(timer);
    typed = $('q').value.trim();
    query = parseQuery(typed);
    if (query.length < MIN_QUERY) {
      query = '';
      clearResults(typed ? 'Type at least two letters.' : 'Type at least two letters. Accents, breathings, capitals and punctuation do not matter.');
      go(how);
      return;
    }
    const keepBar = selBar;
    selBar = ''; selPassage = '';
    results = searchInVersions(searchIndex(), query, selected);
    const ordered = groupByVersion(textIndex, results, [...versionLabels.keys()]).flatMap(g => g.list);
    allCounts = countTokens(searchIndex(), ordered, query);
    const total = allCounts.reduce((n, r) => n + r.count, 0);
    setAbout(results.length
      ? `“${typed}” occurs ${plural(total, 'time', 'times')} in ${plural(results.length, 'passage', 'passages')}, as ${plural(allCounts.length, 'different word form', 'different word forms')}.`
      : (selected.size ? `No passage contains “${typed}”.` : 'No texts are selected: choose some under “Texts”.'));
    $('chartbox').hidden = !results.length;
    $('page').replaceChildren(el('p', 'hint', 'Choose a passage to see its page.'));
    if (!results.length) { counts = []; drawChart(); drawTable(); $('passages').replaceChildren(el('p', 'hint', 'No matches. Try fewer letters, or search all texts.')); }
    else showCounts(keepBar);
    go(how);
  }

  /** Show the word forms that pass the cutoff, in the chosen order; keep the chosen bar if it is still there. */
  function showCounts(keepBar, preservePage = false) {
    const min = minCount();
    counts = sortCounts(atLeast(allCounts, min), order());
    const sorted = order() === 'count' ? 'by count' : 'alphabetically';
    $('chartnote').textContent = counts.length
      ? `${min > 1 ? `${plural(counts.length, 'word form', 'word forms')} of ${allCounts.length} occur ${min} or more times. ` : ''}Occurrences of each word form, sorted ${sorted}. Click a bar to list its passages.`
      : `No word form occurs ${min} or more times; the most frequent occurs ${Math.max(...allCounts.map(c => c.count))} times.`;
    $('csv').disabled = !counts.length;
    drawChart();
    drawTable();
    if (keepBar && counts.some(c => c.token === keepBar)) {
      if (preservePage) { selBar = keepBar; markBar(); } else selectBar(keepBar);   // the list and page of a bar still shown stay as they are
    } else { selBar = ''; selPassage = ''; $('passages').replaceChildren(el('p', 'hint', 'Click a bar to list the passages with that word.')); $('page').replaceChildren(el('p', 'hint', 'Choose a passage to see its page.')); }
  }

  // --- the chart -------------------------------------------------------------------------------

  function drawChart() {
    const box = $('chart');
    box.textContent = '';
    if (!counts.length) return;
    const step = 30, left = 44, right = 12, top = 20, plot = 190, labelRoom = 120;
    const width = Math.max(box.clientWidth || 0, left + right + counts.length * step);
    const height = top + plot + labelRoom;
    const ticks = niceTicks(Math.max(...counts.map(c => c.count)));
    const top_ = ticks[ticks.length - 1];
    const y = v => top + plot - (v / top_) * plot;
    const s = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
    const axis = svg('g', { class: 'axis' });
    for (const t of ticks) {
      axis.appendChild(svg('line', { class: 'grid', x1: left, x2: width - right, y1: y(t), y2: y(t) }));
      axis.appendChild(svg('text', { x: left - 6, y: y(t) + 4, 'text-anchor': 'end' }, t.toLocaleString('en')));
    }
    s.appendChild(axis);
    counts.forEach((c, i) => {
      const cx = left + step * i + step / 2;
      const g = svg('g', { class: 'barg', tabindex: 0, role: 'button', 'data-token': c.token,
        'aria-label': `${c.form}: ${plural(c.count, 'occurrence', 'occurrences')} in ${plural(c.passages.length, 'passage', 'passages')}` });
      g.appendChild(svg('title', {}, `${c.form}: ${c.count} (${plural(c.passages.length, 'passage', 'passages')})`));
      const bh = Math.max(1, (c.count / top_) * plot);
      g.appendChild(svg('rect', { class: 'hitarea', x: cx - step / 2, y: top, width: step, height: plot + 4, fill: 'transparent' }));
      g.appendChild(svg('rect', { class: 'bar', x: cx - step * 0.35, y: top + plot - bh, width: step * 0.7, height: bh, rx: 2 }));
      g.appendChild(svg('text', { class: 'val', x: cx, y: top + plot - bh - 4, 'text-anchor': 'middle' }, String(c.count)));
      const lab = svg('text', { class: 'tick', x: cx + 4, y: top + plot + 12, 'text-anchor': 'end', lang: 'grc',
        transform: `rotate(-55 ${cx + 4} ${top + plot + 12})` }, c.form);
      g.appendChild(lab);
      s.appendChild(g);
    });
    s.appendChild(svg('line', { class: 'grid', x1: left, x2: width - right, y1: y(0), y2: y(0), stroke: 'var(--muted)' }));
    box.appendChild(s);
    markBar();
  }

  function markBar() {
    for (const g of $('chart').querySelectorAll('.barg')) {
      const on = g.dataset.token === selBar;
      g.classList.toggle('on', on);
      g.setAttribute('aria-pressed', String(on));
    }
  }

  function drawTable() {
    const box = $('tablebox');
    box.textContent = '';
    if (!counts.length) return;
    const t = el('table');
    const head = t.createTHead().insertRow();
    for (const [h, num] of [['Word form', false], ['Occurrences', true], ['Passages', true]]) {
      const th = el('th', num ? 'num' : '', h);
      th.scope = 'col';
      head.appendChild(th);
    }
    const body = t.createTBody();
    for (const c of counts) {
      const r = body.insertRow();
      const b = el('button', '', c.form);
      b.type = 'button'; b.lang = 'grc'; b.dataset.token = c.token;
      r.insertCell().appendChild(b);
      for (const v of [c.count, c.passages.length]) {
        const td = r.insertCell();
        td.className = 'num';
        td.textContent = v.toLocaleString('en');
      }
    }
    box.appendChild(t);
  }

  function downloadCsv() {
    if (!counts.length) return;
    const blob = new Blob(['﻿', toCsv(counts)], { type: 'text/csv;charset=utf-8' });   // BOM: spreadsheets read UTF-8 right
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = csvName(query);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // --- passages of a bar and the page ---------------------------------------------------------------

  function selectBar(token) {
    selBar = token;
    selPassage = '';
    markBar();
    renderList();
    $('page').replaceChildren(el('p', 'hint', 'Choose a passage to see its page.'));
  }

  function renderList() {
    const box = $('passages');
    box.textContent = '';
    const c = counts.find(x => x.token === selBar);
    if (!c) { box.appendChild(el('p', 'hint', 'Click a bar to list the passages with that word.')); return; }
    const ix = searchIndex();
    const h = el('div', 'vh');
    h.lang = 'grc';
    h.appendChild(document.createTextNode(c.form));
    h.appendChild(el('span', 'n', ` — ${plural(c.count, 'occurrence', 'occurrences')} in ${plural(c.passages.length, 'passage', 'passages')}`));
    box.appendChild(h);
    const rows = el('div');
    box.appendChild(rows);
    let shown = 0;
    const more = el('button', 'btn more');
    more.type = 'button';
    const step = upTo => {
      const end = Math.min(c.passages.length, upTo ?? shown + LIMIT);
      for (; shown < end; shown++) rows.appendChild(rowFor(c.passages[shown], ix, c.token));
      more.hidden = shown >= c.passages.length;
      more.textContent = `Show more (${c.passages.length - shown} left)`;
    };
    more.addEventListener('click', () => step());
    box.appendChild(more);
    const at = selPassage ? c.passages.indexOf(selPassage) : -1;
    step(at >= 0 ? Math.max(LIMIT, at + 1) : undefined);
  }

  function rowFor(pk, ix, token) {
    const b = el('button', 'row');
    b.type = 'button'; b.dataset.passage = pk;
    if (pk === selPassage) b.classList.add('on');
    b.appendChild(el('span', 'ref', refOf(pk)));
    const pages = surfacesOf.get(pk);
    b.appendChild(el('span', 'pg', `${versionLabels.get(versionOf(pk)) ?? versionOf(pk)} · ${pages ? (pageLabels.get(pages[0]) ?? pages[0]) : 'no page in the DSE records'}`));
    const sn = snippet(ix.byKey.get(pk), query, 36, token);
    if (sn) {
      const s = el('span', 'snip');
      s.lang = 'grc';
      s.appendChild(document.createTextNode(sn.before));
      s.appendChild(el('mark', 'hit', sn.hit));
      s.appendChild(document.createTextNode(sn.after));
      b.appendChild(s);
    }
    return b;
  }

  function showPassage(pk) {
    selPassage = pk;
    for (const r of $('passages').querySelectorAll('.row')) r.classList.toggle('on', r.dataset.passage === pk);
    pageView.show($('page'), pk, { textKind, fillText, isHit, hitLabel: `“${typed}”`, hitNoun: 'match' });
  }

  // --- navigation (location hash) --------------------------------------------------------------------

  function go(how) {
    if (how === 'none') return;
    const hash = query ? formatCounterHash({ q: typed, versions: selected.size === choices.length ? null : [...selected], kind: textKind(), bar: selBar, passage: selPassage, order: order(), min: minCount() }) : '';
    ownHash = hash || '#';
    if (how === 'replace') history.replaceState(null, '', hash || location.pathname + location.search);
    else if (hash) location.hash = hash;
    else history.pushState(null, '', location.pathname + location.search);
  }

  function route() {
    const w = parseCounterHash(location.hash);
    if (!w) { if (query) { $('q').value = ''; search('none'); } return; }
    $('q').value = w.q;
    selected = new Set(w.versions
      ? w.versions.filter(v => choices.some(c => c.version === v))
      : choices.filter(c => w.scope === 'all' || c.section === w.scope).map(c => c.version));   // an older link names iliad or scholia
    drawTexts();
    document.querySelector(`input[name=text][value=${w.kind}]`).checked = true;
    document.querySelector(`input[name=order][value=${w.order}]`).checked = true;
    $('minc').value = String(w.min);
    search('none');
    if (w.bar && counts.some(c => c.token === w.bar)) {
      if (w.passage) selPassage = w.passage;
      selectBar(w.bar);
      const c = counts.find(x => x.token === w.bar);
      if (w.passage && c.passages.includes(w.passage)) { selPassage = w.passage; renderList(); showPassage(w.passage); }
    }
  }

  // --- wiring ------------------------------------------------------------------------------------------

  function pick(token) { selectBar(token); go('push'); }

  $('controls').addEventListener('submit', e => { e.preventDefault(); search('push'); });
  $('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search('replace'), DEBOUNCE); });
  document.addEventListener('click', e => { if (!$('texts').contains(e.target)) $('texts').open = false; });   // click elsewhere closes the list
  $('texts').addEventListener('keydown', e => { if (e.key === 'Escape') { $('texts').open = false; $('textsum').focus(); } });
  $('textlist').addEventListener('change', e => {
    const box = e.target;
    if (box.dataset.section) {                                    // a section's "all" box
      for (const c of choices) if (c.section === box.dataset.section) (box.checked ? selected.add(c.version) : selected.delete(c.version));
    } else if (box.dataset.version) {
      if (box.checked) selected.add(box.dataset.version); else selected.delete(box.dataset.version);
    } else return;
    syncTexts();
    if (release) search('replace');
  });
  $('textlist').addEventListener('click', e => {
    const b = e.target.closest('button[data-pick]');
    if (!b) return;
    selected = new Set(b.dataset.pick === 'all' ? choices.map(c => c.version) : []);
    syncTexts();
    if (release) search('replace');
  });
  for (const r of document.querySelectorAll('input[name=text]')) {
    r.addEventListener('change', () => {
      if (!release) return;
      const bar = selBar, keep = selPassage;
      search('replace');
      const c = counts.find(x => x.token === bar);
      if (c && keep && c.passages.includes(keep)) { selPassage = keep; renderList(); showPassage(keep); go('replace'); }
      else if (c) go('replace');
    });
  }
  for (const r of document.querySelectorAll('input[name=order]')) {
    r.addEventListener('change', () => {
      if (allCounts.length) showCounts(selBar, true);
      go('replace');
    });
  }
  $('minc').addEventListener('input', () => {
    if (!allCounts.length) return;
    clearTimeout(timer);
    timer = setTimeout(() => { showCounts(selBar, true); go('replace'); }, DEBOUNCE);
  });
  $('chart').addEventListener('click', e => {
    const g = e.target.closest('.barg');
    if (g) pick(g.dataset.token);
  });
  $('chart').addEventListener('keydown', e => {
    const g = e.target.closest?.('.barg');
    if (!g) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g.dataset.token); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const bars = [...$('chart').querySelectorAll('.barg')];
      const n = bars[bars.indexOf(g) + (e.key === 'ArrowRight' ? 1 : -1)];
      if (n) { e.preventDefault(); n.focus(); }
    }
  });
  $('tablebox').addEventListener('click', e => {
    const b = e.target.closest('button[data-token]');
    if (b) pick(b.dataset.token);
  });
  $('csv').addEventListener('click', downloadCsv);
  $('passages').addEventListener('click', e => {
    const row = e.target.closest('.row');
    if (!row) return;
    showPassage(row.dataset.passage);
    go('push');
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash || '#';
    if (ownHash === h) { ownHash = null; return; }
    ownHash = null;
    if (release) route();
  });
  window.addEventListener('resize', () => { if (counts.length) drawChart(); });
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

// Browser UI for the DSE check: summarizes the relational inconsistencies of the
// DSE records of a release in three groups.  Uses the shared sources inlined
// ahead of this file (see index.html).
(function () {
  const $ = id => document.getElementById(id);
  const LIMIT = 200;   // items rendered at once in a long list
  const n = x => x.toLocaleString('en');
  const plural = (x, one, many) => `${n(x)} ${x === 1 ? one : many}`;

  /** @type {DseCheck | null} */ let check = null;

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

  function group(title, desc, count, unit) {
    const s = el('section', 'group');
    const h = el('div', 'gh');
    h.appendChild(el('h2', '', title));
    h.appendChild(el('span', count ? 'badge warn' : 'badge ok', count ? plural(count, unit[0], unit[1]) : 'OK, none'));
    s.appendChild(h);
    s.appendChild(el('p', 'gdesc', desc));
    return s;
  }

  function render(c) {
    check = c;
    const root = $('groups');
    root.textContent = '';
    const table = $('summary');
    table.textContent = '';
    const head = el('tr');
    for (const t of ['Version', 'Text passages', 'DSE records', 'Missing from DSE', 'Not in text']) head.appendChild(el('th', '', t));
    table.appendChild(head);
    for (const v of c.versions) {
      const tr = el('tr');
      tr.appendChild(el('td', '', v.label));
      tr.appendChild(el('td', '', n(v.passages)));
      tr.appendChild(el('td', '', n(v.records)));
      tr.appendChild(el('td', v.missing.length ? 'bad' : '', n(v.missing.length)));
      tr.appendChild(el('td', v.unknown.length ? 'bad' : '', n(v.unknown.length)));
      table.appendChild(tr);
    }

    // 1. text passages missing from DSE
    const miss = c.versions.filter(v => v.missing.length);
    const g1 = group('Text passage missing from DSE', 'Passages of the textual editions that no DSE record names.',
      miss.reduce((s, v) => s + v.missing.length, 0), ['passage', 'passages']);
    for (const v of miss) {
      const d = el('details', 'entry');
      const sum = el('summary', '', `${v.label} `);
      sum.appendChild(el('span', 'n', `${plural(v.missing.length, 'passage', 'passages')} of ${n(v.passages)}`));
      if (v.records === 0) sum.appendChild(el('span', 'flag', '  no DSE records for this text at all'));
      d.appendChild(sum);
      let built = false;
      d.addEventListener('toggle', () => {
        if (!d.open || built) return;
        built = true;
        const chips = el('div', 'chips');
        d.appendChild(chips);
        renderLimited(chips, v.missing, m => { const x = el('span', 'chip', m.ref); if (m.text) x.title = m.text; return x; });
      });
      g1.appendChild(d);
    }
    root.appendChild(g1);

    // 2. DSE records for passages not in the editions
    const unk = c.versions.filter(v => v.unknown.length);
    const g2 = group('DSE record for text passage not in textual editions',
      'DSE records whose text passage is absent from the release’s editions.',
      unk.reduce((s, v) => s + v.unknown.length, 0) + c.badPassages.length, ['record', 'records']);
    const recLine = (r, text) => {
      const p = el('div', 'rec');
      p.appendChild(el('span', 'row', `row ${r.row}  `));
      p.appendChild(document.createTextNode(`${text}  ${r.imageroi}  ${r.surface}`));
      return p;
    };
    for (const v of unk) {
      const d = el('details', 'entry');
      const sum = el('summary', '', `${v.label} `);
      sum.appendChild(el('span', 'n', plural(v.unknown.length, 'record', 'records')));
      if (!v.hasText) sum.appendChild(el('span', 'flag', '  the release has no text of this version'));
      d.appendChild(sum);
      let built = false;
      d.addEventListener('toggle', () => {
        if (!d.open || built) return;
        built = true;
        const box = el('div');
        d.appendChild(box);
        renderLimited(box, v.unknown, r => recLine(r, r.ref));
      });
      g2.appendChild(d);
    }
    if (c.badPassages.length) {
      const d = el('details', 'entry');
      const sum = el('summary', '', 'Not a CTS passage URN ');
      sum.appendChild(el('span', 'n', plural(c.badPassages.length, 'record', 'records')));
      d.appendChild(sum);
      const box = el('div');
      d.appendChild(box);
      renderLimited(box, c.badPassages, r => recLine(r, r.passage));
      g2.appendChild(d);
    }
    root.appendChild(g2);

    // 3. images not in the catalog
    const g3 = group('Reference to image not in catalog',
      `DSE records whose image is not among the ${n(c.catalogImages)} images of the image catalog (${n(c.imagesChecked)} distinct images referenced).`,
      c.imageProblems.reduce((s, p) => s + p.records.length, 0), ['record', 'records']);
    for (const p of c.imageProblems) {
      const d = el('details', 'entry');
      const reason = p.kind === 'item' ? `no such image in ${p.collection}`
        : p.kind === 'collection' ? `${p.collection} is not an image collection of this release` : 'record has no image reference';
      const sum = el('summary', '', `${p.image || '(no image)'} `);
      sum.appendChild(el('span', 'n', `${plural(p.records.length, 'record', 'records')}`));
      sum.appendChild(el('span', 'flag', `  ${reason}`));
      d.appendChild(sum);
      const box = el('div');
      d.appendChild(box);
      renderLimited(box, p.records, r => recLine(r, r.passage));
      g3.appendChild(d);
    }
    root.appendChild(g3);

    $('intro').textContent = c.found
      ? `${plural(c.records, 'DSE record', 'DSE records')} checked against the editions and the image catalog.`
      : 'This release has no DSE relation set; nothing to check.';
    $('report').hidden = false;
    $('drop').hidden = true;
  }

  function start(rel) {
    const c = checkDse(rel);
    render(c);
    const total = c.versions.reduce((s, v) => s + v.missing.length + v.unknown.length, 0)
      + c.badPassages.length + c.imageProblems.reduce((s, p) => s + p.records.length, 0);
    setStatus(`${rel.library.name}: ${total ? plural(total, 'inconsistency', 'inconsistencies') : 'no inconsistencies'}`);
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
    const url = URL.createObjectURL(new Blob([reportCsv(check)], { type: 'text/csv;charset=utf-8' }));
    const a = el('a');
    a.href = url; a.download = 'dse-check.csv';
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

  (async function init() {
    try { start(await fetchRelease()); }
    catch (e) { showProblem(`Could not load the HMT release (${e.message || e}). If you are offline, load a copy of the release from your computer.`); }
  })();
})();

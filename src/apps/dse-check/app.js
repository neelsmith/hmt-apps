// Browser UI for the DSE check: summarizes the relational inconsistencies of the
// DSE records of a release in four groups.  Uses the shared sources inlined
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

  /** Address of the codices app on GitHub Pages. */
  /** Address of the images app on GitHub Pages. */
  const IMAGES_APP = 'https://neelsmith.github.io/hmt-apps/images.html';
  const CODICES_APP = 'https://neelsmith.github.io/hmt-apps/codices.html';

  /** Passage of each chip with text, for the popover. @type {WeakMap<Element, {ref: string, texts: {exemplar: string, text: string}[]}>} */
  const chipTexts = new WeakMap();
  const pop = el('div', 'popover');
  pop.id = 'popover';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  document.body.appendChild(pop);

  /** Show the text of a passage beside its chip. */
  function showPop(chip) {
    const m = chipTexts.get(chip);
    if (!m) return;
    pop.textContent = '';
    for (const t of m.texts) {
      if (!t.text.trim()) continue;
      const p = el('p');
      if (m.texts.length > 1) p.appendChild(el('span', 'ex', t.exemplar || 'text'));
      p.appendChild(document.createTextNode(t.text.trim()));
      pop.appendChild(p);
    }
    pop.hidden = false;
    const r = chip.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = r.bottom + 6 + h > window.innerHeight && r.top - 6 - h > 0 ? r.top - 6 - h : r.bottom + 6;
    pop.style.left = `${left + window.scrollX}px`;
    pop.style.top = `${top + window.scrollY}px`;
    chip.setAttribute('aria-describedby', 'popover');
  }
  /** The diplomatic text of a passage; if it has none, the first exemplar's. */
  function diplomaticText(m) {
    const t = m.texts.find(x => x.exemplar === 'diplomatic' && x.text.trim()) ?? m.texts.find(x => x.text.trim());
    return t ? t.text.trim() : '';
  }

  /** Copy text to the clipboard; resolves to whether it worked. */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through to the old way */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  /** Copy a chip's diplomatic text and say so in the popover and the status line. */
  async function copyChip(chip) {
    const m = chipTexts.get(chip);
    if (!m) return;
    const ok = await copyText(diplomaticText(m));
    showPop(chip);
    const note = el('p', 'copied', ok ? 'Diplomatic text copied to the clipboard' : 'Could not copy to the clipboard');
    pop.appendChild(note);
    setStatus(ok ? `Copied the diplomatic text of ${m.ref}` : `Could not copy ${m.ref} to the clipboard`);
  }

  function hidePop() {
    pop.hidden = true;
    document.querySelectorAll('[aria-describedby=popover]').forEach(x => x.removeAttribute('aria-describedby'));
  }
  const chipOf = e => e.target instanceof Element ? e.target.closest('.chip') : null;
  document.addEventListener('mouseover', e => { const c = chipOf(e); if (c) showPop(c); });
  document.addEventListener('mouseout', e => { if (chipOf(e)) hidePop(); });
  document.addEventListener('focusin', e => { const c = chipOf(e); if (c) showPop(c); });
  document.addEventListener('focusout', e => { if (chipOf(e)) hidePop(); });
  document.addEventListener('click', e => { const c = chipOf(e); if (c) copyChip(c); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hidePop();
    const c = chipOf(e);
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); copyChip(c); }
  });

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

    const ctable = $('codex-summary');
    ctable.textContent = '';
    const chead = el('tr');
    for (const t of ['Codex', 'Pages', 'Pages with DSE records', 'Pages without', 'Runs without']) chead.appendChild(el('th', '', t));
    ctable.appendChild(chead);
    for (const x of c.codices) {
      const tr = el('tr');
      tr.appendChild(el('td', '', x.label));
      tr.appendChild(el('td', '', n(x.pages)));
      tr.appendChild(el('td', '', n(x.covered)));
      tr.appendChild(el('td', x.uncovered ? 'bad' : '', n(x.uncovered)));
      tr.appendChild(el('td', x.runs.length ? 'bad' : '', n(x.runs.length)));
      ctable.appendChild(tr);
    }
    // pages with problems, by book of the Iliad
    const pageLink = pg => {
      const a = el('a', '', pg.id);
      a.href = CODICES_APP + formatPageQuery(pg.urn);
      a.title = pg.urn;
      return a;
    };
    const msName = v => v.label.split(' — ').pop().replace(/\s*\(.*\)$/, '');
    const ip = c.iliadPages;
    const itable = $('iliad-pages');
    itable.textContent = '';
    $('iliad-pages-head').hidden = $('iliad-pages-note').hidden = $('iliad-pages-wrap').hidden = !ip.length;
    if (ip.length) {
      $('iliad-pages-note').textContent = `Pages named by DSE records for lines of the Iliad that are not in the textual edition (${ip.map(v => msName(v)).join(', ')}). Hover a cell for the number of records.`;
      const ihead = el('tr');
      ihead.appendChild(el('th', '', 'Book'));
      for (const v of ip) ihead.appendChild(el('th', '', msName(v)));
      itable.appendChild(ihead);
      for (let i = 0; i < 24; i++) {
        if (!ip.some(v => v.byBook[i].records)) continue;
        const tr = el('tr');
        tr.appendChild(el('td', '', String(i + 1)));
        for (const v of ip) {
          const b = v.byBook[i];
          const td = el('td', 'pages', b.records ? '' : '—');
          b.parts.forEach((part, k) => {
            if (k) td.appendChild(document.createTextNode(', '));
            td.appendChild(pageLink(part.from));
            if (part.to.urn !== part.from.urn) { td.appendChild(document.createTextNode('–')); td.appendChild(pageLink(part.to)); }
          });
          if (b.records) td.title = `${plural(b.records, 'record', 'records')} on ${plural(b.pages, 'page', 'pages')}`;
          tr.appendChild(td);
        }
        itable.appendChild(tr);
      }
      const other = ip.filter(v => v.other);
      if (other.length) $('iliad-pages-note').textContent += ` Not placed in a book: ${other.map(v => `${msName(v)} ${plural(v.other, 'record', 'records')}`).join('; ')}.`;
    }
    $('codex-summary-head').hidden = $('codex-summary-wrap').hidden = !c.codices.length;

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
        renderLimited(chips, v.missing, m => { const x = el('span', 'chip', m.ref); if (m.texts.some(t => t.text.trim())) { x.tabIndex = 0; x.setAttribute('role', 'button'); x.dataset.ref = m.ref; chipTexts.set(x, m); } return x; });
      });
      g1.appendChild(d);
    }
    root.appendChild(g1);

    // 2. DSE records for passages not in the editions
    const unk = c.versions.filter(v => v.unknown.length);
    const g2 = group('DSE record for text passage not in textual editions',
      'DSE records whose text passage is absent from the release’s editions.',
      unk.reduce((s, v) => s + v.unknown.length, 0) + c.badPassages.length, ['record', 'records']);
    const recLine = (r, text, linkImage) => {
      const p = el('div', 'rec');
      p.appendChild(el('span', 'row', `row ${r.row}  `));
      p.appendChild(document.createTextNode(`${text}  `));
      if (linkImage && /^urn:cite2:/.test(r.imageroi)) {
        const a = el('a', '', r.imageroi);
        a.href = IMAGES_APP + formatQuery({ image: r.imageroi });   // with its region, which the images app highlights
        a.title = 'Open this image in the images app';
        p.appendChild(a);
      } else p.appendChild(document.createTextNode(r.imageroi));
      p.appendChild(document.createTextNode(`  ${r.surface}`));
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
        renderLimited(box, v.unknown, r => recLine(r, r.ref, true));
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
      renderLimited(box, c.badPassages, r => recLine(r, r.passage, true));
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

    // 4. codex pages without DSE records
    const gaps = c.codices.filter(x => x.runs.length);
    const g4 = group('Codex pages without DSE records',
      'Pages of each codex (manuscript) that no DSE record names as its surface, as runs of consecutive pages in codex order.',
      gaps.reduce((s, x) => s + x.runs.length, 0), ['run', 'runs']);
    for (const x of gaps) {
      const d = el('details', 'entry');
      const sum = el('summary', '', `${x.label} `);
      sum.appendChild(el('span', 'n', `${plural(x.runs.length, 'run', 'runs')}, ${plural(x.uncovered, 'page', 'pages')} of ${n(x.pages)}`));
      if (x.covered === 0) sum.appendChild(el('span', 'flag', '  no DSE records for this codex at all'));
      d.appendChild(sum);
      let built = false;
      d.addEventListener('toggle', () => {
        if (!d.open || built) return;
        built = true;
        const box = el('div');
        d.appendChild(box);
        renderLimited(box, x.runs, r => {
          const p = el('div', 'rec');
          p.appendChild(el('span', 'row', r.count === 1 ? '1 page  ' : `${n(r.count)} pages  `));
          p.appendChild(document.createTextNode(r.count === 1 ? r.from.label : `${r.from.label} to ${r.to.label}`));
          p.title = r.count === 1 ? r.from.urn : `${r.from.urn} to ${r.to.urn}`;
          return p;
        });
      });
      g4.appendChild(d);
    }
    root.appendChild(g4);

    // summary line by manuscript
    const bs = $('by-ms');
    bs.textContent = '';
    bs.hidden = !c.codices.length || !c.found;
    for (const x of c.codices.filter(x => x.records || x.inconsistencies)) {
      const li = el('li');
      li.appendChild(el('strong', '', `${x.label}: `));
      li.appendChild(document.createTextNode(`${plural(x.records, 'DSE record', 'DSE records')}, `));
      li.appendChild(el('span', x.inconsistencies ? 'flag' : 'ok', x.inconsistencies ? plural(x.inconsistencies, 'inconsistency', 'inconsistencies') : 'no inconsistencies'));
      bs.appendChild(li);
    }

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
      + c.badPassages.length + c.imageProblems.reduce((s, p) => s + p.records.length, 0)
      + c.codices.reduce((s, x) => s + x.runs.length, 0);
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

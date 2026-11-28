// Browser UI for iliad-scholia-columns.html: a passage of the Iliad in a reference version, beside the same lines of
// every other version that has them, with the words that differ from the reference shaded and, for each line of each
// version, the scholia indexed to that version.  Uses the shared sources inlined ahead of this file (see index.html).
// Address: `?text=<version URN>[.kind]:<passage>`, as in iliad-scholia.html.
(function () {
  const $ = id => document.getElementById(id);

  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {any[]} */ let versions = [];
  /** @type {any} */ let build = null;

  function setStatus(msg) { $('status').textContent = msg; }
  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

  function start(rel) {
    textIndex = buildTextIndex(rel);
    versions = iliadVersions(rel, textIndex);
    build = createColumns(versions, textIndex, commentaryPairs(rel));
    const sel = $('version');
    sel.textContent = '';
    for (const v of versions) {
      const o = document.createElement('option');
      o.value = v.urn;
      o.textContent = v.online ? v.label : `${v.label} (no online text)`;
      o.disabled = !v.online;
      sel.appendChild(o);
    }
    const firstOnline = versions.find(v => v.online);
    if (firstOnline) sel.value = firstOnline.urn;
    for (const id of ['version', 'ref', 'go']) $(id).disabled = !firstOnline;
    renderKinds();
    updateCoverage();
    $('load-error').hidden = true;
    $('drop').hidden = true;
    setStatus(`${rel.library.name}: ${versions.filter(v => v.online).length} of ${versions.length} Iliad versions have an online text.`);
    $('results').hidden = true;
    const q = readParams(location.search).text;
    if (q) openText(q);
  }

  /** Open at a version, text and passage given as one CTS URN. @param {string} param */
  function openText(param) {
    const r = parseUrnParam(versions, param);
    if ('error' in r) { $('error').textContent = r.error; return; }
    $('version').value = r.version.urn;
    renderKinds();
    if (r.kind) {
      const radio = [...document.querySelectorAll('input[name=kind]')].find(i => i.value.endsWith('.' + r.kind + ':'));
      if (radio) radio.checked = true;
    }
    updateCoverage();
    if (r.ref) { $('ref').value = r.ref; show(); }
    if (r.note) $('error').textContent = r.note;
  }

  const currentVersion = () => versions.find(v => v.urn === $('version').value);

  function renderKinds() {
    const v = currentVersion();
    const box = $('kinds');
    box.textContent = '';
    const texts = v ? v.texts : [];
    $('kind-field').hidden = texts.length < 2;
    texts.forEach((t, i) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'kind'; input.value = t.urn; input.checked = i === 0;
      label.append(input, ' ', t.kind);
      box.appendChild(label);
    });
  }
  /** The kind of text chosen (the other versions use the same kind if they have it). */
  function currentKind() {
    const v = currentVersion();
    const checked = document.querySelector('input[name=kind]:checked');
    const t = v && (v.texts.find(x => checked && x.urn === checked.value) || v.texts[0]);
    return t ? t.kind : 'normalized';
  }

  function coverage(text) {
    const books = [...new Set(text.refs.map(r => parseInt(r, 10)).filter(n => !isNaN(n)))].sort((a, b) => a - b);
    if (!books.length) return '';
    const runs = [];
    for (const b of books) {
      const last = runs[runs.length - 1];
      if (last && b === last[1] + 1) last[1] = b; else runs.push([b, b]);
    }
    const label = runs.map(([a, b]) => a === b ? String(a) : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`).join(', ');
    return `This text has ${books.length === 1 ? 'book' : 'books'} ${label}.`;
  }
  function updateCoverage() {
    const v = currentVersion();
    const t = v && v.texts.length ? textIndex.get(v.texts[0].urn) : null;
    $('coverage').textContent = t ? coverage(t) : '';
  }

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  /** The text of a line with the words that differ from the reference shaded. */
  function fillText(span, line) {
    span.lang = 'grc';
    if (!line.segments) { span.textContent = line.text; return; }
    line.segments.forEach((seg, i) => {
      if (i) span.append(' ');
      if ('text' in seg) { span.append(seg.text); return; }
      if (seg.alt) {
        const d = el('span', 'diff', seg.alt);
        d.title = seg.base ? `reference: ${seg.base}` : 'not in the reference';
        span.append(d);
      } else {
        const g = el('span', 'gap', '‸');
        g.title = `lacks: ${seg.base}`;
        g.setAttribute('aria-label', `lacks: ${seg.base}`);
        span.append(g);
      }
    });
  }

  function renderScholion(urn, kind) {
    const s = scholionPassage(textIndex, urn, kind);
    const d = el('div', 'scholion');
    const id = el('div', 'id');
    id.appendChild(pvPassageLink(dseKey(urn) || urn, s.label));
    d.appendChild(id);
    const body = el('div', 'greek');
    body.lang = 'grc';
    if (s.lemma) { body.append(el('span', 'lemma', s.lemma), ' '); }
    body.append(s.comment || (s.lemma ? '' : '(text not available in this release)'));
    d.appendChild(body);
    return d;
  }

  function cellFor(col, ref, line, isRef) {
    const cell = el('div', `cell${isRef ? ' refcol' : ''}${line ? '' : ' missing'}`);
    cell.setAttribute('role', 'cell');
    if (!line) { cell.textContent = '—'; cell.title = `${col.label} does not have ${ref}`; return cell; }
    const t = el('span', 'greek');
    fillText(t, line);
    cell.appendChild(t);
    if (line.scholia.length) {
      const btn = el('button', 'badge', plural(line.scholia.length, 'scholion', 'scholia'));
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.title = `Scholia indexed to ${col.label} ${ref}`;
      let panel = null;
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        if (!panel) {
          panel = el('div', 'scholia');
          for (const urn of line.scholia) panel.appendChild(renderScholion(urn, col.kind));
          cell.appendChild(panel);
        }
        panel.hidden = open;
        btn.setAttribute('aria-expanded', String(!open));
      });
      cell.appendChild(btn);
    }
    return cell;
  }

  function show() {
    $('error').textContent = '';
    const v = currentVersion();
    if (!v || !build) return;
    const input = $('ref').value;
    const kind = currentKind();
    const r = build(v.urn, kind, input);
    if ('error' in r) { $('error').textContent = r.error; $('results').hidden = true; return; }
    const first = r.refs[0], last = r.refs[r.refs.length - 1];
    $('summary').textContent = `${v.label}, ${first === last ? first : first + '–' + last}: ${plural(r.refs.length, 'line', 'lines')} in ${plural(r.columns.length, 'version', 'versions')}, ${plural(r.scholiaTotal, 'scholion', 'scholia')}`;
    const notes = [];
    if (r.omitted) notes.push(`Showing the first ${r.refs.length} lines; ${r.omitted.toLocaleString('en')} more are not shown.`);
    const absent = versions.filter(x => x.online && !r.columns.some(c => c.urn === x.urn));
    if (absent.length) notes.push(`No line of this passage in: ${absent.map(x => x.label).join('; ')}.`);
    const other = r.columns.filter(c => c.kind !== kind);
    if (other.length) notes.push(`No ${kind} text in ${other.map(c => c.label).join('; ')}; its ${other.map(c => c.kind).join(', ')} text is shown.`);
    $('notes').textContent = notes.join(' ');
    $('notes').hidden = notes.length === 0;
    $('legend').textContent = r.columns.length > 1
      ? `Shaded words differ from ${v.label}; ‸ marks a word it has that the version lacks (hover for the word). The ${kind} text is compared word by word, ignoring punctuation.`
      : `No other version has a line of this passage.`;

    const box = $('cols');
    box.textContent = '';
    box.style.setProperty('--n', String(r.columns.length));
    const head = el('div', 'colhead');
    head.setAttribute('role', 'columnheader');
    head.textContent = 'Line';
    box.appendChild(head);
    r.columns.forEach((c, i) => {
      const h = el('div', `colhead${i === 0 ? ' reflabel' : ''}`);
      h.setAttribute('role', 'columnheader');
      h.title = c.label;
      h.append(shortVersionLabel(c.label));
      const sub = el('small', '', i === 0 ? 'reference' : c.different ? `${plural(c.different, 'line differs', 'lines differ')}` : 'same text');
      h.appendChild(sub);
      box.appendChild(h);
    });
    for (const ref of r.refs) {
      const rr = el('div', 'rowref');
      rr.setAttribute('role', 'rowheader');
      rr.appendChild(pvPassageLink(v.urn + ref, ref));
      box.appendChild(rr);
      r.columns.forEach((c, i) => box.appendChild(cellFor(c, ref, c.lines.get(ref), i === 0)));
    }
    $('results').hidden = false;
    const refText = v.texts.find(t => t.kind === kind) || v.texts[0];
    setQuery({ text: refText.urn + input.trim() }, true);   // the address is now a bookmark of this passage
  }

  // --- loading -------------------------------------------------------------

  function showLoadError(err, hint) {
    setStatus('');
    const box = $('load-error');
    box.hidden = false;
    box.textContent = `Could not load the release automatically (${err && err.message ? err.message : err}). ${hint || ''}`;
    $('drop').hidden = false;
  }
  async function loadFile(file) {
    setStatus(`Reading ${file.name}…`);
    try { start(await readReleaseFile(file)); }
    catch (e) { showLoadError(e, 'That file could not be read.'); }
  }
  $('file').addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
  window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  window.addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  $('form').addEventListener('submit', e => { e.preventDefault(); show(); });
  $('version').addEventListener('change', () => { renderKinds(); updateCoverage(); if (!$('results').hidden) show(); });
  $('kinds').addEventListener('change', () => { if (!$('results').hidden) show(); });
  for (const b of document.querySelectorAll('.examples button')) {
    b.addEventListener('click', () => { $('ref').value = b.textContent; $('ref').focus(); });
  }

  (async function init() {
    try { start(await fetchRelease()); }
    catch (e) { showLoadError(e, 'If you are offline, load a copy of the release from your computer.'); }
  })();
})();

// Browser UI for the Iliad-scholia apps.  Uses the shared parser and the
// Iliad-scholia logic, which the build inlines ahead of this file.
//
// Two pages use this file.  By default the reader chooses one text (diplomatic
// or normalized).  With <body data-text="interwoven"> (the editorial view) the
// diplomatic text is shown, and wherever the normalized text differs it follows
// in parentheses (styled by the page); there is no choice of text.
(function () {
  const MAX_ROWS = 2000;
  const WOVEN = document.body.dataset.text === 'interwoven';
  const $ = id => document.getElementById(id);

  /** @type {any} */ let release = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {any[]} */ let pairs = [];
  /** @type {any[]} */ let versions = [];
  /** Resolved commentary spans, per text URN. */
  const spanCache = new Map();

  function setStatus(msg) { $('status').textContent = msg; }

  function start(rel) {
    release = rel;
    textIndex = buildTextIndex(rel);
    pairs = commentaryPairs(rel);
    versions = iliadVersions(rel, textIndex);
    spanCache.clear();

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
  }

  function currentVersion() { return versions.find(v => v.urn === $('version').value); }

  function renderKinds() {
    if (WOVEN) return;
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

  /** "books 1–24" / "books 8, 9, 10" for the books present in a text. */
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
    const cur = currentText();
    $('coverage').textContent = cur ? coverage(cur.text) : '';
  }

  function currentText() {
    const v = currentVersion();
    if (!v) return null;
    if (WOVEN) {
      // Base: the diplomatic text (or whatever the version has); other: the normalized text.
      const base = v.texts.find(t => t.kind === 'diplomatic') || v.texts[0];
      if (!base) return null;
      const other = v.texts.find(t => t.kind === 'normalized' && t !== base);
      return {
        version: v, kind: base.kind, text: textIndex.get(base.urn),
        other: other ? textIndex.get(other.urn) : null, otherKind: other ? other.kind : null,
      };
    }
    const checked = document.querySelector('input[name=kind]:checked');
    const urn = checked ? checked.value : (v.texts[0] && v.texts[0].urn);
    return urn ? { version: v, kind: v.texts.find(t => t.urn === urn).kind, text: textIndex.get(urn) } : null;
  }

  function spansFor(version, text) {
    if (!spanCache.has(text.urn)) spanCache.set(text.urn, commentarySpans(pairs, version.urn, text));
    return spanCache.get(text.urn);
  }

  function show() {
    const cur = currentText();
    $('error').textContent = '';
    if (!cur) return;
    const input = $('ref').value;
    const range = resolveRange(cur.text, input);
    if ('error' in range) {
      $('error').textContent = `${cur.version.label}: ${range.error}`;
      $('results').hidden = true;
      return;
    }
    const { spans, unresolved } = spansFor(cur.version, cur.text);
    const out = annotateRange(cur.text, range, spans);
    const shown = out.lines.slice(0, MAX_ROWS);

    const first = out.lines[0].ref, last = out.lines[out.lines.length - 1].ref;
    const n = out.lines.length;
    $('summary').textContent =
      `${cur.version.label}, ${first === last ? first : first + '–' + last}: ` +
      `${n} passage${n === 1 ? '' : 's'}, ${out.scholiaTotal} scholi${out.scholiaTotal === 1 ? 'on' : 'a'}`;
    const notes = [];
    if (n > shown.length) notes.push(`Showing the first ${shown.length} passages.`);
    if (unresolved) notes.push(`${unresolved} of ${spans.length + unresolved} commentary relations for this version could not be matched to a passage in the text (for example “13.UNKNOWN”) and are not counted.`);
    $('notes').textContent = notes.join(' ');
    $('notes').hidden = notes.length === 0;

    const box = $('passages');
    box.textContent = '';
    const frag = document.createDocumentFragment();
    for (const line of shown) frag.appendChild(renderPassage(line, cur));
    box.appendChild(frag);
    $('results').hidden = false;
  }

  /**
   * Add text to an element.  In the interwoven view, where `alt` (the
   * normalized text) differs from `base` it follows the differing words in
   * parentheses: `χοώμενος (χωόμενος)`.  A word the normalized text
   * adds is shown as `(word)`; one it omits is followed by `(∅)`.
   */
  function appendText(el, base, alt) {
    if (!WOVEN || alt === undefined || alt === base) { el.append(base); return; }
    weave(base, alt).forEach((seg, i) => {
      if (i) el.append(' ');
      if ('text' in seg) { el.append(seg.text); return; }
      if (seg.base) {
        const d = document.createElement('span');
        d.className = 'dip'; d.textContent = seg.base;
        el.append(d, ' ');
      }
      const a = document.createElement('span');
      a.className = 'alt';
      a.textContent = `(${seg.alt || '∅'})`;
      a.title = !seg.base ? 'added in the normalized text' : !seg.alt ? 'omitted in the normalized text' : 'normalized text';
      el.append(a);
    });
  }

  function renderPassage(line, cur) {
    const div = document.createElement('div');
    div.className = 'passage';
    const head = document.createElement('div');
    head.className = 'head';
    const ref = document.createElement('span');
    ref.className = 'ref'; ref.textContent = line.ref;
    const txt = document.createElement('span');
    txt.className = 'greek'; txt.lang = 'grc';
    const alt = cur.other ? cur.other.texts[cur.other.pos.get(line.ref)] : undefined;
    appendText(txt, line.text, alt);
    head.append(ref, txt);
    div.appendChild(head);

    const count = line.scholia.length;
    if (count > 0) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'badge';
      btn.textContent = `${count} scholi${count === 1 ? 'on' : 'a'}`;
      btn.setAttribute('aria-expanded', 'false');
      btn.title = 'Show the scholia';
      head.appendChild(btn);
      let panel = null;
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        if (!panel) {
          panel = document.createElement('div');
          panel.className = 'scholia';
          for (const urn of line.scholia) panel.appendChild(renderScholion(urn, cur));
          div.appendChild(panel);
        }
        panel.hidden = open;
        btn.setAttribute('aria-expanded', String(!open));
      });
    }
    return div;
  }

  function renderScholion(urn, cur) {
    const s = scholionPassage(textIndex, urn, cur.kind);
    const s2 = cur.other ? scholionPassage(textIndex, urn, cur.otherKind) : null;
    const d = document.createElement('div');
    d.className = 'scholion';
    const id = document.createElement('div');
    id.className = 'id'; id.textContent = s.label; id.title = urn;
    d.appendChild(id);
    const body = document.createElement('div');
    body.className = 'greek'; body.lang = 'grc';
    if (s.lemma) {
      const l = document.createElement('span');
      l.className = 'lemma';
      appendText(l, s.lemma, s2 ? s2.lemma : undefined);
      body.append(l, ' ');
    }
    if (s.comment) appendText(body, s.comment, s2 ? s2.comment : undefined);
    else body.append(s.lemma ? '' : '(text not available in this release)');
    d.appendChild(body);
    return d;
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
  if (!WOVEN) $('kinds').addEventListener('change', () => { if (!$('results').hidden) show(); });
  for (const b of document.querySelectorAll('.examples button')) {
    b.addEventListener('click', () => { $('ref').value = b.textContent; $('ref').focus(); });
  }

  (async function init() {
    try {
      start(await fetchRelease());
    } catch (e) {
      showLoadError(e, 'If you are offline, load a copy of the release from your computer.');
    }
  })();
})();

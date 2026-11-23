// Browser UI for the Iliad-scholia apps.  Uses the shared parser and the
// Iliad-scholia logic, which the build inlines ahead of this file.
//
// Two pages use this file.  By default the reader chooses one text (diplomatic
// or normalized).  With <body data-text="interwoven"> (the editorial view) the
// diplomatic text is shown, and wherever the normalized text differs it follows
// in parentheses (styled by the page); there is no choice of text.
//
// With <body data-scholia="all"> (the all-scholia page) a line counts the scholia
// on the same passage in any version of the Iliad, not only in the version shown.
(function () {
  const MAX_ROWS = 2000;
  const MAX_PAGES = 40;
  const WOVEN = document.body.dataset.text === 'interwoven';
  const ALL = document.body.dataset.scholia === 'all';
  const $ = id => document.getElementById(id);

  /** @type {any} */ let release = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {any[]} */ let pairs = [];
  /** @type {any[]} */ let versions = [];
  /** Resolved commentary spans, per text URN. */
  const spanCache = new Map();
  /** The manuscript pages of the passages (from the DSE records), and the view that shows one. */
  /** @type {any} */ let pageView = null;
  /** @type {{surfacesOf: Map<string, string[]>, passagesOn: Map<string, string[]>}} */ let pageIndex = { surfacesOf: new Map(), passagesOn: new Map() };

  function setStatus(msg) { $('status').textContent = msg; }

  function start(rel) {
    release = rel;
    textIndex = buildTextIndex(rel);
    pairs = commentaryPairs(rel);
    versions = iliadVersions(rel, textIndex);
    spanCache.clear();
    pageIndex = indexPages(rel);
    const pageLabels = new Map();
    for (const c of codices(rel)) for (const p of c.pages) pageLabels.set(p.urn, `${c.label}, ${p.short}`);
    pageView = createPageView({
      release: rel, textIndex, pageLabels,
      versionLabels: new Map(rel.ctsCatalog().map(c => [c.urn, `${c.workTitle} — ${c.versionLabel}`])),
      surfacesOf: pageIndex.surfacesOf, passagesOn: pageIndex.passagesOn,
    });

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
    applyUrnParam();
  }

  /**
   * Open at the version and passage given in the page address, as in
   * `iliad-scholia.html?urn=urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10`.
   * The URN names the version, optionally a text of it (`…msA.normalized`),
   * and optionally the passage or range, which is then shown at once.
   */
  function applyUrnParam() {
    let param = null;
    try { param = new URLSearchParams(location.search).get('urn'); } catch (e) { /* no usable address */ }
    if (param === null) return;
    const r = parseUrnParam(versions, param);
    if ('error' in r) { $('error').textContent = r.error; return; }
    $('version').value = r.version.urn;
    renderKinds();
    if (r.kind && !WOVEN) {
      const radio = [...document.querySelectorAll('input[name=kind]')].find(i => i.value.endsWith('.' + r.kind + ':'));
      if (radio) radio.checked = true;
    }
    updateCoverage();
    if (r.ref) { $('ref').value = r.ref; show(); }
    if (r.note) $('error').textContent = r.note;
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
    if (!spanCache.has(text.urn)) {
      spanCache.set(text.urn, ALL
        ? commentarySpansAllVersions(pairs, versions, textIndex, text)
        : commentarySpans(pairs, version.urn, text));
    }
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
    const { spans, unresolved, relations } = spansFor(cur.version, cur.text);
    const out = annotateRange(cur.text, range, spans);
    const shown = out.lines.slice(0, MAX_ROWS);

    const first = out.lines[0].ref, last = out.lines[out.lines.length - 1].ref;
    const n = out.lines.length;
    $('summary').textContent =
      `${cur.version.label}, ${first === last ? first : first + '–' + last}: ` +
      `${n} passage${n === 1 ? '' : 's'}, ${out.scholiaTotal} scholi${out.scholiaTotal === 1 ? 'on' : 'a'}` +
      (ALL ? ' in any version of the Iliad' : '');
    const notes = [];
    if (n > shown.length) notes.push(`Showing the first ${shown.length} passages.`);
    if (unresolved) {
      notes.push(`${unresolved} of ${relations ?? spans.length + unresolved} commentary relations ${ALL ? 'in all versions' : 'for this version'} could not be matched to a passage in the text (for example “13.UNKNOWN”) and are not counted.`);
    }
    $('notes').textContent = notes.join(' ');
    $('notes').hidden = notes.length === 0;

    const box = $('passages');
    box.textContent = '';
    const pagesNote = renderPages(box, shown, cur);
    if (pagesNote) { notes.push(pagesNote); $('notes').textContent = notes.join(' '); $('notes').hidden = false; }
    $('results').hidden = false;
    const firstCur = box.querySelector('#page .cur');
    if (firstCur) {
      const r = firstCur.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) firstCur.scrollIntoView({ block: 'center' });
    }
  }

  /**
   * Show the lines of the range in the context of their manuscript pages: each page
   * the range touches, whole, with the requested lines marked.  Lines the DSE records
   * do not place on a page are listed apart, as plain passages.
   * @returns {string} a note about what was left out, or ''.
   */
  function renderPages(box, lines, cur) {
    const version = cur.version.urn;
    /** @type {string[]} */ const surfaces = [];
    /** @type {any[]} */ const loose = [];
    const wanted = new Set();
    for (const line of lines) {
      const pk = version + line.ref;
      const on = pageIndex.surfacesOf.get(pk);
      if (!on) { loose.push(line); continue; }
      wanted.add(pk);
      if (!surfaces.includes(on[0])) surfaces.push(on[0]);
    }
    const o = {
      textKind: () => cur.kind, isHit: () => false, hitLabel: '', hitNoun: '', scroll: false,
      fillText(el, pk) {
        el.lang = 'grc';
        const base = passageText(textIndex, pk, cur.kind).parts;
        if (!base.length) { el.append('(text not available in this release)'); return; }
        const alt = WOVEN ? passageText(textIndex, pk, 'normalized').parts : [];
        base.forEach((p, i) => {
          if (i) el.append(' ');
          let holder = el;
          if (p.part === 'lemma') { holder = document.createElement('span'); holder.className = 'lemma'; el.append(holder); }
          appendText(holder, p.text, (alt.find(a => a.part === p.part) || {}).text);
        });
      },
    };
    const holder = document.createElement('div');
    holder.id = 'page';
    for (const surface of surfaces.slice(0, MAX_PAGES)) {
      const pb = document.createElement('div');
      pb.className = 'pagebox';
      pageView.showPage(pb, surface, wanted, o);
      holder.appendChild(pb);
    }
    if (ALL) {                                   // the scholia indexed to a requested line in any version
      const byRef = new Map(lines.map(l => [l.ref, l]));
      for (const row of holder.querySelectorAll('.line.cur')) {
        const line = byRef.get(row.dataset.passage.slice(version.length));
        if (line && line.scholia.length) row.after(renderBreakdown(versionGroups(line)));
      }
    }
    if (surfaces.length) box.appendChild(holder);
    if (loose.length) {
      const note = document.createElement('p');
      note.className = 'loose-note';
      note.textContent = `${loose.length} ${loose.length === 1 ? 'passage is' : 'passages are'} not placed on a manuscript page in the DSE records:`;
      box.appendChild(note);
      const list = document.createElement('div');
      list.className = 'passages';
      for (const line of loose) list.appendChild(renderPassage(line, cur));
      box.appendChild(list);
    }
    return surfaces.length > MAX_PAGES ? `The range covers ${surfaces.length} manuscript pages; showing the first ${MAX_PAGES}.` : '';
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
    const groups = ALL ? versionGroups(line) : [];
    if (ALL && count > 0) div.appendChild(renderBreakdown(groups));
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
          if (groups.length > 1) {
            for (const g of groups) {
              const h = document.createElement('div');
              h.className = 'vhead'; h.textContent = `${g.label}, ${g.scholia.length}`; h.title = g.full;
              panel.appendChild(h);
              for (const urn of g.scholia) panel.appendChild(renderScholion(urn, cur));
            }
          } else {
            for (const urn of line.scholia) panel.appendChild(renderScholion(urn, cur));
          }
          div.appendChild(panel);
        }
        panel.hidden = open;
        btn.setAttribute('aria-expanded', String(!open));
      });
    }
    return div;
  }

  /** A line's scholia grouped by the version they are indexed to, in the order of the version menu. */
  function versionGroups(line) {
    const order = new Map(versions.map((v, i) => [v.urn, i]));
    return Object.entries(line.byVersion)
      .map(([urn, scholia]) => {
        const v = versions.find(x => x.urn === urn);
        return { urn, scholia, full: v ? v.label : urn, label: v ? shortVersionLabel(v.label) : urn };
      })
      .sort((a, b) => (order.get(a.urn) ?? 99) - (order.get(b.urn) ?? 99));
  }

  /** "Venetus A 2 · Venetus B 2 · Escorial, Upsilon 1.1 2": how many scholia come from each version. */
  function renderBreakdown(groups) {
    const el = document.createElement('div');
    el.className = 'byms';
    el.setAttribute('aria-label', 'Scholia by version of the Iliad');
    for (const g of groups) {
      const s = document.createElement('span');
      s.className = 'ms'; s.title = `${g.scholia.length} indexed to ${g.full}`;
      const name = document.createElement('span');
      name.className = 'name'; name.textContent = g.label;
      s.append(name, ' ', String(g.scholia.length));
      el.appendChild(s);
    }
    return el;
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

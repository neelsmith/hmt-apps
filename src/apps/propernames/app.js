// Browser UI for the proper names app: choose a kind of name (personal,
// geographic, ethnic), a name, then one of the passages it occurs in; the Iliad
// and scholia text of that passage's page is shown with every name marked.
// Uses the shared sources inlined ahead of this file (see index.html).
//
// Location hash: `#k=<kind>&i=<name id>[&p=<passage>]`.
(function () {
  const $ = id => document.getElementById(id);
  const LIMIT = 60;                // passages listed at once, per text
  const SNIPPET = 70;

  /** @type {any} */ let release = null;
  /** @type {NameData | null} */ let names = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {Map<string, string>} */ let versionLabels = new Map();   // version URN -> "Iliad — Venetus A"
  /** @type {Map<string, string>} */ let pageLabels = new Map();      // surface URN -> "Venetus A manuscript, folio 12 recto"
  /** @type {Map<string, string[]>} */ let surfacesOf = new Map();
  /** @type {Map<string, string[]>} */ let passagesOn = new Map();
  /** @type {Lexicon} */ let lexicon = new Map();
  /** @type {NameKind | ''} */ let kind = '';
  /** @type {NameEntry[]} */ let items = [];      // names of the kind, in menu order
  /** @type {NameEntry | null} */ let sel = null;
  let selPassage = '';
  let ownHash = null;
  /** @type {Map<string, any[]>} */ const spansCache = new Map();
  let pairsCache = null, iVersionsCache = null, targetsCache = null;

  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  const textKind = () => document.querySelector('input[name=text]:checked').value;
  const kindLabel = k => NAME_KINDS.find(x => x.id === k).label;
  const setStatus = msg => { $('status').textContent = msg; };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // --- loading -------------------------------------------------------------------

  function start(rel) {
    release = rel;
    setStatus('Reading the name indexes…');
    // let the status paint before the heavy part
    setTimeout(() => {
      names = readNames(rel);
      textIndex = buildTextIndex(rel);
      versionLabels = new Map(rel.ctsCatalog().map(c => [c.urn, `${c.workTitle} — ${c.versionLabel}`]));
      const ip = indexPages(rel);
      surfacesOf = ip.surfacesOf; passagesOn = ip.passagesOn;
      pageLabels = new Map();
      for (const c of codices(rel)) for (const p of c.pages) pageLabels.set(p.urn, `${c.label}, ${p.short}`);
      lexicon = learnLexicon(lexiconSamples());
      spansCache.clear(); pairsCache = iVersionsCache = targetsCache = titlesCache = null;
      for (const r of document.querySelectorAll('input[name=kind]')) r.disabled = false;
      const counts = NAME_KINDS.map(k => `${names.byKind[k.id].length.toLocaleString('en')} ${kindLabel(k.id).toLowerCase()}`);
      setStatus(`${rel.library.name}: ${counts.join(', ')}` + (names.unresolved ? ` · ${plural(names.unresolved, 'index entry', 'index entries')} naming an unknown name not shown` : ''));
      $('drop').hidden = true;
      route();
    }, 0);
  }

  /** Texts of the indexed passages with the names indexed to them, both kinds of text, for learning which word is which name. */
  function lexiconSamples() {
    const out = [];
    for (const [pk, ns] of names.byPassage) {
      const keys = ns.map(n => `${n.kind}:${n.id}`);
      for (const k of ['diplomatic', 'normalized']) {
        const t = joinedText(pk, k);
        if (t) out.push({ text: t, names: keys });
      }
    }
    return out;
  }

  function joinedText(pk, k) {
    return passageText(textIndex, pk, k).parts.map(p => p.text).join(' ');
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

  // --- menus -------------------------------------------------------------------------

  function chooseKind(k) {
    kind = k;
    sel = null; selPassage = '';
    for (const r of document.querySelectorAll('input[name=kind]')) r.checked = r.value === k;
    items = k ? names.byKind[k] : [];
    $('find').value = '';
    fillItems();
    $('find').disabled = !k; $('item').disabled = !k;
    $('about').hidden = true;
    $('passages').replaceChildren(el('p', 'hint', k ? 'Choose a name.' : 'Choose a kind of name, then a name.'));
    $('page').replaceChildren(el('p', 'hint', 'Choose a passage to see its page.'));
  }

  function fillItems() {
    const q = $('find').value.trim().toLowerCase();
    const labels = menuLabels(items);
    const select = $('item');
    select.textContent = '';
    select.appendChild(new Option(items.length ? `Choose a name… (${items.length.toLocaleString('en')})` : 'No names', ''));
    let shown = 0;
    items.forEach((e, i) => {
      if (q && !(e.label.toLowerCase().includes(q) || e.id.toLowerCase() === q)) return;
      const o = new Option(labels[i], e.id);
      if (e.description) o.title = e.description;
      select.appendChild(o);
      shown++;
    });
    if (q) select.options[0].textContent = shown ? `${shown.toLocaleString('en')} match` : 'No match';
    if (sel) select.value = sel.id;
  }

  // --- navigation (location hash) -----------------------------------------------------

  function go(replace) {
    const hash = sel ? formatNameHash({ kind, id: sel.id, passage: selPassage }) : '';
    ownHash = hash || '#';
    if (replace) history.replaceState(null, '', hash || location.pathname + location.search);
    else if (hash) location.hash = hash;
    else history.pushState(null, '', location.pathname + location.search);
  }

  function route() {
    const w = parseNameHash(location.hash);
    if (!w) { chooseKind(''); return; }
    chooseKind(w.kind);
    const e = names.entries.get(`${w.kind}:${w.id}`);
    if (!e) { setStatus(`No such name: ${w.id}`); return; }
    selectName(e, w.passage, true);
  }

  // --- the passages of a name -----------------------------------------------------------

  /** Position of a passage in its text, for ordering. */
  function position(pk) {
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(pk);
    if (!m) return 1e9;
    const t = textsOfVersion(textIndex, ctsVersionOf(m[1]))[0];
    const tx = t && textIndex.get(t.urn);
    if (!tx) return 1e9;
    return tx.pos.get(m[2]) ?? tx.pos.get(m[2] + '.lemma') ?? 1e9;
  }
  const versionOf = pk => ctsVersionOf(/^(urn:cts:[^:]+:[^:]+:)/.exec(pk)[1]);
  const refOf = pk => pk.slice(versionOf(pk).length);
  const sectionRank = { iliad: 0, scholia: 1, other: 2 };

  /** Passages of the name, grouped by version of the text: Iliad first, then scholia, then others; in text order. */
  function groupPassages(e) {
    /** @type {Map<string, string[]>} */
    const by = new Map();
    for (const pk of e.passages) {
      const v = versionOf(pk);
      if (!by.has(v)) by.set(v, []);
      by.get(v).push(pk);
    }
    const order = [...versionLabels.keys()];
    const groups = [...by].map(([version, list]) => ({ version, list: list.sort((a, b) => position(a) - position(b)) }));
    groups.sort((a, b) => sectionRank[sectionOf(a.list[0])] - sectionRank[sectionOf(b.list[0])]
      || (order.indexOf(a.version) + 1 || 999) - (order.indexOf(b.version) + 1 || 999));
    return groups;
  }

  function selectName(e, passage, fromRoute) {
    sel = e;
    selPassage = passage || '';
    fillItems();
    $('item').value = e.id;
    const about = $('about');
    about.hidden = false;
    about.textContent = `${e.label}${e.description ? ' — ' + e.description : ''} · ${e.urn} · ${plural(e.passages.length, 'passage', 'passages')}`;
    renderPassageList(e);
    if (selPassage && e.passages.includes(selPassage)) showPassage(selPassage);
    else { selPassage = ''; $('page').replaceChildren(el('p', 'hint', 'Choose a passage to see its page.')); }
    if (!fromRoute) go(false);
  }

  function renderPassageList(e) {
    const box = $('passages');
    box.textContent = '';
    for (const g of groupPassages(e)) {
      box.appendChild(el('div', 'vh', `${versionLabels.get(g.version) ?? g.version} (${g.list.length.toLocaleString('en')})`));
      const rows = el('div');
      box.appendChild(rows);
      let shown = 0;
      const more = el('button', 'btn more');
      const step = (upTo) => {
        const end = Math.min(g.list.length, upTo ?? shown + LIMIT);
        for (; shown < end; shown++) rows.appendChild(rowFor(g.list[shown]));
        more.hidden = shown >= g.list.length;
        more.textContent = `Show more (${g.list.length - shown} left)`;
      };
      more.addEventListener('click', () => step());
      box.appendChild(more);
      // the chosen passage must be in the list, however far down
      const at = selPassage ? g.list.indexOf(selPassage) : -1;
      step(at >= 0 ? Math.max(LIMIT, at + 1) : undefined);
    }
  }

  function rowFor(pk) {
    const b = el('button', 'row');
    b.type = 'button'; b.dataset.passage = pk;
    if (pk === selPassage) b.classList.add('on');
    b.appendChild(el('span', 'ref', refOf(pk)));
    const pages = surfacesOf.get(pk);
    b.appendChild(el('span', 'pg', pages ? (pageLabels.get(pages[0]) ?? pages[0]) : 'no page in the DSE records'));
    const t = joinedText(pk, textKind());
    if (t) { const s = el('span', 'snip', t.length > SNIPPET ? t.slice(0, SNIPPET) + '…' : t); s.lang = 'grc'; b.appendChild(s); }
    return b;
  }

  // --- the page --------------------------------------------------------------------------

  /** Append the words of a text to an element, names marked. */
  function appendMarked(parent, tokens, spans, from, to, pk) {
    const selKey = sel ? sel.key : '';
    const names_ = names.byPassage.get(pk) ?? [];
    const hasSel = names_.some(n => `${n.kind}:${n.id}` === selKey);
    for (let i = from; i < to; i++) {
      const t = tokens[i], sp = spans.get(i);
      if (sp) {
        const s = el('span', `nm ${sp.kind}${sp.key ? '' : ' unk'}`, t.text);
        if (sp.key && sp.key === selKey) s.classList.add('sel');
        else if (!sp.key && hasSel && sp.kind === sel.kind) s.classList.add('maybe');
        const e = sp.key ? names.entries.get(sp.key) : null;
        s.title = e ? `${e.label} (${kindLabel(e.kind).toLowerCase().replace(/ names$/, ' name')})` : `${kindLabel(sp.kind).toLowerCase().replace(/ names$/, ' name')}; which one is not determined`;
        parent.appendChild(s);
      } else parent.appendChild(document.createTextNode(t.text));
      if (t.space) parent.appendChild(document.createTextNode(' '));
    }
  }

  /** Text of a passage in a container: one part, or a scholion's lemma and comment. */
  function fillText(box, pk) {
    box.lang = 'grc';
    const parts = passageText(textIndex, pk, textKind()).parts;
    if (!parts.length) { box.appendChild(el('span', 'hint', '(text not available in this release)')); return; }
    const joined = parts.map(p => p.text).join(' ');
    const { tokens, spans } = locateNames(joined, names.byPassage.get(pk) ?? [], lexicon);
    let at = 0;
    parts.forEach((p, i) => {
      const n = tokenize(p.text).length;
      const holder = parts.length > 1 || p.part ? el('span', p.part === 'lemma' ? 'lemma' : '') : box;
      appendMarked(holder, tokens, spans, at, at + n, pk);
      if (holder !== box) { if (i) box.appendChild(document.createTextNode(' ')); box.appendChild(holder); }
      at += n;
    });
  }

  function hasSelected(pk) {
    return !!sel && (names.byPassage.get(pk) ?? []).some(n => `${n.kind}:${n.id}` === sel.key);
  }

  function showPassage(pk) {
    selPassage = pk;
    for (const r of $('passages').querySelectorAll('.row')) r.classList.toggle('on', r.dataset.passage === pk);
    const surfaces = surfacesOf.get(pk);
    const box = $('page');
    box.textContent = '';
    if (!surfaces) { renderLoose(box, pk); return; }
    renderPage(box, surfaces[0], pk, surfaces);
  }

  function renderLoose(box, pk) {
    box.appendChild(el('h2', '', `${versionLabels.get(versionOf(pk)) ?? versionOf(pk)} ${refOf(pk)}`));
    box.appendChild(el('p', 'sub', 'The DSE records do not place this passage on a page; here is the passage alone.'));
    const t = el('div', 'greek');
    fillText(t, pk);
    box.appendChild(t);
  }

  function renderPage(box, surface, current, surfaces) {
    box.appendChild(el('h2', '', pageLabels.get(surface) ?? surface));
    const sub = el('p', 'sub', surface);
    if (surfaces.length > 1) {
      sub.append(' · also on: ');
      for (const s of surfaces.filter(x => x !== surface)) {
        const b = el('button', 'btn', pageLabels.get(s) ?? s);
        b.addEventListener('click', () => { box.textContent = ''; renderPage(box, s, current, surfaces); });
        sub.appendChild(b);
      }
    }
    box.appendChild(sub);

    const keys = (passagesOn.get(surface) ?? []).slice();
    /** @type {Record<string, string[]>} */
    const secs = { iliad: [], scholia: [], other: [] };
    for (const pk of keys) secs[sectionOf(pk)].push(pk);
    for (const s of Object.keys(secs)) secs[s].sort((a, b) => (versionOf(a) === versionOf(b) ? position(a) - position(b) : versionOf(a).localeCompare(versionOf(b))));

    // Iliad lines, each followed by the scholia of the page that comment on it
    /** @type {Map<string, string[]>} */
    const iliadBy = new Map();
    for (const pk of secs.iliad) { const v = versionOf(pk); if (!iliadBy.has(v)) iliadBy.set(v, []); iliadBy.get(v).push(pk); }
    let rest = secs.scholia.slice();
    const nHas = secs.scholia.filter(hasSelected).length;
    for (const [version, lines] of iliadBy) {
      const shown = shownText(version);
      const { byLine, loose } = shown ? attachScholia(lines.map(refOf), shown, spansFor(version), rest) : { byLine: new Map(), loose: rest };
      rest = loose;
      const label = iliadBy.size > 1 ? ` · ${(versionLabels.get(version) ?? version).replace(/^Iliad — /, '')}` : '';
      box.appendChild(el('h3', '', `Iliad${label} · ${plural(lines.length, 'line', 'lines')}`));
      for (const pk of lines) {
        const row = el('div', 'line');
        row.dataset.passage = pk;
        if (pk === current) row.classList.add('cur');
        row.appendChild(el('span', 'ref', refOf(pk)));
        const t = el('span', 'greek');
        fillText(t, pk);
        row.appendChild(t);
        box.appendChild(row);
        const attached = byLine.get(refOf(pk));
        if (!attached) continue;
        const panel = el('div', 'panel');
        for (const a of attached) panel.appendChild(scholionEl(a.key, current, a.from === a.to ? a.from : `${a.from}–${a.to}`));
        const nOpen = attached.filter(a => hasSelected(a.key) || a.key === current).length;
        const badge = el('button', 'badge', `${plural(attached.length, 'scholion', 'scholia')}${nOpen ? ` · ${nOpen} with “${sel.label}”` : ''}`);
        badge.type = 'button';
        if (nOpen) badge.classList.add('hot');
        panel.hidden = !nOpen;
        badge.setAttribute('aria-expanded', String(!panel.hidden));
        badge.title = 'Show the scholia';
        badge.addEventListener('click', () => { panel.hidden = !panel.hidden; badge.setAttribute('aria-expanded', String(!panel.hidden)); });
        row.appendChild(badge);
        box.appendChild(panel);
      }
    }

    // scholia that comment on no line of this page
    const hasLines = iliadBy.size > 0;
    if (rest.length || (!hasLines && secs.scholia.length)) {
      const h = el('h3', '', `${hasLines ? 'Other scholia on this page' : 'Scholia'} · ${plural(rest.length, 'scholion', 'scholia')}`);
      box.appendChild(h);
      for (const pk of rest) box.appendChild(scholionEl(pk, current, ''));
    }

    if (secs.scholia.length) {
      const fold = el('button', 'btn', 'Unfold all scholia');
      let all = false;
      fold.addEventListener('click', () => {
        all = !all;
        for (const pn of box.querySelectorAll('.panel')) {
          const open = all || !!pn.querySelector('details.scholion.has, details.scholion.cur');
          pn.hidden = !open;
          const b = pn.previousElementSibling && pn.previousElementSibling.querySelector('.badge');
          if (b) b.setAttribute('aria-expanded', String(open));
        }
        for (const d of box.querySelectorAll('details.scholion')) d.open = all || d.classList.contains('has') || d.classList.contains('cur');
        fold.textContent = all ? 'Fold scholia without the name' : 'Unfold all scholia';
      });
      const top = el('p', 'sub', `${plural(secs.scholia.length, 'scholion', 'scholia')} on this page` + (nHas ? `, ${nHas} with “${sel.label}”. ` : '. '));
      top.appendChild(fold);
      sub.after(top);
    }

    if (secs.other.length) {
      box.appendChild(el('h3', '', `Other text · ${plural(secs.other.length, 'passage', 'passages')}`));
      for (const pk of secs.other) {
        const row = el('div', 'line');
        if (pk === current) row.classList.add('cur');
        row.appendChild(el('span', 'ref', refOf(pk)));
        const t = el('span', 'greek');
        fillText(t, pk);
        row.appendChild(t);
        box.appendChild(row);
      }
    }
    const cur = box.querySelector('.cur');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  /** One scholion, folded unless it has the selected name or is the chosen passage. */
  function scholionEl(pk, current, on) {
    const d = el('details', 'scholion');
    d.dataset.passage = pk;
    const has = hasSelected(pk);
    d.open = has || pk === current;
    if (has) d.classList.add('has');
    if (pk === current) d.classList.add('cur');
    const sm = el('summary');
    sm.appendChild(el('span', 'id', passageLabel(pk, versionLabelsByTitle())));
    const target = on || commentedOn(pk);
    if (target) sm.appendChild(el('span', 'on', `on ${target}`));
    const lemma = passageText(textIndex, pk, textKind()).parts.find(p => p.part === 'lemma');
    if (lemma) { const pre = el('span', 'pre greek', lemma.text.length > 60 ? lemma.text.slice(0, 60) + '…' : lemma.text); pre.lang = 'grc'; sm.appendChild(pre); }
    if (has) sm.appendChild(el('span', 'hasname', sel.label));
    d.appendChild(sm);
    const body = el('div', 'body greek');
    fillText(body, pk);
    d.appendChild(body);
    return d;
  }

  /** The text a text version's scholia are positioned in, and the spans of commentary relations in it (computed once per version). */
  function shownText(version) {
    const t = textsOfVersion(textIndex, version)[0];
    return t ? textIndex.get(t.urn) : null;
  }
  function spansFor(version) {
    let sp = spansCache.get(version);
    if (!sp) {
      const shown = shownText(version);
      sp = shown ? commentarySpansAllVersions(commentary(), iVersions(), textIndex, shown).spans : [];
      spansCache.set(version, sp);
    }
    return sp;
  }
  function commentary() { return pairsCache ?? (pairsCache = commentaryPairs(release)); }
  function iVersions() { return iVersionsCache ?? (iVersionsCache = iliadVersions(release, textIndex)); }
  /** "Iliad 1.13-1.16": what a scholion is indexed to, for scholia not placed under a line. */
  function commentedOn(pk) {
    if (!targetsCache) {
      targetsCache = new Map();
      for (const p of commentary()) {
        const k = passageKey(p.scholion);
        if (!k) continue;
        const list = targetsCache.get(k) ?? [];
        const label = passageLabel(p.target, versionLabelsByTitle());
        if (!list.includes(label)) list.push(label);
        targetsCache.set(k, list);
      }
    }
    return (targetsCache.get(pk) ?? []).join(', ');
  }

  let titlesCache = null;
  function versionLabelsByTitle() { return titlesCache ?? (titlesCache = catalogTitles(release)); }

  // --- wiring ---------------------------------------------------------------------------------

  for (const r of document.querySelectorAll('input[name=kind]')) {
    r.addEventListener('change', () => { chooseKind(r.value); go(false); });
  }
  $('find').addEventListener('input', fillItems);
  $('item').addEventListener('change', e => {
    const id = e.target.value;
    if (!id) return;
    selectName(names.entries.get(`${kind}:${id}`), '', false);
  });
  $('passages').addEventListener('click', e => {
    const row = e.target.closest('.row');
    if (!row) return;
    showPassage(row.dataset.passage);
    go(false);
  });
  for (const r of document.querySelectorAll('input[name=text]')) {
    r.addEventListener('change', () => { if (sel) { renderPassageList(sel); if (selPassage) showPassage(selPassage); } });
  }
  window.addEventListener('hashchange', () => {
    const h = location.hash || '#';
    if (ownHash === h) { ownHash = null; return; }
    ownHash = null;
    if (names) route();
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

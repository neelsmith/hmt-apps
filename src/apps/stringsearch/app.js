// Browser UI for the string search app: enter a Greek string (no diacritics
// needed), optionally limit the search to the Iliad or the scholia, pick one of
// the matching passages, and see the Iliad and scholia text of its page with
// every match marked.  Uses the shared sources inlined ahead of this file.
//
// Location hash: `#q=<string>&s=<all|iliad|scholia>&t=<diplomatic|normalized>[&p=<passage>]`.
(function () {
  const $ = id => document.getElementById(id);
  const LIMIT = 60;                // passages listed at once, per text
  const DEBOUNCE = 250;

  /** @type {any} */ let release = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {Map<string, string>} */ let versionLabels = new Map();
  /** @type {Map<string, string>} */ let pageLabels = new Map();
  /** @type {Map<string, string[]>} */ let surfacesOf = new Map();
  /** @type {any} */ let pageView = null;
  /** @type {Map<string, SearchIndex>} */ const indexes = new Map();
  let query = '';                  // the folded query of the results on show
  let typed = '';                  // as the user typed it
  let results = [];
  let selPassage = '';
  let ownHash = null;
  let timer = 0;

  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  const radio = name => document.querySelector(`input[name=${name}]:checked`).value;
  const textKind = () => radio('text');
  const scope = () => radio('scope');
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

  // --- marking ---------------------------------------------------------------------

  /** Append a text to an element with the matches of the query marked. */
  function appendMarked(parent, text) {
    let at = 0;
    for (const m of findMatches(text, query)) {
      if (m.start > at) parent.appendChild(document.createTextNode(text.slice(at, m.start)));
      parent.appendChild(el('mark', 'hit', text.slice(m.start, m.end)));
      at = m.end;
    }
    if (at < text.length) parent.appendChild(document.createTextNode(text.slice(at)));
  }

  /** The text of a passage in a container, matches marked; a scholion's lemma and comment in their own parts. */
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

  // --- searching ---------------------------------------------------------------------

  function setAbout(msg) { $('about').textContent = msg; }

  /** Run the search in the form; `how`: 'push' to add a history entry, 'replace' to replace it, 'none' for none (the hash is already right). */
  function search(how) {
    clearTimeout(timer);
    typed = $('q').value.trim();
    query = parseQuery(typed);
    selPassage = '';
    if (query.length < MIN_QUERY) {
      results = [];
      query = '';
      $('passages').replaceChildren(el('p', 'hint', 'Enter a string to search for.'));
      $('page').replaceChildren(el('p', 'hint', 'Choose a passage to see its page.'));
      setAbout(typed ? 'Type at least two letters.' : 'Type at least two letters. Accents, breathings, capitals and punctuation do not matter.');
      go(how);
      return;
    }
    results = searchPassages(searchIndex(), query, scope());
    const groups = tokenGroups();
    setAbout(results.length
      ? `${plural(results.length, 'passage', 'passages')} contain “${typed}”, in ${plural(groups.length, 'different word form', 'different word forms')}.`
      : `No passage contains “${typed}”.`);
    renderList();
    $('page').replaceChildren(el('p', 'hint', results.length ? 'Choose a passage to see its page.' : ''));
    go(how);
  }

  /** Matching passages (Iliad first, then scholia, in text order) grouped under their word tokens. */
  function tokenGroups() {
    const ordered = groupByVersion(textIndex, results, [...versionLabels.keys()]).flatMap(g => g.list);
    return groupByToken(searchIndex(), ordered, query);
  }

  function renderList() {
    const box = $('passages');
    box.textContent = '';
    if (!results.length) { box.appendChild(el('p', 'hint', 'No matches. Try fewer letters, or search all texts.')); return; }
    const ix = searchIndex();
    for (const g of tokenGroups()) {
      const h = el('div', 'vh');
      h.lang = 'grc';
      h.appendChild(document.createTextNode(g.form));
      h.appendChild(el('span', 'n', ` (${g.keys.length.toLocaleString('en')})`));
      box.appendChild(h);
      const rows = el('div');
      box.appendChild(rows);
      let shown = 0;
      const more = el('button', 'btn more');
      more.type = 'button';
      const step = upTo => {
        const end = Math.min(g.keys.length, upTo ?? shown + LIMIT);
        for (; shown < end; shown++) rows.appendChild(rowFor(g.keys[shown], ix, g.token));
        more.hidden = shown >= g.keys.length;
        more.textContent = `Show more (${g.keys.length - shown} left)`;
      };
      more.addEventListener('click', () => step());
      box.appendChild(more);
      const at = selPassage ? g.keys.indexOf(selPassage) : -1;     // the chosen passage must be listed, however far down
      step(at >= 0 ? Math.max(LIMIT, at + 1) : undefined);
    }
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

  // --- navigation (location hash) --------------------------------------------------------

  function go(how) {
    if (how === 'none') return;
    const hash = query ? formatSearchHash({ q: typed, scope: scope(), kind: textKind(), passage: selPassage }) : '';
    ownHash = hash || '#';
    if (how === 'replace') history.replaceState(null, '', hash || location.pathname + location.search);
    else if (hash) location.hash = hash;
    else history.pushState(null, '', location.pathname + location.search);
  }

  function route() {
    const w = parseSearchHash(location.hash);
    if (!w) { if (query) { $('q').value = ''; search('none'); } return; }
    $('q').value = w.q;
    document.querySelector(`input[name=scope][value=${w.scope}]`).checked = true;
    document.querySelector(`input[name=text][value=${w.kind}]`).checked = true;
    search('none');
    if (w.passage && results.includes(w.passage)) {
      selPassage = w.passage;
      renderList();
      showPassage(w.passage);
    }
  }

  // --- wiring ------------------------------------------------------------------------------

  $('controls').addEventListener('submit', e => { e.preventDefault(); search('push'); });
  $('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search('replace'), DEBOUNCE); });
  for (const r of document.querySelectorAll('input[name=scope]')) r.addEventListener('change', () => { if (release) search('push'); });
  for (const r of document.querySelectorAll('input[name=text]')) {
    r.addEventListener('change', () => {
      if (!release) return;
      const keep = selPassage;
      search('replace');
      if (keep && results.includes(keep)) { selPassage = keep; renderList(); showPassage(keep); go('replace'); }
    });
  }
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

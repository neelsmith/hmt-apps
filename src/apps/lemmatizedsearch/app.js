// Browser UI for the lemmatized search app: search the lemmata of the lemmatization data set,
// see the matching lemmata as a folding list (accordion) with their tokens, choose a token and
// see the page of its passage with the token marked.  Uses the shared sources inlined ahead of
// this file.
//
// Location hash: `#q=<string>[&l=<lemma>][&o=<token URN without urn:cts:>]`.
(function () {
  const $ = id => document.getElementById(id);
  const LIMIT = 60;                // tokens listed at once under a lemma
  const LEMMA_LIMIT = 200;         // lemmata listed at once
  const EXPAND_LIMIT = 30;         // "Expand all" opens this many at most
  const DEBOUNCE = 250;

  /** @type {any} */ let release = null;
  /** @type {LemmaData | null} */ let lemmata = null;
  /** @type {LemmataRelease[] | null} */ let meta = null;
  /** @type {Map<string, any>} */ let textIndex = new Map();
  /** @type {Map<string, string>} */ let versionLabels = new Map();
  /** @type {Map<string, string>} */ let pageLabels = new Map();
  /** @type {Map<string, string[]>} */ let surfacesOf = new Map();
  /** @type {any} */ let pageView = null;
  let ready = false;
  let query = '', typed = '';
  /** @type {LemmaEntry[]} */ let found = [];
  let shownLemmata = 0;
  /** @type {{entry: LemmaEntry, occ: Occurrence, loc: any} | null} */ let sel = null;
  let ownHash = null;
  let timer = 0;

  const plural = (n, one, many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
  const mb = n => `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;
  const setStatus = msg => { $('status').textContent = msg; };
  const versionOrder = () => [...versionLabels.keys()];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // --- progress ---------------------------------------------------------------------------------

  /** @param {string} id row of the loading panel */
  function progress(id, text, read, total) {
    const row = $(id);
    row.querySelector('.t').textContent = text;
    const bar = row.querySelector('progress');
    if (total && read <= total) { bar.max = total; bar.value = read; } else bar.removeAttribute('value');
  }
  function finished(id, text, failed = false) {
    const row = $(id);
    row.querySelector('.t').textContent = text;
    row.classList.add(failed ? 'fail' : 'done');
  }

  /** Fetch a URL, reporting the bytes read.  @returns {Promise<Response>} */
  async function get(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp;
  }
  const lengthOf = resp => Number(resp.headers.get('content-length')) || 0;

  /** Read a response as text, reporting progress. */
  async function readText(resp, label, id) {
    const total = lengthOf(resp);
    const reader = /** @type {ReadableStream<Uint8Array>} */ (resp.body).getReader();
    const dec = new TextDecoder('utf-8');
    let text = '', read = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.length;
      text += dec.decode(value, { stream: true });
      progress(id, `${label}: ${mb(read)}${total ? ` of ${mb(total)}` : ''}`, read, total);
    }
    return text + dec.decode();
  }

  // --- loading -------------------------------------------------------------------------------------

  /** Words for a failed fetch: a TypeError ("Load failed", "Failed to fetch") means the browser stopped the request, most often because the server does not allow other sites to read the file (CORS), or is unreachable. */
  const why = e => (e instanceof TypeError
    ? `${e.message || 'network error'}: the browser could not read the file. Either the server cannot be reached, or it does not allow pages from other sites to read it (CORS)`
    : (e.message || String(e)));

  const problems = [];
  function problem(msg) {
    problems.push(msg);
    $('problem').textContent = problems.join(' ');
    $('drop').hidden = false;
  }

  async function loadReleaseNet() {
    progress('ld-release', 'HMT release: connecting…', 0, 0);
    try {
      const resp = await get(DEFAULT_RELEASE_URL);
      const text = await readText(resp, 'HMT release', 'ld-release');
      progress('ld-release', 'HMT release: reading…', 0, 0);
      await new Promise(r => setTimeout(r, 0));
      setRelease(parseRelease(text));
    } catch (e) {
      finished('ld-release', 'HMT release: not loaded', true);
      problem(`Could not load the HMT release (${why(e)}).`);
    }
  }

  async function loadLemmataNet() {
    progress('ld-lemmata', 'Lemmatization data: connecting…', 0, 0);
    try {
      const resp = await get(LEMMATA_URL);
      const total = lengthOf(resp);
      const d = await readLemmata(/** @type {ReadableStream<Uint8Array>} */ (resp.body), {
        onProgress: p => progress('ld-lemmata', `Lemmatization data: ${mb(p.read)}${total ? ` of ${mb(total)}` : ''} · ${p.rows.toLocaleString('en')} tokens read`, p.read, total),
      });
      setLemmata(d);
    } catch (e) {
      finished('ld-lemmata', 'Lemmatization data: not loaded', true);
      problem(`Could not load the lemmatization data (${why(e)}). Download ${LEMMATA_URL} and load the saved file here instead.`);
    }
  }

  async function loadMetaNet() {
    progress('ld-meta', 'Lemmatization metadata: connecting…', 0, 0);
    try {
      const resp = await get(LEMMATA_RELEASES_URL);
      setMeta(parseReleasesCex(await readText(resp, 'Lemmatization metadata', 'ld-meta')));
    } catch (e) {
      finished('ld-meta', 'Lemmatization metadata: not loaded', true);
      meta = [];
      showVersionInfo();
    }
  }

  /** What kind of file a dropped file is, from its first lines. @param {File} file */
  async function sniff(file) {
    const head = await file.slice(0, 4096).text();
    if (/^#!(cexversion|citelibrary)/m.test(head)) return 'release';
    if (/^release\|date\|archive\|llm/m.test(head) || /^lemmata-[^|\n]*\|/m.test(head)) return 'meta';
    return 'lemmata';
  }

  async function loadFile(file) {
    try {
      const kind = await sniff(file);
      if (kind === 'release') {
        $('ld-release').classList.remove('fail', 'done');
        $('loading').hidden = false;
        progress('ld-release', `HMT release: reading ${file.name}…`, 0, 0);
        await new Promise(r => setTimeout(r, 0));
        setRelease(await readReleaseFile(file));
      } else if (kind === 'meta') {
        setMeta(parseReleasesCex(await file.text()));
      } else {
        $('ld-lemmata').classList.remove('fail', 'done');
        $('loading').hidden = false;
        const d = await readLemmata(file.stream(), {
          onProgress: p => progress('ld-lemmata', `Lemmatization data (${file.name}): ${mb(p.read)} of ${mb(file.size)} · ${p.rows.toLocaleString('en')} tokens read`, p.read, file.size),
        });
        setLemmata(d);
      }
    } catch (e) {
      problem(`${file.name}: ${e.message || e}`);
    }
  }

  function setRelease(rel) {
    release = rel;
    finished('ld-release', 'HMT release: loaded');
    showVersionInfo();
    maybeReady();
  }

  function setLemmata(d) {
    lemmata = d;
    finished('ld-lemmata', `Lemmatization data: ${d.lexical.toLocaleString('en')} lexical tokens of ${plural(d.list.length, 'lemma', 'lemmata')}`);
    showVersionInfo();
    maybeReady();
  }

  function setMeta(rows) {
    meta = rows;
    finished('ld-meta', 'Lemmatization metadata: loaded');
    showVersionInfo();
  }

  /** The line that compares the archive release behind the lemmatization with the release in use. */
  function showVersionInfo() {
    const box = $('versioninfo');
    if (meta === null && !lemmata && !release) return;
    const cur = meta ? currentLemmataRelease(meta) : null;
    box.hidden = false;
    box.classList.remove('warn');
    if (meta === null) { box.textContent = 'Reading the lemmatization metadata…'; return; }
    if (!cur) { box.textContent = 'No “lemmata-current” row in the lemmatization metadata, so its source release is unknown.'; box.classList.add('warn'); return; }
    const built = `Lemmatization “${cur.release}”: ${cur.date}, built from HMT archive release ${cur.archive}${cur.llm ? `, using ${cur.llm}` : ''}.`;
    if (!release) { box.textContent = `${built} (Release not loaded yet, so not compared.)`; return; }
    const c = compareArchives(cur.archive, release.library);
    if (c.status === 'same') box.textContent = `✓ ${built} This is the release loaded here (${c.release}).`;
    else if (c.status === 'different') { box.textContent = `⚠ ${built} The release loaded here is ${c.release}, so some passages may differ from the lemmatized tokens.`; box.classList.add('warn'); }
    else { box.textContent = `${built} The release loaded here is “${c.release}”; the two could not be compared.`; box.classList.add('warn'); }
  }

  /** Both the release and the lemmatization are in: build what the page view needs and enable the search. */
  function maybeReady() {
    if (ready || !release || !lemmata) return;
    ready = true;
    setStatus('Preparing…');
    setTimeout(() => {
      textIndex = buildTextIndex(release);
      versionLabels = new Map(release.ctsCatalog().map(c => [c.urn, `${c.workTitle} — ${c.versionLabel}`]));
      const ip = indexPages(release);
      surfacesOf = ip.surfacesOf;
      for (const c of codices(release)) for (const p of c.pages) pageLabels.set(p.urn, `${c.label}, ${p.short}`);
      pageView = createPageView({ release, textIndex, versionLabels, pageLabels, surfacesOf, passagesOn: ip.passagesOn });
      const bases = new Set(lemmata.versions.map(v => ctsVersionOf(v.replace(/-tokens(?=:$)/, ''))));
      const missing = [...bases].filter(v => v && !versionLabels.has(v));
      const notes = [];
      if (missing.length) notes.push(`The lemmatization covers texts that are not in this release: ${missing.join(', ')}.`);
      if (lemmata.malformed) notes.push(`${plural(lemmata.malformed, 'line', 'lines')} of the lemmatization data could not be read.`);
      if (notes.length) { $('versioninfo').hidden = false; $('versioninfo').classList.add('warn'); $('versioninfo').textContent += ' ' + notes.join(' '); }
      setStatus(`${release.library.name} · ${plural(lemmata.list.length, 'lemma', 'lemmata')}, ${lemmata.lexical.toLocaleString('en')} tokens`);
      $('loading').hidden = true;
      if (!problems.length) $('drop').hidden = true;
      for (const e of [$('q'), $('go')]) e.disabled = false;
      route();
      if (!query) $('q').focus();
    }, 0);
  }

  // --- the list of lemmata ---------------------------------------------------------------------------

  function setAbout(msg) { $('about').textContent = msg; }
  const HINT = 'Search the lemmata of the lemmatized tokens. Type at least two letters; accents, breathings and capitals do not matter.';

  /** Run the search in the form; `how`: 'push', 'replace' or 'none' (the hash is already right). */
  function search(how) {
    clearTimeout(timer);
    typed = $('q').value.trim();
    query = parseQuery(typed);
    sel = null;
    $('page').replaceChildren(el('p', 'hint', 'Choose a token to see its page.'));
    if (query.length < MIN_QUERY) {
      query = ''; found = [];
      $('passages').replaceChildren(el('p', 'hint', 'Enter a lemma, or part of one, to search for.'));
      setAbout(typed ? 'Type at least two letters.' : HINT);
      go(how);
      return;
    }
    found = searchLemmata(/** @type {LemmaData} */ (lemmata), query);
    const tokens = found.reduce((n, e) => n + e.t.length, 0);
    setAbout(found.length
      ? `${plural(found.length, 'lemma matches', 'lemmata match')} “${typed}”, with ${plural(tokens, 'token', 'tokens')}. Open a lemma to list its tokens.`
      : `No lemma contains “${typed}”.`);
    shownLemmata = 0;
    renderList();
    go(how);
  }

  function renderList() {
    const box = $('passages');
    box.textContent = '';
    if (!found.length) { box.appendChild(el('p', 'hint', 'No matches. Try fewer letters.')); return; }
    const tools = el('div', 'lemmatools');
    const open = el('button', 'btn', found.length > EXPAND_LIMIT ? `Expand first ${EXPAND_LIMIT}` : 'Expand all');
    const shut = el('button', 'btn', 'Collapse all');
    open.type = shut.type = 'button';
    open.addEventListener('click', () => { for (const d of [...box.querySelectorAll('details.lem')].slice(0, EXPAND_LIMIT)) d.open = true; });
    shut.addEventListener('click', () => { for (const d of box.querySelectorAll('details.lem')) d.open = false; });
    tools.append(open, shut);
    box.appendChild(tools);
    const list = el('div', 'lemlist');
    box.appendChild(list);
    const more = el('button', 'btn more');
    more.type = 'button';
    more.addEventListener('click', () => addLemmata(list, more));
    box.appendChild(more);
    addLemmata(list, more);
    if (found.length === 1) /** @type {HTMLDetailsElement} */ (list.querySelector('details.lem')).open = true;
  }

  /** @param {number} [upTo] list lemmata up to this many in all */
  function addLemmata(list, more, upTo) {
    const end = Math.min(found.length, upTo ?? shownLemmata + LEMMA_LIMIT);
    for (; shownLemmata < end; shownLemmata++) list.appendChild(lemmaBlock(found[shownLemmata]));
    more.hidden = shownLemmata >= found.length;
    more.textContent = `Show more lemmata (${found.length - shownLemmata} left)`;
  }

  /** A folding block for one lemma; its tokens are listed when it is first opened. */
  function lemmaBlock(entry) {
    const d = /** @type {HTMLDetailsElement} */ (el('details', 'lem'));
    d.dataset.lemma = entry.lemma;
    const sum = el('summary');
    const lm = el('span', 'lm', entry.lemma);
    lm.lang = 'grc';
    sum.append(lm, el('span', 'n', ` — ${plural(entry.t.length, 'token', 'tokens')}`));
    d.appendChild(sum);
    d.addEventListener('toggle', () => { if (d.open && !d.dataset.built) fillLemma(d, entry); });
    return d;
  }

  /** @param {HTMLDetailsElement} d @param {LemmaEntry} entry @param {string} [wantUrn] token URN that must be listed */
  function fillLemma(d, entry, wantUrn) {
    d.dataset.built = '1';
    const forms = lemmaForms(entry);
    const f = el('p', 'forms');
    f.lang = 'grc';
    f.textContent = `Forms: ${forms.slice(0, 8).map(x => `${x.form} ${x.count}`).join(' · ')}${forms.length > 8 ? ` · and ${forms.length - 8} more` : ''}`;
    d.appendChild(f);
    const order = orderOccurrences(/** @type {LemmaData} */ (lemmata), entry, versionOrder());
    const rows = el('div', 'rows');
    d.appendChild(rows);
    let shown = 0;
    const more = el('button', 'btn more');
    more.type = 'button';
    const step = upTo => {
      const end = Math.min(order.length, upTo ?? shown + LIMIT);
      for (; shown < end; shown++) rows.appendChild(rowFor(entry, order[shown]));
      more.hidden = shown >= order.length;
      more.textContent = `Show more (${order.length - shown} left)`;
    };
    more.addEventListener('click', () => step());
    d.appendChild(more);
    let at = -1;
    if (wantUrn) at = order.findIndex(i => occurrenceOf(/** @type {LemmaData} */ (lemmata), entry, i).tokenUrn === wantUrn);
    step(at >= 0 ? Math.max(LIMIT, at + 1) : undefined);
  }

  /** Passage text parts of an occurrence (normalized: the text that was lemmatized). */
  const partsOf = occ => (occ.key ? passageText(textIndex, occ.key, 'normalized').parts : []);

  function rowFor(entry, i) {
    const occ = occurrenceOf(/** @type {LemmaData} */ (lemmata), entry, i);
    const b = pvRowEl();
    b.dataset.lemma = entry.lemma;
    b.dataset.token = occ.tokenUrn;
    b.dataset.i = String(i);
    if (sel && sel.occ.tokenUrn === occ.tokenUrn) b.classList.add('on');
    const t = el('span', 'tok', occ.token);
    t.lang = 'grc';
    b.appendChild(t);
    if (occ.key) { const r = pvRefEl('ref', occ.key, refOf(occ.key)); if (occ.n) r.append(` · token ${occ.n}`); b.appendChild(r); }
    else b.appendChild(el('span', 'ref', occ.tokenUrn));
    const pages = occ.key ? surfacesOf.get(occ.key) : null;
    const where = occ.key
      ? `${versionLabels.get(occ.version) ?? occ.version} · ${pages ? (pageLabels.get(pages[0]) ?? pages[0]) : 'no page in the DSE records'}`
      : 'passage not recognised';
    b.appendChild(el('span', 'pg', `${where}${occ.pos ? ` · ${occ.pos}` : ''}`));
    const parts = partsOf(occ);
    if (!parts.length) {
      b.appendChild(el('span', 'pg', 'passage text not in this release'));
    } else {
      const loc = locateToken(parts, occ.token, occ.n, occ.part);
      const h = loc.hits[0];
      if (h) {
        const text = parts[h.part].text;
        const s = el('span', 'snip');
        s.lang = 'grc';
        s.appendChild(document.createTextNode(text.slice(Math.max(0, h.start - 36), h.start)));
        s.appendChild(el('mark', 'hit', text.slice(h.start, h.end)));
        s.appendChild(document.createTextNode(text.slice(h.end, h.end + 36)));
        b.appendChild(s);
      }
    }
    return b;
  }

  // --- the page of a token ---------------------------------------------------------------------------

  function appendMarked(parent, text, ranges, title) {
    let at = 0;
    for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
      if (r.start > at) parent.appendChild(document.createTextNode(text.slice(at, r.start)));
      const m = el('mark', 'hit', text.slice(r.start, r.end));
      m.title = title;
      parent.appendChild(m);
      at = r.end;
    }
    if (at < text.length) parent.appendChild(document.createTextNode(text.slice(at)));
  }

  function fillText(box, pk) {
    box.lang = 'grc';
    const parts = passageText(textIndex, pk, 'normalized').parts;
    if (!parts.length) { box.appendChild(el('span', 'hint', '(text not available in this release)')); return; }
    const here = sel && pk === sel.occ.key ? sel : null;
    parts.forEach((p, i) => {
      const ranges = here ? here.loc.hits.filter(h => h.part === i) : [];
      const title = here ? `${here.occ.lemma}${here.occ.pos ? ` · ${here.occ.pos}` : ''}` : '';
      if (parts.length === 1 && !p.part) { appendMarked(box, p.text, ranges, title); return; }
      if (i) box.appendChild(document.createTextNode(' '));
      const holder = el('span', p.part === 'lemma' ? 'lemma' : '');
      appendMarked(holder, p.text, ranges, title);
      box.appendChild(holder);
    });
  }

  function showToken(entry, i) {
    const occ = occurrenceOf(/** @type {LemmaData} */ (lemmata), entry, i);
    for (const r of $('passages').querySelectorAll('.row')) r.classList.toggle('on', r.dataset.token === occ.tokenUrn);
    const page = $('page');
    if (!occ.key) {
      page.replaceChildren(el('p', 'warnnote', `The token URN ${occ.tokenUrn} does not name a passage this app can read.`));
      sel = null;
      return;
    }
    const loc = locateToken(partsOf(occ), occ.token, occ.n, occ.part);
    sel = { entry, occ, loc };
    pageView.show(page, occ.key, { textKind: () => 'normalized', fillText, isHit: pk => pk === occ.key, hitLabel: `“${occ.token}”`, hitNoun: 'token' });
    if (!partsOf(occ).length) page.prepend(el('p', 'warnnote', `The passage ${occ.passageUrn} is not in the loaded release. Is it the release the lemmatization was made from?`));
    else if (loc.how === 'none') page.prepend(el('p', 'warnnote', `The token “${occ.token}” was not found in the normalized text of this passage, so nothing is marked.`));
    else if (loc.how === 'nearest') page.prepend(el('p', 'warnnote', `“${occ.token}” occurs more than once in this passage and its token number (${occ.n}) does not fit the text exactly, so the nearest one is marked.`));
    else if (loc.how === 'string' && loc.hits.length > 1) page.prepend(el('p', 'warnnote', `Every “${occ.token}” in the passage is marked.`));
  }

  // --- navigation (location hash) -----------------------------------------------------------------------

  function go(how) {
    if (how === 'none') return;
    const hash = query ? formatLemmaHash({ q: typed, lemma: sel?.occ.lemma ?? openLemma(), token: sel?.occ.tokenUrn }) : '';
    ownHash = hash || '#';
    if (how === 'replace') history.replaceState(null, '', hash || location.pathname + location.search);
    else if (hash) location.hash = hash;
    else history.pushState(null, '', location.pathname + location.search);
  }

  /** The first open lemma, if exactly one is open. */
  function openLemma() {
    const open = [...$('passages').querySelectorAll('details.lem[open]')];
    return open.length === 1 ? /** @type {HTMLElement} */ (open[0]).dataset.lemma ?? '' : '';
  }

  function route() {
    const w = parseLemmaHash(location.hash);
    if (!w) { if (query) { $('q').value = ''; search('none'); } return; }
    $('q').value = w.q;
    search('none');
    if (!w.lemma) return;
    const at = found.findIndex(e => e.lemma === w.lemma);
    if (at < 0) return;
    const list = /** @type {HTMLElement} */ ($('passages').querySelector('.lemlist'));
    if (at >= shownLemmata) addLemmata(list, /** @type {HTMLElement} */ ($('passages').querySelector('.more')), at + 1);
    const d = /** @type {HTMLDetailsElement} */ ([...list.children][at]);
    if (!d.dataset.built) fillLemma(d, found[at], w.token);   // (before opening: opening would list the first tokens only)
    d.open = true;
    if (w.token) {
      const row = [...d.querySelectorAll('.row')].find(r => /** @type {HTMLElement} */ (r).dataset.token === w.token);
      if (row) { showToken(found[at], Number(/** @type {HTMLElement} */ (row).dataset.i)); row.scrollIntoView({ block: 'nearest' }); }
    }
  }

  // --- wiring --------------------------------------------------------------------------------------------

  $('controls').addEventListener('submit', e => { e.preventDefault(); if (ready) search('push'); });
  $('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => ready && search('replace'), DEBOUNCE); });
  $('passages').addEventListener('click', e => {
    const row = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.row'));
    if (!row || /** @type {HTMLElement} */ (e.target).closest('a.plink')) return;   // a passage link is the link's own click
    const entry = found.find(x => x.lemma === row.dataset.lemma);
    if (!entry) return;
    showToken(entry, Number(row.dataset.i));
    go('push');
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash || '#';
    if (ownHash === h) { ownHash = null; return; }
    ownHash = null;
    if (ready) route();
  });
  $('file').addEventListener('change', e => { for (const f of /** @type {HTMLInputElement} */ (e.target).files ?? []) loadFile(f); });
  window.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  window.addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    for (const f of e.dataTransfer?.files ?? []) loadFile(f);
  });

  loadReleaseNet();
  loadLemmataNet();
  loadMetaNet();
})();

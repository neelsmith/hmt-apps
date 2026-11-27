// Browser UI for "Scholia without DSE records": the scholia of the editions that no DSE record names, one book of the
// Iliad at a time (the book each comments on, from the commentary index).  Uses the shared sources inlined ahead of this
// file (see index.html).  Address: `?book=N` (1-24, or `none` for scholia the index does not place).
(function () {
  const $ = id => document.getElementById(id);
  const n = x => x.toLocaleString('en');
  const plural = (x, one, many) => `${n(x)} ${x === 1 ? one : many}`;

  /** @type {ScholiaCheck | null} */ let result = null;
  let current = 1;   // the book shown: 1-24, or 0 for "no book"

  /** @param {string} tag @param {string} [cls] @param {string} [text] */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function setStatus(msg) { $('status').textContent = msg; }

  // --- text of a scholion on hover; click copies the diplomatic text -------------------

  /** What each chip shows in the popover. @type {WeakMap<Element, MissingScholion>} */
  const chipData = new WeakMap();
  const pop = el('div', 'popover');
  pop.id = 'popover';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  document.body.appendChild(pop);

  function showPop(chip) {
    const m = chipData.get(chip);
    if (!m) return;
    pop.textContent = '';
    for (const t of m.texts) {
      if (!t.text.trim()) continue;
      const p = el('p');
      if (m.texts.length > 1) p.appendChild(el('span', 'ex', t.exemplar || 'text'));
      p.appendChild(document.createTextNode(t.text.trim()));
      pop.appendChild(p);
    }
    if (m.comments.length) pop.appendChild(el('p', 'on', `Comments on Iliad ${m.comments.join(', ')}`));
    pop.hidden = false;
    const r = chip.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = r.bottom + 6 + h > window.innerHeight && r.top - 6 - h > 0 ? r.top - 6 - h : r.bottom + 6;
    pop.style.left = `${left + window.scrollX}px`;
    pop.style.top = `${top + window.scrollY}px`;
    chip.setAttribute('aria-describedby', 'popover');
  }
  function hidePop() {
    pop.hidden = true;
    document.querySelectorAll('[aria-describedby=popover]').forEach(x => x.removeAttribute('aria-describedby'));
  }
  /** The diplomatic text of a scholion; if it has none, the first exemplar's. */
  function diplomaticText(m) {
    const t = m.texts.find(x => x.exemplar === 'diplomatic' && x.text.trim()) ?? m.texts.find(x => x.text.trim());
    return t ? t.text.trim() : '';
  }
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
  async function copyChip(chip) {
    const m = chipData.get(chip);
    if (!m) return;
    const ok = await copyText(diplomaticText(m));
    showPop(chip);
    pop.appendChild(el('p', 'copied', ok ? 'Diplomatic text copied to the clipboard' : 'Could not copy to the clipboard'));
    setStatus(ok ? `Copied the diplomatic text of scholion ${m.ref}` : `Could not copy scholion ${m.ref} to the clipboard`);
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
    else if (!c && result && !e.target.closest('input, select, textarea') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '[' || e.key === 'PageUp') step(-1);
      else if (e.key === ']' || e.key === 'PageDown') step(1);
    }
  });

  // --- books ------------------------------------------------------------------------

  const bookName = b => b === 0 ? 'no book' : `book ${b}`;
  const slot = b => result.books.find(x => x.book === b);

  /** Move to the previous or next book that the list has (book 0 comes last, when there is one). */
  function step(d) {
    const order = result.books.map(x => x.book);
    const i = order.indexOf(current) + d;
    if (i >= 0 && i < order.length) show(order[i], true);
  }

  function renderNav() {
    const ul = $('books');
    ul.textContent = '';
    for (const b of result.books) {
      const li = el('li');
      const btn = el('button');
      btn.type = 'button';
      btn.dataset.book = String(b.book);
      btn.title = `${plural(b.scholia.length, 'scholion', 'scholia')} on ${bookName(b.book)}`;
      btn.appendChild(el('span', '', b.book === 0 ? '—' : String(b.book)));
      btn.appendChild(el('span', 'n', n(b.scholia.length)));
      if (!b.scholia.length) btn.classList.add('zero');
      li.appendChild(btn);
      ul.appendChild(li);
    }
  }

  /** Show one book: its scholia, grouped by the version they are in. @param {number} b @param {boolean} [push] */
  function show(b, push) {
    if (!result) return;
    if (!slot(b)) b = 1;
    current = b;
    const data = slot(b);
    hidePop();
    for (const btn of $('books').querySelectorAll('button')) btn.setAttribute('aria-current', String(Number(btn.dataset.book) === b));
    $('book-title').textContent = b === 0 ? 'Scholia the index does not place in a book' : `Scholia on book ${b} of the Iliad`;
    $('book-badge').className = `badge ${data.scholia.length ? 'warn' : 'ok'}`;
    $('book-badge').textContent = data.scholia.length ? plural(data.scholia.length, 'scholion', 'scholia') : 'OK, none';
    const order = result.books.map(x => x.book), i = order.indexOf(b);
    $('prev').disabled = i <= 0;
    $('next').disabled = i >= order.length - 1;
    $('book-note').textContent = b === 0
      ? 'These scholia are in the editions without a DSE record, and the index of scholia to Iliad passages names no passage in books 1-24 for them (no entry, or an entry like UNKNOWN).'
      : data.scholia.length ? 'Scholia of the editions that comment on a passage of this book and that no DSE record names.'
        : 'Every scholion that comments on this book has a DSE record.';

    const groups = $('groups');
    groups.textContent = '';
    /** @type {Map<string, MissingScholion[]>} */
    const byVersion = new Map();
    for (const s of data.scholia) {
      const list = byVersion.get(s.version) ?? [];
      list.push(s);
      byVersion.set(s.version, list);
    }
    for (const [, list] of byVersion) {
      const g = el('section', 'vgroup');
      const h = el('h3', '', list[0].label + ' ');
      h.appendChild(el('span', 'n', `· ${plural(list.length, 'scholion', 'scholia')}`));
      g.appendChild(h);
      const chips = el('div', 'chips');
      for (const s of list) {
        const x = el('span', 'chip', s.ref);
        if (s.texts.some(t => t.text.trim())) { x.tabIndex = 0; x.setAttribute('role', 'button'); chipData.set(x, s); }
        chips.appendChild(x);
      }
      g.appendChild(chips);
      groups.appendChild(g);
    }
    const q = `?book=${b === 0 ? 'none' : b}`;
    if (push !== undefined && location.search !== q) (push ? history.pushState : history.replaceState).call(history, null, '', q);
    document.title = `Scholia without DSE records – ${bookName(b)}`;
  }

  function bookFromAddress() {
    const v = new URLSearchParams(location.search).get('book');
    if (v === 'none') return 0;
    const b = Number(v);
    return Number.isInteger(b) && b >= 1 && b <= 24 ? b : null;
  }

  $('books').addEventListener('click', e => {
    const btn = e.target instanceof Element ? e.target.closest('button[data-book]') : null;
    if (btn) show(Number(btn.dataset.book), true);
  });
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  window.addEventListener('popstate', () => { if (result) show(bookFromAddress() ?? 1); });

  // --- the release -------------------------------------------------------------------

  function start(rel) {
    result = scholiaMissingByBook(rel);
    $('drop').hidden = true;
    $('report').hidden = false;
    renderNav();
    $('intro').textContent = result.versions
      ? `${plural(result.missing, 'scholion', 'scholia')} of the ${plural(result.passages, 'scholion', 'scholia')} in the editions (${plural(result.versions, 'version', 'versions')}) ${result.missing === 1 ? 'has' : 'have'} no DSE record. Choose a book of the Iliad, or step through the books.`
      : 'This release has no edition of scholia.';
    const warnings = [];
    if (!result.dse) warnings.push('The release has no DSE records, so every scholion is listed.');
    if (!result.commentary) warnings.push('The release has no index of scholia to Iliad passages, so no scholion can be placed in a book.');
    $('warning').hidden = warnings.length === 0;
    $('warning').textContent = warnings.join(' ');
    const first = result.books.find(b => b.scholia.length)?.book ?? 1;
    show(bookFromAddress() ?? first, false);
    setStatus(`${rel.library.name}: ${result.missing ? plural(result.missing, 'scholion', 'scholia') + ' without a DSE record' : 'every scholion has a DSE record'}`);
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

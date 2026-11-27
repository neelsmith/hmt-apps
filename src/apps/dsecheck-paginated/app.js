// Browser UI for "Scholia without DSE records, by page": the scholia of the editions that no DSE record names, one
// manuscript page at a time (the page the DSE gives the Iliad line each comments on).  Uses the shared sources inlined
// ahead of this file (see index.html).  Address: `?page=<surface URN or id such as 12r>`, or `?page=none` for scholia
// whose Iliad line has no DSE record.
(function () {
  const $ = id => document.getElementById(id);
  const n = x => x.toLocaleString('en');
  const plural = (x, one, many) => `${n(x)} ${x === 1 ? one : many}`;

  /** @type {ScholiaPageCheck | null} */ let result = null;
  let current = 0;   // index into result.pages of the page shown

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

  // --- pages ------------------------------------------------------------------------

  const addressOf = p => p.page ? p.page : 'none';
  const idOf = p => p.page ? p.page.slice(p.page.lastIndexOf(':') + 1) : 'none';

  /** Move to the previous or next page that has scholia ("no page" comes last, when there is one). */
  function step(d) {
    const i = current + d;
    if (i >= 0 && i < result.pages.length) show(i, true);
  }

  function renderNav() {
    const sel = $('pages');
    sel.textContent = '';
    result.pages.forEach((p, i) => {
      const o = el('option', '', `${p.page ? p.label : 'No page'} (${n(p.scholia.length)})`);
      o.value = String(i);
      sel.appendChild(o);
    });
  }

  /** Show one page: its scholia, grouped by the version they are in. @param {number} i @param {boolean} [push] */
  function show(i, push) {
    if (!result || !result.pages.length) return;
    if (!result.pages[i]) i = 0;
    current = i;
    const data = result.pages[i];
    hidePop();
    $('pages').value = String(i);
    $('page-title').textContent = data.page ? `Scholia on ${data.label}` : 'Scholia whose Iliad line has no DSE record';
    $('page-badge').className = `badge ${data.scholia.length ? 'warn' : 'ok'}`;
    $('page-badge').textContent = plural(data.scholia.length, 'scholion', 'scholia');
    $('prev').disabled = i <= 0;
    $('next').disabled = i >= result.pages.length - 1;
    $('page-note').textContent = data.page
      ? `Scholia of the editions that comment on an Iliad line the DSE puts on this page (${data.page}), and that no DSE record names.`
      : 'These scholia have no DSE record, and no Iliad line they comment on has one either (or the index gives them no line), so no page can be given.';

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
    const q = `?page=${encodeURIComponent(addressOf(data)).replace(/%3A/gi, ':')}`;
    if (push !== undefined && location.search !== q) (push ? history.pushState : history.replaceState).call(history, null, '', q);
    document.title = `Scholia without DSE records – ${data.page ? data.label : 'no page'}`;
  }

  /** Index of the page the address names (a surface URN, or its id such as `12r`, or `none`), else null. */
  function pageFromAddress() {
    const v = new URLSearchParams(location.search).get('page');
    if (!v || !result) return null;
    const i = result.pages.findIndex(p => p.page === v || idOf(p) === v);
    return i >= 0 ? i : null;
  }

  $('pages').addEventListener('change', () => show(Number($('pages').value), true));
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  window.addEventListener('popstate', () => { if (result) show(pageFromAddress() ?? 0); });

  // --- the release -------------------------------------------------------------------

  function start(rel) {
    result = scholiaMissingByPage(rel);
    $('drop').hidden = true;
    $('report').hidden = false;
    renderNav();
    $('intro').textContent = result.versions
      ? `${plural(result.missing, 'scholion', 'scholia')} of the ${plural(result.passages, 'scholion', 'scholia')} in the editions (${plural(result.versions, 'version', 'versions')}) ${result.missing === 1 ? 'has' : 'have'} no DSE record. They are grouped by the manuscript page of the Iliad line they comment on; choose a page, or step through the pages.`
      : 'This release has no edition of scholia.';
    const warnings = [];
    if (!result.dse) warnings.push('The release has no DSE records, so every scholion is listed.');
    if (!result.commentary) warnings.push('The release has no index of scholia to Iliad passages, so no scholion can be placed on a page.');
    $('warning').hidden = warnings.length === 0;
    $('warning').textContent = warnings.join(' ');
    $('report').querySelector('#pager').hidden = !result.pages.length;
    show(pageFromAddress() ?? 0, false);
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

// @ts-check
/**
 * Logic for the proper names app: the indexes of personal, geographic and
 * ethnic names of a release, the passages each name occurs in, where those
 * passages are on the pages of the manuscripts, and where in a passage's text
 * the names stand.
 *
 * The indexes say only *which* names occur in a passage, not where.  Names are
 * written with a capital letter in the editions, so the capitalized words of a
 * passage are the candidates; which word is which name is learned from the
 * release (see `learnLexicon`).  A word that cannot be attributed is shown as
 * a name of unknown identity, never guessed.
 *
 * Pure functions; no DOM access.  Convention for inlining (see
 * scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { DSE_URN } from './dse.js';

/**
 * @typedef {'pers' | 'place' | 'ethnic'} NameKind
 */

/** The three kinds of names: index relation set, and the label of the menu. */
export const NAME_KINDS = /** @type {{id: NameKind, label: string, index: string}[]} */ ([
  { id: 'pers', label: 'Personal names', index: 'urn:cite2:hmt:persnameindex.v1:all' },
  { id: 'place', label: 'Geographic names', index: 'urn:cite2:hmt:placenameindex.v1:all' },
  { id: 'ethnic', label: 'Ethnic names', index: 'urn:cite2:hmt:ethnicgroupindex.v1:all' },
]);

/**
 * @typedef {Object} NameEntry
 * @property {string} key          `kind:id`, e.g. `pers:pers1`.
 * @property {NameKind} kind
 * @property {string} id           Object part of the URN, e.g. `pers1`.
 * @property {string} urn          URN in its collection, e.g. `urn:cite2:hmt:pers.v1:pers1`.
 * @property {string} label
 * @property {string} description
 * @property {string[]} passages   Passages (version URN + reference) it occurs in, in index order, without duplicates.
 */

/**
 * @typedef {Object} NameData
 * @property {Map<string, NameEntry>} entries         By key.
 * @property {Record<NameKind, NameEntry[]>} byKind   Ordered by label.
 * @property {Map<string, {kind: NameKind, id: string}[]>} byPassage  Names of each passage.
 * @property {number} unresolved   Index rows naming something that is not in the pers or place collection.
 * @property {number} rows         Index rows read.
 */

/** Field of a row by header name, ignoring case. */
const field = (/** @type {Record<string, string>} */ row, /** @type {string} */ name) => {
  for (const k of Object.keys(row)) if (k.toLowerCase() === name) return (row[k] ?? '').trim();
  return '';
};

/** Object id of a name URN as the indexes write it: `…:pers142`, `…:place.r1:place67`; null if it has none. */
export function nameId(urn) {
  const m = /(?:^|:)((?:pers|place)\d+)\s*$/.exec(urn.trim().replace(/\s+$/, ''));
  return m ? m[1] : null;
}

/**
 * Passage reference of a text node as the indexes and the DSE name it: the
 * `.lemma` and `.comment` parts of a scholion belong to the scholion, and a
 * subreference (`@word`) is dropped.  Returns the version URN with the
 * reference appended, e.g. `urn:cts:greekLit:tlg5026.msA.hmt:1.28`.
 * @param {string} urn
 * @returns {string | null}
 */
export function passageKey(urn) {
  const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(urn.trim());
  if (!m || !m[2]) return null;
  const version = ctsVersionOf(m[1]);
  let ref = m[2].replace(/@.*$/, '');
  if (/^urn:cts:[^:]+:tlg5026\./.test(version)) ref = ref.replace(/\.(lemma|comment)$/, '');
  return `${version}${ref}`;
}

/**
 * Read the name indexes.  Names are identified by object id (`pers142`,
 * `place67`), since the indexes are not consistent about the version part of
 * the collection URN (`pers.v1`, `place.r1`, none).  A redirect in the
 * collection is followed.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {NameData}
 */
export function readNames(release) {
  /** @type {Map<string, {urn: string, label: string, description: string, redirect: string}>} */
  const records = new Map();
  for (const block of release.citeData()) {
    if (!block.collections.some(c => /^urn:cite2:[^:]+:(pers|place)\.[^:]+:$/.test(c))) continue;
    const urnField = block.header.find(h => h.toLowerCase() === 'urn');
    if (!urnField) continue;
    for (const row of block.rows) {
      const urn = (row[urnField] ?? '').trim();
      const id = nameId(urn);
      if (id) records.set(id, { urn, label: field(row, 'label'), description: field(row, 'description'), redirect: field(row, 'redirect') });
    }
  }
  const resolve = (/** @type {string} */ id) => {
    for (let i = 0; i < 5; i++) {
      const r = records.get(id);
      const to = r && r.redirect ? nameId(r.redirect) : null;
      if (!to || to === id || !records.has(to)) break;
      id = to;
    }
    return id;
  };

  /** @type {Map<string, NameEntry>} */
  const entries = new Map();
  /** @type {Map<string, {kind: NameKind, id: string}[]>} */
  const byPassage = new Map();
  let unresolved = 0, rows = 0;
  for (const kind of NAME_KINDS) {
    const set = release.relationSets().find(r => r.urn === kind.index);
    if (!set) continue;
    for (const row of set.rows) {
      rows++;
      const rawId = nameId(row[set.header[1]] ?? '');
      const pk = passageKey(row[set.header[0]] ?? '');
      if (!rawId || !pk || !records.has(rawId)) { unresolved++; continue; }
      const id = resolve(rawId);
      const rec = /** @type {NonNullable<ReturnType<typeof records.get>>} */ (records.get(id));
      const key = `${kind.id}:${id}`;
      let e = entries.get(key);
      if (!e) {
        e = { key, kind: kind.id, id, urn: rec.urn, label: rec.label || id, description: rec.description, passages: [] };
        entries.set(key, e);
      }
      let names = byPassage.get(pk);
      if (!names) { names = []; byPassage.set(pk, names); }
      if (names.some(n => n.kind === kind.id && n.id === id)) continue;     // already indexed
      names.push({ kind: kind.id, id });
      e.passages.push(pk);
    }
  }
  /** @type {Record<NameKind, NameEntry[]>} */
  const byKind = { pers: [], place: [], ethnic: [] };
  for (const e of entries.values()) byKind[e.kind].push(e);
  for (const k of Object.keys(byKind)) byKind[/** @type {NameKind} */ (k)].sort((a, b) => a.label.localeCompare(b.label, 'en') || a.id.localeCompare(b.id, 'en', { numeric: true }));
  return { entries, byKind, byPassage, unresolved, rows };
}

/**
 * Menu labels for the names of one kind: the label and the number of
 * passages, with the id added where two names have the same label.
 * @param {NameEntry[]} items
 * @returns {string[]}  parallel to `items`
 */
export function menuLabels(items) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const e of items) seen.set(e.label, (seen.get(e.label) ?? 0) + 1);
  return items.map(e => `${e.label}${(seen.get(e.label) ?? 0) > 1 ? ` [${e.id}]` : ''} (${e.passages.length.toLocaleString('en')})`);
}

// --- locating the names in a text -------------------------------------------------

/**
 * @typedef {Object} Token
 * @property {string} text   The word with its punctuation, as written.
 * @property {string} core   Letters only, in lower case, e.g. `ἀχιλῆος`.
 * @property {boolean} cap   Starts with a capital letter.
 * @property {boolean} space True if whitespace follows it (to rebuild the text).
 */

/** Split a text into words.  @param {string} text @returns {Token[]} */
export function tokenize(text) {
  /** @type {Token[]} */
  const out = [];
  const re = /(\S+)(\s*)/gu;
  let m;
  while ((m = re.exec(text))) {
    const core = m[1].replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    const first = core.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0);
    out.push({ text: m[1], core: core.normalize('NFC').toLowerCase(), cap: first !== '' && first !== first.toLowerCase(), space: m[2].length > 0 });
  }
  return out;
}

/**
 * A word list of the names: which entity each capitalized word stands for.
 * `forms.get(core)` maps entity keys to how often the word was seen for them.
 * @typedef {Map<string, Map<string, number>>} Lexicon
 */

/**
 * Learn which words are which names from every passage of the release that is
 * indexed: first from passages where one name and one capitalized word make
 * the attribution certain; then from passages where, once the known words are
 * taken out, one name and one capitalized word are left.
 * @param {{text: string, names: string[]}[]} samples  Texts with the keys (`kind:id`) of the names indexed to them.
 * @returns {Lexicon}
 */
export function learnLexicon(samples) {
  /** @type {Lexicon} */
  const forms = new Map();
  const add = (/** @type {string} */ core, /** @type {string} */ key) => {
    let m = forms.get(core);
    if (!m) { m = new Map(); forms.set(core, m); }
    m.set(key, (m.get(key) ?? 0) + 1);
  };
  const toks = samples.map(s => tokenize(s.text));
  samples.forEach((s, i) => {
    if (s.names.length !== 1) return;
    const caps = toks[i].filter(t => t.cap);
    if (caps.length === 1) add(caps[0].core, s.names[0]);
  });
  // second round: elimination
  samples.forEach((s, i) => {
    if (s.names.length < 2) return;
    const a = attribute(toks[i], s.names, forms);
    if (a.leftoverTokens.length === 1 && a.leftoverNames.length === 1) add(toks[i][a.leftoverTokens[0]].core, a.leftoverNames[0]);
  });
  return forms;
}

/**
 * Attribute the capitalized words of a passage to the names indexed to it.
 * A word known (from the lexicon) for one of the passage's names belongs to
 * the name seen most often with it.  Words left over are matched to names
 * left over when exactly one of each remains.
 * @param {Token[]} tokens
 * @param {string[]} names    keys of the passage's names
 * @param {Lexicon} lexicon
 * @returns {{found: Map<number, string>, leftoverTokens: number[], leftoverNames: string[]}}
 *   `found`: token index to name key.
 */
export function attribute(tokens, names, lexicon) {
  /** @type {Map<number, string>} */
  const found = new Map();
  const wanted = new Set(names);
  tokens.forEach((t, i) => {
    if (!t.cap) return;
    const votes = lexicon.get(t.core);
    if (!votes) return;
    let best = '', n = 0;
    for (const [key, c] of votes) if (wanted.has(key) && c > n) { best = key; n = c; }
    if (best) found.set(i, best);
  });
  const usedNames = new Set(found.values());
  const leftoverTokens = tokens.map((t, i) => (t.cap && !found.has(i) ? i : -1)).filter(i => i >= 0);
  const leftoverNames = names.filter(k => !usedNames.has(k));
  return { found, leftoverTokens, leftoverNames };
}

/**
 * @typedef {Object} NameSpan
 * @property {number} token       Token index.
 * @property {NameKind} kind
 * @property {string | null} key  Entity key if the word is certainly that name; null if the name is one of several and not known.
 */

/**
 * The words of a text that are names.  Only passages with indexed names have
 * any.  A capitalized word is attributed from the lexicon; if one word and one
 * name are left over they belong together; if all the names left over are of
 * one kind, the left-over words are names of that kind of unknown identity
 * (`key` null); with a mixture of kinds, they cannot be told apart and are
 * left unmarked.  The first word of a passage, which a capital letter does not
 * make a name, is marked only when the lexicon says it is one or when it is
 * the only candidate.
 * @param {string} text
 * @param {{kind: NameKind, id: string}[]} names  Names indexed to the passage.
 * @param {Lexicon} lexicon
 * @returns {{tokens: Token[], spans: Map<number, NameSpan>}}
 */
export function locateNames(text, names, lexicon) {
  const tokens = tokenize(text);
  /** @type {Map<number, NameSpan>} */
  const spans = new Map();
  if (!names.length) return { tokens, spans };
  const keys = names.map(n => `${n.kind}:${n.id}`);
  const kindOf = new Map(names.map(n => [`${n.kind}:${n.id}`, n.kind]));
  const a = attribute(tokens, keys, lexicon);
  for (const [i, key] of a.found) spans.set(i, { token: i, kind: /** @type {NameKind} */ (kindOf.get(key)), key });
  let tokensLeft = a.leftoverTokens;
  if (tokensLeft.length > a.leftoverNames.length && tokensLeft[0] === 0) tokensLeft = tokensLeft.slice(1);   // capital of the first word only
  if (a.leftoverNames.length && tokensLeft.length) {
    if (tokensLeft.length === 1 && a.leftoverNames.length === 1) {
      const key = a.leftoverNames[0];
      spans.set(tokensLeft[0], { token: tokensLeft[0], kind: /** @type {NameKind} */ (kindOf.get(key)), key });
    } else {
      const kinds = new Set(a.leftoverNames.map(k => kindOf.get(k)));
      if (kinds.size === 1) {
        const kind = /** @type {NameKind} */ ([...kinds][0]);
        for (const i of tokensLeft) spans.set(i, { token: i, kind, key: null });
      }
    }
  }
  return { tokens, spans };
}

// --- from passage to page ---------------------------------------------------------

/**
 * Pages (surfaces) of the passages, from the DSE records.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {{surfacesOf: Map<string, string[]>, passagesOn: Map<string, string[]>}}
 *   `surfacesOf`: passage key to the pages it is on; `passagesOn`: page URN to
 *   the passage keys on it, in order of the records, without duplicates.
 */
export function indexPages(release) {
  /** @type {Map<string, string[]>} */
  const surfacesOf = new Map();
  /** @type {Map<string, string[]>} */
  const passagesOn = new Map();
  const set = release.relationSets().find(r => r.urn === DSE_URN);
  if (!set) return { surfacesOf, passagesOn };
  /** @type {Map<string, Set<string>>} */
  const seenOn = new Map();
  for (const row of set.rows) {
    const key = passageKey(row.passage ?? '');
    const surface = (row.surface ?? '').trim();
    if (!key || !surface) continue;
    const s = surfacesOf.get(key) ?? [];
    if (!s.includes(surface)) s.push(surface);
    surfacesOf.set(key, s);
    let seen = seenOn.get(surface);
    if (!seen) { seen = new Set(); seenOn.set(surface, seen); passagesOn.set(surface, []); }
    if (!seen.has(key)) { seen.add(key); /** @type {string[]} */ (passagesOn.get(surface)).push(key); }
  }
  return { surfacesOf, passagesOn };
}

/**
 * @typedef {'iliad' | 'scholia' | 'other'} Section
 */

/** Part of a page's text a passage belongs to. @param {string} key */
export function sectionOf(key) {
  const m = /^urn:cts:[^:]+:([^:.]+)\.([^:.]+)/.exec(key);
  if (!m) return /** @type {Section} */ ('other');
  if (m[1] === 'tlg0012' && m[2] === 'tlg001') return /** @type {Section} */ ('iliad');
  if (m[1] === 'tlg5026') return /** @type {Section} */ ('scholia');
  return /** @type {Section} */ ('other');
}

/**
 * Where the scholia of a page go among the Iliad lines of the page.  Each
 * scholion stands under the first line of the page it comments on (a
 * scholion on `1.13-1.16` appears once, under 1.13); scholia that comment on
 * no line of the page are returned apart.
 * @param {string[]} lineRefs   References of the Iliad lines on the page.
 * @param {import('./text-index.js').TextIndex} shown  The text those lines belong to.
 * @param {{scholion: string, start: number, end: number}[]} spans  Commentary relations as positions in `shown`.
 * @param {string[]} pageScholia  Passage keys of the scholia on the page, in the order to keep.
 * @returns {{byLine: Map<string, {key: string, from: string, to: string}[]>, loose: string[]}}
 *   `from`..`to` are the references the scholion comments on.
 */
export function attachScholia(lineRefs, shown, spans, pageScholia) {
  const onPage = new Set(pageScholia);
  /** @type {Map<string, {start: number, end: number}[]>} */
  const spansOf = new Map();
  for (const sp of spans) {
    const key = passageKey(sp.scholion);
    if (!key || !onPage.has(key)) continue;
    const list = spansOf.get(key) ?? [];
    list.push(sp);
    spansOf.set(key, list);
  }
  /** @type {Map<number, string>} */
  const lineAt = new Map();
  for (const r of lineRefs) { const at = shown.pos.get(r); if (at !== undefined) lineAt.set(at, r); }
  const positions = [...lineAt.keys()].sort((a, b) => a - b);
  /** @type {Map<string, {key: string, from: string, to: string}[]>} */
  const byLine = new Map();
  /** @type {string[]} */
  const loose = [];
  for (const key of pageScholia) {
    /** @type {{at: number, sp: {start: number, end: number}} | null} */
    let best = null;
    for (const sp of spansOf.get(key) ?? []) {
      const at = positions.find(p => p >= sp.start && p <= sp.end);
      if (at !== undefined && (!best || at < best.at)) best = { at, sp };
    }
    if (!best) { loose.push(key); continue; }
    const ref = /** @type {string} */ (lineAt.get(best.at));
    const list = byLine.get(ref) ?? [];
    list.push({ key, from: shown.refs[best.sp.start], to: shown.refs[best.sp.end] });
    byLine.set(ref, list);
  }
  return { byLine, loose };
}

/**
 * Location hash for a name and a passage, and its reading.
 * @param {{kind: string, id: string, passage?: string}} where
 */
export function formatNameHash(where) {
  const p = new URLSearchParams({ k: where.kind, i: where.id });
  if (where.passage) p.set('p', where.passage);
  return `#${p.toString()}`;
}

/** @param {string} hash @returns {{kind: NameKind, id: string, passage: string} | null} */
export function parseNameHash(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const kind = p.get('k'), id = p.get('i');
  if (!NAME_KINDS.some(k => k.id === kind) || !id) return null;
  return { kind: /** @type {NameKind} */ (kind), id, passage: p.get('p') ?? '' };
}

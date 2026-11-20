import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import {
  fold, foldWithMap, parseQuery, findMatches, buildSearchIndex, searchPassages, entryMatches, snippet, tokenMatches, groupByToken,
  formatSearchHash, parseSearchHash, MIN_QUERY,
} from '../src/stringsearch.js';

test('fold: no diacritics, case or punctuation', () => {
  assert.equal(fold('Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος'), 'μηνιν αειδε θεα πηληιαδεω αχιληοσ');
  assert.equal(fold('Ἀχιλλεύς :'), 'αχιλλευσ');                  // final sigma, trailing punctuation
  assert.equal(fold('μυρί\' Ἀχαιοῖς'), 'μυρι αχαιοισ');
  assert.equal(fold('ὁ   Ἀτρείδης\n τε'), 'ο ατρειδησ τε');       // white space collapses
  assert.equal(fold('ϲτρατόϲ'), 'στρατοσ');                       // lunate sigma
  assert.equal(fold('ᾳδω'), 'αδω');                                // iota subscript
  assert.equal(fold('αβγ'), fold('Ἀβγ'));
  assert.equal(fold(''), '');
  assert.equal(fold('1.2 [ἄ]'), 'α');
});

test('fold: precomposed and decomposed forms agree', () => {
  const nfc = 'Ἀχιλῆος', nfd = nfc.normalize('NFD');
  assert.notEqual(nfc, nfd);
  assert.equal(fold(nfc), fold(nfd));
});

test('parseQuery: what the user types, with or without diacritics', () => {
  assert.equal(parseQuery(' αχιλ '), 'αχιλ');
  assert.equal(parseQuery('Ἀχιλ'), 'αχιλ');
  assert.equal(parseQuery('αχιλλευς'), parseQuery('Ἀχιλλεύς'));
  assert.equal(parseQuery('  '), '');
  assert.equal(MIN_QUERY, 2);
});

test('findMatches: ranges of the text as written, marks included', () => {
  const text = 'Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος';
  const [m] = findMatches(text, 'αχιλ');
  assert.equal(text.slice(m.start, m.end), 'Ἀχιλ');
  const [w] = findMatches(text, 'ηνιν');
  assert.equal(text.slice(w.start, w.end), 'ῆνιν');
  const full = findMatches(text, 'αχιληοσ')[0];
  assert.equal(text.slice(full.start, full.end), 'Ἀχιλῆος');
  // across a space and punctuation
  const t2 = 'ἀνδρῶν καὶ δῖος Ἀχιλλεύς :';
  const [x] = findMatches(t2, 'ανδρων και');
  assert.equal(t2.slice(x.start, x.end), 'ἀνδρῶν καὶ');
  const [y] = findMatches(t2, 'ευσ');
  assert.equal(t2.slice(y.start, y.end), 'εύς');
  // several matches, none overlapping
  assert.equal(findMatches('αβαβα', 'αβα').length, 1);
  assert.equal(findMatches('Ἀχιλλεὺς καὶ Ἀχιλλῆος', 'αχιλλ').length, 2);
  assert.deepEqual(findMatches('abc', ''), []);
  // the same in decomposed form
  const d = 'Ἀχιλῆος'.normalize('NFD');
  const [z] = findMatches(d, 'αχιλ');
  assert.equal(d.slice(z.start, z.end).normalize('NFC'), 'Ἀχιλ');
  const [z2] = findMatches(d, 'ληο');
  assert.equal(d.slice(z2.start, z2.end).normalize('NFC'), 'λῆο');
});

const T = 'urn:cts:greekLit:tlg0012.tlg001';
const S = 'urn:cts:greekLit:tlg5026.msA.hmt';
const P = 'urn:cts:greekLit:tlg7000.tlg001.msA';
const CEX = `#!ctsdata
${T}.msA.diplomatic:1.1|Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος
${T}.msA.diplomatic:1.2|οὐλομένην: ἡ μυρί' Ἀχαιοῖς ἄλγε' ἔθηκεν:
${T}.msA.normalized:1.1|μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος
${T}.msA.normalized:1.2|οὐλομένην, ἣ μυρίʼ Ἀχαιοῖς ἄλγεʼ ἔθηκεν,
${T}.msB.normalized:1.1|μῆνιν ἄειδε θεά
${S}.diplomatic:1.1.lemma|μῆνιν ἄειδε
${S}.diplomatic:1.1.comment|ζητοῦσι δια τί ἀπὸ τῆς μήνιδος ἤρξατο
${S}.diplomatic:1.2.lemma|οὐλομένην
${S}.diplomatic:1.2.comment|τὴν μῆνιν λέγει Ἀχιλλέως
${P}.diplomatic:1|ἄλλο μῆνιν
`;
const idx = kind => buildSearchIndex(buildTextIndex(parseRelease(CEX)), kind);

test('buildSearchIndex: every passage once, scholion parts together, the exemplar asked for', () => {
  const d = idx('diplomatic');
  assert.deepEqual(d.entries.map(e => e.key.split(':').slice(3).join(':')),
    ['tlg0012.tlg001.msA:1.1', 'tlg0012.tlg001.msA:1.2', 'tlg0012.tlg001.msB:1.1', 'tlg5026.msA.hmt:1.1', 'tlg5026.msA.hmt:1.2', 'tlg7000.tlg001.msA:1']);
  assert.deepEqual(d.byKey.get(`${S}:1.1`).parts.map(p => p.part), ['lemma', 'comment']);
  assert.equal(d.byKey.get(`${T}.msA:1.2`).parts[0].text.startsWith('οὐλομένην: ἡ'), true, 'diplomatic text');
  assert.equal(idx('normalized').byKey.get(`${T}.msA:1.2`).parts[0].text.startsWith('οὐλομένην, ἣ'), true, 'normalized text');
  assert.equal(d.byKey.get(`${T}.msB:1.1`).parts[0].text, 'μῆνιν ἄειδε θεά', 'a version without the kind uses its first exemplar');
});

test('searchPassages: by scope, in index order, with a minimum length', () => {
  const d = idx('diplomatic');
  const keys = (q, scope) => searchPassages(d, parseQuery(q), scope).map(k => k.split(':').slice(3).join(':'));
  assert.deepEqual(keys('μηνιν', 'all'), ['tlg0012.tlg001.msA:1.1', 'tlg0012.tlg001.msB:1.1', 'tlg5026.msA.hmt:1.1', 'tlg5026.msA.hmt:1.2', 'tlg7000.tlg001.msA:1']);
  assert.deepEqual(keys('μηνιν', 'iliad'), ['tlg0012.tlg001.msA:1.1', 'tlg0012.tlg001.msB:1.1']);
  assert.deepEqual(keys('Μῆνιν', 'scholia'), ['tlg5026.msA.hmt:1.1', 'tlg5026.msA.hmt:1.2']);   // typed with diacritics, in the comment of 1.2
  assert.deepEqual(keys('αχιλλ', 'all'), ['tlg5026.msA.hmt:1.2']);          // Ἀχιλῆος has one lambda
  assert.deepEqual(keys('αχιλ', 'iliad'), ['tlg0012.tlg001.msA:1.1']);
  assert.deepEqual(keys('ανδρων', 'all'), []);
  assert.deepEqual(keys('α', 'all'), [], 'one letter is too short');
  assert.deepEqual(keys('μηνιδοσ ηρξ', 'scholia'), ['tlg5026.msA.hmt:1.1'], 'across words, in one part');
  assert.deepEqual(keys('αειδε ζητουσι', 'scholia'), [], 'a match does not span lemma and comment');
  assert.equal(entryMatches(d.byKey.get(`${S}:1.1`), 'ζητ'), true);
  assert.equal(entryMatches(undefined, 'ζητ'), false);
});

test('snippet: context around the first match, as written', () => {
  const d = idx('diplomatic');
  const s = snippet(d.byKey.get(`${T}.msA:1.1`), 'αχιλ', 8);
  assert.deepEqual(s, { before: '…ληϊάδεω ', hit: 'Ἀχιλ', after: 'ῆος' });
  const c = snippet(d.byKey.get(`${S}:1.2`), 'μηνιν', 4);
  assert.equal(c.hit, 'μῆνιν');                       // found in the comment
  assert.equal(snippet(d.byKey.get(`${S}:1.2`), 'ζζζ'), null);
});

test('hash round trip', () => {
  const h = formatSearchHash({ q: 'αχιλ', scope: 'iliad', kind: 'normalized', passage: `${T}.msA:1.1` });
  assert.deepEqual(parseSearchHash(h), { q: 'αχιλ', scope: 'iliad', kind: 'normalized', passage: `${T}.msA:1.1` });
  assert.deepEqual(parseSearchHash('#q=%CE%B1%CF%87'), { q: 'αχ', scope: 'all', kind: 'diplomatic', passage: '' });
  assert.equal(parseSearchHash(''), null);
  assert.equal(parseSearchHash('#s=iliad'), null);
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: search agrees with an independent count', { skip: !existsSync(REAL) }, () => {
  const rel = parseRelease(readFileSync(REAL, 'utf8'));
  const ti = buildTextIndex(rel);
  const d = buildSearchIndex(ti, 'diplomatic');
  // independent: strip with NFD, drop everything that is not a letter or a space
  const naive = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[ςϲ]/g, 'σ').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ');
  const q = 'αχιλλευσ';
  const expected = d.entries.filter(e => e.parts.some(p => naive(p.text).includes(q))).length;
  assert.equal(searchPassages(d, q, 'all').length, expected);
  assert.ok(expected > 100, String(expected));
  const il = searchPassages(d, q, 'iliad'), sc = searchPassages(d, q, 'scholia');
  assert.ok(il.length > 50 && sc.length > 50);
  assert.ok(il.length + sc.length <= expected);
  // Iliad 1.1 of the Venetus A holds μηνιν
  assert.ok(searchPassages(d, 'μηνιν', 'iliad').includes('urn:cts:greekLit:tlg0012.tlg001.msA:1.1'));
  // every passage is in the index once
  assert.equal(new Set(d.entries.map(e => e.key)).size, d.entries.length);
});

test('tokenMatches / groupByToken: matches widen to word tokens, groups sorted ignoring accents', () => {
  const q = parseQuery('μηνι');
  const tm = tokenMatches('ἡ Μῆνις καὶ μῆνιν, μῆνιν.', q);
  assert.deepEqual(tm.map(t => t.form), ['Μῆνις', 'μῆνιν', 'μῆνιν']);
  assert.deepEqual(tm.map(t => t.token), ['μηνισ', 'μηνιν', 'μηνιν']);
  assert.equal(tm[0].start, 2);                                  // match range itself is unchanged
  assert.deepEqual(tokenMatches('ἐνμῆνιδος ἦρξε', parseQuery('μηνιδοσ ηρξ')).map(t => t.form), ['ἐνμῆνιδος ἦρξε'], 'a match across words is one phrase token');
  const d = idx('diplomatic');
  const keys = searchPassages(d, q, 'all');
  const groups = groupByToken(d, keys, q);
  const toks = groups.map(g => g.token);
  assert.deepEqual(toks, [...toks].sort(), 'alphabetical');
  assert.equal(new Set(toks).size, toks.length, 'unique');
  for (const k of keys) assert.ok(groups.some(g => g.keys.includes(k)), 'every passage is under some token');
  for (const g of groups) assert.equal(new Set(g.keys).size, g.keys.length, 'a passage once per token');
  assert.ok(groups.some(g => g.token === 'μηνιν' && g.form === 'μῆνιν'));
  assert.equal(snippet(d.byKey.get(groups[0].keys[0]), q, 36, groups[0].token) !== null, true);
});

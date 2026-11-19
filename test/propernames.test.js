import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import {
  NAME_KINDS, nameId, passageKey, readNames, menuLabels, tokenize, learnLexicon, attribute, locateNames,
  indexPages, sectionOf, formatNameHash, parseNameHash, attachScholia,
} from '../src/propernames.js';

const T = 'urn:cts:greekLit:tlg0012.tlg001.msA';
const S = 'urn:cts:greekLit:tlg5026.msA.hmt';
const CEX = `#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:pers.v1:|Personal names|urn:cite2:hmt:pers.v1.label:||CC
urn:cite2:hmt:place.v1:|Place names|urn:cite2:hmt:place.v1.label:||CC
#!citedata
URN|mf|Character|Label|Description|Status|Redirect
urn:cite2:hmt:pers.v1:pers1|m|literary|Achilles|hero|accepted|
urn:cite2:hmt:pers.v1:pers2|m|literary|Agamemnon|king|accepted|
urn:cite2:hmt:pers.v1:pers3|m|literary|Agamemnon (dup)|old record|rejected|urn:cite2:hmt:pers.v1:pers2
urn:cite2:hmt:pers.v1:pers4|m|literary|Alexandros|Paris|accepted|
urn:cite2:hmt:pers.v1:pers5|m|literary|Alexandros|another|accepted|
#!citedata
URN|Label|Description|Pleiades|Status|Redirect
urn:cite2:hmt:place.v1:place1|Troy|city|x|accepted|
urn:cite2:hmt:place.v1:place2|Achaea|region|x|accepted|
#!citerelationset
urn|urn:cite2:hmt:persnameindex.v1:all
label|persons

passage|person
${T}:1.1|urn:cite2:hmt:pers.v1:pers1
${T}:1.2|urn:cite2:hmt:pers.v1:pers1
${T}:1.2|urn:cite2:hmt:pers.v1:pers1
${T}:1.3|urn:cite2:hmt:pers.v1:pers2
${T}:1.3|urn:cite2:hmt:pers:pers1
${T}:1.4|urn:cite2:hmt:pers.v1:pers3
${T}:1.5|urn:cite2:hmt:persName:pers4
${T}:1.6|urn:cite2:hmt:pers.v1:pers5
${T}:1.7|urn:cite2:hmt:pers.v1:pers999
${S}:1.3.lemma|urn:cite2:hmt:pers.v1:pers1
${S}:1.3.comment|urn:cite2:hmt:pers.v1:pers1
${S}:1.3.comment|urn:cite2:hmt:pers.v1:pers2
#!citerelationset
urn|urn:cite2:hmt:placenameindex.v1:all
label|places

passage|place
${T}:1.3|urn:cite2:hmt:place.r1:place1
#!citerelationset
urn|urn:cite2:hmt:ethnicgroupindex.v1:all
label|ethnic

passage|ethnic
${T}:1.2|urn:cite2:hmt:place.r1:place2
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
${T}:1.1|urn:cite2:hmt:vaimg.2017a:I1@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}:1.2@w|urn:cite2:hmt:vaimg.2017a:I1@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}:1.2|urn:cite2:hmt:vaimg.2017a:I1@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${S}:1.3|urn:cite2:hmt:vaimg.2017a:I1@0.5,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}:1.4|urn:cite2:hmt:vaimg.2017a:I2@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:1v
`;
const rel = parseRelease(CEX);
const d = readNames(rel);

test('nameId: object id of a name URN however the index writes it', () => {
  for (const u of ['urn:cite2:hmt:pers.v1:pers142', 'urn:cite2:hmt:persName:pers142', 'urn:cite2:hmt:pers:pers142 ', 'urn:cite2:hmt:place.r1:place7']) assert.ok(nameId(u), u);
  assert.equal(nameId('urn:cite2:hmt:persName:pers142'), 'pers142');
  assert.equal(nameId('urn:cite2:hmt:place.r1:place7'), 'place7');
  assert.equal(nameId('persMISSING'), null);
  assert.equal(nameId('urn:cite2:hmt:pers.v1:pers903,Danae'), null);
});

test('passageKey: version URN + reference; scholion parts and subreferences dropped', () => {
  assert.equal(passageKey(`${T}:1.2@word`), `${T}:1.2`);
  assert.equal(passageKey(`${S}:1.3.lemma`), `${S}:1.3`);
  assert.equal(passageKey(`${S}:1.3.comment`), `${S}:1.3`);
  assert.equal(passageKey(`${T}:1.3.comment`), `${T}:1.3.comment`, 'only scholia have parts');
  assert.equal(passageKey('nonsense'), null);
  assert.equal(passageKey(`${T}:`), null);
});

test('readNames: entries by kind, resolved by id; duplicates and redirects folded', () => {
  assert.deepEqual(NAME_KINDS.map(k => k.id), ['pers', 'place', 'ethnic']);
  assert.deepEqual(d.byKind.pers.map(e => e.id), ['pers2', 'pers1', 'pers4', 'pers5'].sort((a, b) => d.entries.get('pers:' + a).label.localeCompare(d.entries.get('pers:' + b).label) || a.localeCompare(b)));
  const achilles = d.entries.get('pers:pers1');
  assert.equal(achilles.label, 'Achilles');
  assert.deepEqual(achilles.passages, [`${T}:1.1`, `${T}:1.2`, `${T}:1.3`, `${S}:1.3`]);   // 1.2 twice and lemma+comment once each
  assert.equal(d.entries.get('pers:pers2').passages.includes(`${T}:1.4`), true, 'pers3 redirects to pers2');
  assert.equal(d.entries.has('pers:pers3'), false);
  assert.equal(d.byKind.place.length, 1);
  assert.equal(d.byKind.place[0].label, 'Troy');
  assert.equal(d.byKind.ethnic[0].label, 'Achaea');          // an ethnic name is a place of the place collection
  assert.equal(d.unresolved, 1);                              // pers999
  assert.equal(d.rows, 12 + 1 + 1);
});

test('readNames: names of a passage', () => {
  assert.deepEqual(d.byPassage.get(`${T}:1.3`).map(n => `${n.kind}:${n.id}`), ['pers:pers2', 'pers:pers1', 'place:place1']);
  assert.deepEqual(d.byPassage.get(`${S}:1.3`).map(n => `${n.kind}:${n.id}`), ['pers:pers1', 'pers:pers2']);
});

test('menuLabels: label and passage count, id added where labels repeat', () => {
  const labels = menuLabels(d.byKind.pers);
  assert.ok(labels.includes('Achilles (4)'));
  assert.ok(labels.includes('Alexandros [pers4] (1)') && labels.includes('Alexandros [pers5] (1)'));
});

test('tokenize: words, capitals, punctuation', () => {
  const t = tokenize('Ἀτρείδης τε ἄναξ: Ἄϊδι προΐαψεν.');
  assert.deepEqual(t.map(x => x.cap), [true, false, false, true, false]);
  assert.equal(t[2].core, 'ἄναξ');
  assert.equal(t[2].text, 'ἄναξ:');
  assert.equal(t[0].core, 'ἀτρείδης');
  assert.deepEqual(tokenize('').length, 0);
  assert.equal(tokenize('a b').map(x => x.text + (x.space ? ' ' : '')).join(''), 'a b');
});

test('learnLexicon / attribute / locateNames', () => {
  const samples = [
    { text: 'ἄειδε θεὰ Ἀχιλῆος', names: ['pers:a'] },
    { text: 'ἦλθεν Ἀχιλῆος υἱός', names: ['pers:a'] },
    { text: 'εἶπε Ἀτρείδης', names: ['pers:b'] },
    { text: 'Ἀτρείδης καὶ Ἀχιλλεύς', names: ['pers:b', 'pers:c'] },     // Ἀχιλλεύς left over with c: learned by elimination
  ];
  const lex = learnLexicon(samples);
  assert.equal(lex.get('ἀχιλῆος').get('pers:a'), 2);
  assert.equal(lex.get('ἀτρείδης').get('pers:b'), 1);
  assert.equal(lex.get('ἀχιλλεύς').get('pers:c'), 1);
  const toks = tokenize('Ἀχιλλεύς ἦλθε Ἀχιλῆος');
  const a = attribute(toks, ['pers:a', 'pers:c'], lex);
  assert.deepEqual([...a.found], [[0, 'pers:c'], [2, 'pers:a']]);
  // one word, one name left over: they belong together even though the word is new
  const r1 = locateNames('ἦλθε Πάρις καὶ Ἀτρείδης', [{ kind: 'pers', id: 'b' }, { kind: 'pers', id: 'n' }], lex);
  assert.equal(r1.spans.get(1).key, 'pers:n');
  assert.equal(r1.spans.get(3).key, 'pers:b');
  // two unknown words, two names of one kind: marked, identity unknown
  const r2 = locateNames('Πάρις καὶ Ἕκτωρ', [{ kind: 'pers', id: 'x' }, { kind: 'pers', id: 'y' }], lex);
  assert.deepEqual([...r2.spans.values()].map(s => [s.kind, s.key]), [['pers', null], ['pers', null]]);
  // two unknown words, names of different kinds: left unmarked
  const r3 = locateNames('ἐν Τροίᾳ Πάρις', [{ kind: 'pers', id: 'x' }, { kind: 'place', id: 'y' }], lex);
  assert.equal(r3.spans.size, 0);
  // a capital at the start of a passage is not enough
  const r4 = locateNames('Ἦλθε ἀνὴρ Πάρις', [{ kind: 'pers', id: 'x' }], lex);
  assert.deepEqual([...r4.spans.keys()], [2]);
  // a passage with no indexed names has no names
  assert.equal(locateNames('Ἀχιλῆος', [], lex).spans.size, 0);
});

test('indexPages: pages of passages, passages of pages', () => {
  const ip = indexPages(rel);
  assert.deepEqual(ip.surfacesOf.get(`${T}:1.2`), ['urn:cite2:hmt:msA.v1:1r']);
  assert.deepEqual(ip.passagesOn.get('urn:cite2:hmt:msA.v1:1r'), [`${T}:1.1`, `${T}:1.2`, `${S}:1.3`]);
  assert.equal(ip.surfacesOf.get(`${T}:1.5`), undefined);
});

test('attachScholia: a scholion stands under the first line of the page it comments on', () => {
  const refs = ['1.1', '1.2', '1.3', '1.4', '1.5'];
  const shown = { urn: `${T}:`, refs, texts: refs.map(() => ''), pos: new Map(refs.map((r, i) => [r, i])) };
  const sch = n => `${S}:${n}`;
  const spans = [
    { scholion: sch('1.10'), start: 1, end: 3 },      // 1.2-1.4
    { scholion: sch('1.11'), start: 0, end: 0 },
    { scholion: sch('1.11'), start: 4, end: 4 },      // also 1.5
    { scholion: sch('1.12'), start: 9, end: 9 },      // not a line of this page
    { scholion: sch('1.99'), start: 2, end: 2 },      // not on this page
  ];
  const pageLines = ['1.1', '1.3', '1.4', '1.5'];     // 1.2 is on another page
  const { byLine, loose } = attachScholia(pageLines, shown, spans, [sch('1.10'), sch('1.11'), sch('1.12'), sch('1.13')]);
  assert.deepEqual(byLine.get('1.3'), [{ key: sch('1.10'), from: '1.2', to: '1.4' }]);     // first line of its range that is on the page
  assert.deepEqual(byLine.get('1.1'), [{ key: sch('1.11'), from: '1.1', to: '1.1' }]);     // once, under the earlier line
  assert.equal(byLine.has('1.5'), false);
  assert.deepEqual(loose, [sch('1.12'), sch('1.13')]);                                     // no span on the page's lines; no span at all
  assert.deepEqual(attachScholia([], shown, spans, [sch('1.10')]).loose, [sch('1.10')]);
});

test('sectionOf', () => {
  assert.equal(sectionOf(`${T}:1.1`), 'iliad');
  assert.equal(sectionOf(`${S}:1.1`), 'scholia');
  assert.equal(sectionOf('urn:cts:greekLit:tlg7000.tlg001.msA:1'), 'other');
});

test('hash round trip', () => {
  const h = formatNameHash({ kind: 'pers', id: 'pers1', passage: `${T}:1.1` });
  assert.deepEqual(parseNameHash(h), { kind: 'pers', id: 'pers1', passage: `${T}:1.1` });
  assert.deepEqual(parseNameHash('#k=place&i=place3'), { kind: 'place', id: 'place3', passage: '' });
  assert.equal(parseNameHash('#k=bogus&i=x'), null);
  assert.equal(parseNameHash(''), null);
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: the three indexes, the learned names', { skip: !existsSync(REAL) }, () => {
  const r = parseRelease(readFileSync(REAL, 'utf8'));
  const n = readNames(r);
  assert.equal(n.rows, 21531);
  assert.equal(n.unresolved, 108);
  assert.deepEqual(Object.fromEntries(Object.entries(n.byKind).map(([k, v]) => [k, v.length])), { pers: 1154, place: 449, ethnic: 132 });
  assert.equal(n.entries.get('pers:pers1').label, 'Achilles');
  assert.equal(n.entries.get('pers:pers1').passages.length, 832);
  const text = new Map(r.ctsData().map(x => [x.urn, x.text]));
  const diplomatic = pk => { const m = /^(urn:cts:[^:]+:[^:]+)(:.*)$/.exec(pk); const b = `${m[1]}.diplomatic${m[2]}`; return text.get(b) ?? ['.lemma', '.comment'].map(q => text.get(b + q)).filter(x => x !== undefined).join(' '); };
  const samples = [];
  for (const [pk, names] of n.byPassage) for (const kind of ['diplomatic', 'normalized']) {
    const m = /^(urn:cts:[^:]+:[^:]+)(:.*)$/.exec(pk);
    const base = `${m[1]}.${kind}${m[2]}`;
    const t = text.get(base) ?? ['.lemma', '.comment'].map(q => text.get(base + q)).filter(x => x !== undefined).join(' ');
    if (t) samples.push({ text: t, names: names.map(x => `${x.kind}:${x.id}`) });
  }
  const lex = learnLexicon(samples);
  const show = pk => { const { tokens, spans } = locateNames(diplomatic(pk), n.byPassage.get(pk) ?? [], lex); return tokens.map((x, i) => spans.has(i) ? `[${x.text}|${spans.get(i).key ?? '?'}]` : x.text).join(' '); };
  const nfc = x => x.normalize('NFC');
  assert.equal(nfc(show(`${T}:1.1`)), nfc('Μῆνιν ἄειδε θεὰ Πηληϊάδεω [Ἀχιλῆος|pers:pers1]'));
  assert.equal(nfc(show(`${T}:1.2`)), nfc('οὐλομένην: ἡ μυρί\' [Ἀχαιοῖς|ethnic:place96] ἄλγε\' ἔθηκεν:'));
  assert.ok(nfc(show(`${T}:1.3`)).includes(nfc('[Ἄϊδι|place:place67]')));
  // most indexed passages have every name located
  let full = 0, total = 0;
  for (const [pk, names] of n.byPassage) {
    const t = diplomatic(pk); if (!t) continue; total++;
    const got = new Set([...locateNames(t, names, lex).spans.values()].map(s => s.key));
    if (names.every(x => got.has(`${x.kind}:${x.id}`))) full++;
  }
  assert.ok(full / total > 0.8, `${full} of ${total}`);
});

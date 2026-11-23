import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex, passageText } from '../src/text-index.js';
import { fold, parseQuery } from '../src/stringsearch.js';
import {
  parseReleasesCex, currentLemmataRelease, releaseIdOf, compareArchives, createLemmaData, addLemmaLine, finishLemmaData, parseLemmata,
  readLemmata, searchLemmata, occurrenceOf, orderOccurrences, lemmaForms, tokenizeGreek, locateToken, formatLemmaHash, parseLemmaHash,
} from '../src/lemmata.js';

const V = 'urn:cts:greekLit:tlg0012.tlg001.msA.normalized-tokens:';
const S = 'urn:cts:greekLit:tlg5026.msA.hmt.normalized-tokens:';
const SAMPLE = [
  'token|passage|type|lemma|pos',
  `Μῆνιν|${V}1.1.t1|lexical|μῆνις|n-s---fa-`,
  `ἄειδε|${V}1.1.t2|lexical|ἀείδω|v2spma---`,
  `.|${V}1.1.t5|punctuation|.|u--------`,
  `μῆνιν|${S}1.1.comment.t4|lexical|μῆνις|n-s---fa-`,
  `μήνιδος|${S}1.1.comment.t9|lexical|μῆνις|n-s---fg-`,
  `μῆνιν|${V}1.1.t1|lexical|μῆνιν|n-s---fa-`,
  'broken line',
  `x|${V}1.2.t1|oddtype|a|b`,
  '',
].join('\n');

test('parseReleasesCex and the current row', () => {
  const rows = parseReleasesCex('release|date|archive|llm\r\nlemmata-2025a|2025-01-02|2024b|some-model\r\nlemmata-current|2025-06-01|2024c|other model\r\n\r\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(currentLemmataRelease(rows), { release: 'lemmata-current', date: '2025-06-01', archive: '2024c', llm: 'other model' });
  assert.equal(currentLemmataRelease([rows[0]]), null);
  assert.deepEqual(parseReleasesCex('// comment\n#!x\nlemmata-current|d|a\n'), [{ release: 'lemmata-current', date: 'd', archive: 'a', llm: '' }]);
});

test('releaseIdOf and compareArchives', () => {
  assert.equal(releaseIdOf('Homer Multitext project, release 2024c'), '2024c');
  assert.equal(releaseIdOf('urn:cite2:hmt:publications.cex.2024c:all'), '2024c');
  assert.equal(releaseIdOf('hmt-2025A'), '2025a');
  assert.equal(releaseIdOf('no id'), null);
  const lib = { urn: 'urn:cite2:hmt:publications.cex.2024c:all', name: 'Homer Multitext project, release 2024c' };
  assert.deepEqual(compareArchives('2024c', lib), { status: 'same', lemmata: '2024c', release: '2024c' });
  assert.equal(compareArchives('hmt-2024c', lib).status, 'same');
  assert.deepEqual(compareArchives('2024b', lib), { status: 'different', lemmata: '2024b', release: '2024c' });
  assert.equal(compareArchives('mystery', { name: 'something' }).status, 'unknown');
  assert.equal(compareArchives('mystery', { name: 'the mystery release' }).status, 'same');
});

test('parseLemmata: lexical tokens only, grouped by lemma, interned', () => {
  const d = parseLemmata(SAMPLE);
  assert.equal(d.lexical, 5);
  assert.equal(d.punctuation, 1);
  assert.equal(d.malformed, 2, 'one short line, one unknown type');
  assert.deepEqual(d.list.map(e => e.lemma), ['ἀείδω', 'μῆνιν', 'μῆνις']);   // alphabetical ignoring accents: μηνιν before μηνισ
  assert.equal(d.versions.length, 2);
  assert.deepEqual(d.versions, [V, S]);
  assert.deepEqual(d.refs, ['1.1', '1.1.comment']);
  const e = d.lemmas.get('μῆνις');
  assert.equal(e.t.length, 3);
  assert.deepEqual(lemmaForms(e), [{ form: 'μήνιδος', count: 1 }, { form: 'μῆνιν', count: 1 }, { form: 'Μῆνιν', count: 1 }].sort((a, b) => b.count - a.count || (a.form < b.form ? -1 : 1)));
});

test('alphabetical order ignores accents', () => {
  const d = parseLemmata(`a|${V}1.1.t1|lexical|βῆτα|x\nb|${V}1.1.t2|lexical|ἄλφα|x\nc|${V}1.1.t3|lexical|ἀλφα|x\nd|${V}1.1.t4|lexical|γάμμα|x\n`);
  assert.deepEqual(d.list.map(e => e.folded), ['αλφα', 'αλφα', 'βητα', 'γαμμα']);
});

test('occurrenceOf: token URN to passage URN and key', () => {
  const d = parseLemmata(SAMPLE);
  const e = d.lemmas.get('μῆνις');
  const o = e.t.map((_, i) => occurrenceOf(d, e, i));
  assert.deepEqual(o[0], {
    token: 'Μῆνιν', pos: 'n-s---fa-', lemma: 'μῆνις', n: 1, part: '', key: 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1',
    version: 'urn:cts:greekLit:tlg0012.tlg001.msA:', tokenUrn: `${V}1.1.t1`, passageUrn: 'urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.1',
  });
  assert.equal(o[1].key, 'urn:cts:greekLit:tlg5026.msA.hmt:1.1', 'a scholion passage drops .comment');
  assert.equal(o[1].part, 'comment');
  assert.equal(o[1].passageUrn, 'urn:cts:greekLit:tlg5026.msA.hmt.normalized:1.1.comment');
  assert.equal(o[1].tokenUrn, `${S}1.1.comment.t4`);
  assert.equal(o[1].version, 'urn:cts:greekLit:tlg5026.msA.hmt:');
});

test('tokens without a .tN part', () => {
  const d = parseLemmata(`w|${V}1.5|lexical|λ|x\n`);
  const o = occurrenceOf(d, d.lemmas.get('λ'), 0);
  assert.equal(o.n, 0);
  assert.equal(o.tokenUrn, `${V}1.5`);
  assert.equal(o.key, 'urn:cts:greekLit:tlg0012.tlg001.msA:1.5');
});

test('searchLemmata: substring of the folded lemma, minimum length', () => {
  const d = parseLemmata(SAMPLE);
  assert.deepEqual(searchLemmata(d, parseQuery('μηνι')).map(e => e.lemma), ['μῆνιν', 'μῆνις']);
  assert.deepEqual(searchLemmata(d, parseQuery('Ἀείδ')).map(e => e.lemma), ['ἀείδω']);
  assert.deepEqual(searchLemmata(d, parseQuery('ειδ')).map(e => e.lemma), ['ἀείδω']);
  assert.deepEqual(searchLemmata(d, 'μ'), []);
  assert.deepEqual(searchLemmata(d, 'ξξξ'), []);
});

test('orderOccurrences: Iliad before scholia, then catalogue order, then data order', () => {
  const B = 'urn:cts:greekLit:tlg0012.tlg001.msB.normalized-tokens:';
  const d = parseLemmata([`a|${S}1.1.comment.t1|lexical|λ|x`, `b|${B}1.1.t1|lexical|λ|x`, `c|${V}1.2.t1|lexical|λ|x`, `d|${V}1.1.t1|lexical|λ|x`].join('\n'));
  const e = d.lemmas.get('λ');
  const order = ['urn:cts:greekLit:tlg0012.tlg001.msA:', 'urn:cts:greekLit:tlg0012.tlg001.msB:', 'urn:cts:greekLit:tlg5026.msA.hmt:'];
  assert.deepEqual(orderOccurrences(d, e, order).map(i => e.t[i]), ['c', 'd', 'b', 'a']);
});

test('readLemmata: a stream cut anywhere gives the same result', async () => {
  const bytes = new TextEncoder().encode(SAMPLE.replace(/\n/g, '\r\n'));
  for (const size of [1, 3, 7, 64, bytes.length]) {
    const stream = new ReadableStream({
      start(c) { for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size)); c.close(); },
    });
    const seen = [];
    const d = await readLemmata(stream, { onProgress: p => seen.push(p.read) });
    assert.equal(d.lexical, 5, `chunk size ${size}`);
    assert.deepEqual(d.list.map(e => e.lemma), parseLemmata(SAMPLE).list.map(e => e.lemma));
    assert.equal(seen.at(-1), bytes.length, 'progress reaches the end');
    assert.ok(seen.every((n, i, a) => !i || a[i - 1] <= n));
  }
  // no final newline
  const d = await readLemmata(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`w|${V}1.1.t1|lexical|λ|x`)); c.close(); } }));
  assert.equal(d.lexical, 1);
});

test('tokenizeGreek: words with elision marks, punctuation singly', () => {
  assert.deepEqual(tokenizeGreek('ἀλλ’ ἄγε, δὴ·').map(t => [t.text, t.lexical]), [['ἀλλ’', true], ['ἄγε', true], [',', false], ['δὴ', true], ['·', false]]);
  const t = tokenizeGreek('Μῆνιν ἄειδε');
  assert.deepEqual([t[1].start, t[1].end], [6, 11]);
});

const sch0 = () => [{ part: 'lemma', text: 'μῆνιν ἄειδε' }, { part: 'comment', text: 'ζητοῦσι μήνιδος' }];

test('locateToken: by number counting punctuation, by lexical number, by string', () => {
  const parts = [{ part: '', text: 'οὕνεκα τὸν, Χρύσην τὸν ἀρητῆρα' }];
  assert.deepEqual(locateToken(parts, 'Χρύσην', 4), { hits: [{ part: 0, start: 12, end: 18 }], how: 'number' });
  assert.equal(locateToken(parts, 'Χρύσην', 3).how, 'lexical-number');
  const s = locateToken(parts, 'τὸν', 99);
  assert.equal(s.how, 'nearest');
  assert.equal(s.hits.length, 1, 'one of the same strings when the number does not fit');
  assert.equal(locateToken(parts, 'τὸν', 6).hits[0].start, 19, 'number 6 is nearer the second τὸν (token 5) than the first (token 2)');
  assert.equal(locateToken(parts, 'Χρύσην', 99).how, 'string', 'a single occurrence needs no number');
  assert.equal(locateToken(parts, 'Χρύσην', 99).hits.length, 1);
  assert.equal(locateToken(parts, 'ξξ', 2).how, 'none');
  assert.equal(locateToken(parts, 'Χρύσην', 0).how, 'string');
  // NFD token against NFC text, and accent-only differences
  assert.equal(locateToken(parts, 'Χρύσην'.normalize('NFD'), 4).how, 'number');
  assert.equal(locateToken(parts, 'χρυσην', 4).how, 'number');
  // numbering that starts again in the comment
  assert.deepEqual(locateToken(sch0(), 'μήνιδος', 2), { hits: [{ part: 1, start: 8, end: 15 }], how: 'part-number' });
  // scholion: lemma then comment, numbered on through both
  const sch = [{ part: 'lemma', text: 'μῆνιν ἄειδε' }, { part: 'comment', text: 'ζητοῦσι μήνιδος' }];
  assert.deepEqual(locateToken(sch, 'μήνιδος', 4), { hits: [{ part: 1, start: 8, end: 15 }], how: 'number' });
});

test('locateToken: a scholion token is numbered within its lemma or comment', () => {
  const sch = [{ part: 'lemma', text: 'τὸν ἄειδε' }, { part: 'comment', text: 'ἄειδε τὸν ὁ' }];
  assert.deepEqual(locateToken(sch, 'τὸν', 2, 'comment'), { hits: [{ part: 1, start: 6, end: 9 }], how: 'part-number' });
  assert.deepEqual(locateToken(sch, 'τὸν', 1, 'lemma'), { hits: [{ part: 0, start: 0, end: 3 }], how: 'part-number' });
  assert.deepEqual(locateToken(sch, 'ἄειδε', 1, 'comment').hits, [{ part: 1, start: 0, end: 5 }]);
  assert.equal(locateToken(sch, 'ὁ', 3, 'comment').how, 'part-number');
  assert.equal(locateToken(sch, 'τὸν', 2, 'nonesuch').how, 'part-number', 'unknown part name: falls back on trying every part');
});

test('locateToken: the elision mark may be part of the word or a token of its own', () => {
  const parts = [{ part: '', text: "οὐλομένην: ἡ μυρί' Ἀχαιοῖς ἄλγε' ἔθηκεν:" }];
  // as in the lemmatization: μυρί (4) ' (5) Ἀχαιοῖς (6) ἄλγε (7) ' (8) ἔθηκεν (9)
  assert.deepEqual(['Ἀχαιοῖς', 6], ['Ἀχαιοῖς', 6]);
  for (const [tok, n] of [['μυρί', 4], ['Ἀχαιοῖς', 6], ['ἄλγε', 7], ['ἔθηκεν', 9]]) {
    const loc = locateToken(parts, tok, n);
    assert.equal(loc.how, 'number', `${tok} ${n}`);
    assert.equal(fold(parts[0].text.slice(loc.hits[0].start, loc.hits[0].end)), fold(tok));
  }
});

const SAMPLE_FILE = new URL('../scratch/sample.cex', import.meta.url);
test('a sample of the real lemmatization data', { skip: !existsSync(SAMPLE_FILE) || !existsSync(new URL('../scratch/hmt-current.cex', import.meta.url)) }, () => {
  const d = parseLemmata(readFileSync(SAMPLE_FILE, 'utf8'));
  assert.equal(d.malformed, 0, 'every line is read');
  assert.ok(d.lexical > 0 && d.punctuation > 0);
  const ti = buildTextIndex(parseRelease(readFileSync(new URL('../scratch/hmt-current.cex', import.meta.url), 'utf8')));
  let n = 0;
  for (const e of d.list) for (let i = 0; i < e.t.length; i++) {
    const o = occurrenceOf(d, e, i);
    assert.ok(o.key, o.tokenUrn);
    const parts = passageText(ti, o.key, 'normalized').parts;
    assert.ok(parts.length, `${o.tokenUrn}: passage ${o.key} is in the release`);
    const loc = locateToken(parts, o.token, o.n);
    assert.equal(loc.how, 'number', `${o.tokenUrn} ${o.token}`);
    assert.equal(loc.hits.length, 1);
    n++;
  }
  assert.equal(n, d.lexical);
});

const FULL_FILE = new URL('../scratch/lemmata-current.cex', import.meta.url);
test('the whole lemmatization data set: every line read, every token in a passage of the release, nearly all located', { skip: !existsSync(FULL_FILE) || !existsSync(new URL('../scratch/hmt-current.cex', import.meta.url)) }, () => {
  const d = parseLemmata(readFileSync(FULL_FILE, 'utf8'));
  assert.equal(d.malformed, 0);
  assert.ok(d.lexical > 100000 && d.list.length > 1000);
  const ti = buildTextIndex(parseRelease(readFileSync(new URL('../scratch/hmt-current.cex', import.meta.url), 'utf8')));
  const how = {};
  let n = 0;
  for (const e of d.list.filter((_, k) => k % 5 === 0)) for (let i = 0; i < e.t.length; i++) {
    const o = occurrenceOf(d, e, i);
    assert.ok(o.key, o.tokenUrn);
    const parts = passageText(ti, o.key, 'normalized').parts;
    assert.ok(parts.length, `${o.tokenUrn}: passage ${o.key} is in the release`);
    const loc = locateToken(parts, o.token, o.n, o.part);
    how[loc.how] = (how[loc.how] ?? 0) + 1;
    n++;
  }
  const exact = (how.number ?? 0) + (how['part-number'] ?? 0) + (how['lexical-number'] ?? 0) + (how.string ?? 0);
  assert.ok(exact / n > 0.95, `located exactly: ${exact} of ${n} (${JSON.stringify(how)})`);
  assert.ok((how.none ?? 0) / n < 0.005, `not found: ${how.none} of ${n}`);
});

test('hash round trip', () => {
  const w = { q: 'μηνι', lemma: 'μῆνις', token: `${V}1.1.t1` };
  assert.deepEqual(parseLemmaHash(formatLemmaHash(w)), w);
  assert.deepEqual(parseLemmaHash('#q=α'), { q: 'α', lemma: '', token: '' });
  assert.equal(parseLemmaHash('#l=x'), null);
  assert.equal(formatLemmaHash({ q: 'α' }), '#q=%CE%B1');
});

const CEX = new URL('../scratch/hmt-current.cex', import.meta.url);
test('on the real release: tokens made from its texts are found again by number, and map to passages', { skip: !existsSync(CEX) }, () => {
  const rel = parseRelease(readFileSync(CEX, 'utf8'));
  const ti = buildTextIndex(rel);
  const d = createLemmaData();
  let made = 0;
  const tokenCounts = new Map();
  for (const ex of ti.values()) {
    if (!/\.normalized:$/.test(ex.urn)) continue;
    const tokenVersion = ex.urn.replace(/\.normalized:$/, '.normalized-tokens:');
    ex.refs.slice(0, 40).forEach((ref, k) => {
      tokenizeGreek(ex.texts[k]).forEach((t, i) => {
        addLemmaLine(d, `${t.text}|${tokenVersion}${ref}.t${i + 1}|${t.lexical ? 'lexical' : 'punctuation'}|${fold(t.text) || t.text}|x`);
        made++;
      });
    });
  }
  finishLemmaData(d);
  assert.ok(made > 1000 && d.lexical > 500);
  assert.ok(d.versions.length >= 1);
  let checked = 0;
  for (const e of d.list.filter((_, k) => k % 7 === 0)) {
    for (let i = 0; i < Math.min(e.t.length, 3); i++) {
      const o = occurrenceOf(d, e, i);
      assert.ok(o.key, o.tokenUrn);
      const parts = passageText(ti, o.key, 'normalized').parts;
      assert.ok(parts.length > 0, `passage for ${o.tokenUrn} => ${o.key}`);
      const loc = locateToken(parts, o.token, o.n);
      assert.ok(['number', 'lexical-number', 'part-number'].includes(loc.how), `${o.tokenUrn} is found by its number (${loc.how})`);
      const p = parts[loc.hits[0].part].text;
      assert.equal(p.slice(loc.hits[0].start, loc.hits[0].end), o.token);
      checked++;
    }
  }
  assert.ok(checked > 200, `checked ${checked} of ${d.list.length} lemmata (${d.lexical} tokens)`);
});

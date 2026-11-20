import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import { buildSearchIndex, searchPassages, parseQuery, tokenMatches } from '../src/stringsearch.js';
import { countTokens, sortCounts, atLeast, searchInVersions, textChoices, versionOfKey, toCsv, csvName, niceTicks, formatCounterHash, parseCounterHash } from '../src/stringcounter.js';

/** A tiny search index from passages: [key, text]. */
const mk = rows => ({
  kind: 'diplomatic',
  entries: [],
  byKey: new Map(rows.map(([k, text]) => [k, { key: k, parts: [{ part: '', text, folded: text }] }])),
});

test('countTokens: occurrences and passages per token, alphabetical', () => {
  const ix = mk([['a', 'μῆνιν ἄειδε μῆνιν'], ['b', 'Μῆνις'], ['c', 'μῆνιν']]);
  const rows = countTokens(ix, ['a', 'b', 'c'], 'μηνι');
  assert.deepEqual(rows.map(r => [r.token, r.form, r.count, r.passages]), [
    ['μηνιν', 'μῆνιν', 3, ['a', 'c']],        // twice in a, once in c
    ['μηνισ', 'μῆνις', 1, ['b']],
  ]);
});

test('toCsv: header, CRLF, quoting', () => {
  const csv = toCsv([{ token: 'α', form: 'α', count: 2, passages: ['x', 'y'] }, { token: 'b,c', form: 'say "b"', count: 1, passages: ['z'] }]);
  assert.equal(csv, 'token,form,occurrences,passages\r\nα,α,2,2\r\n"b,c","say ""b""",1,1\r\n');
  assert.equal(toCsv([]), 'token,form,occurrences,passages\r\n');
});

test('csvName, niceTicks, hash', () => {
  assert.equal(csvName('μηνι'), 'string-counts-meni.csv');
  assert.equal(csvName('αχ λλ'), 'string-counts-ach-ll.csv');
  assert.equal(csvName('θψ'), 'string-counts-thps.csv');
  assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(niceTicks(305), [0, 100, 200, 300, 400]);
  assert.deepEqual(niceTicks(1), [0, 1]);
  assert.deepEqual(niceTicks(3), [0, 1, 2, 3]);
  assert.ok(niceTicks(1).at(-1) >= 1 && niceTicks(0).length >= 2);
  const w = { q: 'μηνι', scope: 'all', kind: 'normalized', bar: 'μηνιν', passage: 'urn:x:y:1.1', order: 'count', min: 3, versions: ['urn:cts:greekLit:tlg0012.tlg001.msA:', 'urn:cts:greekLit:tlg5026.msA.hmt:'] };
  assert.deepEqual(parseCounterHash(formatCounterHash(w)), w);
  assert.equal(parseCounterHash(formatCounterHash({ q: 'α', kind: 'diplomatic' })).versions, null, 'no v: all texts');
  assert.ok(!/v=/.test(formatCounterHash({ q: 'α', kind: 'diplomatic', versions: null })));
  assert.deepEqual(parseCounterHash('#q=α&s=scholia').scope, 'scholia', 'an older scope link');
  assert.deepEqual(parseCounterHash('#q=α&v=').versions, [], 'none selected');
  assert.equal(parseCounterHash(formatCounterHash({ q: 'α', scope: 'all', kind: 'diplomatic' })).bar, '');
  assert.equal(parseCounterHash(formatCounterHash({ q: 'α', scope: 'all', kind: 'diplomatic', order: 'alpha' })).order, 'alpha');
  assert.equal(parseCounterHash(formatCounterHash({ q: 'α', scope: 'all', kind: 'diplomatic' })).min, 1);
  assert.ok(!/m=/.test(formatCounterHash({ q: 'α', scope: 'all', kind: 'diplomatic', min: 1 })));
  assert.equal(parseCounterHash('#q=α&m=zz').min, 1);
  assert.equal(parseCounterHash('#q=α&m=-4').min, 1);
  assert.equal(parseCounterHash('#q=α&m=2.9').min, 2);
  assert.ok(!/o=/.test(formatCounterHash({ q: 'α', scope: 'all', kind: 'diplomatic', order: 'alpha' })));
  assert.equal(parseCounterHash('#nothing'), null);
});

const CEX = new URL('../scratch/hmt-current.cex', import.meta.url);
test('texts of the real release: choices cover Iliad and scholia, searching all equals scope all', { skip: !existsSync(CEX) }, () => {
  const rel = parseRelease(readFileSync(CEX, 'utf8'));
  const ix = buildSearchIndex(buildTextIndex(rel), 'diplomatic');
  const ch = textChoices(ix, []);
  assert.ok(ch.filter(c => c.section === 'iliad').length >= 2 && ch.filter(c => c.section === 'scholia').length >= 1);
  const q = parseQuery('αχιλλευς');
  const all = new Set(ch.map(c => c.version));
  assert.deepEqual(searchInVersions(ix, q, all), searchPassages(ix, q, 'all'));
  const il = new Set(ch.filter(c => c.section === 'iliad').map(c => c.version));
  assert.deepEqual(searchInVersions(ix, q, il), searchPassages(ix, q, 'iliad'));
  const sc = new Set(ch.filter(c => c.section === 'scholia').map(c => c.version));
  assert.deepEqual(searchInVersions(ix, q, sc), searchPassages(ix, q, 'scholia'));
});

test('countTokens on the real release agrees with an independent count', { skip: !existsSync(CEX) }, () => {
  const rel = parseRelease(readFileSync(CEX, 'utf8'));
  const ix = buildSearchIndex(buildTextIndex(rel), 'diplomatic');
  const q = parseQuery('μηνι');
  const keys = searchPassages(ix, q, 'all');
  const rows = countTokens(ix, keys, q);
  assert.ok(rows.length > 10);
  const total = rows.reduce((n, r) => n + r.count, 0);
  let naive = 0;
  for (const k of keys) for (const p of ix.byKey.get(k).parts) naive += tokenMatches(p.text, q).length;
  assert.equal(total, naive, 'occurrences add up to all token matches');
  for (const r of rows) assert.ok(r.count >= r.passages.length && r.passages.length > 0);
  const mi = rows.find(r => r.token === 'μηνισ');
  assert.ok(mi && mi.count >= 1);
});

test('sortCounts: alphabetical or by count with alphabetical ties', () => {
  const r = (token, count) => ({ token, form: token, count, passages: [] });
  const rows = [r('β', 2), r('α', 2), r('γ', 5), r('δ', 1)];
  assert.deepEqual(sortCounts(rows, 'alpha').map(x => x.token), ['α', 'β', 'γ', 'δ']);
  assert.deepEqual(sortCounts(rows, 'count').map(x => x.token), ['γ', 'α', 'β', 'δ']);
  assert.deepEqual(rows.map(x => x.token), ['β', 'α', 'γ', 'δ'], 'input untouched');
});

test('atLeast: frequency cutoff', () => {
  const r = (token, count) => ({ token, form: token, count, passages: [] });
  const rows = [r('a', 1), r('b', 3), r('c', 2)];
  assert.deepEqual(atLeast(rows, 1).length, 3);
  assert.deepEqual(atLeast(rows, 2).map(x => x.token), ['b', 'c']);
  assert.deepEqual(atLeast(rows, 4), []);
});

test('searchInVersions / textChoices', () => {
  const A = 'urn:cts:greekLit:tlg0012.tlg001.msA:', B = 'urn:cts:greekLit:tlg0012.tlg001.msB:', S = 'urn:cts:greekLit:tlg5026.msA.hmt:', O = 'urn:cts:greekLit:tlg7000.tlg001.msA:';
  const e = (key, text) => ({ key, parts: [{ part: '', text, folded: text }] });
  const entries = [e(A + '1.1', 'μηνιν'), e(B + '1.1', 'μηνιν'), e(S + '1.1.comment', 'μηνιν'), e(O + '1', 'μηνιν'), e(A + '1.2', 'αλλο')];
  const ix = { kind: 'diplomatic', entries, byKey: new Map(entries.map(x => [x.key, x])) };
  assert.equal(versionOfKey(A + '1.1'), A);
  assert.equal(versionOfKey(S + '1.1.comment'), S);
  assert.deepEqual(searchInVersions(ix, 'μηνι', new Set([A, B, S, O])), [A + '1.1', B + '1.1', S + '1.1.comment', O + '1']);
  assert.deepEqual(searchInVersions(ix, 'μηνι', new Set([B, S])), [B + '1.1', S + '1.1.comment']);
  assert.deepEqual(searchInVersions(ix, 'μηνι', new Set()), []);
  assert.deepEqual(searchInVersions(ix, 'μ', new Set([A])), [], 'too short');
  assert.deepEqual(textChoices(ix, [O, S, B, A]), [
    { version: B, section: 'iliad' }, { version: A, section: 'iliad' },
    { version: S, section: 'scholia' }, { version: O, section: 'other' }], 'Iliad, scholia, other; catalogue order inside');
});

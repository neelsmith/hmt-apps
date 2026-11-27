import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { scholiaMissingByBook, scholiaMissingByPage, bookOfRef } from '../src/scholia-check.js';

const T = 'urn:cts:greekLit:tlg0012.tlg001';
const S = 'urn:cts:greekLit:tlg5026';
const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
${T}.msA:|book,line|Homeric poetry|Iliad|Version A||true|grc
${S}.msAint.hmt:|book,scholion|Scholia|Interior scholia|HMT edition||true|grc
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:commentary.v1:all|urn:cite2:cite:datamodels.v1:commentarymodel|Commentary|x
#!ctsdata
${T}.msA.normalized:1.1|line one
${S}.msAint.hmt.normalized:1.10.lemma|lemma 10
${S}.msAint.hmt.normalized:1.10.comment|comment 10
${S}.msAint.hmt.diplomatic:1.10.comment|DIPL comment 10
${S}.msAint.hmt.normalized:1.11.lemma|lemma 11
${S}.msAint.hmt.normalized:2.5.comment|comment 2.5
${S}.msAint.hmt.normalized:3.7.comment|comment 3.7
${S}.msAint.hmt.normalized:3.8.comment|comment 3.8 (indexed)
${S}.msAint.hmt.normalized:4.9.comment|comment 4.9 (no entry)
${S}.msAint.hmt.normalized:5.1.comment|comment 5.1
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE
passage|imageroi|surface
${S}.msAint.hmt:3.8|urn:cite2:hmt:vaimg.2017a:I1@0.1,0.1,0.1,0.1|urn:cite2:hmt:msA.v1:1r
${T}.msA:1.62|urn:cite2:hmt:vaimg.2017a:I2@0.1,0.1,0.1,0.1|urn:cite2:hmt:msA.v1:12r
${T}.msA:1.5|urn:cite2:hmt:vaimg.2017a:I2@0.1,0.3,0.1,0.1|urn:cite2:hmt:msA.v1:12r
${T}.msA:2.1|urn:cite2:hmt:vaimg.2017a:I3@0.1,0.1,0.1,0.1|urn:cite2:hmt:msA.v1:2v
#!citerelationset
urn|urn:cite2:hmt:commentary.v1:all
label|Commentary

scholion|iliad
${S}.msAint.hmt:1.10|${T}.msA:1.62
${S}.msAint.hmt:1.11|${T}.msA:13.UNKNOWN
${S}.msAint.hmt:2.5|${T}.msA:1.5
${S}.msAint.hmt:2.5|${T}.msA:2.1
${S}.msAint.hmt:3.7|${T}.msA:UNKNOWN
${S}.msAint.hmt:3.8|${T}.msA:3.8
${S}.msAint.hmt:5.1|${T}.msA:25.1
`;

test('bookOfRef', () => {
  assert.equal(bookOfRef('1.62'), 1);
  assert.equal(bookOfRef('24.1'), 24);
  assert.equal(bookOfRef('13.UNKNOWN'), 13);
  assert.equal(bookOfRef('UNKNOWN'), 0);
  assert.equal(bookOfRef('25.1'), 0);
  assert.equal(bookOfRef('0.1'), 0);
});

test('scholiaMissingByBook: scholia with no DSE record, by the book of the Iliad they comment on', () => {
  const r = scholiaMissingByBook(parseRelease(CEX));
  assert.equal(r.dse, true);
  assert.equal(r.commentary, true);
  assert.equal(r.versions, 1);
  assert.equal(r.passages, 7);
  assert.equal(r.missing, 6);   // 3.8 has a record
  const refs = b => r.books.find(x => x.book === b).scholia.map(s => s.ref);
  assert.deepEqual(refs(1), ['1.10', '2.5']);          // 1.10 comments on 1.62; 2.5 on 1.5 and 2.1
  assert.deepEqual(refs(2), ['2.5']);                  // listed under each book it comments on
  assert.deepEqual(refs(13), ['1.11']);                // 13.UNKNOWN is book 13
  assert.deepEqual(refs(3), []);                       // 3.8 is in the DSE
  assert.deepEqual(refs(0), ['3.7', '4.9', '5.1']);    // UNKNOWN, no entry, book 25
  assert.equal(r.books.length, 25);
  assert.equal(r.books[24].book, 0);
});

test('scholiaMissingByBook: texts of every exemplar; lemma and comment read as one scholion', () => {
  const r = scholiaMissingByBook(parseRelease(CEX));
  const s = r.books[0].scholia[0];
  assert.equal(s.urn, `${S}.msAint.hmt:1.10`);
  assert.deepEqual(s.comments, [`1.62`]);
  assert.match(s.text, /lemma 10/);
  assert.deepEqual(s.texts.map(t => t.exemplar).sort(), ['diplomatic', 'normalized']);
  assert.match(s.texts.find(t => t.exemplar === 'diplomatic').text, /DIPL comment 10/);
});

test('scholiaMissingByBook: a release without DSE or commentary', () => {
  const r = scholiaMissingByBook(parseRelease(CEX.split('#!citerelationset')[0]));
  assert.equal(r.dse, false);
  assert.equal(r.commentary, false);
  assert.equal(r.missing, 7);
  assert.equal(r.books.at(-1).book, 0);
  assert.equal(r.books.at(-1).scholia.length, 7);
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('scholiaMissingByBook: the current release (if present)', { skip: !existsSync(REAL) }, () => {
  const r = scholiaMissingByBook(parseRelease(readFileSync(REAL, 'utf8')));
  assert.equal(r.books.filter(b => b.book > 0).length, 24);
  assert.ok(r.missing > 0);
  assert.ok(r.books.every(b => b.scholia.every(s => s.version.includes('tlg5026'))));
});

test('scholiaMissingByPage: grouped by the page the DSE gives the Iliad line commented on', () => {
  const r = scholiaMissingByPage(parseRelease(CEX));
  assert.equal(r.missing, 6);
  assert.equal(r.iliadLines, 3);
  const pages = r.pages.map(p => [p.page, p.label, p.scholia.map(s => s.ref)]);
  assert.deepEqual(pages, [
    ['urn:cite2:hmt:msA.v1:2v', '2v', ['2.5']],
    ['urn:cite2:hmt:msA.v1:12r', '12r', ['1.10', '2.5']],
    ['', 'no page', ['1.11', '3.7', '4.9', '5.1']],
  ]);
});

test('scholiaMissingByPage: no DSE or no commentary index', () => {
  const noDse = scholiaMissingByPage(parseRelease(CEX.replace(/urn:cite2:hmt:hmtdse\.v1:all/g, 'urn:cite2:hmt:other.v1:all')));
  assert.equal(noDse.dse, false);
  assert.equal(noDse.pages.length, 1);
  assert.equal(noDse.pages[0].page, '');
  assert.equal(noDse.pages[0].scholia.length, noDse.missing);
});

test('scholiaMissingByPage: the current release, if present', { skip: !existsSync(new URL('../scratch/hmt-current.cex', import.meta.url)) }, () => {
  const r = scholiaMissingByPage(parseRelease(readFileSync(new URL('../scratch/hmt-current.cex', import.meta.url), 'utf8')));
  const book = scholiaMissingByBook(parseRelease(readFileSync(new URL('../scratch/hmt-current.cex', import.meta.url), 'utf8')));
  assert.equal(r.missing, book.missing);
  assert.ok(r.pages.length > 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARAM_NAMES, readParams, formatQuery } from '../src/location.js';

const PAGE = 'urn:cite2:hmt:msA.v1:12r';
const TEXT = 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10';

test('readParams reads text, page and image from a query string', () => {
  assert.deepEqual(PARAM_NAMES, ['text', 'page', 'image']);
  assert.deepEqual(readParams(''), { text: null, page: null, image: null });
  assert.deepEqual(readParams('?page=' + PAGE), { text: null, page: PAGE, image: null });
  assert.equal(readParams('?text=' + TEXT).text, TEXT);
  assert.equal(readParams('?text=' + encodeURIComponent(TEXT)).text, TEXT, 'escaped colons');
  assert.equal(readParams('page=' + PAGE).page, PAGE, 'the question mark is optional');
  assert.equal(readParams('?x=1&image=urn:cite2:hmt:vaimg.2017a:VA012RN_0013&page=' + PAGE).image, 'urn:cite2:hmt:vaimg.2017a:VA012RN_0013');
  assert.equal(readParams('?xtext=a').text, null);
  assert.equal(readParams('?page=').page, null, 'empty is missing');
  assert.equal(readParams('?page=%20' + PAGE + '%20').page, PAGE, 'trimmed');
  assert.equal(readParams('#page=' + PAGE).page, null, 'a # fragment is not a parameter');
  assert.deepEqual(readParams('?image=a&n=3', ['image', 'n']), { image: 'a', n: '3' });
  assert.equal(readParams(undefined).page, null);
});

test('formatQuery writes the parameters given, leaving URNs readable', () => {
  assert.equal(formatQuery({}), '');
  assert.equal(formatQuery({ page: PAGE }), '?page=' + PAGE);
  assert.equal(formatQuery({ image: 'urn:cite2:hmt:vaimg.2017a:VA012RN_0013', n: 2 }), '?image=urn:cite2:hmt:vaimg.2017a:VA012RN_0013&n=2');
  assert.equal(formatQuery({ page: null, text: undefined, image: '' }), '');
  assert.equal(formatQuery({ text: 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1@μῆνιν[1]' }).startsWith('?text=urn:cts:greekLit:tlg0012.tlg001.msA:1.1@%CE%BC'), true);
  assert.equal(formatQuery({ text: 'a&b=c d+e#f' }), '?text=a%26b%3Dc%20d%2Be%23f', 'what could break the address is escaped');
  for (const v of [PAGE, TEXT, 'a&b=c d+e#f', 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1@μῆνιν[1]', '12.B1']) {
    assert.equal(readParams(formatQuery({ text: v })).text, v, 'round trip: ' + v);
  }
});

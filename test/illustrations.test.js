import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease } from '../src/hmt-release.js';
import { illustrationsOf, imagesListUrl, ILLUSTRATION_MODEL } from '../src/illustrations.js';

const head = `#!citelibrary
name|Test
urn|urn:cite2:test:lib.v1:x
license|none
`;
const model = `#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:illustrations.v1:all|${ILLUSTRATION_MODEL}|Illustrations|x
`;
const set = `#!citerelationset
urn|urn:cite2:hmt:illustrations.v1:all
label|Images of pages
image|illustrated
urn:cite2:hmt:vaimg.2017a:A|urn:cite2:hmt:msA.v1:12r
urn:cite2:hmt:vaimg.2017a:B|urn:cite2:hmt:msA.v1:12r
urn:cite2:hmt:vaimg.2017a:A|urn:cite2:hmt:msA.v1:12r
urn:cite2:hmt:vaimg.2017a:C|urn:cite2:hmt:msA.v1:13r
`;

test('illustrationsOf: images by illustrated object, in order, without repeats', () => {
  const m = illustrationsOf(parseRelease(head + model + set));
  assert.deepEqual(m.get('urn:cite2:hmt:msA.v1:12r'), ['urn:cite2:hmt:vaimg.2017a:A', 'urn:cite2:hmt:vaimg.2017a:B']);
  assert.deepEqual(m.get('urn:cite2:hmt:msA.v1:13r'), ['urn:cite2:hmt:vaimg.2017a:C']);
  assert.equal(m.get('urn:cite2:hmt:msA.v1:14r'), undefined);
});

test('illustrationsOf: a set with image and illustrated columns counts even without a data model entry', () => {
  assert.equal(illustrationsOf(parseRelease(head + set)).size, 2);
});

test('illustrationsOf: a release without illustrations gives an empty map', () => {
  const none = `#!citerelationset
urn|urn:cite2:hmt:other.v1:all
label|Other
a|b
x|y
`;
  assert.equal(illustrationsOf(parseRelease(head + none)).size, 0);
  assert.equal(illustrationsOf(parseRelease(head)).size, 0);
});

test('imagesListUrl: comma-separated URNs in the urns parameter', () => {
  assert.equal(imagesListUrl(['urn:cite2:a:b:1', 'urn:cite2:a:b:2'], 'https://x/images.html'), 'https://x/images.html?urns=urn:cite2:a:b:1,urn:cite2:a:b:2');
});

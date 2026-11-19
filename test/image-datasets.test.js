import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRelease } from '../src/hmt-release.js';
import { imageCollections, imageService } from '../src/images.js';
import { collectionKey, pictureUrl, imageLabel, buildCex, buildManifest, PICTURE_WIDTH } from '../src/image-datasets.js';

const CEX = `#!citelibrary
name|Test library, release 1
urn|urn:cite2:test:lib.v1:x
license|none
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:vaimg.2017a:|urn:cite2:cite:datamodels.v1:imagemodel|Images A|x
urn:cite2:hmt:emptyimg.v1:|urn:cite2:cite:datamodels.v1:imagemodel|Images empty|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:vaimg.2017a:|Images of the Venetus A|urn:cite2:hmt:vaimg.2017a.caption:||CC-BY
urn:cite2:hmt:emptyimg.v1:|Aardvark images|urn:cite2:hmt:emptyimg.v1.caption:||PD
#!citedata
urn|caption|rights
urn:cite2:hmt:vaimg.2017a:VA012RN_0013|Venetus A: Marcianus Graecus Z. 454 (= 822).  Photograph in natural light, folio 12, recto.|Rights A
urn:cite2:hmt:vaimg.2017a:VA013RN_0014|Venetus A, folio 13, recto|
urn:cite2:hmt:vaimg.2017a:VA014RN_0015||Rights C
`;
const items = () => imageCollections(parseRelease(CEX)).find(c => c.urn === 'urn:cite2:hmt:vaimg.2017a:');

test('collectionKey, pictureUrl, imageLabel', () => {
  assert.equal(collectionKey('urn:cite2:hmt:vaimg.2017a:'), 'vaimg.2017a');
  assert.equal(collectionKey('urn:cite2:citebl:burney86imgs.v1:'), 'burney86imgs.v1');
  assert.throws(() => collectionKey('urn:cite2:hmt:vaimg.2017a:VA012RN_0013'));
  assert.equal(pictureUrl('http://x/a.tif'), 'http://x/a.tif/full/2000,/0/default.jpg');
  const [a, , c] = items().items;
  assert.equal(imageLabel(a), 'Venetus A: Marcianus Graecus Z. 454 (= 822). Photograph in natural light, folio 12, recto');
  assert.equal(imageLabel(c), 'VA014RN_0015');                      // no caption: the id
  assert.equal(imageLabel({ ...a, caption: 'a | b\nc  d.' }), 'a b c d');
});

test('buildCex: header and one line per image, `image` is the IIIF service id', () => {
  const { text, rows, skipped } = buildCex(items());
  const lines = text.trimEnd().split('\n');
  assert.equal(lines[0], 'image|urn|label');
  assert.equal(rows, 3);
  assert.equal(skipped.length, 0);
  assert.equal(lines[1].split('|').length, 3);
  assert.equal(lines[1].split('|')[0],
    'http://www.homermultitext.org/iipsrv?IIIF=/project/homer/pyramidal/deepzoom/hmt/vaimg/2017a/VA012RN_0013.tif');
  assert.equal(lines[1].split('|')[1], 'urn:cite2:hmt:vaimg.2017a:VA012RN_0013');
  assert.ok(text.endsWith('\n'));
  assert.deepEqual(buildCex(items(), () => null).skipped.length, 3);
});

test('buildManifest: Presentation 3 canvases for images of known size; others reported', () => {
  const c = items();
  const sizes = new Map([[c.items[0].urn, { width: 5428, height: 7230 }], [c.items[2].urn, { width: 4000, height: 3000 }]]);
  const { manifest: m, missing } = buildManifest(c, sizes, { id: 'https://example.org/m/vaimg.2017a.json', source: 'Test library, release 1' });
  assert.deepEqual(missing, [c.items[1].urn]);
  assert.equal(m['@context'], 'http://iiif.io/api/presentation/3/context.json');
  assert.equal(m.type, 'Manifest');
  assert.equal(m.id, 'https://example.org/m/vaimg.2017a.json');
  assert.deepEqual(m.label, { en: ['Images of the Venetus A'] });
  assert.deepEqual(m.requiredStatement.value, { en: ['CC-BY'] });
  assert.equal(m.items.length, 2);
  const cv = m.items[0];
  assert.equal(cv.type, 'Canvas');
  assert.equal(cv.width, 5428); assert.equal(cv.height, 7230);
  assert.ok(cv.id.startsWith(m.id + '/canvas/') && cv.id.endsWith('VA012RN_0013'));
  const anno = cv.items[0].items[0];
  assert.equal(anno.motivation, 'painting');
  assert.equal(anno.target, cv.id);
  const service = imageService(c.items[0].urn);
  assert.equal(anno.body.id, `${service}/full/${PICTURE_WIDTH},/0/default.jpg`);
  assert.deepEqual([anno.body.width, anno.body.height], [2000, Math.round(2000 * 7230 / 5428)]);
  assert.deepEqual(anno.body.service, [{ id: service, type: 'ImageService2', profile: 'level1' }]);
  assert.ok(cv.metadata.some(x => x.value.en[0] === c.items[0].urn), 'image URN in canvas metadata');
  assert.ok(cv.metadata.some(x => x.value.en[0] === 'Rights A'));
  const ids = new Set(); JSON.stringify(m, (k, v) => { if (k === 'id') { assert.ok(!ids.has(v), `duplicate id ${v}`); ids.add(v); } return v; });
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(m)));
});

test('the CEX `image` value is the manifest\'s service id, for every image', () => {
  const c = items();
  const sizes = new Map(c.items.map(i => [i.urn, { width: 100, height: 200 }]));
  const { manifest } = buildManifest(c, sizes, { id: 'https://example.org/m.json' });
  const fromManifest = new Map(manifest.items.map(cv => {
    const body = cv.items[0].items[0].body;
    return [cv.metadata[0].value.en[0], body.service[0].id];
  }));
  const rows = buildCex(c).text.trimEnd().split('\n').slice(1).map(l => l.split('|'));
  assert.equal(rows.length, c.items.length);
  for (const [image, urn] of rows) {
    assert.equal(image, fromManifest.get(urn), urn);
    assert.ok(!/\/(full|info\.json)/.test(image), `${image} has a request part`);
    assert.ok(image.endsWith('.tif'));
  }
});

// ---- the script, against a local stand-in for the image server ----

const SCRIPT = fileURLToPath(new URL('../scripts/make-image-datasets.js', import.meta.url));
function run(args) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [SCRIPT, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => resolve({ code, out, err }));
  });
}

test('script: CEX without network, manifests from info.json, cache, missing images', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'imgds-'));
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(req.url);
    if (req.url.includes('VA013RN_0014')) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ width: 3000, height: 4000 }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/iip/`;
  try {
    const rel = join(dir, 'release.cex'); writeFileSync(rel, CEX);
    const out = join(dir, 'out');
    const common = ['--release', rel, '--out', out, '--service-base', base, '--base-url', 'https://example.org/m/'];

    // 1. CEX only: no requests
    let r = await run([...common, '--cex-only']);
    assert.equal(r.code, 0, r.err + r.out);
    assert.equal(hits.length, 0);
    assert.deepEqual(readdirSync(out).sort(), ['vaimg.2017a.cex']);            // empty collection skipped
    const cexLines = readFileSync(join(out, 'vaimg.2017a.cex'), 'utf8').trimEnd().split('\n');
    assert.equal(cexLines.length, 4);
    assert.ok(cexLines[1].startsWith(`${base}hmt/vaimg/2017a/VA012RN_0013.tif|`), cexLines[1]);

    // 2. full run: one image is missing on the server
    r = await run(common);
    assert.equal(r.code, 1, 'exit code 1 when images are missing');
    assert.match(r.out, /2 canvases in vaimg\.2017a\.json/);
    assert.match(r.out, /1 images left out/);
    assert.match(r.out, /VA013RN_0014: HTTP 404/);
    const man = JSON.parse(readFileSync(join(out, 'vaimg.2017a.json'), 'utf8'));
    assert.equal(man.id, 'https://example.org/m/vaimg.2017a.json');
    assert.equal(man.items.length, 2);
    assert.equal(man.items[0].width, 3000);
    assert.ok(existsSync(join(out, 'sizes.json')));
    const first = hits.length;
    assert.equal(hits.filter(u => u.includes('VA013RN_0014')).length, 1, 'a 404 is not retried');

    // 3. repeat: sizes come from the cache; only the missing image is asked for again
    r = await run(common);
    assert.equal(hits.length - first, 1);
    assert.deepEqual(hits.slice(first).every(u => u.includes('VA013RN_0014')), true);

    // 4. --only with an unknown collection
    r = await run([...common, '--only', 'nope.v1']);
    assert.equal(r.code, 1);
    assert.match(r.err, /no image collections to do/);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('script: unknown option is an error', async () => {
  const r = await run(['--frobnicate']);
  assert.equal(r.code, 1);
  assert.match(r.err, /unknown option/);
});

test('script: gives up quickly on an unreachable server, and on a wrong location', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'imgds-'));
  // many images, so that "gives up" is visible
  const rows = Array.from({ length: 40 }, (_, i) => `urn:cite2:hmt:vaimg.2017a:IMG${i}|Page ${i}|r`).join('\n');
  const rel = join(dir, 'release.cex');
  writeFileSync(rel, CEX.replace(/urn:cite2:hmt:vaimg.2017a:VA012[\s\S]*$/, rows + '\n'));
  const hits = [];
  const server = createServer((req, res) => { hits.push(req.url); res.writeHead(404); res.end('no'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    // wrong location: every request answers 404
    let r = await run(['--release', rel, '--out', join(dir, 'a'), '--concurrency', '1',
      '--service-base', `http://127.0.0.1:${server.address().port}/`]);
    assert.equal(r.code, 1);
    assert.match(r.out, /none of the first 10 images exist/);
    assert.ok(hits.length <= 11, `${hits.length} requests`);
    assert.ok(existsSync(join(dir, 'a', 'vaimg.2017a.cex')), 'CEX still written');
    assert.ok(!existsSync(join(dir, 'a', 'vaimg.2017a.json')), 'no manifest without sizes');
  } finally { server.close(); }
  // unreachable: a port that was open a moment ago and is now closed
  const closed = createServer();
  await new Promise(r => closed.listen(0, '127.0.0.1', r));
  const closedPort = closed.address().port;
  await new Promise(r => closed.close(r));
  const t0 = Date.now();
  const r = await run(['--release', rel, '--out', join(dir, 'b'), '--concurrency', '1', '--service-base', `http://127.0.0.1:${closedPort}/`]);
  assert.equal(r.code, 1);
  assert.match(r.out, /did not answer the first 10 requests/);
  assert.ok(Date.now() - t0 < 10000, `took ${Date.now() - t0} ms`);
  rmSync(dir, { recursive: true, force: true });
});

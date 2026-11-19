// Make datasets for every image collection of an HMT release:
//   <out>/<collection>.cex   image|urn|label      (no network needed; `image` is the IIIF service id)
//   <out>/<collection>.json  IIIF Presentation 3 manifest
// A manifest canvas needs the image's pixel size, which only the image server
// knows (its IIIF info.json), so the manifests need network access.  Sizes
// are cached in <out>/sizes.json, so a run that was interrupted, or that
// failed for some images, can simply be repeated.
//
// Usage: node scripts/make-image-datasets.js [options]
//   --release <file>       release to read             (default scratch/hmt-current.cex)
//   --out <dir>            where to write              (default scratch/images)
//   --base-url <url>       URL the manifests will be published at, without a file name
//                          (default https://neelsmith.github.io/hmt-apps/images)
//   --service-base <url>   IIIF image server base      (default: the HMT server, see src/images.js)
//   --only <key>           one collection only, e.g. vaimg.2017a (may be repeated)
//   --cex-only             write the CEX files and no manifests (no network)
//   --concurrency <n>      parallel size requests      (default 8)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRelease } from '../src/hmt-release.js';
import { imageCollections, imageService, parseInfo, IMAGE_SERVICE_BASE } from '../src/images.js';
import { buildCex, buildManifest, collectionKey } from '../src/image-datasets.js';

/** Failed requests, with no success so far, after which a collection is given up. */
const GIVE_UP = 10;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string[]} argv */
export function parseArgs(argv) {
  const o = { release: join(root, 'scratch/hmt-current.cex'), out: join(root, 'scratch/images'),
    baseUrl: 'https://neelsmith.github.io/hmt-apps/images', serviceBase: IMAGE_SERVICE_BASE,
    only: /** @type {string[]} */ ([]), cexOnly: false, concurrency: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) throw new Error(`${a} needs a value`); return argv[++i]; };
    if (a === '--release') o.release = resolve(val());
    else if (a === '--out') o.out = resolve(val());
    else if (a === '--base-url') o.baseUrl = val().replace(/\/+$/, '');
    else if (a === '--service-base') o.serviceBase = val();
    else if (a === '--only') o.only.push(val());
    else if (a === '--cex-only') o.cexOnly = true;
    else if (a === '--concurrency') o.concurrency = Math.max(1, parseInt(val(), 10) || 8);
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

/** Fetch the size of one image, trying up to three times. */
async function fetchSize(service) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(`${service}/info.json`, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const size = parseInfo(await resp.json());
      if (!size) throw new Error('no width and height in info.json');
      return size;
    } catch (e) {
      last = e;
      const code = e && e.cause && e.cause.code;
      // Asking again helps only after a timeout or a server error, not when the file is not there or nothing answers.
      if (/HTTP 4\d\d/.test(String(e.message)) || ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) break;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw last;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const rel = parseRelease(readFileSync(o.release, 'utf8'));
  const serviceFor = urn => imageService(urn, o.serviceBase);
  const source = rel.library.name;
  let collections = imageCollections(rel).filter(c => c.items.length > 0);
  if (o.only.length) collections = collections.filter(c => o.only.includes(collectionKey(c.urn)));
  if (!collections.length) throw new Error('no image collections to do');
  mkdirSync(o.out, { recursive: true });

  const cachePath = join(o.out, 'sizes.json');
  /** @type {Record<string, {width: number, height: number}>} */
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  let problems = 0;

  for (const coll of collections) {
    const key = collectionKey(coll.urn);
    const cex = buildCex(coll, serviceFor);
    writeFileSync(join(o.out, `${key}.cex`), cex.text);
    let line = `${key}: ${cex.rows} images in ${key}.cex`;
    if (cex.skipped.length) { line += `, ${cex.skipped.length} without a usable location`; problems++; }
    if (o.cexOnly) { console.log(line); continue; }

    const todo = coll.items.filter(i => serviceFor(i.urn) && !cache[serviceFor(i.urn)]);
    const failures = [];
    let next = 0, done = 0, found = 0;
    /** Set when it is clear that going on is pointless: no image has answered after GIVE_UP tries. */
    let giveUp = '';
    let unreachable = false;
    const worker = async () => {
      while (next < todo.length && !giveUp) {
        const item = todo[next++];
        const service = serviceFor(item.urn);
        try { cache[service] = await fetchSize(service); found++; }
        catch (e) {
          failures.push(`${item.urn}: ${e.message}`);
          if (found === 0 && failures.length >= GIVE_UP) {
            unreachable = !failures.some(f => /HTTP \d\d\d/.test(f));
            giveUp = unreachable
              ? `the image server did not answer the first ${GIVE_UP} requests (${e.message}); stopping`
              : `none of the first ${GIVE_UP} images exist where this script looks for them (${service}/info.json); is --service-base right for this collection?`;
          }
        }
        if (++done % 100 === 0) process.stderr.write(`  ${key}: ${done}/${todo.length} sizes\r`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(o.concurrency, todo.length) }, worker));
    writeFileSync(cachePath, JSON.stringify(cache));

    const sizes = new Map();
    for (const i of coll.items) { const s = cache[serviceFor(i.urn)]; if (s) sizes.set(i.urn, s); }
    const { manifest, missing } = buildManifest(coll, sizes, { id: `${o.baseUrl}/${key}.json`, source, serviceFor });
    if (manifest.items.length) writeFileSync(join(o.out, `${key}.json`), JSON.stringify(manifest, null, 2) + '\n');
    line += manifest.items.length
      ? `; ${manifest.items.length} canvases in ${key}.json`
      : '; no manifest (no image sizes)';
    if (missing.length) {
      problems++;
      line += `; ${missing.length} images left out of the manifest`;
    }
    console.log(line);
    for (const f of failures.slice(0, 3)) console.log(`    ${f}`);
    if (failures.length > 3) console.log(`    … and ${failures.length - 3} more`);
    if (giveUp) {
      console.log(`    gave up: ${giveUp}`);
      if (unreachable) { problems++; break; }
    }
  }
  if (problems) {
    console.log('\nSome images are missing from the manifests. Check the image server, then run this again: sizes already found are kept in sizes.json.');
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message || e); process.exit(1); });
}

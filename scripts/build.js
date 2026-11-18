// Build single-file apps.
//
// Each app lives in src/apps/<name>/index.html.  A line of the form
//     <!-- @inline path/relative/to/repo/root.js -->
// is replaced by an inline <script> holding that file, and a line of the form
//     <!-- @inline-style path/relative/to/repo/root.css -->
// by an inline <style>.  Apps may share files that live in another app's folder.
// The shared sources are ordinary ES modules (so Node can test them); to make them work as classic
// inline scripts, single-line `import ... from '...';` statements are removed
// and the `export` keyword is dropped.  The scripts share one global scope, so
// list files in dependency order and avoid duplicate top-level names.
//
// Versions: version.txt (maintained by hand, never written by this script)
// lists one app per line, `<name>.html <version>`.  The text @@VERSION@@ in an
// app's page is replaced by that app's version; an app with no entry is an
// error, so no page is published without a version.
//
// Usage: node scripts/build.js        (writes dist/<name>.html)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Turn an ES module into code usable in a classic script. */
export function toClassicScript(source, label = 'source') {
  if (/^\s*import[\s{*]/m.test(source.replace(/^\s*import .* from ['"][^'"]+['"];?\s*$/gm, ''))) {
    throw new Error(`${label}: only single-line imports can be inlined`);
  }
  return source
    .replace(/^\s*import .* from ['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export (async function|function|const|let|class)\b/gm, '$1')
    .replace(/<\/script/gi, '<\\/script');
}

/**
 * Parse version.txt: one app per line, the page name (`editorial.html`)
 * and its version, separated by whitespace.  Blank lines are ignored.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseVersions(text) {
  const versions = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, version, ...extra] = line.trim().split(/\s+/);
    if (!version || extra.length) throw new Error(`version.txt: expected "<name>.html <version>", got "${line.trim()}"`);
    versions.set(name, version);
  }
  return versions;
}

/** Assemble one app's HTML.  `version` replaces @@VERSION@@ when given. */
export function buildApp(template, readSource, version) {
  const html = template
    .replace(/^[ \t]*<!-- @inline-style (\S+) -->[ \t]*$/gm, (_, path) =>
      `<style>\n${readSource(path).replace(/<\/style/gi, '<\\/style')}</style>`)
    .replace(/^[ \t]*<!-- @inline (\S+) -->[ \t]*$/gm, (_, path) =>
      `<script>\n${toClassicScript(readSource(path), path)}\n</script>`);
  return version === undefined ? html : html.replaceAll('@@VERSION@@', version);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const appsDir = join(root, 'src', 'apps');
  const outDir = join(root, 'dist');
  const versions = parseVersions(readFileSync(join(root, 'version.txt'), 'utf8'));
  mkdirSync(outDir, { recursive: true });
  let failed = false;
  for (const name of readdirSync(appsDir)) {
    const page = join(appsDir, name, 'index.html');
    if (!existsSync(page)) continue;
    const version = versions.get(`${name}.html`);
    if (version === undefined) {
      console.error(`no version for ${name}.html in version.txt; not built`);
      failed = true;
      continue;
    }
    const html = buildApp(readFileSync(page, 'utf8'), p => readFileSync(join(root, p), 'utf8'), version);
    const out = join(outDir, `${name}.html`);
    writeFileSync(out, html);
    console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB, version ${version})`);
  }
  if (failed) process.exit(1);
}

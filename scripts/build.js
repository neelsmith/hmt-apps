// Build single-file apps.
//
// Each app lives in src/apps/<name>/index.html.  A line of the form
//     <!-- @inline path/relative/to/repo/root.js -->
// is replaced by an inline <script> holding that file.  The shared sources are
// ordinary ES modules (so Node can test them); to make them work as classic
// inline scripts, single-line `import ... from '...';` statements are removed
// and the `export` keyword is dropped.  The scripts share one global scope, so
// list files in dependency order and avoid duplicate top-level names.
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

/** Assemble one app's HTML. */
export function buildApp(template, readSource) {
  return template.replace(/^[ \t]*<!-- @inline (\S+) -->[ \t]*$/gm, (_, path) =>
    `<script>\n${toClassicScript(readSource(path), path)}\n</script>`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const appsDir = join(root, 'src', 'apps');
  const outDir = join(root, 'dist');
  mkdirSync(outDir, { recursive: true });
  for (const name of readdirSync(appsDir)) {
    const page = join(appsDir, name, 'index.html');
    if (!existsSync(page)) continue;
    const html = buildApp(readFileSync(page, 'utf8'), p => readFileSync(join(root, p), 'utf8'));
    const out = join(outDir, `${name}.html`);
    writeFileSync(out, html);
    console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
  }
}

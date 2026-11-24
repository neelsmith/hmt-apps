import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { buildApp, toClassicScript, parseVersions } from '../scripts/build.js';

test('buildApp inlines scripts and styles, stripping import/export from scripts', () => {
  const files = {
    'a.js': "import { x } from './b.js';\nexport function f() { return 1; }\nexport const K = 2;\n",
    'b.css': 'body { color: red; }\n',
  };
  const out = buildApp('<head>\n<!-- @inline-style b.css -->\n</head>\n<!-- @inline a.js -->\n', p => files[p]);
  assert.match(out, /<style>\nbody \{ color: red; \}\n<\/style>/);
  assert.match(out, /<script>\n[\s\S]*function f\(\)/);
  assert.doesNotMatch(out, /import|export /);
  assert.match(out, /const K = 2;/);
});

test('toClassicScript refuses multi-line imports and escapes </script>', () => {
  assert.throws(() => toClassicScript("import {\n a,\n b } from './x.js';\n"), /single-line/);
  assert.match(toClassicScript("const s = '</script>';"), /<\\\/script>/);
});

test('parseVersions reads "<name>.html <version>" lines (any spacing, no final newline)', () => {
  const v = parseVersions('va-facsimile.html   0.1.1\r\n\niliad-scholia.html\t0.2.0\neditorial.html  0.1.0');
  assert.deepEqual([...v], [['va-facsimile.html', '0.1.1'], ['iliad-scholia.html', '0.2.0'], ['editorial.html', '0.1.0']]);
  assert.throws(() => parseVersions('editorial.html'), /expected/);
  assert.throws(() => parseVersions('editorial.html 0.1.0 extra'), /expected/);
});

test('parseVersions ignores blank lines and // comment lines, including indented ones', () => {
  const v = parseVersions('// facsimiles\nva-facsimile.html   0.3.0\n\n  // text browsing\niliad-scholia.html  0.2.0\r\n\t\n// last\n');
  assert.deepEqual([...v], [['va-facsimile.html', '0.3.0'], ['iliad-scholia.html', '0.2.0']]);
  assert.throws(() => parseVersions('editorial.html // note'), /expected/);
});

test('buildApp puts the version into every @@VERSION@@ and leaves none behind', () => {
  const t = '<meta name="app-version" content="@@VERSION@@">\n<p>Version @@VERSION@@</p>\n';
  assert.equal(buildApp(t, () => '', '1.2.3'), '<meta name="app-version" content="1.2.3">\n<p>Version 1.2.3</p>\n');
});

test('every app in src/apps has a version in version.txt', () => {
  const versions = parseVersions(readFileSync(new URL('../version.txt', import.meta.url), 'utf8'));
  const apps = readdirSync(new URL('../src/apps/', import.meta.url))
    .filter(n => existsSync(new URL(`../src/apps/${n}/index.html`, import.meta.url)));
  assert.ok(apps.length >= 3);
  for (const a of apps) assert.ok(versions.get(`${a}.html`), `${a}.html has no version in version.txt`);
});

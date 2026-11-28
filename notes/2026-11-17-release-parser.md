# Session summary: 2026-11-17 — shared HMT release parser

## Decisions (from Neel)
- Plain JavaScript (ES modules, JSDoc types, no dependencies); easy maintenance is the priority.
- Consistency problems are **warnings only** — parsing and validation never throw.
- Always write a session summary to `notes/`.

## What was built
- `src/hmt-release.js` — the shared parser. Single file, no imports, so it runs in Node and in a browser and can later be inlined into single-file apps by stripping the leading `export` keywords.
  - `splitBlocks(text)` — splits into labelled blocks; drops `//` comments and blank lines; handles CRLF.
  - `HmtRelease` (via `parseRelease(text)`, `fetchRelease(url?)`, `readReleaseFile(file)`):
    - `getBlock(type)` — composite of all blocks of a type (repeated header lines dropped for citecollections, citeproperties, datamodels, ctscatalog; plain concatenation for the rest).
    - Typed accessors: `cexVersion`, `library`, `collections()`, `properties()`, `dataModels()`, `ctsCatalog()`, `ctsData()`, `citeData()` (one table per block, with its own header), `relationSets()` (one per block).
    - `validate()` — returns a list of warnings (parse irregularities plus the CLAUDE.md consistency checks).
  - URN helpers: `isCollectionUrn`, `collectionOfObject`, `collectionOfProperty`, `propertyUrn`, `ctsWorkOf`, `ctsVersionOf`.
- `test/hmt-release.test.js` — 12 tests (`npm test`): small inline fixtures plus the real release when `scratch/hmt-current.cex` exists (skipped otherwise).
- `package.json` — `"type": "module"`, `npm test` script only.

## Facts about the 2024c release (24 MB, ~193k lines)
- 107 blocks. Only `cexversion` and `citelibrary` occur once. `ctsdata` ≈ 81k passages; `citerelationset` ≈ 100k rows. Parse + validate ≈ 150 ms in Node.
- `citedata` has 8 distinct header shapes → always parse per block, by its own header.
- A relation set's `urn` (e.g. `urn:cite2:hmt:hmtdse.v1:all`) is what appears in `datamodels` `Collection`; so `datamodels` may point to either a collection or a relation set.
- `ctsdata` passages are mostly exemplar-level (`…msA.diplomatic:`, `…normalized:`); the catalog lists version level. The check accepts either.

## Warnings the real release produces (17; data quirks, not parser bugs)
- Some later `citeproperties` blocks start with `URN|Label|Type|Authority list` rather than `Property|…`.
- `datamodels`: 11 rows have 3 values (no description).
- Geneva images `citedata` (line ~114141): all 802 rows end with a trailing `|`.
- `astro.v1` and `citedworks.v1` give their labelling property as `…:Label` (not a property URN).
- Geneva namespace mismatch: collection `urn:cite2:citeecod:gen44imgs.2017a:` vs properties `urn:cite2:ecod:gen44.2017a.*`.
- First `citedata` (data models) uses collection `urn:cite2:hmt:datamodels.v1:`, but the documented collection is `urn:cite2:cite:datamodels.v1:`.
- Named-entity tables (astro, citedworks, pers, place) use capitalized column names (`Label`, `URN`) where properties are documented in lowercase.
- Relation set `urn:cite2:hmt:comparetti.v1:msA` has no `datamodels` entry.

## Not done yet / next steps
- Build step to inline `src/` into single-file HTML apps (works from `file://`; no bundler available offline in this environment, so a small hand-written inliner is the likely route).
- Each app needs a file-picker / drag-and-drop fallback, since `fetch` is blocked on `file://`.
- Lookup indexes (passage by URN, collection objects by URN) and lazy handling of the large `ctsdata` / relation-set data once the first app needs them.
- Decide whether to report these quirks upstream to the HMT archive.

---

# Session summary (continued): first app — Iliad scholia

## What was asked
Single-page app: menu of all Iliad versions in the release; user enters a passage reference or range (`1.1-1.10`, order as in the version's ordered text); scholia found through cite relations following the `commentary` data model; Iliad text shown with the number of scholia on each line.

## What was built
- `src/iliad-scholia.js` — app logic (pure functions, tested): `buildTextIndex`, `iliadVersions`, `splitReference`, `resolveRange`, `commentaryPairs`, `commentarySpans`, `annotateRange`, `scholionPassage`.
- `src/apps/iliad-scholia/index.html` + `app.js` — the UI (template + browser code).
- `scripts/build.js` (`npm run build`) — inlines the shared sources into each `src/apps/<name>/index.html`, writing `dist/<name>.html`. Inlining rules: sources are ES modules with **single-line imports only**; the build strips imports and the `export` keyword; all inlined scripts share one global scope, so avoid duplicate top-level names and list files in dependency order via `<!-- @inline path -->` lines.
- `test/iliad-scholia.test.js` — 9 tests (21 in total with the parser tests; `npm test`).
- Output: `dist/iliad-scholia.html` (~41 KB; works from `file://`). `dist/` is **not** git-ignored — Neil to decide whether to commit built apps.

## Behaviour and decisions
- Versions: every catalog entry of the Iliad (`tlg0012.tlg001.*`): 7 in 2024c. Only msA, msB, e3 have online text; the other four are listed but disabled ("no online text").
- Texts exist as exemplars (`normalized`, `diplomatic`; only 505 of 15,645 msA lines differ). Default is `normalized`; a radio switch appears when a version has more than one. The scholia shown use the same kind.
- "Ordered list" = order of passages in the release. Never sorted numerically: refs include `1.title`, `6.386del`, `12.218b`, `18.604_605`.
- Commentary relations are found via `datamodels` (relation sets whose model is `urn:cite2:cite:datamodels.v1:commentarymodel`), not by hard-coding `commentary.v1:all`. Columns `scholion|iliad`.
- A line's count = distinct scholia whose commented passage or range contains that line. Clicking the badge shows each scholion's lemma and comment.
- Reference input: `1.5`, `1.1-1.10`, `1.1-10` (end line only), whole books `1` and `1-3`. Errors are shown in the page (including which books a text covers: msB has only book 9, e3 only books 8–10).
- Relation targets in the data use shorthand and junk forms; handled: `14.205-207`, `14.75-6` (= 14.76), `@subreferences`, trailing dots. Unresolvable ones (e.g. `13.UNKNOWN`, `9.523XXXX`, `21.23?`) are counted and reported in the page, not guessed at (msA: 61 of 10,253).
- Loading: tries the GitHub raw URL (CORS allows this even from `file://`); if that fails, falls back to a file picker / drag-and-drop for a saved `hmt-current.cex`.

## Verification
- Counts for msA 1.1–1.10 checked against an independent script: `[7, 2, 3, 2, 4, 3, 1, 2, 1, 1]`, 24 distinct scholia. Book 1 = 611 passages, 992 scholia.
- Browser test (Playwright/Chromium, from `file://`): fetch path, file-picker fallback, errors, shorthand, version/exemplar switching, no console errors; dark mode and 390 px width checked, no horizontal overflow.

## Open items / ideas
- Rendering is capped at 2,000 passages per query (a whole book is ~600).
- Scholia for versions other than msA/msB/e3 would show only if they gain online text; Iliad passages in `e4`, `u4`, `gen4`, `laur32_3` are indexed in other relation sets but not in `commentary`.
- Possible next steps: link scholia to their manuscript pages/images via the `hmtdse` relation set; copy/export of results; share `file://` fallback UI as a reusable component for future apps.

---

# Session summary (continued): second app — Venetus A facsimile (`dist/va-facsimile.html`)

## What was asked
Light-table view of the pages of the Venetus A from the IIIF manifest
(`.../hmt-archive/.../iiif/venetusA.json`); selecting an image opens a pannable/zoomable view; draw a rectangle for every `hmtdse.v1:all` item (`passage|imageroi|surface`) belonging to the image, keeping rectangles registered with the image as the display changes; hovering a rectangle shows the passage text.

## What was built
Shared modules (all inlined by `scripts/build.js`; no dependencies):
- `src/text-index.js` — **new shared module**: `buildTextIndex`, `textsOfVersion`, `passageText(textIndex, urn, kind)` (diplomatic/normalized; scholia come back as lemma + comment parts). Moved out of `iliad-scholia.js`, which now imports it (and `scholionPassage` is built on `passageText`).
- `src/iiif.js` — IIIF Presentation 3 manifest parsing (`parseManifest`), image URN from the service path (`hmt/vaimg/2017a/VA012RN_0013.tif` → `urn:cite2:hmt:vaimg.2017a:VA012RN_0013`), IIIF Image URLs, http→https when the page is https.
- `src/dse.js` — `indexDse(release)` (regions grouped by image URN), `parseRoi` / `parseImageRoi`, `passageKind` (iliad / scholia / other), `passageLabel`.
- `src/pan-zoom.js` — pure geometry for the view transform, zoom-at-point, clamping, tile level and visible tiles, ROI → image pixels.
- `src/image-viewer.js` — `IiifViewer`: canvas drawn from IIIF tile requests (region + size), with an SVG overlay group in **image pixel coordinates**; the same transform drives canvas and overlay, which is what keeps rectangles registered. Drag, wheel, pinch, double-click, keys (+ − 0, arrows).
- App: `src/apps/va-facsimile/index.html` + `app.js`.

## Behaviour
- Light table: all canvases as lazy-loaded thumbnails (240 px wide), find box (`12r`, `12`, `cover`…), "only pages with indexed text", size slider, a count badge per page. Opens at `#page=<canvas id>` (shareable; browser Back returns to the table).
- Viewer: Iliad regions red, scholia blue, other (Greek Anthology) green; layer checkboxes; hover shows every passage under the pointer (up to 4) with label and text; diplomatic (default) / normalized switch; prev/next (`[` `]`), Esc back, Fit.
- Tap shows the tooltip on touch devices.
- Loads manifest and release independently; either failing shows a message and a drop zone/file picker (accepts `venetusA.json` and `hmt-current.cex`).

## Data facts (2024c)
- Manifest: ~660 canvases, all 5428×7230; back matter files named `VAMSFlyleaf_…`, `VAMSInside_back_cover_…` (no index regions).
- DSE set: 26,666 rows; 24,318 on 631 Venetus A pages (the rest are Escorial `e3bifolio` images, ignored). Passage kinds on VA: Iliad ≈15.6k, scholia ≈8.7k (six zones), anthology 31.
- Another relation set (`pagerois.v1:msA`) also uses `vaimg…@` URNs (one whole-page region each): not drawn.
- Skipped row: `tlg5026.msA.hmt:7.4` has no region (just a page URN).
- Region quirks: whitespace inside values (`0.6663 ,0.2089`) is tolerated; `msAim.hmt:14.D6` overshoots the image edge by 0.4% (x+w = 1.004) → clipped (up to 2% accepted).
- 93 indexed passages have no text in `ctsdata` (e.g. scholia of types `msAmeta`, `msAimLater`); the tooltip says "Text not available in this release."

## Verification
- 37 Node tests (`npm test`), incl. real-release checks (631 images, 48 regions on `VA012RN_0013`, 1 skipped row).
- Browser tests (Playwright/Chromium) against a **stubbed IIIF server** that serves generated images with a grid and cyan markers drawn at the corners of a real region (1.1 on `VA012RN_0013`). The overlay rectangle's corners matched the markers within 0.8 px at fit, after wheel zoom, after drag-pan, at maximum zoom, after pressing `0` and after a window resize. Badge counts matched independent counts from the release text. 38 checks pass, no console errors; 660-page manifest: grid built in ~1.2 s, filters < 70 ms.
- **Not verified:** the real image server (`www.homermultitext.org/iipsrv`) was unreachable from this environment. The viewer requests standard IIIF Image API 2 region requests `…tif/x,y,w,h/256,/0/default.jpg` (size `w,`, as the manifest's own `full/2000,` URLs do). If the server rejects them, the 1000 px base image still shows and the overlay is unaffected; tile failures retry after 10 s.
- **Not verified:** when the app is served from https, http image services are rewritten to https; this assumes `https://www.homermultitext.org/iipsrv` works.

## Open items / ideas
- Check on a real machine: tile loading from the live server; the https assumption.
- No libraries are used for the viewer; if deep-zoom needs outgrow it (rotation, smoother tile blending), OpenSeadragon could be inlined instead.
- Possible next steps: list of passages on the current page (keyboard accessible); jump to the page for a given Iliad line (via the same DSE index); show hover text from `hmt-current.cex` for e3/msB images too.

---

# Session summary (2026-11-18): third app — editorial view (`dist/editorial.html`)

## What was asked
Same as `iliad-scholia.html`, except no choice of diplomatic vs normalized: one interwoven display, diplomatic text as the base, with the normalized reading added in parentheses, visually less strong, wherever it differs.

## What was built
- `src/interweave.js` — `weave(base, alt)`: word-by-word comparison (common prefix/suffix trimmed, then longest-common-subsequence) returning segments `{text}` (same) or `{base, alt}` (differ; either side may be empty). Identical texts are returned verbatim. Very different long texts (word-count product > 2.5M) become one block rather than risk a slow comparison. Helpers `baseOf`, `altOf`, `hasDifference`.
- `src/apps/editorial/index.html` — the page (no text choice; legend explaining the notation). `<body data-text="interwoven">` switches the shared app code into interwoven mode.
- **Shared code, not a copy:** `src/apps/iliad-scholia/app.js` serves both apps (the `WOVEN` flag); the CSS moved to `src/apps/iliad-scholia/style.css`, shared via a new build marker `<!-- @inline-style path -->` (`scripts/build.js`). The Iliad scholia app's built output was byte-identical after the CSS move, and its browser regression gives the same results as before.
- `test/interweave.test.js`, `test/build.test.js`.

## Behaviour
- Base text: diplomatic. Where normalized differs: `χοώμενος (χωόμενος)`. A word only the normalized text has: `(οϋ)`. A diplomatic word the normalized text leaves out: `χοώμενος (∅)`-style marker `(∅)` after the omitted word, with a hover title ("omitted in the normalized text" / "added in the normalized text" / "normalized text"). **Styling (revised 2026-11-18):** the parenthesised text is the same size as the base text, in a contrasting blue (`--alt` in `src/apps/editorial/index.html`: `#1a5bb8` on light, `#7fb2ff` on dark; 6.2:1 and 8.2:1 against the page background). The parentheses remain a second, non-colour cue. The diplomatic word that has a normalized counterpart (`.dip`) gets a faint tint of the same blue (13% light / 24% dark) and a thin inset underline, so each pair reads together; text on the tint keeps 12:1 / 14.8:1 contrast. (First version used smaller muted grey text; judged too weak.)
- Scholia (lemma + comment) are interwoven the same way, since they also exist in both editions.
- Versions with only one edition show plain text. When texts differ only in spacing nothing is marked. When a line differs, spacing is normalized to single spaces.
- Counts, ranges, errors, loading fallbacks: unchanged from the Iliad scholia app.

## Facts (2024c, Venetus A)
- 505 Iliad lines and 1,687 scholia parts differ between the editions; Iliad lines have 20 additions and 7 omissions (e.g. 2.56 `ξιφος` omitted), book 1 has 16 differing lines. 80 scholia parts have omissions (e.g. msA 1.423, comment on 1.137).
- The release stores Greek in decomposed Unicode (not NFC); the apps show it exactly as stored. (Tests that compare typed Greek must normalize.)

## Verification
- 47 Node tests pass, incl. a check over every diplomatic/normalized pair in the release (25k+) that weaving loses nothing.
- Browser (Playwright): all 611 lines of book 1 checked against the raw data — text outside the parentheses equals the diplomatic text on every line, and parentheses appear on exactly the 16 lines where the editions differ; 44 scholia in 1.1–1.20 checked the same way; substitution (1.44), addition (1.124), omission (2.56) and a scholion omission checked; Escorial works; no horizontal overflow on a phone; no console errors.

## Open ideas
- Option to hide the parentheses (read-only diplomatic) — would reintroduce a control, so not added.

## Home link and version display (all three apps)

- Request: every app links to https://neelsmith.github.io/hmt-apps/ and shows an app-specific version.
- The user said `versions.txt`; that file does not exist. The existing `version.txt` (user-owned, read-only) holds the per-app versions and was used.
- `scripts/build.js` now parses `version.txt` (`parseVersions`), substitutes `@@VERSION@@` per app (`buildApp`), and fails the build if an app has no entry. The build log prints the version.
- Each app template has `<meta name="app-version">` and an `.appmeta` bar with "← HMT apps home" and "Version X".
  - iliad-scholia and editorial: bar above the h1, styled in the shared `style.css`.
  - va-facsimile: bar in the header, right-aligned, with its own CSS.
- Fixed a 360 px horizontal overflow in va-facsimile's error-state drop zone (`#drop input[type=file] { max-width: 100%; }`).
- Built versions: va-facsimile 0.1.1, iliad-scholia 0.1.1, editorial 0.1.0.
- Verification: 50 unit tests pass. Playwright header/version checks (33) pass at desktop and phone width, and the three UI regression suites pass with no page errors.
- Nothing committed.

## `?urn=` parameter for iliad-scholia (2026-11-19)

- `iliad-scholia.html?urn=<CTS URN>` opens at a version and passage, e.g. `?urn=urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10`.
  - Version-level URN selects the version; a range/line/book after the colon is filled in and shown immediately.
  - An exemplar part (`…msA.normalized:`, `…msA.diplomatic:`) also selects that text. An unavailable text falls back to the default with a note.
  - Version only (`…msA:`) selects the version and shows nothing.
  - Bad input (not a CTS URN, work without version, unknown version, version with no online text, passage not in the text) shows a message in the page's error line; the app stays usable.
  - Percent-encoded URNs work.
- Logic: `parseUrnParam(versions, param)` in `src/iliad-scholia.js` (pure, unit-tested). UI: `applyUrnParam()` in `src/apps/iliad-scholia/app.js`, run after every successful release load (including a file loaded after the fetch failed).
- The editorial page shares this code, so it honours `?urn=` too (text kind ignored; it always weaves both).
- Bug caught by the browser test: text radio values are URNs ending in `:`, so the exemplar match initially never selected diplomatic.
- Not done: the address bar is not updated as the user changes version/passage (could add `history.replaceState` for shareable links).
- Tests: 52 unit tests; `ui-test-urn.js` (scratchpad) covers 12 cases against the real release; earlier UI suites unchanged and passing. Nothing committed.

## images.html: image collections, light box, viewer (2026-11-19)

- New app `images.html` (`src/apps/images/`, logic in `src/images.js`, tests in `test/images.test.js`).
- Menu: every collection that `datamodels` documents as following `urn:cite2:cite:datamodels.v1:imagemodel` (11 in release 2024c, 5,083 images), sorted by label, with counts. Empty collections (`e3img.2017a` has none) are listed but disabled.
- Light box: thumbnails in pages (12/24/48/96 per page, default 24), pager at top and bottom (first/prev/number/next/last). Cell label is the page part of the caption (`folio 82, recto`, `bifolio containing 1v and 2r`, `page 7`), else the image id; the full caption is the tooltip.
- Viewer: the shared tiled `IiifViewer` (drag, wheel/pinch, double-click, + - 0, arrows). Prev/next across page boundaries (`[` `]`), Esc/← Images back to the page the image is on, a Rights toggle showing the release's rights statement.
- Location hash: `#urn=<collection URN>[&page=N]` for a page, `#urn=<image URN>` for an image. Browser Back/Forward work; paging replaces history entries, opening an image adds one.
- **Where the pictures come from (unverified).** The release gives image URNs, captions and rights only, no locations or sizes. Locations follow the HMT convention seen in the Venetus A manifest: `urn:cite2:hmt:vaimg.2017a:ID` is `http://www.homermultitext.org/iipsrv?IIIF=/project/homer/pyramidal/deepzoom/hmt/vaimg/2017a/ID.tif`. That layout is confirmed only for the `hmt` namespace (`vaimg`). The `citebl`, `citelaur` and `citeecod` collections assume the same layout (`<namespace>/<collection>/<version>/<id>.tif`) and could not be checked, because the sandbox cannot reach homermultitext.org. Image sizes come from each image's `info.json`. If a server does not answer, thumbnails show "no image", the page says none loaded, and the viewer shows the error. The base URL is the single constant `IMAGE_SERVICE_BASE` in `src/images.js`.
- Bugs caught while testing: a late thumbnail failure from a previous page could show the "none loaded" note on the next one (render token); the page re-rendered a tick after the hash changed (now `go()` renders at once and the hashchange handler skips its own change); on a phone the collection menu ran off the edge and the grid was a single huge column.
- `version.txt` (user-owned) has no entry for `images.html`, so `npm run build` skips it with an error until a line like `images.html  0.1.0` is added. `dist/images.html` was built as 0.1.0 meanwhile.
- Tests: 7 new unit tests (59 in all) including one against the real release; a Playwright script with a stubbed image server (menu, paging, viewer, deep links, bad input, failing server, file fallback, 360 px dark) passes 53 checks. Not run against the real image server. Nothing committed.

## Image datasets: CEX tables and IIIF manifests per collection (2026-11-19)

- `node scripts/make-image-datasets.js` writes, for each non-empty image collection of the release, into `scratch/images/` (default; `scratch/` is git-ignored):
  - `<collection>.cex`: header `image|urn|label`, then one line per image. `image` is the IIIF service id, the manifest's `body.service[0].id` (`<service>.tif`; the first version wrongly wrote the 2000 px picture URL, fixed the same day); `urn` is the image URN; `label` is the release's caption with whitespace tidied and the final period dropped (the image id when there is no caption).
  - `<collection>.json`: IIIF Presentation 3 manifest in the shape of `venetusA.json` (`ImageService2` level 1, painting annotation per canvas), plus the collection label, license (`requiredStatement`), and per canvas the image URN and rights in `metadata`. Manifest ids default to `https://neelsmith.github.io/hmt-apps/images/<collection>.json` (`--base-url`).
- File names are `<collection>.<version>` (`vaimg.2017a`, `burney86imgs.v1`, ...). The empty collection `e3img.2017a` is skipped.
- **The CEX files are written (10 files, 5,083 images). The manifests are not**: a canvas needs the image's pixel size, which only the image server's `info.json` gives, and neither the sandbox nor the shell on the Mac could reach homermultitext.org. Image sizes are not guessed. Run the script without `--cex-only` on a machine that can reach the server; sizes are cached in `scratch/images/sizes.json`, so reruns resume, and images the server cannot answer for are left out of that manifest and reported (exit code 1).
- Safety valves: a collection is given up after its first 10 requests fail with no success (reports whether the server is unreachable or the images are not where expected); an unreachable server stops the whole run.
- The location convention is confirmed only for `hmt/vaimg` (the manifest's first two ids exist in the release and map to the manifest's service URLs). `citebl`, `citelaur` and `citeecod` collections assume the same layout; a run that finds 404 for them says so (`--service-base` overrides the server base, but not the per-collection path).
- All 5,083 image ids are URL-safe (letters, digits, `_`, `.`, `-`).
- Logic in `src/image-datasets.js`; tests in `test/image-datasets.test.js` (builders, plus the script run against a local stand-in image server: cex-only, manifests, cache, a 404, give-up, unreachable). Nothing committed.

## all-scholia.html: scholia on the same passage in any version (2026-11-19)

- New app `all-scholia.html` (`src/apps/all-scholia/index.html`). It is `iliad-scholia` with one difference: a line counts, and lists, the scholia indexed to the same passage in **any** version of the Iliad, not only in the version being read. It shares `src/apps/iliad-scholia/app.js` and `style.css` with the other two pages and is switched by `<body data-scholia="all">` (as the editorial page is by `data-text="interwoven"`). Same version menu, text choice, passage syntax, `?urn=` parameter, and scholion panel; the summary adds "in any version of the Iliad" and the unresolved-relations note says "in all versions".
- Logic: `commentarySpansAllVersions(pairs, versions, textIndex, shown)` in `src/iliad-scholia.js`. Each relation is resolved in the text of the version it names (a range follows that text's order, and may run through passages the shown text lacks), and the passages found are matched to the shown text by their references. A scholion on a passage the shown text lacks adds nothing and is not "unresolved"; relations that cannot be resolved in their own version, or name a version with no text, are counted (73 of 11,204 in release 2024c).
- What the data looks like: every one of the 11,204 commentary relations links a scholion to a passage in its own manuscript (msA 10,253, e3 617, msB 334), so each scholion appears once and "all versions" means adding the msB and e3 scholia to the lines they comment on. Those cover books 8-10 only: Venetus A 9.1 goes from 2 scholia to 6 (two from msB, two from e3); 658 lines gain scholia; Venetus A as a whole goes from 10,192 to 11,131 scholia (= 11,204 - 73). **Venetus A 1.1 does not change** (7 scholia): nothing in msB or e3 comments on book 1. Use 9.1 or books 8-10 to see the difference.
- Result does not depend on which version is read: Venetus B, Escorial and Venetus A all give 6 scholia for 9.1, and a text always shows at least what `iliad-scholia` shows for it.
- Shared `app.js` changed (the flag, `relations` count), so `dist/iliad-scholia.html` and `dist/editorial.html` were rebuilt; their behaviour is unchanged (all earlier UI suites pass).
- Tests: `test/all-scholia.test.js` (fixture with four versions: cross-version mapping, range through a passage the shown text lacks, reordered versions, unresolved/other-work cases, never fewer scholia than same-version; real release: 9.1 gives 6 = 2 + 2 msB + 2 e3). With the function deliberately broken (only same-version relations) 5 of its 6 tests fail. Browser script (stub-free, real release): 28 checks incl. comparison with `iliad-scholia`, panel contents, `?urn=`, 360 px dark. Full unit suite 72 tests; the one failure is the known missing `images.html` entry in `version.txt`.
- Not done: the scholion panel does not say which version a scholion was indexed to (its siglum, e.g. `msB 9.msB_114v_1`, already identifies the source). Nothing committed.

### all-scholia: breakdown by version (2026-11-19, later)
- Under each line that has scholia, `all-scholia.html` now shows how many come from each version of the Iliad (`Venetus A 2   Venetus B 2   Escorial, Upsilon 1.1 2`, in the order of the version menu; tooltip gives the full version name and count). When more than one version contributes, the opened scholia panel is grouped under headings (`Venetus B, 2`). With a single contributing version (e.g. Venetus A 1.1) there is one chip and no headings. The `N scholia` badge is unchanged.
- "Version" here is the version the scholion is indexed to (the relation's target), not the manuscript the scholion text comes from (siglum such as `msAil`, `msB`), which the scholion label still shows.
- Logic: spans now carry `version`; `annotateRange` lines gain `byVersion` (version URN to scholia); new `shortVersionLabel`. `iliad-scholia` and `editorial` are unchanged in what they show (they do not render the breakdown); their dist files were rebuilt because the shared script and CSS changed.
- Tests: byVersion groups on the fixture and on the real release (9.1: msA 2, msB 2, e3 2), `shortVersionLabel`; browser checks for chips, tooltips, panel headings, 1.1 (single version), no breakdown on a line without scholia, phone width. 73 unit tests pass except the known `images.html` version entry. Nothing committed.

## dse-check.html (2026-11-19)

Checks the relational integrity of the DSE records (`urn:cite2:hmt:hmtdse.v1:all`, `passage|imageroi|surface`) of a release, in three groups:

1. **Text passage missing from DSE** — passages of the editions that no record names. (The request said "message"; read as "missing".)
2. **DSE record for text passage not in textual editions** — including records for versions the release has no text of (`msAmeta`, `msAimLater`) and passages that are not CTS URNs.
3. **Reference to image not in catalog** — image (before `@`) is not an item of any collection with the image data model. Reasons: no such item in an image collection; not an image collection; no image.

Design: `src/dse-check.js` (`checkDse`, `reportCsv`), `src/apps/dse-check/`. Passages are compared per version: any exemplar (diplomatic/normalized) counts; scholion `.lemma`/`.comment` are one passage; `@subref` ignored. Surfaces are NOT checked (could be added). Warnings only. CSV download of the whole report.

Findings on the current release: 26,666 records; 2,747 passages missing from DSE (Venetus A Iliad 43; all 710 Venetus B Iliad and 324 Venetus B scholia have no records at all); 120 records for passages not in the text; 70 records with images not in the catalog (69 for `e3bifolio.v1:E3_120v_121r`, 1 for `msA.v1:91r` used as an image).

Tests: `test/dse-check.test.js` (fixture + real release). Needs `dse-check.html  0.1.0` in version.txt (user-owned; not edited).

Update: records in group 2 have a "show image" button that shows the image (IIIF, 1000 px wide) with the RoI outlined in place; "open full image" link; error note if the image server cannot be reached. Uses src/iiif.js (inlined) and imageService from src/images.js. Verified in browser with a stub image server only; real server not reachable from the sandbox.

## codices.html (2026-11-19)

Choose a codex (collections with the `urn:cite2:hmt:datamodels.v1:codexmodel` data model: 7, 4,254 pages), then a page; the page image is shown in the shared IIIF viewer with a rectangle over each DSE-indexed passage; hovering shows the diplomatic text (same tooltip as va-facsimile). Deep link: `#urn=<page URN>`.

- Image: the one named by the page's DSE records (most frequent among catalog images), because it can differ from the catalog's page image (e.g. msA 83r: VA083RN_0255 vs VA083RN_0084; e3 pages use `E3_97bisv_98r` style bifolio images). Pages with no usable records show the catalog's image without rectangles.
- Only Venetus A (630 pages) and Escorial Y 1.1 (71 pages) have DSE records; the other five codices show images only. The menus say so.
- Records whose image is not an image of the catalog (e.g. msA.v1:91r used as an image) are not drawn; a count of regions on another image is noted.
- Files: `src/codices.js` (`codices`, `indexRegionsBySurface`, `pageView`), `src/apps/codices/`, `test/codices.test.js`. Needs `codices.html  0.1.0` in version.txt.
- Image URLs for non-`hmt` namespaces (citebl, citelaur) are the unverified server layout; tested with a stub server only.

Update: pages with indexed text are marked "● " in the page menu, followed by the number of drawn passages; others get blank padding. Counts are of regions that are drawn (on a catalog image): Escorial Y 1.1 has 69 such pages (71 pages have DSE records, 2 only on non-catalog images).

Update: clicking a rectangle copies the full diplomatic text of the topmost passage under the pointer (scholion: lemma and comment joined by a space) to the clipboard, with a short confirmation; falls back to a hidden textarea + execCommand where navigator.clipboard is missing. A drag does not copy. A tap on touch shows the text and copies.

## propernames.html (2026-11-19)

Choose a kind of name (personal / geographic / ethnic), a name from a menu (with a find box), then one of the passages it occurs in; the Iliad and scholia text of that passage's page is shown with all indexed names marked (pastel background per kind; selected name outlined and bold). Scholia that contain the selected name are unfolded, the rest folded (button to unfold all). Deep link `#k=<kind>&i=<id>[&p=<passage>]`. Diplomatic/normalized toggle.

Data, and what had to be worked around:
- Indexes: `urn:cite2:hmt:{persname,placename,ethnicgroup}index.v1:all`, columns `passage|person`, `passage|place`, `passage|ethnic`. Ethnic names are items of the place collection (e.g. Achaea, place96). 21,531 rows.
- Entity URNs in the indexes are inconsistent (`pers.v1`, `pers`, `persName`, `place.r1`, typos `htm`, `html`, `per2`); names are matched by object id (`pers142`, `place67`). 108 rows name ids that do not exist (e.g. `persMISSING`, `pesr108`, `pers903,Danae`) and are skipped; the status line says how many. Citedata headers are capitalized (`Label`, `Redirect`).
- Index passages for scholia carry `.lemma`/`.comment`; DSE records do not. Both reduce to version + reference (`passageKey`).
- Pages: from DSE records (passage -> surface). Passages without one (e.g. msA main scholion 1.1; all of Venetus B) show the passage alone with a note.
- The release has no markup saying which word is a name. Names are capitalized in the editions, so capitalized words are the candidates; which word is which name is learned from the release (single-name/single-capital passages first, then by elimination), and only attributed to names indexed to that passage. On the current release every indexed name is located in 10,000 of 11,573 passages; where the identity is unclear but the kind is, the word is marked as that kind with a darker underline and no selected-name highlight (dashed outline if the selected name is in that passage); with mixed kinds left over nothing is marked. A capital on the first word of a passage is not counted unless the lexicon says it is a name.
- Files: `src/propernames.js`, `src/apps/propernames/`, `test/propernames.test.js`. Needs `propernames.html  0.1.0` in version.txt.

Update (propernames): the scholia of a page are interleaved with the Iliad line they comment on, as in iliad-scholia.html: a badge "N scholia" on the line opens a panel under it; a scholion indexed to a range (e.g. 1.13-1.16) stands once, under the first of those lines that is on the page, with "on 1.13–1.16" in its summary. The panel is open when it holds a scholion with the selected name or the chosen passage; inside, scholia without the name stay folded. Scholia that comment on no line of the page (other pages, or no Iliad on the page) are listed after the lines with their targets (e.g. "on Iliad 1.13-1.16"). Uses commentaryPairs/commentarySpansAllVersions (iliad-scholia.js, now inlined) so a relation to any version of the Iliad counts; spans are computed once per Iliad version. New: attachScholia in src/propernames.js.

## String search app and shared page view

- `stringsearch.html` (0.1.0): enter a Greek string without diacritics, optionally limit to Iliad or scholia, list matching passages (grouped by text, paged 60 at a time, with a snippet), pick one to see the whole page with the Iliad lines interleaved with their scholia. Matches are marked; scholia holding a match are unfolded, the rest folded.
- Folding (`src/stringsearch.js`): accents, breathings, capitals and punctuation are ignored; ς/ϲ = σ; minimum two letters; matches may span words inside one text part, but not from a scholion's lemma into its comment. Diplomatic or normalized text can be searched. Hash form: `#q=..&s=..&t=..[&p=..]`.
- Release 2024c: "αχιλλευς" matches 305 passages (189 Iliad, 111 scholia, the rest other texts).
- Refactor: the page display shared by propernames and stringsearch now lives in `src/page-view.js` and `src/page-view.css`; propernames was moved onto it (tests unchanged and passing).
- Tests: `test/stringsearch.test.js` (9, includes an independent count against the real release); full suite 109 pass.

### String search: results grouped by word token

- Results are now blocks per matching word token, sorted alphabetically ignoring accents and breathings (`groupByToken` in `src/stringsearch.js`). A match is widened to whole words; a match spanning words gives a phrase token. Tokens are unique after folding (case, accents), and the block title is the commonest written form, lower-cased. A passage with several different tokens appears under each. Rows show the text and page as well as the reference. "μηνι" gives 32 blocks, including μῆνις and μῆνιν.

## String counter app

- `stringcounter.html` (0.1.0): same alphabetic search as stringsearch (scope Iliad/scholia/all, diplomatic/normalized, accents/case ignored, two-letter minimum), but results are an SVG bar chart: word tokens (alphabetical, accents ignored, labelled with the commonest written form) on X, occurrences on Y. Clicking a bar (or Enter on a focused bar, or a button in the collapsible table) lists that token's passages; clicking a passage shows the page as in stringsearch.
- Counts are occurrences of the token across all texts in scope (the Iliad is held in several manuscripts, so those add up); the table also gives the number of passages. "Download CSV" writes `token,form,occurrences,passages` (RFC 4180, CRLF, UTF-8 with BOM so spreadsheets read Greek correctly). File name is ASCII (Greek transliterated: μηνι gives `string-counts-meni.csv`), because headless Chromium dropped non-ASCII download names.
- Logic in `src/stringcounter.js` (`countTokens`, `toCsv`, `csvName`, `niceTicks`, hash with `&b=<token>`); tests in `test/stringcounter.test.js`. Reuses `stringsearch.js` and `page-view.js`.
- Release 2024c: "μηνι" occurs 91 times in 73 passages as 32 word forms (μῆνιν 18, the most).
- Pitfall: all inlined modules share one global scope; a top-level `field` in stringcounter.js clashed with another module and silently broke the page (renamed `csvField`).
- `version.txt` needs a line `stringcounter.html   0.1.0` (user-owned file, not edited on the device).

### String counter: sort order

- A "Sort: alphabetically / by count" control sets the order of the bars, the table and the CSV. Alphabetical is the default; by count is most frequent first, ties alphabetical (`sortCounts` in `src/stringcounter.js`). The order is in the hash as `&o=count` (omitted when alphabetical). The chosen bar stays selected when the order changes.

### String counter: frequency cutoff

- "Only words occurring at least [N] times" (default 1) limits the bars, table and CSV to word forms with at least N occurrences (`atLeast` in `src/stringcounter.js`). The about line still reports the full totals; the chart note says how many word forms pass. In the hash as `&m=N` (omitted at 1; junk or values below 1 read as 1). Changing the cutoff or the sort order keeps the chosen bar, its passage list and the page if that bar still passes; if it is cut, the list and page reset. If nothing passes, the chart note gives the highest count and the CSV button is disabled.

### String counter: choice of texts

- The Iliad/scholia/all radios are replaced by a "Texts" checklist (a drop-down panel): "All Iliad", "All scholia" and "All other texts" boxes (tri-state when only some of their texts are ticked), one box per text version under each, and Select all / Select none. All are ticked at first, which equals the old "all texts". The summary reads "Texts: all 12", "all Iliad", "all scholia", "n of m" or "none". Escape or a click elsewhere closes the panel.
- `searchInVersions`, `textChoices`, `versionOfKey` in `src/stringcounter.js`. Hash: `&v=<ns:work.version>,…` only when a subset is chosen; an older `s=iliad|scholia` link (no `v`) still selects that section.
- Only the counter app was changed; stringsearch.html still has the three-way scope.

### va-facsimile manifest address (2026-11-22)

- `venetusA.json` now 404s in hmt-archive; `VA_MANIFEST_URL` (src/iiif.js) is now `.../iiif/vaimg.2017a.json`, and the drop-zone text names that file. Not checked against the live file from here (no network); if its canvases differ in shape from the old manifest, the status line or grid will show it.

## Lemmatized search app

- `lemmatizedsearch.html` (0.1.0). Loads the HMT release, `lemmata-current.cex` (`token|passage|type|lemma|pos`) and `lemmata-releases.cex` (`release|date|archive|llm`) from shot.holycross.edu/hmt/lemmatization/, with a progress row for each (bytes read, tokens read). The lemmatization is read as a stream, line by line, into an index by lemma (`readLemmata` in `src/lemmata.js`); punctuation tokens are skipped, unreadable lines counted and reported. Cost on the real file: about 0.5 s and 65 MB of memory.
- Version check: the `archive` value of the `lemmata-current` row is compared with the release id (`2024c`) in the loaded release's library urn/name (`compareArchives`); shown as ✓ or ⚠ under the header. Differences are warnings only.
- Search: substring of the folded lemma (no accents, breathings, capitals; two letters minimum), as in stringsearch. Results are one folding block (`<details>`) per lemma, alphabetical ignoring accents, with token counts; opening a lemma lists its forms and its tokens (Iliad first, then scholia; 60 at a time), each with the passage, text, page, part-of-speech code and context. Expand all / Collapse all. A single matching lemma opens by itself.
- Token to passage: `urn:cts:…msA.normalized-tokens:1.1.t1` gives `…msA.normalized:1.1` and passage key `…msA:1.1` (scholia: `…hmt.normalized-tokens:1.1.comment.t4` gives key `…hmt:1.1`). The page view is the shared one, always showing the normalized text (the text that was lemmatized), with the token marked; a scholion with the token is unfolded.
- Finding the token in the text (`locateToken`): by its number counting every token, then only lexical tokens, then numbering that restarts in each part of a scholion; a number is accepted only if the text there is the token. Otherwise every identical lexical token of the passage is marked, with a note; if none, a note says nothing is marked. CHECKED AGAINST THE REAL FILE (`scratch/sample.cex`, then the whole `scratch/lemmata-current.cex`: 404,418 lines, 41 MB; 348,989 lexical and 55,427 punctuation tokens, 39,052 lemmata, 12 text versions, all in the release, no unreadable line; read in 0.5 s, about 65 MB of memory; `pos` is a Universal Dependencies tag). Facts found there: there is a header line; token numbers count punctuation; a scholion's tokens are numbered from 1 again in its lemma and in its comment (the token URN names the part: `…comment.t27`, `…lemma.t2`); references include `1.title` and odd ones like `13.165r10`; the elision mark is inconsistent (`δ'` one token, `μυρί` + `'` two); there are OCR oddities (Latin lookalike letters, lone combining marks), and many variant lemmata for one word (αχιλλευς matches 14 lemmata).
- Finding a token in its passage (`locateToken(parts, token, n, part)`), over all 349k tokens: exact by number 333,972 (within the named part 208,182; over the passage 123,390; counting lexical tokens only 2,392), identical string occurring once in the passage 11,292, ambiguous (several identical strings, the one nearest the number is marked, with a note) 3,320, not found 413 (0.1%, mostly lone combining marks). A number is accepted only where the text is the token.
- Tests: `test/lemmata.test.js` (17; the sample and the whole data set when present in scratch/, stream cut at any byte, header, punctuation, interning, URN mapping, locating, hash, real release texts re-tokenized). Browser test (run against the whole real file, and against a synthetic one made from the release texts), including progress, version ✓/⚠, accordion, page marks, deep links (also beyond the first 60), fall-back drop zone for the three files, 360 px dark.
- `lemmata-releases.cex` was not available to check; its format is as described (header `release|date|archive|llm`, row `lemmata-current`).
- `version.txt` needs a line `lemmatizedsearch.html   0.1.0` (user-owned; the build skips the app and `test/build.test.js` fails until it is there).
- If the server does not send CORS headers, the page cannot fetch the data from another origin; the drop zone then accepts the saved files (it recognises each by its first lines).

- Fetch failures now say why: a TypeError ("Load failed" in Safari, "Failed to fetch" elsewhere) is reported as the browser being unable to read the file (server unreachable, or no CORS permission), and the drop zone is offered. Prompted by a transient network drop on 2026-11-23; the data loaded fine on retry.

## Standard top menu: Docs link (2026-11-23)

- Every app's `.appmeta` bar is now: "← HMT apps home" (left), "Version X", then "Docs" (right), where Docs links to `https://neelsmith.github.io/hmt-apps/docs/<app-name>/` (no `.html`; e.g. `.../docs/iliad-scholia/`). Added to all 11 `src/apps/*/index.html`; `dist/` rebuilt.
- `src/apps/iliad-scholia/style.css` (shared by iliad-scholia, editorial, all-scholia): the bar now uses `justify-content: flex-end` with `.home { margin-right: auto }`, so three items keep home left and version + Docs right.
- The other apps already right-align `.appmeta` with `margin-left: auto`, so no CSS change was needed.
- 121 unit tests pass (15 skipped). Not checked visually in a browser. Nothing committed.
- Follow-up (2026-11-23): in codices, dse-check, images, lemmatizedsearch, propernames, stringcounter, stringsearch and va-facsimile the menu bar sat right-aligned on the title's line. Its CSS is now `order: -1; flex: 0 0 100%` inside the flex `<header>`, so it takes its own line above the h1 (home left, version + Docs right), as in iliad-scholia. CSS-only; HTML unchanged. Checked in Chromium at 1100 and 390 px: bar above the title in all nine apps, no overflow.

## va-facsimile: `text` and `image` parameters (2026-11-23)

- `#text=<CTS URN>` opens the page a passage is indexed to; `#image=<CITE2 URN>` opens an image. Both also work as `?text=` / `?image=` when the page opens. Details in `notes/va-facsimile-usage.md`.
- Code: `dseKey` and `parseFacsimileParams` in `src/dse.js` (which now imports `ctsVersionOf`); `indexDse` also returns `byPassage` (passage key to images); `tryPending` in `src/apps/va-facsimile/app.js` waits for the manifest (and the release, for `text`), then replaces the hash with `#page=<id>`. Failures leave the light table with a message in the status line.
- Tests: 3 new unit tests in `test/viewer-modules.test.js` (124 pass). Browser check (Chromium, stubbed manifest/release, 17 checks): exemplar-level and scholion URNs, query and hash forms, unindexed/range/e3/bad URNs, release failure, `#page` precedence, hash set while running. Not run against the real release. Nothing committed.

## Manuscript-page context in iliad-scholia, all-scholia and editorial (2026-11-23)

- Entering a passage, range or book now shows each manuscript page the lines are on, whole, as in propernames: the page's Iliad lines with the page's scholia under the lines they comment on (badge per line, folded panels, "Unfold all scholia"), with the requested lines highlighted. The summary line and notes above it are unchanged; the old per-line list is gone.
- Pages come from the DSE records (`indexPages`), one block per page in order of the first requested line on it, at most 40 pages (a note says when more). A line with no page in the DSE (e.g. Venetus B, a few Venetus A lines) goes in a plain list below, with a note; if no line has a page, only that list shows.
- Text: `?urn=` and the diplomatic/normalized radio work as before and apply to the page text. editorial.html weaves the normalized reading in parentheses in the page lines and in the scholia, as before.
- Behaviour that differs from the old list: the badge on a line counts the scholia that are *on that page* and comment on the line (DSE placement), not every scholion indexed to the line. In all-scholia the "Venetus A 2 · Venetus B 2 …" chips are kept under each requested line that has scholia, but scholia of other manuscripts are not on this page, so they appear in the chips and the summary total, not in the page text.
- Code: `page-view.js` gained `showPage(box, surface, current, options)`, and `current` may be a set of keys (a range); `options.scroll` and an empty `hitNoun` are supported. `src/page-view.css` was split: `src/page-view.css` (list layout) and new `src/page-text.css` (the page text); propernames, stringsearch, stringcounter and lemmatizedsearch now inline both. The three apps now inline dse, images, codices, propernames and page-view too (about 110 KB each).
- Style clashes avoided by renaming the apps' own classes: `.panel` (form box) is now `.card`; `.badge`, `.scholion`, `.scholion .id/.lemma` rules in `src/apps/iliad-scholia/style.css` are scoped to `.passage` / `.scholia`.
- Tests: 124 unit tests pass (no new ones; the change is DOM code). Browser test (Chromium, 17 checks) against a synthetic release with two pages and an unplaced line: single page, range across two pages, partly unplaced, fully unplaced, badges and panels, text-kind switch, all-scholia chips, editorial weaving (lines and scholia), style leakage, 390 px width, no errors. **Not run against the real release** (no network here); propernames/stringsearch were not re-checked in a browser after the CSS split (the rules moved unchanged). Nothing committed.

## coverage.html (0.1.0)

- New app `coverage.html`: bar charts of edited Iliad lines by book (one series per manuscript with lines), pages with DSE records per codex (count and percent of the codex's pages).
- New `src/bar-chart.js` (generic SVG grouped bars, ticks, legend, table), `src/coverage.js` (`iliadLinesByBook`, `dsePagesByCodex`), tests in `test/coverage.test.js`.
- A line = passage `book.line[suffix]` with text in either exemplar; titles excluded. Real release 2024c: msA 15,639, msB 709, e3 1,692.
- DSE pages: msA 631 of 662 (95.3%), e3 71 of 660 (10.8%), others 0. Warnings: 1 DSE record skipped; msA surface `211v1` is not in the codex page list (still counted in the numerator).

### Scholia chart (added to coverage.html 0.1.0)

- New chart "Edited scholia, by book" between the lines chart and the DSE page charts: `scholiaByBook` in `src/coverage.js`.
- A scholion = `book.scholion` with lemma or comment text in either exemplar. A group of scholia belongs to the manuscript whose Iliad version id begins its own (`msAint` → `msA`), so the six Venetus A groups are added together.
- Release 2024c: Venetus A 10,253 (groups 1,107 / 4,732 / 349 / 3 / 2,339 / 1,723), Venetus B 324 (book 9 only), Escorial Y 1.1 627 (books 8-10).

## commentary-check.html (0.1.0)

- New app `commentary-check.html`: gaps between the commentary index (`urn:cite2:hmt:commentary.v1:all`), the editions of the scholia and the DSE. New `src/commentary-check.js` (`checkCommentary`, `countByBook`, `commentaryCsv`), tests in `test/commentary-check.test.js`; `src/coverage.js` gained `manuscriptOfScholia` (shared with `scholiaByBook`).
- A scholion = `book.scholion` reference in an edition (text or not); indexed = an index entry names it and its target is an Iliad passage. Group of scholia → manuscript by identifier prefix (`msAint` → `msA`).
- Release 2024c: 7 scholia not indexed (Venetus A: 16.209r1-r4 interior, 16.209r4 main, 23.800/23.801 interior); 0 index entries for scholia absent from editions; 76 scholia indexed to an Iliad passage on a different page (of 9,126 comparable); 73 index entries whose Iliad passage cannot be found (e.g. `13.UNKNOWN`, `9.523XXXX`, whole-book `4`).
- 1,986 entries could not be compared by page because the scholion has no DSE record; 19 because the Iliad passage has none.
- Needs `commentary-check.html   0.1.0` in version.txt (user-owned; also check a newline precedes it).

## Bookmarkable addresses (va-facsimile, codices, images, iliad-scholia, all-scholia, editorial)

- New `src/location.js` (`readParams`, `formatQuery`, `setQuery`): optional URN parameters `text`, `page`, `image` in the query string; these apps no longer use `#` and the old `#urn=`, `#page=<canvas id>`, `#text=`, `#image=`, `?urn=` forms are not read.
- `text` = CTS URN (text apps: replaces `?urn=`, and Show now writes it into the address); `page` = CITE2 page URN (codices: replaces `#urn=`; va-facsimile: `urn:cite2:hmt:msA.v1:<canvas id>`, replaces `#page=12r`); `image` = CITE2 image URN (images: replaces `#urn=`, collection URNs allowed; va-facsimile as before). va-facsimile reads all three (`page`, then `image`, then `text`) and rewrites the address to `?page=…`.
- images: thumbnail paging moved from `&page=N` to `&n=N` so `page` means a codex page everywhere.
- In-app navigation uses `history.pushState`/`replaceState` and `popstate` (Back/Forward work); where a browser refuses to change the address of a page opened from a file, `setQuery` returns false and navigation still works without the address.
- Removed `parseFacsimileParams` (dse.js), `formatPageHash`/`parsePageHash` (codices.js), `formatHash`/`parseHash` (images.js); added `formatPageQuery`/`parsePageQuery`, `formatImageQuery`/`imageParams`/`parseImageQuery`.
- Not changed: propernames, stringsearch, stringcounter, lemmatizedsearch still keep their state in `#` hashes.

## All three parameters in codices, images and the text apps

- codices, images, iliad-scholia, all-scholia and editorial now accept `text`, `page` and `image` (va-facsimile already did). New `src/locate.js` (`firstPassageKey`, `createLocator`, `resolvePage`, `resolveImage`), tests in `test/locate.test.js`; `iliadRangeOf` added to `src/iliad-scholia.js`.
- Precedence: codices `page` > `image` > `text` (the first that gives a page of the release; an unusable earlier one falls through); images `image` > `page` > `text`; text apps `text` > `page` > `image`. The address is then rewritten to the app's own parameter (`?page=`, `?image=`, `?text=`).
- text → page/image: the DSE record of the passage (the first passage of a range; version label ignored, scholion `.lemma`/`.comment` suffix dropped). page → image: DSE image of the page, else the catalog image. image → page: pages whose DSE rows or catalog use the image.
- page/image → text: the Iliad lines on it become one range (first to last in the text's order, in the version with most lines there); a page with only scholia gives the range of the lines they are indexed to. Ranges can include title lines (e.g. `1.title-1.25`).
- Search apps (propernames, stringsearch, stringcounter, lemmatizedsearch) unchanged, still `#`.

## Previous / next page (iliad-scholia, all-scholia, editorial, stringsearch, propernames, stringcounter, lemmatizedsearch)

- The shared page view (`src/page-view.js`) now puts **‹ Previous page** / **Next page ›** under the heading of every manuscript page it shows. Order comes from the codex sequence (`pageNeighbours` in `src/codices.js`, tested in `test/codices.test.js`); the buttons are disabled at the ends of a codex.
- Search apps: the view re-renders in place on the neighbouring page (empty pages included), keeping the hits marked. No change to their `#` addresses.
- Text apps: `onNavigate` hands the page to the app, which opens the Iliad range of that page via `locator.passagesOnPage` and `iliadRangeOf` (so the address is a normal `?text=` bookmark); `skipEmpty` skips pages with no indexed passages. In a multi-page range each page's buttons move from that page.

## A range in `text` for the one-page-at-a-time apps (va-facsimile, codices, images)

- These apps show one page or image at a time, so a `text` range uses only its first passage and opens that page or image; the user moves on with the normal page navigation. va-facsimile previously refused ranges; it now uses `firstPassageKey`, which moved from `src/locate.js` to `src/dse.js` so va-facsimile can use it without inlining the locator.
- Text-oriented apps (iliad-scholia, all-scholia, editorial, and the search apps' page views) still show whole ranges, over as many pages as they span.

## va-facsimile now starts from the codex model

- The light table is built from the Venetus A codex (`urn:cite2:hmt:msA.v1:`) of the release: one cell per page, showing the documentary image indexed to the page (`pageView`: the image of its DSE records, else the catalog image). The IIIF manifest `vaimg.2017a.json` is no longer fetched or accepted; image size comes from each image's `info.json` on opening (as in codices), thumbnails take their shape from the loaded picture.
- Addresses resolve through `createLocator`/`resolvePage` (as codices), restricted to pages of the Venetus A. Release 2024c: 662 pages, all with images, 630 with DSE regions.
- `parseManifest`, `VA_MANIFEST_URL` and `imageUrnFromService` (and their tests) are removed from `src/iiif.js` and `test/viewer-modules.test.js`; `iiif.js` keeps `iiifImageUrl` and `matchProtocol`.
- The `quarto` page for va-facsimile and `notes/va-facsimile-usage.md` may still describe the manifest (not touched).

## images.html: light box like the Venetus A one

- The light box of `images.html` now follows `va-facsimile.html`: **Find** (matches the typed text in the caption, or the id when there is no caption; `imageMatches` in `src/images.js`), a **Size** slider, and the whole collection on one scrolling page (thumbnails load lazily). Paging is removed: no Per page menu, no pagers, no `n` parameter; `paginate` is deleted (and its test), `formatImageQuery`/`imageParams`/`parseImageQuery` now deal only with `image`. Thumbnails take the aspect ratio of the loaded picture.
- The grid is built once per collection and kept when you open an image and come back; it is rebuilt when the collection changes. The "none of the thumbnails loaded" note now appears when the first six thumbnails all fail.

## dse-check.html (0.1.x): codex pages without DSE records

- New fourth check: for each codex of the release (collections of the codex model, via `codices()`), compare its pages, in codex order, with the surfaces named by DSE records, and report the runs of consecutive pages no record names. `codexCoverage(release, surfaces)` and `describeRun` in `src/dse-check.js`; `checkDse` returns `codices` (pages, covered, uncovered, runs). Tests in `test/dse-check.test.js` (synthetic release with two codices, order independent of the data, and the real release). The CSV gets lines in the group `codex page without DSE record`; the app gets a **By codex** table and a fourth group. The app now inlines `src/location.js` and `src/codices.js`.
- A page is covered if any record names it as `surface`, whatever the record's passage or image. Surfaces that are not pages of the codex are ignored here (the Venetus A has `211v1`; `coverage.html` still counts it, so its 631 is 630 here).
- Release 2024c: Venetus A 662 pages, 630 covered, 3 runs (inside front cover to folio 11 verso, 25 pages; folio 211 verso; folio 327 verso to inside back cover, 6 pages). Escorial Y 1.1: 660 pages, 71 covered, 4 runs. Burney 86, Escorial Ω 1.12, Laurentian 32.3, Venetus B and Marciana 841 have no DSE records: one run each.

## coverage.html: edited pages by book

- New table: a row per book of the Iliad, a column per manuscript with edited lines, each cell the range of codex pages holding edited lines of that book. `iliadPagesByBook(release, textIndex)` in `src/coverage.js`: an edited line (same definition as `iliadLinesByBook`) is placed on the surfaces of DSE records whose `dseKey(passage)` is the version URN plus the line reference; pages are ordered by codex order (`codices()`), and the manuscript's codex is the one holding most of its placed lines. Each book gives `first`/`last` page ids, `pages`, `span`, `lines`, `unplaced`.
- Release 2024c: Venetus A runs from 12r (book 1) to 326v (book 24), every book on a contiguous run of pages (book 16 has 30 lines with no DSE page); Escorial Y 1.1 covers books 8-10 (98r-134r); Venetus B has 709 edited lines in book 9 but no DSE records, so the cell reads "no page".
- Tests: `test/coverage.test.js` (synthetic and real release; 163 unit tests in all).

## dse-check.html: pages with DSE problems, by book

- New table: for each Iliad version with DSE records whose passage is not in the text (problem 2), the pages those records name, by book. `iliadProblemPages(release, versions)` in `src/dse-check.js`, returned by `checkDse` as `iliadPages` (`byBook[24]` of `{records, pages, text}`, plus `records` and `other`). Pages come in codex order with consecutive pages joined; pages not in the codex follow by id. Only this problem type is included (the request was cut off after it; "text passage missing from DSE" has no page of its own, and "image not in catalog" was not asked for).
- Release 2024c: Venetus A only: book 4 (58v), 7 (98v), 14 (188v), 16 (213v, 214v, 218r, 219v), 24 (324v); 5 more records are not lines of books 1-24.
- Tests: `test/dse-check.test.js` (synthetic, ordering and real release; 165 unit tests in all).

- dse-check.html: each page in the by-book table links to `https://neelsmith.github.io/hmt-apps/codices.html?page=PAGEURN` (built with `formatPageQuery`). `byBook[n].parts` gives `{from, to}` as `{id, urn}` for each page or range alongside `text`.

- dse-check.html: the title tooltip on missing passages is now a styled popover (immediate, wraps, keyboard-focusable) showing all exemplars. `VersionCheck.missing[]` gained `texts: {exemplar, text}[]` next to `text` (the first exemplar). Test added in `test/dse-check.test.js` (166 unit tests).

- dse-check.html: clicking (or Enter/Space on) a missing-passage reference copies its diplomatic text (`navigator.clipboard`, with a `execCommand('copy')` fallback for non-secure contexts); chips have `role=button`.

## images.html: image references with a region of interest (bug fix)

- `?image=<image URN>@x,y,w,h` used to fail as "not in this release" because the whole string was taken as the image URN. `resolveImage` (`src/locate.js`) now splits at `@`: `{image, roi, roiText}` (`roi` is null, and ignored, if `parseRoi` rejects it). The images app opens the single image, draws a `rect.roi-hl` in the viewer overlay, zooms to the region (at most full resolution, at least fit) and keeps `@roi` in the canonical address; stepping to another image drops it. Tests in `test/locate.test.js`; UI test in the scratchpad (`ui-test-images.js`).

- dse-check.html: in group 2 (and its "not a CTS passage URN" records) the `imageroi` of each record links to `images.html?image=<imageroi>` on GitHub Pages. Group 3 is deliberately not linked.

## Regions of interest (citable `@x,y,w,h`) in images, codices and va-facsimile

- Modelled on `iiif-cite` (`ui/roi-layer.ts`, `cite-roi`), read only. New shared sources: `src/roi.js` (pure: `fractionAt`, `roiFromCorners`, `moveRoi`, `resizeRoi`, `formatRoi` (4 decimals), `roiUrn`, `sameRoi`, `MIN_ROI`), `src/roi-tool.js` (`RoiTool`: Shift-drag or Select to draw, move/resize with corner handles, Delete, Esc), `src/roi-panel.js` (`RoiUi`: Select button, panel of `imageURN@x,y,w,h` with Copy, Copy all, Clear all; regions kept per image URN while the page is open; `copyToClipboard`) and `src/roi.css`.
- `IiifViewer` gained `addLayer()` (an SVG group that follows the transform and survives `open`/`close`), `interceptPointer` (a tool may take the drag instead of panning) and `onViewChange`. Regions are stored as fractions and re-rendered on every view change, so they stay on the same part of the image through pan and zoom; handles and labels are redrawn at a fixed screen size.
- After a tool drag `viewer.dragging` is set for one tick, so the hover and click-to-copy handlers of codices and va-facsimile do not fire; Shift-drag over indexed rectangles draws and copies no text.
- images.html: `?image=<URN>@x,y,w,h` now opens with that region as the first editable region (the separate yellow highlight is gone). The region is not written back to the address as it is edited. codices and va-facsimile use the image URN of the page (from the DSE/codex model).
- Tests: `test/roi.test.js` (geometry, round trip through `parseImageRoi`); browser tests in the scratchpad (`ui-test-images.js`, `ui-test-roi-apps.js`). 172 unit tests in all.

- Regions of interest: the cursor is a crosshair as soon as Shift is down over the image (Shift is noticed on `window`, so the viewer need not have focus) and during a Shift-drag, over indexed rectangles and existing regions too (`roi-shift` class); with Select on it is a crosshair for plain drags. The apps' `#viewer { cursor: grab }` is more specific than a class, hence the `#viewer.roi-draw` rule in `src/roi.css`.

- Regions of interest: the adjust mode of iiif-cite (Select: move, corner-handle resize, click to select, Delete, Esc) was already in `RoiTool`; the panel now says so with a hint line ("To move or resize a region, press Select…", changing to the Select-mode keys while it is on). Browser tests of move and resize added for codices and va-facsimile.

## Page URN links to codices (all text displays)

- In the shared page view (`src/page-view.js`, so in iliad-scholia, all-scholia, editorial, stringsearch, stringcounter, propernames and lemmatizedsearch) the page URN under the heading is now `<a class="pageurn" href="https://neelsmith.github.io/hmt-apps/codices.html?page=<URN>" target="_blank" rel="noopener">`; it follows Previous/Next and the "also on" buttons because it is made in `renderPage`. Opens in a new tab so a search or reading position is not lost. Built by string, not `formatPageQuery`, because location.js is not inlined in the search apps. Style in `src/page-text.css`. Checked in `ui-test-pagenav.js`.

## va-facsimile: click a region to copy it

- Clicking an indexed region in va-facsimile copies `<passage URN>\n<text>` (the text as hover shows it, diplomatic or normalized; lemma and comment of a scholion joined by a space) and shows a toast, as codices already did (`copyAt`, `toast`, `copyToClipboard` from `roi-panel.js`). Codices now copies the URN line too. A click on a region of interest the user drew (`.roi-layer`) does not copy; drags do not copy. Checked in `ui-test-va-copy.js` and `ui-test-codices.js`.

## images.html: indexed text on the image

- images.html now behaves like codices for an image with DSE records: `src/text-regions.js` (`TextRegions`) draws a `rect.roi.<kind>` for each region of `indexDse(release).byImage` on `viewer.overlay` (id `rois`), with Iliad/Scholia/Other checkboxes (group `#layers`, hidden when the image has none), a hover tooltip of the diplomatic text, and click-to-copy of `<passage URN>\n<text>`; CSS in `src/text-regions.css` (needs `--c-iliad`, `--c-scholia`, `--c-other`). The app inlines `src/text-index.js` now and builds the text index and titles when the release loads. The note under the image gains "· N indexed passages". Shift-drag, Select mode and pan do not copy. Codices and va-facsimile still carry their own copies of this code; they could move to `TextRegions` later. Checked in `ui-test-images-text.js` (folio 12 recto: 48 regions).

## stringcounter.html: foldable bar chart

- `#fold` button in `.charthead` (`aria-expanded`, `aria-controls="chart"`) toggles class `folded` on `#chartbox` (`setFolded` in `src/apps/stringcounter/app.js`). CSS hides `#chart`, `#tbl`, `#chartnote`, the sort group and `#csv` when folded; `#foldnote` (`updateFoldNote`, called from `markBar`) shows the chosen form and count. Selection and hash are untouched; the folded state is per page view and not in the hash. Checked in `ui-test-fold.js` (scratchpad): the chart box shrinks and `#main` grows.

## `image` first, and the `text` region marked (2026-11-25): va-facsimile, codices, images

- `resolvePage` (`src/locate.js`): an `image` now decides alone (a `page` given with it is ignored, and a bad image is an error, not a fall back); among several pages with that image (a bifolio) the one the `text` is on is chosen. `resolveImage` already put `image` first. New `locator.regionsOfText(text, image)`: the DSE regions of a passage (or the start of a range) on an image.
- In the three apps the region of the `text` passage on the shown image is added to the image's regions of interest exactly as a Shift-drag would (`roiUi.open(image, regions)`): pink outline, number, row in the Regions of interest panel, kept in the page's memory. It is separate from the Iliad/Scholia/Other rectangles, so their checkboxes do not hide it. No zoom (images.html still zooms for an `@region` on `image`). If the passage has no region on the image, the note under the image says so.
- The address keeps the `text` (`?image=…&text=…` or `?page=…&text=…`; a text-only address is rewritten to the page/image plus the text); stepping with the buttons drops it; Back/Forward re-marks it.
- codices: an `image` that is not the one the DSE would show for its page (the catalog's other image) is shown as asked.
- Tests: `test/locate.test.js` (155 pass). Browser (Chromium, synthetic release, stubbed image server, 3 apps × 12 checks): text only, image beats page, image+text+page, text not on the image, `@region` plus text (images), layer checkboxes, next drops text, popstate re-marks, no errors. Not run against the real release. Nothing committed.

## `text` parameter: layers start off, passage shown

- In images, codices and va-facsimile, `setFocus(text)` sets `focusKey = firstPassageKey(text)` and unchecks `#show-iliad/scholia/other`; regions with `dseKey(passage) === focusKey` get class `target` (`.roi.target {display: inline !important}` overrides the layer hiding, so it stays visible). `TextRegions.show(imageUrn, w, h, target)` takes the key. The canonical address keeps `text` (`formatQuery({page|image, text})`); `go()`/`goTo()` clear `focusKey`. Checked in `ui-test-textparam.js` (scratchpad); `ui-test-va.js` expectations updated for the address.

## propernames.html: live names

- `appendMarked` gives each identified name span (`sp.key` with an entry) class `live`, `data-key` and `data-passage`; CSS `.nm.live` (pointer, underline on hover). A delegated click on `#page` (ignored while text is selected, or on the name already chosen) switches kind with `chooseKind` if needed and calls `selectName(entry, passage, false)`, which updates the hash. Checked in `ui-test-namelive.js` (scratchpad).

## Passage links to codices.html?text=

- `src/page-view.js`: `pvPassageLink(urn, text)` (anchor class `plink`, new tab) and `pvRefEl(cls, urn, text)`; used for Iliad/other line refs, scholion summary ids and the loose-passage heading. `src/apps/iliad-scholia/app.js` (`renderPassage`, `renderScholion`, also the editorial and all-scholia apps) uses `pvPassageLink` too (`dseKey(urn)` for scholia). Style `a.plink` in `src/page-text.css`. The result-list rows are buttons and are not linked. Checked in `ui-test-plinks.js` (scratchpad). `ui-test-editorial.js` still looks for `.passage` rows and fails as before (stale).

## Passage links in the result lists

- The rows of the passage lists (stringsearch, stringcounter, propernames, lemmatizedsearch) are now `div.row[role=button][tabindex=0]` from `pvRowEl()` in `src/page-view.js` (Enter/Space click it), because a link cannot sit inside a `<button>`. The reference in each row is `pvRefEl('ref', passageKey, ref)`, a link to `codices.html?text=<passage URN>`; the list click handlers ignore clicks on `a.plink`. `.row {cursor: pointer}` in `src/page-view.css`. Checked in `ui-test-rowlinks.js` and a copy of the lemmatized test (scratchpad).

## codices.html: light box of pages

- The Page menu is gone. `#table-view` (sticky `#controls`: `#codex`, `#find`, `#only-text`, `#cell-size`, `#shown`; `#grid` of `.cell` buttons with `.thumb` and a `.badge` count; `#note`, `#empty`) is the first view; `#viewer-view` has `#back`, prev/next, `#viewer-title` and `#viewer-count`. In `src/apps/codices/app.js`: `selectBook`, `showTable`, `renderGrid` (thumbnails from `pageView(page, …).image`, lazy loaded), `applyFilter`; `route()` treats `?page=<codex URN>` as the light box. `go()` still shows pages directly; Back/Esc and the codex menu set `?page=<codex URN>` and call `route()`. Checked in `ui-test-codex-box.js` (scratchpad); `ui-test-codices.js` updated for the new flow.

## images.html: `urns` parameter

- `parseImageList(text)` (split on `,` only before `urn:`, so `@x,y,w,h` survives; order kept, repeats dropped) and `imageList(collections, text)` (a virtual `ImageCollection` with `urn: ''` of the listed catalog images, plus `rois` and `missing`) in `src/images.js`, with tests in `test/images.test.js`. In `src/apps/images/app.js`: `routeList(params)` (cached by `listKey`, so stepping does not rebuild the grid), `listRois`, `listNote`; `go()` adds `urns` to the address while a list is shown; the grid click carries a listed region; the collection menu clears `listKey`. The address stays as written (`?urns=…[&image=…]`). Checked in `ui-test-urns.js` (scratchpad). The existing parameter is `image` (not `urn`); its behaviour is unchanged.

## images.html: image URN beside the label

- `#viewer-title` gets a `span.urn` with `item.urn` after the label (`src/apps/images/app.js`, style in `index.html`).

## images.html: selecting thumbnails, copying URNs

- `picked` (Set of indexes into `coll.items`), `viewedUrns()` (URNs of cells not hidden by Find, and the selected ones among them), `updateCopy()`, `setPicked()`, `clearPicked()`, `copyUrns()` in `src/apps/images/app.js`. Shift-pointerdown on `#grid` toggles a cell and sets `dragMode`; a document `pointermove` applies it to the cell under the pointer; the click with Shift does nothing (except keyboard Shift+Enter, `detail === 0`). `img.draggable = false` and `#grid {user-select: none}` stop native drags. Buttons `#copy-urns`, `#clear-sel`, message `#copy-msg` in the controls. Checked in `ui-test-pick.js` (scratchpad).

## codices.html: page URN beside the label

- `#viewer-title` gets a `span.urn` with `page.urn` after the label (`src/apps/codices/app.js`, style in `index.html`), as in images.html.

## codices.html: diplomatic / normalized choice

- Radios `name=kind` in the page bar; `kind()` replaces the constant `KIND` in `src/apps/codices/app.js` for the hover tip and the copied text; the tip's cache key includes it and the tip hides on a change (as in va-facsimile). Checked in `ui-test-kind.js` (scratchpad, line 1.44 where the editions differ). With this codices does everything va-facsimile does for the Venetus A.

## codices.html: other images of a page (illustration index)

- New `src/illustrations.js`: `illustrationsOf(release)` (Map of illustrated object URN to image URNs, from relation sets of the illustration model or with `image` and `illustrated` columns) and `imagesListUrl(urns, base)`; tests in `test/illustrations.test.js`. In `src/apps/codices/app.js`, `illustrations` is built in `start()`; `showPage` shows `#more-images` ("N images") linking to `images.html?urns=…` on GitHub Pages. The format was taken from the request (heading `image|illustrated`); the local `scratch/hmt-current.cex` has no illustration data, so the browser check `ui-test-illus.js` (scratchpad) adds a synthetic data model entry and relation set to a copy of it.

## va-facsimile removed

- `va-facsimile.html` is retired: `codices.html` does everything it did for the Venetus A (light box, page view, regions, hover and copy with diplomatic or normalized text, `page`/`image`/`text` addresses) and covers every codex. Removed `src/apps/va-facsimile/` and `notes/app-docs/va-facsimile.md`; the earlier sections of this log and `notes/va-facsimile-usage.md` are kept as history. (It had already been taken out of `version.txt`, so the build no longer produced it.) Left alone, as they are yours: the link in `docs/apps.html`, `releases.md`, and the quarto pages.

## dsecheck-paginated.html: scholia without DSE records, by book

- New `src/scholia-check.js` (`scholiaMissingByBook(release)`, `bookOfRef`): scholia versions (`tlg5026.<ms>.<hmt>`) of `checkDse(release).versions[].missing`, placed in books by `commentaryPairs(release)` (the scholion's `version + ref`, lemma/comment stripped, to the book of each target `1.62`, `13.UNKNOWN` = 13); several books = listed under each; none = book 0. Tests in `test/scholia-check.test.js` (synthetic release and the current one). App `src/apps/dsecheck-paginated/` (index.html, app.js): book buttons, prev/next, `?book=N|none`, popover and click-to-copy as in dse-check (own copy of that code). Top-level names in `scholia-check.js` are prefixed `SCH_` because dse-check.js and iliad-scholia.js share its global scope. Checked in `ui-test-dscp.js` (scratchpad). Current release: 1,993 scholia without a DSE record, 224 of them on book 1.
- **version.txt needs a line** (it is yours): `dsecheck-paginated.html  0.1.0`; until then the build prints "no version … not built". I built and tested it with that line added in my own copy.

## dsecheck-books.html (renamed) and dsecheck-paginated.html (by page)

- The by-book app is now `dsecheck-books.html` (`src/apps/dsecheck-books/`, docs link `docs/dsecheck-books/`); nothing else about it changed. Notes: `notes/app-docs/dsecheck-books.md`.
- New `dsecheck-paginated.html` (`src/apps/dsecheck-paginated/`): same missing-scholia list, grouped by the manuscript page of the *Iliad* line commented on. `scholia-check.js` gained `scholiaMissingByPage(release)` (shares `missingScholia` with the by-book function); `MissingScholion.targets` holds the commented-on passages with their *Iliad* edition. Page = `surface` of the DSE record for that *Iliad* passage in the same edition (no matching by bare reference, so several MSS are not mixed); order and labels from the codex model. Menu + prev/next, `?page=<surface URN | id | none>`. Current release: 1,993 scholia without a DSE record; 295 entries (294 pages plus "No page", which has 330). Tests in `test/scholia-check.test.js`.
- **version.txt needs two lines** (yours): `dsecheck-books.html  0.1.0` and `dsecheck-paginated.html  0.1.0`. `dsecheck-paginated` was previously the by-book app, so check any link or bookmark to it.

## codices-docs.html (2026-11-27)

- New app `codices-docs.html` (`src/apps/codices-docs/index.html`): `codices.html` with the Iliad/Scholia/Other checkboxes replaced by a list of the documents (text versions) with regions on the open page, each with its own colour, count and checkbox, plus All/None. Details in `notes/app-docs/codices-docs.md`.
- Shared script `src/apps/codices/app.js` with `data-layers="documents"` on the body (as `data-text` / `data-scholia` for the scholia apps); the codices CSS moved to `src/apps/codices/style.css` (shared via `@inline-style`).
- **`version.txt` (user-owned) needs a line `codices-docs.html  0.1.0`**; until then `npm run build` skips the app and `test/build.test.js` fails ("every app … has a version"). `dist/codices-docs.html` was built by hand as 0.1.0.
- Tests: browser only (Chromium, synthetic release with an Iliad and two scholia zones on one page): list, order, counts, colours, toggles, All/None, persistence across pages, no-text page, `?text=`, codices.html unaffected. Not run against the real release. Nothing committed.

## iliad-scholia-image.html: the reader with RoI pictures

- New app `src/apps/iliad-scholia-image/index.html` over the unchanged iliad-scholia code: `<body data-roi="image">` makes `app.js` pass `extra: createRoiImages(...)` to the shared page view (`PageOptions.extra`, called for each Iliad line and each scholion body). `src/roi-images.js` + `.css`; tests in `test/roi-images.test.js`; browser-checked with a mocked image service (picture directly under 26 of 27 lines of 1.1-1.10, scholia carry theirs, folded ones not fetched).
- **version.txt needs a line** (yours): `iliad-scholia-image.html  0.1.0`.
- iliad-scholia-image: each picture links to `images.html?image=<image URN>@x,y,w,h` (`imageRoiLink` in `src/roi-images.js`); the region is written from the parsed RoI numbers.

## codices-docs.html replaces codices.html (2026-11-28)

- `src/apps/codices/index.html` is now the former `codices-docs` page (names changed: title "Codices", docs link `docs/codices/`); `src/apps/codices-docs/`, `dist/codices-docs.html` and `notes/app-docs/codices-docs.md` are removed, its notes folded into `notes/app-docs/codices.md`. `app.js` and `style.css` are unchanged; the old checkbox mode is now unused.
- **`version.txt` (user-owned): delete the `codices-docs.html` line** (`codices.html` keeps its own). Also for you: `docs/` and `quarto/` still have pages for `codices-docs` if you made them; links elsewhere to `codices-docs.html` should point to `codices.html`.

## codices.html: URL parameters (2026-11-28)

- Priority is now `page` > `image` > `text` (`resolvePage` in `src/locate.js`, which also returns `via`). `page`: codex URN = light box, page URN = single-page view (a bad `page` falls through). `image` (a region on the URN no longer stops it resolving: the `@…` is stripped before looking the image up): single-page view of its page; with a region it is marked through `roiUi.open(image, [roi])` and every document starts off (`hideLayers`, shared with `text`); the address of an `image` is not rewritten (it would lose the image). `text`: page of the passage, start of a range; address becomes `?page=…&text=…`. Tests in `test/locate.test.js`; browser-checked (scratchpad `ui-test-cdx3.js`).

## codices.html: foldable documents bar (2026-11-28)

- The heading of the documents bar is now a button (`.doc-head`, `aria-expanded`) that folds the list (`#doc-bar.folded`, CSS in index.html; `docsFolded` in app.js, kept page to page). Folded, it says how many documents are shown. Browser-checked (scratchpad `ui-test-cdx4.js`).

## codices.html: tools column (2026-11-28)

- The zoom (+/−), Fit and Select buttons moved from the page bar into a narrow vertical column (`#tools`) at the left of the image (`#viewer-row` holds it and `#viewer-wrap`; CSS in `src/apps/codices/style.css`). Ids and behaviour unchanged. Browser-checked (scratchpad `ui-test-cdx5.js`).

## iliad-scholia-columns.html: versions of the Iliad in parallel columns (2026-11-28)

- New app `src/apps/iliad-scholia-columns/` over new `src/columns.js` (`createColumns(versions, textIndex, pairs)` returns, for a reference version, kind and passage: refs, a column per version with a line of it, per line text, scholia for that version (`commentarySpans` + `annotateRange` on that version's text) and `weave(referenceLine, line)` segments; tests `test/columns.test.js`). The reference version's range decides the rows; other versions' extra lines are not shown. Real release: 9.1-9.20 gives Venetus A, Venetus B and Escorial Upsilon 1.1 (only books 8-10 are shared; book 1 has Venetus A alone). Notes: `notes/app-docs/iliad-scholia-columns.md`. `version.txt` already has the line.
- iliad-scholia-columns: the Passage box starts with `9.1-9.20` (a range three versions share).
- iliad-scholia-columns: the clickable examples are now 9.5, 9.1-9.20 and 9 (book 9 is shared by three versions; a whole book is capped at 600 lines, with a note).
- iliad-scholia-columns: punctuation is ignored when comparing words (`compareLines` in `src/columns.js`: Unicode punctuation and elision marks dropped from the comparison key only; each text shown as written; accents still count).

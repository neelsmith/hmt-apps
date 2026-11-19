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

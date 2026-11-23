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

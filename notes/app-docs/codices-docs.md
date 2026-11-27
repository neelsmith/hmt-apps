# codices-docs.html — Codices, by document

Works exactly like `codices.html` (same codex menu, light box, page viewer, `page` / `image` / `text` parameters, hover text, click to copy, regions of interest, release loading) except for the choice of regions shown. See `codices.md` for everything else.

## What differs

- The **Iliad / Scholia / Other** checkboxes are replaced by a bar under the page controls that lists every **document** with at least one indexed region on the open page, e.g. *Iliad — Venetus A (24)*, *Scholia — Venetus A interior (12)*, *… exterior*, *… interlinear*, *… intermarginal*. The bar changes with the page.
- A document is a text *version* (the version-level CTS URN of a region's passage, e.g. `urn:cts:greekLit:tlg5026.msAint.hmt:`), named from the `#!ctscatalog` as "work title — version label". Hovering the entry shows the URN.
- Each document has its own colour and a checkbox, and a count of its regions on the page. Colours are fixed per document across pages (the Iliad first, then scholia, then other texts, each in catalog order; the palette repeats after 12 documents). **All** and **None** switch every document on the page on or off.
- A document switched off stays off on other pages (until switched on again). A page with no indexed text says so.
- With a `text` parameter, every document starts switched off and only the region of that passage is shown (as in `codices.html`).

## Code

One script serves both pages: `src/apps/codices/app.js`, switched by `<body data-layers="documents">` (`src/apps/codices-docs/index.html`). The page styles moved to `src/apps/codices/style.css`, shared by both pages; `codices.html` is unchanged in behaviour.

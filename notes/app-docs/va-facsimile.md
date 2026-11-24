# va-facsimile.html — Venetus A facsimile

A light table of the pages of the Venetus A manuscript and a zoomable viewer showing the regions the DSE indexes.

## Data blocks used

- Not only the release: the IIIF manifest `vaimg.2017a.json` (from the hmt-archive repository on GitHub) supplies the pages and their images. Saved copies of the manifest and/or the release can be dropped on the page or chosen with the file picker (several files at once).
- From the release: `#!ctscatalog` and `#!ctsdata` (the text of each region) and `#!citerelationset` (the DSE, `urn:cite2:hmt:hmtdse.v1:all`, `passage|imageroi|surface`).
- The page still shows the images if the release fails to load; the indexed regions are then missing.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags. The app writes `?page=…` itself as you move, so the address is a bookmark and Back and Forward work.

- `page` — a page URN, e.g. `?page=urn:cite2:hmt:msA.v1:12r`.
- `image` — an image URN, optionally with `@x,y,w,h`: opens the page that has that image.
- `text` — a single passage URN with a DSE record on a Venetus A page: opens that page.
- If several are given, `page` wins, then `image`, then `text`; the address is rewritten as `?page=…`. A URN that cannot be used puts a notice in the status line and shows the light table.

## Output options

None.

## User options and display

- Light table: **Find** (e.g. `12r`, `cover`, `flyleaf`), **Only pages with indexed text**, a **Size** slider for the thumbnails; click a page to open it.
- Viewer: **‹ ›** (or `[` `]`) for the previous or next page; **← Pages** or Esc for the light table.
- **Iliad**, **Scholia** and **Other** checkboxes show or hide those regions; **diplomatic** or **normalized** chooses the text shown when you hover (or tap) a region.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

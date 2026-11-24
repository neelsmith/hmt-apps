# va-facsimile.html — Venetus A facsimile

A light table of the pages of the Venetus A manuscript and a zoomable viewer showing the regions the DSE indexes.

## Data blocks used

- Everything comes from the release; there is no separate IIIF manifest any more. The pages are those of the Venetus A codex, `urn:cite2:hmt:msA.v1:`, found through `#!datamodels` (codex model), `#!citecollections` and `#!citedata` (page URN, label, sequence and catalog image).
- Each page is shown by its documentary image: the image its DSE records name most often, else the catalog's image for the page. Pages with no usable image are left out (the status line counts them). The pictures come from the IIIF image service named by the image URN (`#!datamodels` image model, `#!citedata` of the image collections); a page's pixel size is read from the image's `info.json` when it is opened.
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`, `passage|imageroi|surface`), for the regions drawn on each page and the counts on the light table; and the commentary index and the page lookups used by the `text` and `image` parameters.
- `#!ctscatalog` and `#!ctsdata`: the text of each region.
- `#!citelibrary`: the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker. Without the release there is nothing to show.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags. The app writes `?page=…` itself as you move, so the address is a bookmark and Back and Forward work.

- `page` — a page URN, e.g. `?page=urn:cite2:hmt:msA.v1:12r`.
- `image` — an image URN (a region `@x,y,w,h` is ignored): opens the page that has that image.
- `text` — a passage URN with a DSE record on a Venetus A page: opens that page. For a range (`…msA:1.1-3.10`) only the first passage is used; the viewer shows one page at a time, so move on with the page buttons.
- If several are given, `page` wins, then `image`, then `text`; the address is rewritten as `?page=…`. A URN that does not lead to a page of the Venetus A with an image puts a notice in the status line and shows the light table.

## Output options

None.

## User options and display

- Light table: **Find** (e.g. `12r`, `cover`, `flyleaf`), **Only pages with indexed text**, a **Size** slider for the thumbnails; click a page to open it.
- Viewer: **‹ ›** (or `[` `]`) for the previous or next page; **← Pages** or Esc for the light table.
- **Iliad**, **Scholia** and **Other** checkboxes show or hide those regions; **diplomatic** or **normalized** chooses the text shown when you hover (or tap) a region.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

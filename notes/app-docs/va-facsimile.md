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
- Clicking a region **copies its passage URN and the text shown (diplomatic or normalized) to the clipboard**: the URN on the first line, the text on the second; a message confirms. Nothing is saved to a file. Dragging to pan, or Shift-dragging to draw a region of interest, copies nothing.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

## Marking regions of interest

On the open image you can mark rectangular regions and cite them. Hold **Shift** and drag to draw one at any time (over the indexed rectangles too: it draws and copies no text), or press **Select** and drag (the way on a touch screen). With Select on, drag a region to move it, drag a corner handle to resize it, or click a region to make it current; Delete removes the current region and Esc leaves Select. A region is kept as fractions of the whole image, so it bounds the same part of the image however you pan or zoom.

The **Regions of interest** panel under the image lists each region as the CITE2 URN of the page's image plus `@x,y,w,h` (four decimals, each from 0 to 1), e.g. `urn:cite2:hmt:vaimg.2017a:VA051RN_0052@0.2140,0.5184,0.1710,0.0225`. **Copy** puts one URN on the clipboard, **Copy all** puts them all, one per line. Regions are kept for each image while the page stays open; they are not saved or written to the address.

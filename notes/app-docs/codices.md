# codices.html — Codices

Page images of every codex in the release, with a rectangle over each text passage the DSE indexes.

## Data blocks used

- `#!datamodels` (codex model `urn:cite2:hmt:datamodels.v1:codexmodel`; image model), `#!citecollections` and `#!citedata`: the codices, their pages (in sequence) and their images.
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`).
- `#!ctscatalog` and `#!ctsdata`: the diplomatic text shown for each region.
- `#!citelibrary`: the release name in the status line. The page images come from the IIIF service named in the data.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags.

- `page` — a page URN, e.g. `?page=urn:cite2:hmt:msA.v1:12r`.
- `image` — an image URN: opens the page the DSE (or the catalog) gives that image.
- `text` — a passage URN: opens the page the DSE puts it on. For a range only the first passage is used (one page is shown at a time; move on with the page buttons).
- If several are given, `page` wins, then `image`, then `text`; the first that gives a page is used. The address is rewritten as `?page=…` and then follows the page shown, so bookmarks, links and Back and Forward work. A value that matches no page gives a message in the status line.

## Output options

- Clicking a region **copies its passage URN and its text to the clipboard** (URN on the first line, diplomatic text on the second; a message confirms). Nothing is saved to a file.

## User options and display

- Choose a **Codex**, then a **Page** (the menu marks pages with indexed text with ● and the number of passages), or step with **‹ ›** or the `[` `]` keys.
- The page image is shown with a rectangle over each indexed passage; the **Iliad**, **Scholia** and **Other** checkboxes show or hide each kind. Hovering a rectangle shows its diplomatic text.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

## Marking regions of interest

On the open image you can mark rectangular regions and cite them. Hold **Shift** and drag to draw one at any time, or press **Select** and drag (the way on a touch screen). With Select on, drag a region to move it, drag a corner handle to resize it, or click a region to make it current; Delete removes the current region and Esc leaves Select. A region is kept as fractions of the whole image, so it bounds the same part of the image however you pan or zoom.

The **Regions of interest** panel under the image lists each region as the CITE2 URN of the page's image plus `@x,y,w,h` (four decimals, each from 0 to 1), e.g. `urn:cite2:hmt:vaimg.2017a:VA051RN_0052@0.2140,0.5184,0.1710,0.0225`. **Copy** puts one URN on the clipboard, **Copy all** puts them all, one per line. Regions are kept for each image while the page stays open; they are not saved or written to the address.

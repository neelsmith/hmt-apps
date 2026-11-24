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
- `text` — a passage URN (or the start of a range): opens the page the DSE puts it on.
- If several are given, `page` wins, then `image`, then `text`; the first that gives a page is used. The address is rewritten as `?page=…` and then follows the page shown, so bookmarks, links and Back and Forward work. A value that matches no page gives a message in the status line.

## Output options

- Clicking a region **copies its text to the clipboard** (a message confirms). Nothing is saved to a file.

## User options and display

- Choose a **Codex**, then a **Page** (the menu marks pages with indexed text with ● and the number of passages), or step with **‹ ›** or the `[` `]` keys.
- The page image is shown with a rectangle over each indexed passage; the **Iliad**, **Scholia** and **Other** checkboxes show or hide each kind. Hovering a rectangle shows its diplomatic text.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

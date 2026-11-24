# codices.html — Codices

## Data from the release

- `#!datamodels` (codex model `urn:cite2:hmt:datamodels.v1:codexmodel`; image model), `#!citecollections` and `#!citedata`: the codices, their pages and the page images.
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`).
- `#!ctscatalog` and `#!ctsdata`: the diplomatic text shown for each region.
- `#!citelibrary`. The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `?page=<page URN>`, e.g. `?page=urn:cite2:hmt:msA.v1:12r` (replaces the earlier `#urn=`). The address follows the page shown, so bookmarks, links and the Back and Forward buttons work. No `#`. Where a browser will not let a page opened from a file change its own address, the address stays as it was and only the on-screen buttons navigate.

## Output

- Clicking a region copies its text to the clipboard (a message confirms); nothing is saved to a file.

## Using it

- Choose a codex, then a page (the menu marks pages with indexed text with ● and the number of passages), or step with the ‹ › buttons or the `[` and `]` keys.
- The page image is shown with a rectangle over each indexed passage; the Iliad, Scholia and Other checkboxes show or hide each kind. Hovering a rectangle shows the diplomatic text.
- Drag to pan; scroll or pinch to zoom; the + / − / Fit buttons or the `+`, `-`, `0` keys also zoom.

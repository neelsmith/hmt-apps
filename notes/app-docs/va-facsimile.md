# va-facsimile.html — Venetus A facsimile

## Data from the release

- Not the whole release: the IIIF manifest `https://raw.githubusercontent.com/homermultitext/hmt-archive/refs/heads/master/iiif/vaimg.2017a.json` provides the page images and their image URNs. Saved copies of the manifest and/or the release can be dropped on the page.
- From the release: `#!ctscatalog` and `#!ctsdata` (text of the regions) and `#!citerelationset` for the DSE (`urn:cite2:hmt:hmtdse.v1:all`). The page shows the images even if the release fails to load; the indexed regions then are missing.

## Parameters

- `#page=<canvas id>` opens a page of the manifest (the app writes this itself as you move).
- `#text=<CTS passage URN>` or `#image=<image URN>` (optionally with `@x,y,w,h`) opens the page with that passage or image; the same two as a query string (`?text=…`, `?image=…`) are read once when the page opens. A passage must be a single passage (not a range) with a DSE record on a Venetus A page; otherwise a notice says why.

## Output

None.

## Using it

- Light table of all pages: Find (e.g. `12r`, `cover`), Only pages with indexed text, and a Size slider; click a page to open it.
- Viewer: ‹ › or `[` `]` for the previous/next page, ← Pages or Esc to return; Iliad, Scholia and Other checkboxes show or hide the regions; diplomatic or normalized text; hover (or tap) a region to read its text; drag to pan, scroll or pinch to zoom, + / − / Fit.

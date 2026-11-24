# va-facsimile.html — Venetus A facsimile

## Data from the release

- Not the whole release: the IIIF manifest `https://raw.githubusercontent.com/homermultitext/hmt-archive/refs/heads/master/iiif/vaimg.2017a.json` provides the page images and their image URNs. Saved copies of the manifest and/or the release can be dropped on the page.
- From the release: `#!ctscatalog` and `#!ctsdata` (text of the regions) and `#!citerelationset` for the DSE (`urn:cite2:hmt:hmtdse.v1:all`). The page shows the images even if the release fails to load; the indexed regions then are missing.

## Parameters

- `?page=<page URN>` opens a page, e.g. `?page=urn:cite2:hmt:msA.v1:12r` (a page of `urn:cite2:hmt:msA.v1:`; the object id is the canvas id of the manifest). The app writes this itself as you move, so the address is a bookmark.
- `?text=<CTS passage URN>` or `?image=<image URN>` (optionally with `@x,y,w,h`) opens the page that has that passage or image, and the address then becomes `?page=…`. A passage must be a single passage (not a range) with a DSE record on a Venetus A page. If more than one of the three is given, `page` wins, then `image`, then `text`.
- A URN that cannot be used puts a notice in the status line and shows the light table. No `#`; the earlier `#page=<canvas id>`, `#text=` and `#image=` are no longer read.

## Output

None.

## Using it

- Light table of all pages: Find (e.g. `12r`, `cover`), Only pages with indexed text, and a Size slider; click a page to open it.
- Viewer: ‹ › or `[` `]` for the previous/next page, ← Pages or Esc to return; Iliad, Scholia and Other checkboxes show or hide the regions; diplomatic or normalized text; hover (or tap) a region to read its text; drag to pan, scroll or pinch to zoom, + / − / Fit.

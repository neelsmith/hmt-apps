# images.html — Images

A light box of the image collections in the release, with a pannable, zoomable viewer.

## Data blocks used

- `#!datamodels` (image model `urn:cite2:cite:datamodels.v1:imagemodel`), `#!citecollections` and `#!citedata`: the image collections and their items (URN, caption, rights).
- For the `page` and `text` parameters: the codex pages (`#!datamodels`, `#!citedata`) and the DSE (`#!citerelationset`, `urn:cite2:hmt:hmtdse.v1:all`).
- `#!citelibrary`: the release name in the status line. The pictures come from the IIIF service named in the data.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags.

- `image` — an image URN opens that image; a collection URN shows the thumbnails of that collection. With a collection, `n` is the page number of thumbnails (e.g. `?image=urn:cite2:hmt:vaimg.2017a:&n=3`).
- `page` — a page URN: opens the image of that page.
- `text` — a passage URN: opens the image the DSE puts it on. For a range only the first passage is used (one image is shown at a time; move on with ‹ ›).
- If several are given, `image` wins, then `page`, then `text`; the address is rewritten as `?image=…`. A value with no image gives a message above the thumbnails. The address follows what is shown, so bookmarks, links and Back and Forward work.

## Output options

None.

## User options and display

- Choose a **Collection**; set **Per page** (12, 24, 48 or 96) and move between pages of thumbnails with the pager.
- Choosing a thumbnail opens the image: **‹ ›** (or `[` `]`) for the previous or next image, a **Rights** button for the rights statement, and **← Images** or Esc for the thumbnails.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

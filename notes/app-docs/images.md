# images.html — Images

A light box of the image collections in the release (all the thumbnails of a collection on one scrolling page, with a Find box and a size slider), and a pannable, zoomable viewer.

## Data blocks used

- `#!datamodels` (image model `urn:cite2:cite:datamodels.v1:imagemodel`), `#!citecollections` and `#!citedata`: the image collections and their items (URN, caption, rights).
- For the `page` and `text` parameters: the codex pages (`#!datamodels`, `#!citedata`) and the DSE (`#!citerelationset`, `urn:cite2:hmt:hmtdse.v1:all`).
- `#!citelibrary`: the release name in the status line. The pictures come from the IIIF service named in the data.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags.

- `image` — an image URN opens that image; a collection URN shows the light box of that collection (e.g. `?image=urn:cite2:hmt:vaimg.2017a:`). There is no paging, so the old `n` parameter is no longer read.
- `page` — a page URN: opens the image of that page.
- `text` — a passage URN: opens the image the DSE puts it on. For a range only the first passage is used (one image is shown at a time; move on with ‹ ›).
- If several are given, `image` wins, then `page`, then `text`; the address is rewritten as `?image=…`. A value with no image gives a message above the thumbnails. The address follows what is shown, so bookmarks, links and Back and Forward work.

## Output options

None.

## User options and display

- Choose a **Collection**: all its thumbnails appear on one page (the browser loads the pictures as they scroll into view; none are held back by paging).
- **Find** shows only the images whose caption contains the text you type (capitals and extra spaces do not matter; for an image with no caption, its id); the count line says how many of the collection are shown. The Find box is cleared when you choose another collection.
- **Size** slider sets the width of the thumbnails; each thumbnail takes the shape of its picture.
- Choosing a thumbnail opens the image: **‹ ›** (or `[` `]`) for the previous or next image, a **Rights** button for the rights statement, and **← Images** or Esc for the thumbnails.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

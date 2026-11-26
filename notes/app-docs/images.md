# images.html — Images (version 0.3.0)

A light box of the image collections in a release, and a pannable, zoomable viewer for any image.

## Data blocks used

- `#!datamodels` (image model `urn:cite2:cite:datamodels.v1:imagemodel`), `#!citecollections` and `#!citedata`: the image collections and their items (URN, caption, rights).
- The DSE (`#!citerelationset`, `urn:cite2:hmt:hmtdse.v1:all`): the indexed text regions drawn on an image, and the `page` and `text` parameters. The `#!ctscatalog` and `#!ctsdata` blocks give the text shown for each region, and the codex pages (`#!datamodels` codex model, `#!citedata`) are used for `page` and `text`.
- `#!citelibrary`: the release name in the status line.
- The pictures are not in the release: they are fetched from the HMT IIIF image server, at an address worked out from each image URN. A picture's pixel size is read from its IIIF `info.json` when it is opened.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags. The address follows what is shown, so bookmarks, links and the Back and Forward buttons work.

- `image` — an image URN opens that image in the viewer; a collection URN shows the light box of that collection, e.g. `?image=urn:cite2:hmt:vaimg.2017a:`.
- `image` may end with a region of interest, `@x,y,w,h` as fractions of the image size, e.g. `?image=urn:cite2:hmt:vaimg.2017a:VA051RN_0052@0.214,0.5184,0.171,0.0225`: the viewer opens that single image, outlines the region in yellow and zooms to it (never past full resolution); Fit shows the whole image with the region still marked. The region stays in the address; moving to another image drops it. A region that is not four numbers inside the image is ignored and removed from the address.
- `urns` — a comma-separated list of image URNs, e.g. `?urns=urn:cite2:hmt:vaimg.2017a:VA012RN_0013,urn:cite2:hmt:vaimg.2017a:VA013RN_0014`. The list is treated as a collection: the light box shows just those images, in the order given, and no collection of the release is chosen in the menu. Choosing an image opens it in the viewer as always; the address then keeps the list and adds `&image=…` (`?urns=…&image=…`), the ‹ › buttons and `[` `]` keys step through the list only, and ← Images (or Esc) returns to the list. An entry may carry a region, `…:VA012RN_0013@0.2,0.3,0.1,0.1` (its commas do not split the list; a new entry starts at `urn:`): choosing that image opens it with the region highlighted. Entries that are not images of the release are left out, with a note naming them above the thumbnails; if none is found the note says so. `urns` takes precedence over `image`, `page` and `text` except that an `image` in the same address says which listed image to open (one that is not in the list gives a message); `text` still marks its region. Choosing a collection in the menu leaves the list.
- `page` — a page URN, e.g. `urn:cite2:hmt:msA.v1:12r`: opens the image of that page.
- `text` — a passage URN: opens the image the DSE puts it on (when there is no `image` or `page`). For a range, only its first passage is used; the viewer shows one image at a time, so move on with ‹ ›.
- Priority: `image`, then `page` (which an `image` makes ignored), then `text`. A `text` is also used with the others, to mark its region: Whichever image is shown, the region the DSE gives the `text` passage on it (for a range, its first passage) is marked like a region just drawn with Shift-drag: outlined in pink, numbered, and listed in the Regions of interest panel as a citable URN. It is separate from the Iliad, Scholia and Other regions, so the checkboxes do not hide it. If the passage has no region on the image shown, the note under the image says so. 
- The address is then rewritten as `?image=…`, with the `text` if any (`?image=…&text=…`); stepping to another image drops it.
- A value that leads to no image, or a collection or image not in the release, gives a message (above the thumbnails of the collection if there is one, otherwise in place of the prompt).

## Output options

None.

## User options and display

- **Collection** menu: choose an image collection (the menu shows how many images each has; empty collections are disabled). All its thumbnails appear at once on one scrolling page; the browser loads the pictures as they scroll into view.
- **Find** shows only the images whose caption contains the text you type (capitals and extra spaces do not matter; an image with no caption is matched by its id). The count beside the controls says how many images of the collection are shown, and a message appears if none match. The box is cleared when you choose another collection.
- **Size** slider sets the width of the thumbnails; each thumbnail takes the shape of its picture.
- Choosing a thumbnail opens the image in the viewer:
  - **‹ ›** (or `[` and `]`) move to the previous or next image of the collection, and the title area shows the image's position (e.g. "24 of 966");
  - **Rights** shows or hides the rights statement from the release;
  - **← Images** (or Esc) returns to the light box, with the same filter and scroll position;
  - drag to pan; scroll or pinch to zoom; **+**, **−** and **Fit** (or the `+`, `-` and `0` keys).
- If the image server cannot be reached, the thumbnails show "no image", a note says so, and the viewer reports the failure.

## Marking regions of interest

On the open image you can mark rectangular regions and cite them. Hold **Shift** and drag to draw one at any time, or press **Select** and drag (the way on a touch screen). With Select on, drag a region to move it, drag a corner handle to resize it, or click a region to make it current; Delete removes the current region and Esc leaves Select. A region is kept as fractions of the whole image, so it bounds the same part of the image however you pan or zoom.

The **Regions of interest** panel under the image lists each region as the image's CITE2 URN plus `@x,y,w,h` (four decimals, each from 0 to 1), e.g. `urn:cite2:hmt:vaimg.2017a:VA051RN_0052@0.2140,0.5184,0.1710,0.0225`. **Copy** puts one URN on the clipboard, **Copy all** puts them all, one per line. Regions are kept for each image while the page stays open; they are not saved or written to the address.

An `image` parameter with a region, `?image=<image URN>@x,y,w,h`, opens the image with that region already marked (and zoomed to), so it can be adjusted and copied like the others.

## Indexed text on an image

When the DSE indexes text to the open image, the viewer draws a rectangle over each region, as codices.html does: red for the *Iliad*, blue for scholia, green for anything else. The note on the image says how many indexed passages it has. **Iliad**, **Scholia** and **Other** checkboxes in the toolbar (shown only for an image that has indexed text) turn each kind off and on. Hover over a rectangle to read the diplomatic text of its passage (where rectangles overlap, all of them are listed); click one to copy the passage URN and its text, URN on the first line, text on the second. Dragging to pan and Shift-dragging to mark a region of interest copy nothing, and your own regions are drawn above the indexed ones. An image with no indexed text shows no rectangles and no checkboxes.

**`text` in the address:** when the address has `text=<passage URN>` (for a range, its first passage), the Iliad, Scholia and Other checkboxes start unchecked and only the regions of that passage are drawn (heavier outline), so it is easy to see. Check a box to show that kind again. The address keeps `text` next to `page`/`image` (e.g. `?page=…&text=…`) so a reload or a copied link does the same; going to another page drops it.

In the single-image view the image's CITE2 URN is shown, small and in grey, right after the bold label (e.g. **folio 12, recto** `urn:cite2:hmt:vaimg.2017a:VA012RN_0013`); you can select it to copy.

# codices.html — Codices

Page images of every codex in the release, with a rectangle over each text passage the DSE indexes.

## Data blocks used

- `#!datamodels` (codex model `urn:cite2:hmt:datamodels.v1:codexmodel`; image model), `#!citecollections` and `#!citedata`: the codices, their pages (in sequence) and their images.
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`).
- `#!ctscatalog` and `#!ctsdata`: the diplomatic text shown for each region.
- `#!citerelationset` following the illustration model (`urn:cite2:cite:datamodels.v1:illustrationmodel`, listed in `#!datamodels`), with the heading `image|illustrated`: each row gives an image and the object (here a page) it illustrates. Optional: releases without it simply show no link. (A relation set with `image` and `illustrated` columns is also used if the release does not list it in `#!datamodels`.)
- `#!citelibrary`: the release name in the status line. The page images come from the IIIF service named in the data.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags.

- Priority: `page`, then `image`, then `text`.
- `page` — a codex URN (`?page=urn:cite2:hmt:msA.v1:`) opens the **light box** of that codex; a page URN (`?page=urn:cite2:hmt:msA.v1:12r`) opens the **single-page view**. A `page` that names no codex or page is passed over for the next parameter. With no parameter the app opens at the light box with no codex chosen.
- `image` — an image URN, with or without a region (`…:VA012RN_0013@0.2,0.3,0.1,0.1`): opens the single-page view of the page the DSE (or the catalog) gives that image. **With a region**, that region is marked on the image (outlined, numbered and listed in the Regions of interest panel as a citable URN) and every text group (document) starts switched off, so it is easy to see; switch groups on again at will. Without a region the groups stay on. If the image is on several pages (a bifolio), the page the `text` is on is chosen, else the first. An image that goes with no page gives a message in the light box.
- `text` — a passage URN: opens the single-page view of the page the DSE puts it on; for a range, the page of its first passage (one page is shown at a time; move on with the page buttons).
- A `text` given along with `page` or `image` does not change the page; it marks its own region, as below.
- The address of an `image` is kept as typed (`?image=…`), so a reload or a copied link does the same; an address with `page` or `text` becomes `?page=…` (with the `text`, if any, as `?page=…&text=…`). The page buttons and the light box give `?page=…` and drop the `text`. Bookmarks, links and Back and Forward work. A value that matches no page gives a message in the light box.


## Output options

- Clicking a region **copies its passage URN and its text to the clipboard** (URN on the first line, the text on the second; a message confirms). The text is the **diplomatic** or the **normalized** edition, whichever is chosen with the radio buttons in the page bar (diplomatic at first); hovering shows the same one. Nothing is saved to a file.

## User options and display

- Choose a **Codex**: its pages appear as a **light box** of thumbnails, in order, like the images app. A number on a page is how many indexed text passages it has. **Find** narrows the pages by name, **Only pages with indexed text** hides the rest, and **Size** changes the thumbnails. Choose a page to open it (the single-page view below); **← Pages** or Esc returns to the light box, with its Find text and scroll position kept. In the page view step with **‹ ›** or the `[` `]` keys.
- The page image is shown with a rectangle over each indexed passage; the **documents bar** under the page controls lists every document (text version) with a region on the open page, each with its own colour, count and checkbox, plus All/None (see "Documents bar" below); it replaced the Iliad / Scholia / Other checkboxes. Hovering a rectangle shows its diplomatic text.
- Drag to pan; scroll or pinch to zoom; **+**, **−**, **Fit** (or `+`, `-`, `0`).

## Marking regions of interest

On the open image you can mark rectangular regions and cite them. Hold **Shift** and drag to draw one at any time, or press **Select** and drag (the way on a touch screen). With Select on, drag a region to move it, drag a corner handle to resize it, or click a region to make it current; Delete removes the current region and Esc leaves Select. A region is kept as fractions of the whole image, so it bounds the same part of the image however you pan or zoom.

The **Regions of interest** panel under the image lists each region as the CITE2 URN of the page's image plus `@x,y,w,h` (four decimals, each from 0 to 1), e.g. `urn:cite2:hmt:vaimg.2017a:VA051RN_0052@0.2140,0.5184,0.1710,0.0225`. **Copy** puts one URN on the clipboard, **Copy all** puts them all, one per line. Regions are kept for each image while the page stays open; they are not saved or written to the address.

**`text` in the address:** when the address has `text=<passage URN>` (for a range, its first passage), every document starts switched off and only the regions of that passage are drawn (heavier outline), so it is easy to see. Check a box to show that kind again. The address keeps `text` next to `page`/`image` (e.g. `?page=…&text=…`) so a reload or a copied link does the same; going to another page drops it.

In the page view the page's CITE2 URN is shown, small and grey, right after the bold page label (e.g. **Venetus A (Marciana 454 = 822), folio 12, recto** `urn:cite2:hmt:msA.v1:12r`); you can select it to copy.

**Other images of the page:** when the illustration index has images whose `illustrated` value is the page's URN, the page bar shows a link **N images** (or **1 image**) after the page count. It opens, in a new tab, the images app on GitHub Pages with all those image URNs as a list: `https://neelsmith.github.io/hmt-apps/images.html?urns=URN1,URN2,…`, which shows just those images in a light box. The link is not shown for a page with no entries.

## Documents bar (formerly `codices-docs.html`, 2026-11-28)

`codices-docs.html` replaced the earlier `codices.html`; there is one app, `codices.html`. Its bar lists every **document** with at least one indexed region on the open page, e.g. *Iliad — Venetus A (24)*, *Scholia — Venetus A interior (12)*, *… exterior*, *… interlinear*, *… intermarginal*; it changes with the page.

- A document is a text *version* (the version-level CTS URN of a region's passage, e.g. `urn:cts:greekLit:tlg5026.msAint.hmt:`), named from the `#!ctscatalog` as "work title — version label". Hovering the entry shows the URN.
- Each document has its own colour (fixed across pages: the Iliad first, then scholia, then other texts, each in catalog order; the palette repeats after 12), a checkbox and a count of its regions on the page. **All** and **None** switch every document on the page on or off. A document switched off stays off on other pages. A page with no indexed text says so.
- Code: `src/apps/codices/app.js`, with `<body data-layers="documents">` in `src/apps/codices/index.html`. The script still has the older Iliad / Scholia / Other checkbox mode (no `data-layers`), which no page uses now.
- The list can be **folded up**: click its heading (**▾ 24 documents:**) to hide the checkboxes and All/None; the heading then reads **▸ 24 documents · 5 shown**. Click again to unfold. Folded or not, the regions stay as set; the state is kept from page to page (not between visits).

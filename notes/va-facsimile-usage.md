# Using `va-facsimile.html`: optional parameters

Written 2026-11-23; `text` and `image` added the same day. Source: `src/apps/va-facsimile/app.js` (navigation section).

## Optional parameters

`va-facsimile.html` takes three optional parameters, `page`, `text` and `image`. Give at most one; if several are given, `page` wins, then `image`, then `text`. Each goes in the URL **hash**, e.g. `va-facsimile.html#text=...`. `text` and `image` are also accepted as a `?query` (`va-facsimile.html?text=...`) when the page opens; the query is used once, so Back to the light table stays on the table.

### `#page=<canvas id>`

```
va-facsimile.html#page=<canvas id>
```

- With no hash, the app opens on the light table (the grid of all pages).
- With `#page=<id>`, it opens directly in the viewer on that page, with the text regions drawn over the image.
- `<id>` is the last path segment of the canvas `id` in the IIIF manifest. For folios this is the folio number with `r` or `v`, e.g. `#page=12r`. The same ids label the grid cells. (Folio-style ids are inferred from the grid-label rule in `src/iiif.js`; check a non-folio page, such as a flyleaf, by opening it in the app and copying the address.)
- Values are percent-decoded, so an encoded id works.
- An id that matches no page falls back to the light table, with no error message.

### `#text=<CTS URN>`

Opens the page that a passage is indexed to in the DSE records (`urn:cite2:hmt:hmtdse.v1:all`):

```
va-facsimile.html#text=urn:cts:greekLit:tlg0012.tlg001.msA:1.1
```

- One passage only, not a range.
- The version-level URN, an exemplar-level URN (`...msA.normalized:1.1`, `...msA.diplomatic:1.1`) and a subreference (`@word`) all find the same record. For scholia, `.lemma` and `.comment` are ignored (`urn:cts:greekLit:tlg5026.msAint.hmt:1.28.comment` finds scholion 1.28).
- Needs the HMT release, so the page waits for it to load. If the passage is on several Venetus A pages, the first in manuscript order is opened.
- The passage's region is not singled out; hover over the rectangles to find it.
- If the passage has no DSE record, is not a CTS URN, or is indexed only to images that are not Venetus A pages (e.g. the Escorial), the page shows the light table with a message in the status line.

### `#image=<CITE2 URN>`

Opens a given image:

```
va-facsimile.html#image=urn:cite2:hmt:vaimg.2017a:VA012RN_0013
```

- The URN must be an image of the Venetus A manifest (a `vaimg.2017a` image). A trailing `@x,y,w,h` is ignored.
- Needs only the manifest, not the release; a page with no indexed text opens without rectangles.
- A URN that is not a CITE2 image URN, or not in the manifest, gives the light table with a message.

In all successful cases the address becomes `#page=<canvas id>`, so the link in the address bar is the shareable page link.

## How the hash behaves while using the app

- Opening a page from the table sets the hash, so the address bar is always a shareable link to the current page.
- Next/previous (`[` / `]`) change the hash; browser Back returns to the previous page or to the table.
- `Esc` or the Back button clears the hash and returns to the light table.
- The table's scroll position is restored when you come back to it.

## Not parameters

- The manifest address is the constant `VA_MANIFEST_URL` in `src/iiif.js` (currently `.../hmt-archive/.../iiif/vaimg.2017a.json`), not a URL parameter.
- The layer checkboxes (Iliad, scholia, other), the diplomatic/normalized switch, the find box and the size slider are not stored in the URL; they start at their defaults on every load.
- If the release or manifest cannot be fetched, the app offers a drop zone / file picker for `hmt-current.cex` and the manifest file.

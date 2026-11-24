# images.html — Images

## Data from the release

- `#!datamodels` (image model `urn:cite2:cite:datamodels.v1:imagemodel`), `#!citecollections` and `#!citedata`: the image collections and their items (URN, label, rights).
- `#!citelibrary`. The pictures themselves are fetched from the IIIF image service named in the data.
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `?image=<image URN>` opens an image; `?image=<collection URN>[&n=N]` shows page N (default 1) of the thumbnails of a collection (`page` means a codex page everywhere, so thumbnail paging is `n`). `?page=<page URN>` or `?text=<CTS URN>` open the image of that page, or the image the DSE records put the passage (or start of a range) on; `image` wins, then `page`, then `text`, and the address is rewritten to `?image=…`. A value with no image gives a message above the thumbnails. The address follows what is shown, so bookmarks, links and the Back and Forward buttons work. No `#`.

## Output

None.

## Using it

- Choose an image collection; set the number of thumbnails per page (12, 24, 48 or 96) and move between pages with the pager.
- Choosing a thumbnail opens the image in a viewer: prev/next (‹ › or `[` `]`), a Rights button that shows the rights statement, pan and zoom (drag, scroll or pinch; + / − / Fit), and ← Images or Esc to go back to the thumbnails.

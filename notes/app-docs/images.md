# images.html — Images

## Data from the release

- `#!datamodels` (image model `urn:cite2:cite:datamodels.v1:imagemodel`), `#!citecollections` and `#!citedata`: the image collections and their items (URN, label, rights).
- `#!citelibrary`. The pictures themselves are fetched from the IIIF image service named in the data.
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `#urn=<collection URN>[&page=N]` for a page of thumbnails, or `#urn=<image URN>` for one image. The hash follows what is shown, so links and the Back button work. No query-string parameters.

## Output

None.

## Using it

- Choose an image collection; set the number of thumbnails per page (12, 24, 48 or 96) and move between pages with the pager.
- Choosing a thumbnail opens the image in a viewer: prev/next (‹ › or `[` `]`), a Rights button that shows the rights statement, pan and zoom (drag, scroll or pinch; + / − / Fit), and ← Images or Esc to go back to the thumbnails.

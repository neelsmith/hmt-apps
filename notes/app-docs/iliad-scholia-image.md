# iliad-scholia-image.html — Iliad + scholia reader, with images

Identical to `iliad-scholia.html` (same shared code, `src/apps/iliad-scholia/app.js` and the shared page view) except that the pictures of the regions of interest are shown.

## Data blocks used

Those of iliad-scholia (`#!ctscatalog`, `#!ctsdata`, the commentary index, the DSE relation set `urn:cite2:hmt:hmtdse.v1:all`, codex pages), plus the DSE `imageroi` values for the pictures.

## What is added

- Below each *Iliad* line, the part of the manuscript image its DSE record(s) index it to. A line with several regions shows each; a line with none shows nothing.
- In the body of a scholion, directly below its text, the picture of the scholion's own region (lemma and comment records are one scholion). Pictures in folded scholia or collapsed panels are not fetched until they are opened.
- The picture is cut by the IIIF image service (`{service}/x,y,w,h/{width},/0/default.jpg`, width at most 1200 px). The image size comes from `info.json`, fetched once per image; if that fails the region is asked for as percentages (`pct:`). A picture that cannot be loaded is marked as such.

## Optional parameters and user options

Same as iliad-scholia (`text`, `page`, `image`, version and text choice, passage box). Nothing new.

## Code

`src/roi-images.js` (`roisByPassage`, `regionRequest`, `createRoiImages`), `src/roi-images.css`; the page view takes an optional `extra(pk)` function in its options; `iliad-scholia/app.js` uses `createRoiImages` when `<body data-roi="image">`.

## Links

Each picture is a link (opens in a new tab) to the images app on GitHub Pages, `https://neelsmith.github.io/hmt-apps/images.html?image=<image URN>@x,y,w,h`: the image opens in single-image view with that region highlighted. (`codices.html` has no `image` parameter; `images.html` does, so the links go there.)

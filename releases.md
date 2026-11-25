# Release notes

## Repository version tag

Current version:  **0.12.0**

**0.12.0**, *Nov. 25, 2026*: adds support for interactively citing images with region of interest in `va-facsimile.html`, `codices.html` and `images.html`.


**0.11.3**, *Nov. 24, 2026*: 

- additional reporting on pages covered by DSE records in `dse-check.html`.
- additional reporting on pages edited per MS in `coverage.html`.
- fixes a bug in `images.html` when `image` parameter has an RoI subreference.


**0.11.2**, *Nov. 24, 2026*: updated functionality and lightbox interface in `images.html`. Expanded documentation on several individual apps.


**0.11.1**, *Nov. 24, 2026*: fixes a bug in sequencing of pages in `va-facsimile.html`.

**0.11.0**, *Nov. 24, 2026*:

- adds scholia summary to `coverage.html` app
- adds new `commentary-check.html` app
- adds uniform bookmarking with `text`, `image`, and `page` parameters across all browsing apps (texts, images, manuscript pages)
- adds uniform previous/next navigation to all text displays
- expands documentation for individual apps


**0.10.0**, *Nov. 23, 2026*:  adds new `coverage.html` app.

**0.9.0**, *Nov. 23, 2026*: 

- all apps get standardized menus  with links to docs for invidual apps
- `va-facsimile.html` adds parameters for `text`, `image`
- new page-oriented display in text-focused apps `iliad-scholia.html`, `all-scholia.html` and `editorial.html`

**0.8.0**, *Nov. 23, 2026*: adds `lemmatizedsearch.html` app.



**0.7.0**, *Nov. 20, 2026*: adds `stringcounter.html` app.


**0.6.0**, *Nov. 20, 2026*: adds `stringsearch.html` app.


**0.5.0**, *Nov. 19, 2026*: adds `codices.html` and `propernames.html` apps.


**0.4.0**, *Nov. 19, 2026*: utilities for constructing IIIF manifests and URN maps; new `all-scholia.html` app.


**0.3.0**, *Nov. 19, 2026*: updates `iliad-scholia.html`; adds new app `images.html`.


**0.2.0**, *Nov. 18, 2026*: adds `editorial.html` app. Adds links and version info to all apps.

**0.1.0**, *Nov. 17, 2026*: initial release. Shared code to parse a release of the HMT archive, and two initial apps, an *Iliad* + *scholia* reader, and a Venetus A facsimile reader.


## Facsimile apps

### `va-facsimile.html`

**0.5.0**, *Nov. 25, 2026*: adds support for interactively citing images with region of interest.

**0.4.1**, *Nov. 24, 2026*:  corrects behavior for forming sequence of pages in facsimile.

**0.4.0**, *Nov. 24, 2026*: Adds uniform bookmarking with `page`, `image` or `text` parameters.

**0.3.0**, *Nov. 23, 2026*: adds options to open from reference to a page, an image or a text passage. Adds standard menu to top of page.

**0.2.0**, *Nov. 19, 2026*: add option to use `urn` parameter to open with a specified passage


**0.1.1**, *Nov. 18, 2026*: link to github pages, use app-specific version.

**0.1.0**, *Nov. 17, 2026*: from a lightbox view of Venetus A images, choose individual page to view, see text on hovering over highlighted area.


## Text browsing apps

### `iliad-scholia.html`

**0.3.0**, *Nov. 24, 2026*: Adds uniform bookmarking with `page`, `image` or `text` parameters.

**0.2.0**, *Nov. 23, 2026*: Adds standard menu. Changes text display to page orientation.

**0.1.1**, *Nov. 18, 2026*: link to github pages, use app-specific version.

**0.1.0**, *Nov. 17, 2026*: select passage of *Iliad* to read in a particular version. Optionally view scholia on the passage.

### `all-scholia.html`

**0.3.0**, *Nov. 24, 2026*: Adds uniform bookmarking with `page`, `image` or `text` parameters.

**0.2.0**, *Nov. 23, 2026*: Adds standard menu to top of page. Changes to page-oriented text display.

**0.1.0**, *Nov. 19, 2026*: initial release. Same functionality as `iliad-scholia.html` except links edited scholia on the given passage from *all* edited MSS.

### `editorial.html`

**0.2.0**, *Nov. 24, 2026*: Adds uniform bookmarking with `page`, `image` or `text` parameters.

**0.1.0**, *Nov. 18, 2026*: Browse *Iliad* and *scholia* texts, see diplomatic transcription with interleaved normalized text.

## Text searching apps


### `stringsearch.html`

**0.2.0**, *Nov. 24, 2026*: Adds page navigation of search results.

**0.1.1**, *Nov. 23, 2026*: Adds standard menu to top of page.

**0.1.0**, *Nov. 20, 2026*: search text of *Iliad* and *scholia* for strings of text.


### `stringcounter.html`

**0.2.0**, *Nov. 24, 2026*: Adds page navigation of search results.

**0.1.1**, *Nov. 23, 2026*: Adds standard menu to top of page.

**0.1.0**, *Nov. 20, 2026*: search text of *Iliad* and *scholia* for strings of text and count results.

### `lemmatizedsearch.html`

**0.2.0**, *Nov. 24, 2026*: Adds page navigation of search results.

**0.1.1**, *Nov. 23, 2026*: Adds standard menu to top of page.

**0.1.0**, *Nov. 23, 2026*: search text of *Iliad* and *scholia* for text identified by lemma, optionally explore individual passages. Lemmatizations dervied using Patrick Burns' [LatinCy language models](https://latincy.github.io/latincy-book/).


### `propernames.html`

**0.2.0**, *Nov. 24, 2026*: Adds page navigation of search results.

**0.1.1**, *Nov. 23, 2026*: Adds standard menu to top of page.

**0.1.0**, *Nov. 19, 2026*: initial release. See instances of proper names in texts.



## Apps starting from physical artifacts and images

### `images.html`


**0.4.0**, *Nov. 25, 2026*: adds support for interactively citing images with region of interest.

**0.3.1**, *Nov. 24, 2026*:  fixes a bug handling image URNs with RoI.

**0.3.0**, *Nov. 24, 2026*: adds search on captions;lightbox now displays *all* images with option to scale thumbnails' size.


**0.2.0**, *Nov. 24, 2026*: Adds uniform bookmarking with `page`, `image` or `text` parameters.

**0.1.1**, *Nov. 23, 2026*: Adds standard menu to top of page.

**0.1.0**, *Nov. 19, 2026*: browse all image collections.



### `codices.html`


**0.3.0**, *Nov. 25, 2026*: adds support for interactively citing images with region of interest.

**0.2.0**, *Nov. 24, 2026*: Adds uniform bookmarking with `page`, `image` or `text` parameters.

**0.1.1**, *Nov. 23, 2026*: Adds standard menu to top of page.

**0.1.0**, *Nov. 19, 2026*: initial release.  Browse codices, view texts on a page.





## Editorial status

### `coverage.html`

**0.3.0**, *Nov. 24, 2026*: adds report of edited MS pages per book of the *Iliad*.

**0.2.0**, *Nov. 24, 2026*: summarize coverage of editing of *scholia* in different MSS of the HMT project.

**0.1.0**, *Nov. 23, 2026*: summarize coverage of editing of *Iliad* in different MSS of the HMT project.



### `commentary-check.html`

**0.1.0**, *Nov. 24, 2026*: Review consistency of scholia-Iliad indexing.



### `dse-check.html`

**0.2.0**,  *Nov. 24, 2026*: Adds reporting on runs on pages in a MS absent from DSE records.

**0.1.1**,  *Nov. 24, 2026*: Adds standard menu to top of page.


**0.1.0**, *Nov. 19, 2026*: Review consistency of DSE indexing.
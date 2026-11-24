# dse-check.html — DSE check

The relational inconsistencies of the DSE records of a release, and the runs of codex pages that no DSE record covers.

## Data blocks used

- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`, `passage|imageroi|surface`).
- `#!ctscatalog` and `#!ctsdata`: the passages of the editions, to compare with the DSE.
- `#!datamodels`, `#!citecollections` and `#!citedata`: the image collections, to check image references; and the codices (collections of the codex model: their pages in sequence), to find the pages no DSE record names as its surface.
- `#!citelibrary`: the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

None.

## Output options

- **Download report as CSV** of all findings (`dse-check.csv`), one line per finding with a group name; a codex page run is a line in the group `codex page without DSE record` (the codex in the version column, the first page of the run in the surface column, and the run described in the detail column).

## User options and display

- Two summary tables: **By text** (passages, DSE records, passages missing from the DSE, records not in the text) and **By codex** (pages, pages with DSE records, pages without, runs of pages without).
- Four groups, each with a count badge: text passages missing from the DSE; DSE records for passages not in the textual editions; references to images not in the image catalog; and **codex pages without DSE records**. Each folds open to a list (200 at a time, with a "show more" button).
- Codex pages without DSE records: for each codex, the pages are taken in codex order, and a page counts as covered if any DSE record names it as its surface. The pages that are not covered are reported as runs of consecutive pages (e.g. *inside front cover to folio 11, verso (25 pages)*, then *folio 211, verso*). A codex that no record mentions at all is reported as a single run and flagged. A DSE surface that is not a page of the codex (such as `211v1` of the Venetus A) is ignored here.
- Findings are warnings only.

## Pages with DSE problems, by book of the *Iliad*

A table below the "By codex" table: a row for each book that has any, a column for each *Iliad* version with DSE records for lines that are not in the textual edition (group 2). Each cell lists the pages those records name as surface, in codex order, consecutive pages joined (`12r–13v`); hover for the number of records. Records whose passage is not a numbered line of books 1–24 are counted in a note under the table.

Each page in that table is a link to the codices app on GitHub Pages, `https://neelsmith.github.io/hmt-apps/codices.html?page=` followed by the page's full CITE2 URN (for a range, each end links to its own page).

In "Text passage missing from DSE", hovering or focusing (Tab) a passage reference opens a popover with the passage's text in every exemplar that has it (diplomatic and normalized, labelled); Escape closes it. Passages with no text have no popover.

Clicking a passage reference in that list (or pressing Enter or Space on it) copies the passage's diplomatic text to the clipboard (the first exemplar with text if there is no diplomatic one). The popover and status line confirm the copy, or say it failed.

In "DSE record for text passage not in textual editions", the image of each record is a link to the images app on GitHub Pages, `https://neelsmith.github.io/hmt-apps/images.html?image=` followed by the record's image reference as written, region included, so the images app opens that image with the region highlighted. (The image references of "Reference to image not in catalog" are not linked: those images are not in the catalog.)

# dse-check.html — DSE check

The relational inconsistencies of the DSE records of a release.

## Data blocks used

- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`, `passage|imageroi|surface`).
- `#!ctscatalog` and `#!ctsdata`: the passages of the editions, to compare with the DSE.
- `#!datamodels`, `#!citecollections` and `#!citedata`: the image collections, to check image references.
- `#!citelibrary`: the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

None.

## Output options

- **Download report as CSV** of all findings (`dse-check.csv`).

## User options and display

- A summary table by text: passages, DSE records, passages missing from the DSE, records not in the text.
- Three groups, each with a count badge: text passages missing from the DSE; DSE records for passages not in the textual editions; references to images not in the image catalog. Each folds open to a list (200 at a time, with a "show more" button).
- Findings are warnings only.

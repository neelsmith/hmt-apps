# dse-check.html — DSE check

## Data from the release

- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`, `passage|imageroi|surface`).
- `#!ctscatalog` and `#!ctsdata`: the passages of the editions, to compare with the DSE.
- `#!datamodels`, `#!citecollections` and `#!citedata`: the image collections, to check image references.
- `#!citelibrary`. The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- None.

## Output

- **Download report as CSV** of all findings.

## Using it

- A summary table by text (passages, DSE records, passages missing from the DSE, records not in the text).
- Three groups, each with a count badge: text passages missing from the DSE; DSE records for passages not in the textual editions; references to images not in the image catalog. Entries fold open to lists (200 at a time, with a "show more" button).
- Findings are warnings only.

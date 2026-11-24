# all-scholia.html — All scholia

## Data from the release

- `#!ctscatalog` and `#!ctsdata` (the texts); `#!citerelationset` for the DSE (`urn:cite2:hmt:hmtdse.v1:all`) and the commentary index (`urn:cite2:hmt:commentary.v1:all`, found through `#!datamodels`); `#!datamodels`, `#!citecollections` and `#!citedata` for the codices (page labels); `#!citelibrary` (name shown in the status line).
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `?text=<CTS URN>`, exactly as for `iliad-scholia.html` (the address follows the passage shown). No `#`.

## Output

None.

## Using it

- Same form and display as `iliad-scholia.html` (same code, `<body data-scholia="all">`).
- Difference: the count for a line includes the scholia indexed to the same passage in *any* version of the *Iliad*, not only the version being read; the breakdown and the opened scholia are grouped by the version their index entry names.

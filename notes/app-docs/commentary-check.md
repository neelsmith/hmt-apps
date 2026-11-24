# commentary-check.html — Commentary check

## Data from the release

- `#!citerelationset`: the commentary index (`urn:cite2:hmt:commentary.v1:all`, `scholion|iliad`, found through `#!datamodels`) and the DSE.
- `#!ctscatalog` and `#!ctsdata`: the scholia in the editions, and the *Iliad* passages the index points to.
- `#!citelibrary`. The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- None.

## Output

- **Download findings as CSV** (kind of finding, manuscript, group, scholion, *Iliad* passage, pages, note).

## Using it

- A summary table by group of scholia (in editions, in index, not indexed, not in editions).
- Charts by book, series per manuscript: scholia not indexed to an *Iliad* passage, and index entries for scholia not in the editions (a message in place of a chart when there are none).
- Folding lists by group: the scholia in each gap; scholia not on the same page as the *Iliad* passage they are indexed to (page of each, compared only where both have DSE records and the passage is in the same manuscript); and index entries whose *Iliad* passage cannot be found.
- Findings are warnings only.

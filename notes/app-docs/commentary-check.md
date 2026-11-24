# commentary-check.html — Commentary check

Gaps between the commentary index, the editions of the scholia and the DSE.

## Data blocks used

- `#!citerelationset`: the commentary index (`urn:cite2:hmt:commentary.v1:all`, `scholion|iliad`, found through `#!datamodels`) and the DSE (`urn:cite2:hmt:hmtdse.v1:all`).
- `#!ctscatalog` and `#!ctsdata`: the scholia in the editions, and the *Iliad* passages the index points to.
- `#!datamodels` and `#!citelibrary`: the model that finds the commentary index, and the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

None.

## Output options

- **Download findings as CSV** (`commentary-check.csv`: kind of finding, manuscript, group, scholion, *Iliad* passage, pages, note).

## User options and display

- A summary table by group of scholia: in editions, in index, not indexed, not in editions.
- Charts by book, a series for each manuscript: scholia not indexed to an *Iliad* passage; and index entries for scholia not in the editions (a message in place of a chart when there are none).
- Folding lists by group: the scholia in each gap; scholia indexed to an *Iliad* passage that is **not on the same page** of the manuscript (page of each; compared only where both have DSE records and the passage is in the same manuscript); and index entries whose *Iliad* passage cannot be found.
- Findings are warnings only.

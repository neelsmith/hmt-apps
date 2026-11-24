# coverage.html — Editorial coverage

Bar charts of how much of the *Iliad*, the scholia and the manuscript pages the HMT has edited.

## Data blocks used

- `#!ctscatalog` and `#!ctsdata`: edited lines of the *Iliad* and scholia by book, for each manuscript with text.
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`), for the pages with records.
- `#!datamodels`, `#!citecollections` and `#!citedata`: the codices and their page totals.
- `#!citelibrary`: the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

None.

## Output options

None. Each chart's numbers are available in a fold-out data table.

## User options and display

- No controls. Four charts: edited *Iliad* lines per book (a series for each manuscript with lines); edited scholia per book (all groups of scholia of a manuscript added together); pages with DSE records per manuscript (count); and the same as a percentage of the codex's pages. Manuscripts with nothing to show are left out.
- Hover a bar for its value; charts redraw when the window is resized and scroll sideways on narrow screens.
- Warnings above the charts: skipped DSE records, DSE pages not in a codex's page list, and passages not counted. Findings are warnings only.

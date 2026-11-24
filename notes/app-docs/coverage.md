# coverage.html — Editorial coverage

## Data from the release

- `#!ctscatalog` and `#!ctsdata`: lines of the *Iliad* by book and scholia by book, for each manuscript with text.
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`), for the pages with records.
- `#!datamodels`, `#!citecollections` and `#!citedata`: the codices and their page totals.
- `#!citelibrary`. The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- None.

## Output

None. Each chart's numbers are in a fold-out data table.

## Using it

- Four charts, no controls: edited *Iliad* lines per book (series per manuscript with lines); edited scholia per book (all groups of a manuscript added together); pages with DSE records per manuscript (count); and as a percentage of the codex's pages. Manuscripts with nothing to show are left out.
- Hover a bar for its value; charts redraw on resize and scroll sideways on narrow screens.
- Warnings above the charts: skipped DSE records, DSE pages not in a codex's page list, and passages not counted.

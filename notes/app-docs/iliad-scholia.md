# iliad-scholia.html — Iliad scholia

## Data from the release

- `#!ctscatalog` and `#!ctsdata` (the texts); `#!citerelationset` for the DSE (`urn:cite2:hmt:hmtdse.v1:all`) and the commentary index (`urn:cite2:hmt:commentary.v1:all`, found through `#!datamodels`); `#!datamodels`, `#!citecollections` and `#!citedata` for the codices (page labels); `#!citelibrary` (name shown in the status line).
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- Query string (not `#`): `?urn=<CTS URN>`, e.g. `?urn=urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10`. The URN names the version, optionally an exemplar (`…msA.normalized`) and optionally a passage or range, which is then shown at once. A bad URN puts a message in the form; no `#` parameters.

## Output

None.

## Using it

- Choose a version of the *Iliad* (versions with no online text are listed but disabled) and, when it has both, the text: diplomatic or normalized.
- Enter a passage: a line (`1.5`), a range (`1.1-1.10`) or a whole book (`1`); the example buttons fill the field. The line shows the books the text has.
- Show lists the lines grouped by manuscript page (at most 2,000 lines, 40 pages), each with the number of scholia indexed to it. A small breakdown shows how many of them are indexed to each version of the *Iliad*; clicking the count opens the scholia (grouped by that version when there is more than one). The page view puts lines and scholia in their place on the page. A note lists passages that the DSE does not place on a page.
- Changing version or text re-runs the display.

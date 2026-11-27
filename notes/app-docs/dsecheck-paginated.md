# dsecheck-paginated.html — Scholia without DSE records, by manuscript page

The scholia of the textual editions that no DSE record names, grouped by the manuscript page of the *Iliad* line they comment on, one page at a time. (The same list grouped by book of the *Iliad* is `dsecheck-books.html`.)

## Data blocks used

- `#!ctscatalog` and `#!ctsdata`: the editions; scholia are the versions `tlg5026.<ms>.<hmt>` (lemma and comment of a scholion count as one passage).
- `#!citerelationset`, the DSE (`urn:cite2:hmt:hmtdse.v1:all`): which scholia a record names (as in dse-check), and the `surface` of the record for each *Iliad* line.
- `#!citerelationset`, the commentary index (commentary model `urn:cite2:cite:datamodels.v1:commentarymodel`): the *Iliad* line(s) each scholion comments on.
- `#!datamodels` + `#!citedata` (codex model): the order and labels of the pages.
- `#!citelibrary`: release name in the status line. The release is fetched when the page opens; a saved copy can be dropped on the page instead.

## How a page is found

The scholion's *Iliad* passage (from the index) is looked up among the DSE records for *Iliad* passages **in the same edition of the *Iliad*** (version URN plus reference); the record's surface is the page. For a range, both ends are looked up. A scholion on lines of several pages is listed under each. A scholion none of whose lines has a DSE record (or that the index does not place) is under "No page".

## Optional parameters

- `page` — a surface URN (`urn:cite2:hmt:msA.v1:12r`) or its id (`12r`), or `none` for "No page". Without it the first page that has scholia opens. The address follows the page shown; Back and Forward work.

## Output options

- Clicking a reference copies the scholion's diplomatic text to the clipboard (first exemplar's text if none is diplomatic). Nothing is saved to a file.

## User options and display

- A menu of the pages that have scholia, each with its count, in codex order, "No page" last; **‹ Previous page** / **Next page ›** (or `[` and `]`, PageUp/PageDown) step through them. Pages with no such scholia are not listed.
- Within a page, the scholia are grouped by edition (interior, main, and so on). Hover over (or Tab to) a reference to read the scholion and the *Iliad* passage it comments on.
- Findings are warnings only: no DSE records means every scholion is listed under "No page"; no commentary index puts everything under "No page" too; the page says so.

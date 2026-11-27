# dsecheck-books.html — Scholia without DSE records, by book

The scholia of the textual editions that no DSE record names, grouped by the book of the *Iliad* they comment on, one book at a time.

## Data blocks used

- `#!ctscatalog` and `#!ctsdata`: the editions; the scholia are the versions `tlg5026.<ms>.<hmt>` (a scholion's lemma and comment count as one passage; every exemplar's text is kept for display).
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`), to see which scholia a record names (same comparison as dse-check: by version, any exemplar, subreferences ignored); and the index of scholia to *Iliad* passages (a relation set the `#!datamodels` block documents as following the commentary model, `urn:cite2:cite:datamodels.v1:commentarymodel`), to place each scholion in a book.
- `#!citelibrary`: the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Query-string parameters (`?name=value`).

- `book` — a number 1 to 24 opens that book; `none` opens the scholia the index does not place in a book. With no `book` (or a value that is not one of these) the page opens at the first book that has scholia.
- The address follows the book shown, and Back and Forward move between the books you looked at.

## Output options

- Clicking a scholion's reference **copies its diplomatic text to the clipboard** (its first exemplar's text if it has no diplomatic one); the popover and the status line say so. Nothing is saved to a file.

## User options and display

- A row of 24 buttons, one per book, each with the number of scholia (grey when none), plus a "—" button for scholia with no book. **‹ Previous book** and **Next book ›** (or the `[` and `]` keys, PageUp and PageDown) step through the books.
- The chosen book lists its scholia as references, in groups by the scholia edition (interior, main, interlinear and so on). **Hover over** (or Tab to) a reference to read the scholion, with the *Iliad* passage it comments on.
- The book is the book of the *Iliad* passage the index says the scholion comments on (a scholion on 1.62 is under book 1), not the number in the scholion's own reference. A scholion that comments on passages of several books is listed under each; the count at the top is of distinct scholia. A scholion the index does not place (no entry, `UNKNOWN`, or a book outside 1-24) is under "no book"; `13.UNKNOWN` counts as book 13.
- Findings are warnings only. If the release has no DSE records every scholion is listed; if it has no commentary index every scholion is under "no book"; the page says so.

# editorial.html — Interwoven diplomatic/editorial reader

Read a passage of the *Iliad* in a Homer Multitext edition, with the number of scholia on each line, in the context of the manuscript page it is on.

## Data blocks used

- `#!ctscatalog` and `#!ctsdata`: the texts.
- `#!citerelationset`: the DSE (`urn:cite2:hmt:hmtdse.v1:all`) placing passages on pages, and the commentary index (`urn:cite2:hmt:commentary.v1:all`, found through `#!datamodels`) linking scholia to *Iliad* passages.
- `#!datamodels`, `#!citecollections` and `#!citedata`: the codices and their pages (page labels and order).
- `#!citelibrary`: the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Query-string parameters (`?name=value`), never `#` tags.

- `text` — a CTS URN, e.g. `?text=urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10`. Any exemplar in a URN you give is ignored (the page always shows the diplomatic text).
- `page` or `image` — a page URN or an image URN: shows the *Iliad* lines the DSE puts on it, as one range in the version of that manuscript (for a page of scholia only, the lines they comment on).
- If several are given, `text` wins, then `page`, then `image`. A value that gives no passage puts a message in the form.
- Showing a passage writes `?text=…` (version, text and passage) into the address, so the address is a bookmark of what is on the screen.

## Output options

None.

## User options and display

- Same form as `iliad-scholia.html` without the choice of text (`<body data-text="interwoven">`): the diplomatic text is shown, and where the normalized text differs it follows in coloured parentheses. `(∅)` marks a diplomatic word the normalized text omits; a parenthesized word alone is one only the normalized text has. A legend on the page explains this.
- Choose the **Version of the *Iliad***. The count for a line is the number of scholia indexed to it in that version.
- Enter a **Passage**: a line (`1.5`), a range (`1.1-1.10`) or a whole book (`1`); the example buttons fill the field, and a note shows which books the text has. Press **Show**.
- The display lists the lines grouped by manuscript page (at most 2,000 lines and 40 pages), each line with a badge counting its scholia; clicking the badge unfolds them. Requested lines are marked. A note lists passages the DSE does not place on a page.
- **Unfold all scholia** opens or folds every scholion on a page.
- Every manuscript page in the page view has **‹ Previous page** and **Next page ›** buttons (the page before or after in the codex; the first and last page of a codex have one button disabled). These reopen the app at the *Iliad* lines on the neighbouring page (skipping pages with no indexed text); the address becomes the `?text=…` range of that page, in the version of the page, so the version menu may change.
- Changing the version or text re-runs the display.

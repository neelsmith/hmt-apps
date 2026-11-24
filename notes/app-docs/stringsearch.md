# stringsearch.html — String search

Find the passages containing a Greek string, and see each on its manuscript page.

## Data blocks used

- `#!ctscatalog` and `#!ctsdata`: the texts searched.
- For the page view of a chosen passage: `#!citerelationset` (the DSE `urn:cite2:hmt:hmtdse.v1:all` and the commentary index `urn:cite2:hmt:commentary.v1:all`, found through `#!datamodels`), `#!datamodels`, `#!citecollections` and `#!citedata` (codex pages and their labels); `#!citelibrary` (release name in the status line).
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Unlike the browsing apps, this app still keeps its state in a `#` hash (no query-string parameters); the address follows the search, so bookmarks and Back and Forward work.

- `#q=<string>&s=<all|iliad|scholia>&t=<diplomatic|normalized>[&p=<passage>]` — the string; where to search (`s`, default `all`); the text searched and shown (`t`, default `diplomatic`); and the passage chosen (`p`).

## Output options

None.

## User options and display

- Type a Greek string (at least two letters; accents, breathings, capitals and punctuation do not matter). Press **Search**; typing also searches after a short pause.
- Choose where to search: **all texts**, **Iliad** or **scholia**; and the text searched and shown: **diplomatic** or **normalized**.
- Matching passages are listed under the word forms that contain the string, by version (60 at a time, with a "show more" button). Choosing one shows its manuscript page: the *Iliad* lines and scholia on it, every match marked, the scholia panels with a match unfolded.
- Every manuscript page in the page view has **‹ Previous page** and **Next page ›** buttons: the page before or after in the codex, even one with no indexed text. The marks stay on the passages that match.

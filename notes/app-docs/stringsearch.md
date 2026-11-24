# stringsearch.html — String search

## Data from the release

- `#!ctscatalog` and `#!ctsdata` (the texts searched).
- For the page view of a matching passage: the DSE and the commentary index (`#!citerelationset`), `#!datamodels`, `#!citecollections` and `#!citedata` (codex page labels), and `#!citelibrary`.
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `#q=<string>&s=<all|iliad|scholia>&t=<diplomatic|normalized>[&p=<passage>]`, e.g. `#q=αχιλλευς&s=iliad&t=normalized`. `q` is required; `s` defaults to `all` and `t` to `diplomatic`; `p` is the passage chosen from the results. No query-string parameters.

## Output

None.

## Using it

- Type a Greek string (at least two letters; accents, breathings, capitals and punctuation do not matter) and press Search; typing also searches after a short pause.
- Limit the search to all texts, the *Iliad* or the scholia, and choose to search and show the diplomatic or normalized text.
- Matching passages are listed by version (60 at a time); choosing one shows its manuscript page with the *Iliad* lines and scholia, every match marked, and the panels with a hit unfolded.
- Each page shown in the context panel has **‹ Previous page** and **Next page ›** buttons, which show the page before or after in the same codex (even a page with no indexed text), keeping the marked hits.

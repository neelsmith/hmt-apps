# stringcounter.html — String counter

## Data from the release

- `#!ctscatalog` and `#!ctsdata` (the texts searched).
- For the page view of a matching passage: the DSE and the commentary index (`#!citerelationset`), `#!datamodels`, `#!citecollections` and `#!citedata` (codex page labels), and `#!citelibrary`.
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `#q=<string>&s=all&t=<diplomatic|normalized>` plus optional `&v=<versions>`, `&b=<token>`, `&o=count`, `&m=<N>`, `&p=<passage>`:
  - `v` — comma-separated version identifiers (the URN without `urn:cts:` and the final colon, e.g. `greekLit:tlg0012.tlg001.msA`); absent means all texts.
  - `b` — the word form (bar) selected; `o=count` — sort by count (default alphabetical); `m` — least number of occurrences to show (default 1); `p` — the passage chosen.
- No query-string parameters.

## Output

- **Download CSV** of the table of word forms and counts, named `string-counts-<query, transliterated>.csv`. The table can also be viewed in the page (Show as table).

## Using it

- Type a Greek string (at least two letters; diacritics, capitals and punctuation do not matter) and press Search.
- Texts checklist: choose specific versions of the *Iliad* and of the scholia, or "All Iliad", "All scholia" and "All other texts"; the summary shows the choice.
- Choose the diplomatic or normalized text.
- A bar chart shows how often each word form containing the string occurs. Sort alphabetically or by count; set the least number of occurrences (default 1).
- Clicking a bar lists the passages with that word form (60 at a time); choosing a passage shows its manuscript page with the word marked.

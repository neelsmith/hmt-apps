# stringcounter.html — String counter

How often each word form containing a Greek string occurs, as a bar chart, with the passages behind each bar.

## Data blocks used

- `#!ctscatalog` and `#!ctsdata`: the texts searched.
- For the page view of a chosen passage: `#!citerelationset` (the DSE `urn:cite2:hmt:hmtdse.v1:all` and the commentary index `urn:cite2:hmt:commentary.v1:all`, found through `#!datamodels`), `#!datamodels`, `#!citecollections` and `#!citedata` (codex pages and their labels); `#!citelibrary` (release name in the status line).
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Unlike the browsing apps, this app still keeps its state in a `#` hash (no query-string parameters); the address follows the search, so bookmarks and Back and Forward work.

- `#q=<string>&s=all&t=<diplomatic|normalized>` plus any of:
  - `v` — comma-separated version identifiers (the URN without `urn:cts:` and the final colon, e.g. `greekLit:tlg0012.tlg001.msA`); absent means all texts;
  - `b` — the word form (bar) selected;
  - `o=count` — sort by count (default: alphabetical);
  - `m` — the least number of occurrences to show (default 1);
  - `p` — the passage chosen.

## Output options

- **Download CSV** of the table of word forms and counts, named `string-counts-<query, transliterated>.csv` (UTF-8 with a byte-order mark, so spreadsheets read it correctly).
- The same table can be viewed on the page with **Show as table**.

## User options and display

- Type a Greek string (at least two letters; diacritics, capitals and punctuation do not matter) and press **Search**.
- **Texts** checklist: choose particular versions of the *Iliad* and of the scholia, or take **All Iliad**, **All scholia** or **All other texts**; the summary line states the choice.
- Choose the text searched and shown: **diplomatic** or **normalized**.
- The bar chart shows how often each word form containing the string occurs. **Sort** alphabetically or by count; set **Only words occurring at least N times** (default 1).
- Clicking a bar lists the passages with that word form (60 at a time); choosing a passage shows its manuscript page with the word marked.
- Every manuscript page in the page view has **‹ Previous page** and **Next page ›** buttons: the page before or after in the codex, even one with no indexed text. The marks stay on the passages that match.

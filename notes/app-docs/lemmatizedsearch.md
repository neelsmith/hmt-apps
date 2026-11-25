# lemmatizedsearch.html — Lemmatized search

Search the lemmata of the lemmatization data set, and see the tokens of a lemma on their manuscript pages.

## Data blocks used

- From the release: `#!ctscatalog` and `#!ctsdata` (the texts).
- For the page view of a chosen passage: `#!citerelationset` (the DSE `urn:cite2:hmt:hmtdse.v1:all` and the commentary index `urn:cite2:hmt:commentary.v1:all`, found through `#!datamodels`), `#!datamodels`, `#!citecollections` and `#!citedata` (codex pages and their labels); `#!citelibrary` (release name in the status line).
- Not part of the release: two files from `https://shot.holycross.edu/hmt/lemmatization/`:
  - `lemmata-current.cex` (`token|passage|type|lemma|pos`; punctuation ignored);
  - `lemmata-releases.cex` (`release|date|archive|llm`): its `lemmata-current` row names the archive release the lemmatization was made from, which the app compares with the release loaded, with a warning if they differ.
- Progress is shown while each file downloads (the lemmatization file is large). Saved copies of the release and of either lemmatization file can be dropped on the page or chosen with the file picker (several at once).

## Optional parameters

Unlike the browsing apps, this app still keeps its state in a `#` hash (no query-string parameters); the address follows the search, so bookmarks and Back and Forward work.

- `#q=<string>[&l=<lemma>][&o=<token URN without urn:cts:>]`, e.g. `#q=μηνις&l=μῆνις` — the search string; one lemma opened (`l`); and a token selected (`o`: a token URN such as `…msA.normalized-tokens:1.1.t1`, mapped to its passage `…msA.normalized:1.1`).

## Output options

None.

## User options and display

- Type a lemma or part of one (at least two letters; accents, breathings and capitals do not matter) and press **Search**.
- Matching lemmata are listed as a folding list (accordion), 200 at a time, each with its number of tokens; **Expand all** (the first 30 if there are more) and **Collapse all** buttons.
- The tokens under a lemma are listed 60 at a time; choosing one shows the manuscript page of its passage (normalized text) with the token marked.
- Every manuscript page in the page view has **‹ Previous page** and **Next page ›** buttons: the page before or after in the codex, even one with no indexed text. The marks stay on the passages that match.

The page URN under each page heading is a link to the codices app on GitHub Pages, `https://neelsmith.github.io/hmt-apps/codices.html?page=` followed by the page's URN; it opens in a new tab, so your place here is kept.

# lemmatizedsearch.html — Lemmatized search

## Data from the release

- Release: `#!ctscatalog`, `#!ctsdata`; for the page view the DSE and commentary index (`#!citerelationset`), `#!datamodels`, `#!citecollections`, `#!citedata`; `#!citelibrary`.
- Not part of the release: two files from `https://shot.holycross.edu/hmt/lemmatization/` — `lemmata-current.cex` (`token|passage|type|lemma|pos`; punctuation ignored) and `lemmata-releases.cex` (`release|date|archive|llm`; the `lemmata-current` row names the archive release the lemmatization was made from, compared with the release loaded, with a warning if they differ). Saved copies of either, or of the release, can be dropped on the page.
- Progress is shown while the lemmatization file downloads.

## Parameters

- `#q=<string>[&l=<lemma>][&o=<token URN without urn:cts:>]`, e.g. `#q=μηνις&l=μῆνις`. `l` opens one lemma; `o` selects a token (a token URN such as `…msA.normalized-tokens:1.1.t1`, mapped to its passage `…msA.normalized:1.1`). No query-string parameters.

## Output

None.

## Using it

- Type a lemma or part of one (at least two letters; accents, breathings and capitals do not matter) and press Search.
- Matching lemmata are listed on the left as a folding (accordion) list, 200 at a time, each with the number of its tokens; Expand all (the first 30 if there are more) and Collapse all buttons.
- Tokens under a lemma are listed 60 at a time; choosing one shows the page of its passage with the token highlighted.

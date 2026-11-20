
### String search: results grouped by word token

- Results are now blocks per matching word token, sorted alphabetically ignoring accents and breathings (`groupByToken` in `src/stringsearch.js`). A match is widened to whole words; a match spanning words gives a phrase token. Tokens are unique after folding (case, accents), and the block title is the commonest written form, lower-cased. A passage with several different tokens appears under each. Rows show the text and page as well as the reference. "μηνι" gives 32 blocks, including μῆνις and μῆνιν.

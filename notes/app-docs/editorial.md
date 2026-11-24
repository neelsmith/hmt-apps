# editorial.html — Iliad scholia: editorial view

## Data from the release

- `#!ctscatalog` and `#!ctsdata` (the texts); `#!citerelationset` for the DSE (`urn:cite2:hmt:hmtdse.v1:all`) and the commentary index (`urn:cite2:hmt:commentary.v1:all`, found through `#!datamodels`); `#!datamodels`, `#!citecollections` and `#!citedata` for the codices (page labels); `#!citelibrary` (name shown in the status line).
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `?text=<CTS URN>`, as for `iliad-scholia.html`; the address follows the passage shown (version URN plus passage). Any exemplar in a URN you give is ignored (the page always shows the diplomatic text). No `#`.

## Output

None.

## Using it

- Same form as `iliad-scholia.html`, without the choice of text (`<body data-text="interwoven">`): the diplomatic text is shown, and where the normalized text differs it follows in coloured parentheses; `(∅)` marks a diplomatic word the normalized text omits, and a parenthesized word alone is one only the normalized text has. A legend on the page explains this.
- Version, passage, Show, per-line scholia counts and the page view work as in `iliad-scholia.html`.

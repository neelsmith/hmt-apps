# propernames.html — Proper names

## Data from the release

- `#!citerelationset`: the name indexes `urn:cite2:hmt:persnameindex.v1:all`, `placenameindex.v1:all` and `ethnicgroupindex.v1:all`; the DSE; the commentary index.
- `#!citedata` (with `#!citecollections`): the `pers` and `place` collections (label, description, redirect), and the codex pages (labels).
- `#!ctscatalog`, `#!ctsdata`, `#!datamodels`, `#!citelibrary` as in `iliad-scholia.html`.
- The release is fetched from `hmt-current.cex`; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Parameters

- `#k=<pers|place|ethnic>&i=<name id>[&p=<passage>]`, e.g. `#k=pers&i=pers1`. `i` is the object part of the name's URN; `p` is a passage (version URN plus reference) of that name to show. The page rewrites the hash as you choose, so links and the Back button work. No query-string parameters.

## Output

None.

## Using it

- Choose the kind of name (personal, geographic, ethnic), then a name from the menu; the Find box narrows the menu.
- Choose the text, diplomatic or normalized.
- The passages in which the name occurs are listed by version (60 at a time, with a "show more" button), each with its manuscript page; choosing one shows that page's *Iliad* lines and scholia (as in `iliad-scholia.html`) with every name marked in a colour for its kind. Passages and scholia containing the chosen name are unfolded.
- Names are attributed to words by learning from the release; a word that cannot be attributed is shown as a name of unknown identity.

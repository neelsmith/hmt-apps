# propernames.html — Proper names

Passages where a personal, geographic or ethnic name occurs, each on its manuscript page with names marked.

## Data blocks used

- `#!citerelationset`: the name indexes `urn:cite2:hmt:persnameindex.v1:all`, `placenameindex.v1:all` and `ethnicgroupindex.v1:all`; also the DSE and the commentary index for the page view.
- `#!citedata` (with `#!citecollections`): the `pers` and `place` collections (label, description, redirect), and the codex pages (labels, order).
- `#!ctscatalog`, `#!ctsdata` and `#!datamodels`: the texts, and the model that finds the commentary index.
- `#!citelibrary`: the release name in the status line.
- The release (`hmt-current.cex`) is fetched when the page opens; if that fails, a saved copy can be dropped on the page or chosen with the file picker.

## Optional parameters

Unlike the browsing apps, this app still keeps its state in a `#` hash (no query-string parameters); the address follows the search, so bookmarks and Back and Forward work.

- `#k=<pers|place|ethnic>&i=<name id>[&p=<passage>]` — the kind of name, the name's object id (e.g. `pers1`) and the passage chosen.

## Output options

None.

## User options and display

- Choose the **kind of name** (personal, geographic or ethnic), then a name from the menu; the **Find** box narrows the menu.
- Choose the text shown: **diplomatic** or **normalized**.
- The passages where the name occurs are listed by version (60 at a time, with a "show more" button), each with its manuscript page. Choosing one shows that page's *Iliad* lines and scholia, with every name marked in a colour for its kind (person, place, ethnic group); passages and scholia containing the chosen name are unfolded.
- Names are attributed to words by learning from the release; a word that cannot be attributed is shown as a name of unknown identity.
- Every manuscript page in the page view has **‹ Previous page** and **Next page ›** buttons: the page before or after in the codex, even one with no indexed text. The marks stay on the passages that match.

The page URN under each page heading is a link to the codices app on GitHub Pages, `https://neelsmith.github.io/hmt-apps/codices.html?page=` followed by the page's URN; it opens in a new tab, so your place here is kept.

**Live names:** in the text of the page, a name the app has identified (a solid-outlined name, not one marked "which one is not determined") is a link: hover to underline it, click to make it the name searched for. The menu and kind follow, and the passage you clicked in is shown with the new name marked. Names whose identity is not determined are not clickable.

**Passage links:** in the page view, each Iliad line number (and the number of any other text passage) and each scholion heading ("Scholion 1.13 (main) on 1.9") is a link to `https://neelsmith.github.io/hmt-apps/codices.html?text=` followed by the passage URN. It opens in a new tab, so your place here is kept. The passage lists (the buttons you choose a passage from) are not links.

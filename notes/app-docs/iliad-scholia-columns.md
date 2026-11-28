# iliad-scholia-columns.html — Iliad + scholia, in columns

Like `iliad-scholia.html` (choose a version of the *Iliad* and a passage), but the passage is shown in parallel columns: the chosen **reference** version first, then every other version of the *Iliad* that has at least one line of the passage.

## Data blocks used

`#!ctscatalog` and `#!ctsdata` (the versions and their diplomatic / normalized texts), and the commentary index (relation sets following the commentary model, `urn:cite2:cite:datamodels.v1:commentarymodel`) for the scholia; scholia text from `#!ctsdata`. Release loading as in the other apps.

## Optional parameters

- `text` — a CTS URN: version (optionally with a text, `…msA.normalized`) and optionally a passage or range, which is shown at once, e.g. `?text=urn:cts:greekLit:tlg0012.tlg001.msA:9.1-9.20`. The address follows the passage shown. (`page` and `image`, which iliad-scholia also takes, are not used here.)

## Output options

None (nothing is copied or saved). Line numbers link to `codices.html?text=<URN>` on GitHub Pages, as in the other apps; so do the scholion headings.

## User options and display

- **Reference version** and, on the same line, **Text** (diplomatic or normalized; the other versions use the same kind if they have it, else their first text, and a note says so) and **Passage** (a line, a range or whole books; a range follows the reference version's order; at most 600 lines are shown).
- One row per line of the reference version. A column per version that has at least one line of the passage, in the order of the version menu; a version without a given line shows "—". Versions with no line of the passage are listed in a note.
- **Differences:** each other column's line is compared with the reference's line word by word (the comparison of the interwoven editorial view, `weave`, on words separated by whitespace; **punctuation and case are ignored**, i.e. Unicode punctuation and elision marks are dropped from a word and it is put in lower case before comparing, while accents and breathings still count; each text is shown with its own punctuation). A word that is not the reference's is shaded, with the reference's word in its tooltip (or "not in the reference"); a word the reference has and the version lacks is marked by a small raised ‸, with the missing word in its tooltip. The reference column is not marked. Each column's heading says how many lines differ.
- **Scholia** go with the version they are indexed to: a line of a version has a badge "N scholia" for the scholia whose index entry names that version's line (as iliad-scholia does for the version shown); click it to open the scholia (lemma, comment) under the line, in that column, in the chosen kind of text.
- **Closing columns:** a **Columns:** row of checkboxes above the table (one per version, the reference's fixed) and a **×** in each other column's heading close and reopen columns; a closed column's cells are hidden and the others share the width. A closed version stays closed when the passage, text or reference changes, until the page is reloaded (not kept between visits). The summary line still counts all the versions.

## Code

`src/columns.js` (`createColumns`, pure), `src/apps/iliad-scholia-columns/{index.html,app.js,style.css}`; the page shares the base styles of iliad-scholia; tests in `test/columns.test.js`.

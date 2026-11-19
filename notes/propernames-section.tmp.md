
## propernames.html (2026-11-19)

Choose a kind of name (personal / geographic / ethnic), a name from a menu (with a find box), then one of the passages it occurs in; the Iliad and scholia text of that passage's page is shown with all indexed names marked (pastel background per kind; selected name outlined and bold). Scholia that contain the selected name are unfolded, the rest folded (button to unfold all). Deep link `#k=<kind>&i=<id>[&p=<passage>]`. Diplomatic/normalized toggle.

Data, and what had to be worked around:
- Indexes: `urn:cite2:hmt:{persname,placename,ethnicgroup}index.v1:all`, columns `passage|person`, `passage|place`, `passage|ethnic`. Ethnic names are items of the place collection (e.g. Achaea, place96). 21,531 rows.
- Entity URNs in the indexes are inconsistent (`pers.v1`, `pers`, `persName`, `place.r1`, typos `htm`, `html`, `per2`); names are matched by object id (`pers142`, `place67`). 108 rows name ids that do not exist (e.g. `persMISSING`, `pesr108`, `pers903,Danae`) and are skipped; the status line says how many. Citedata headers are capitalized (`Label`, `Redirect`).
- Index passages for scholia carry `.lemma`/`.comment`; DSE records do not. Both reduce to version + reference (`passageKey`).
- Pages: from DSE records (passage -> surface). Passages without one (e.g. msA main scholion 1.1; all of Venetus B) show the passage alone with a note.
- The release has no markup saying which word is a name. Names are capitalized in the editions, so capitalized words are the candidates; which word is which name is learned from the release (single-name/single-capital passages first, then by elimination), and only attributed to names indexed to that passage. On the current release every indexed name is located in 10,000 of 11,573 passages; where the identity is unclear but the kind is, the word is marked as that kind with a darker underline and no selected-name highlight (dashed outline if the selected name is in that passage); with mixed kinds left over nothing is marked. A capital on the first word of a passage is not counted unless the lexicon says it is a name.
- Files: `src/propernames.js`, `src/apps/propernames/`, `test/propernames.test.js`. Needs `propernames.html  0.1.0` in version.txt.

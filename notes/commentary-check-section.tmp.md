
## commentary-check.html (0.1.0)

- New app `commentary-check.html`: gaps between the commentary index (`urn:cite2:hmt:commentary.v1:all`), the editions of the scholia and the DSE. New `src/commentary-check.js` (`checkCommentary`, `countByBook`, `commentaryCsv`), tests in `test/commentary-check.test.js`; `src/coverage.js` gained `manuscriptOfScholia` (shared with `scholiaByBook`).
- A scholion = `book.scholion` reference in an edition (text or not); indexed = an index entry names it and its target is an Iliad passage. Group of scholia → manuscript by identifier prefix (`msAint` → `msA`).
- Release 2024c: 7 scholia not indexed (Venetus A: 16.209r1-r4 interior, 16.209r4 main, 23.800/23.801 interior); 0 index entries for scholia absent from editions; 76 scholia indexed to an Iliad passage on a different page (of 9,126 comparable); 73 index entries whose Iliad passage cannot be found (e.g. `13.UNKNOWN`, `9.523XXXX`, whole-book `4`).
- 1,986 entries could not be compared by page because the scholion has no DSE record; 19 because the Iliad passage has none.
- Needs `commentary-check.html   0.1.0` in version.txt (user-owned; also check a newline precedes it).

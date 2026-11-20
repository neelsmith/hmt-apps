
### String counter: choice of texts

- The Iliad/scholia/all radios are replaced by a "Texts" checklist (a drop-down panel): "All Iliad", "All scholia" and "All other texts" boxes (tri-state when only some of their texts are ticked), one box per text version under each, and Select all / Select none. All are ticked at first, which equals the old "all texts". The summary reads "Texts: all 12", "all Iliad", "all scholia", "n of m" or "none". Escape or a click elsewhere closes the panel.
- `searchInVersions`, `textChoices`, `versionOfKey` in `src/stringcounter.js`. Hash: `&v=<ns:work.version>,…` only when a subset is chosen; an older `s=iliad|scholia` link (no `v`) still selects that section.
- Only the counter app was changed; stringsearch.html still has the three-way scope.

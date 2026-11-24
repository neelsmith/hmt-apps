
## Bookmarkable addresses (va-facsimile, codices, images, iliad-scholia, all-scholia, editorial)

- New `src/location.js` (`readParams`, `formatQuery`, `setQuery`): optional URN parameters `text`, `page`, `image` in the query string; these apps no longer use `#` and the old `#urn=`, `#page=<canvas id>`, `#text=`, `#image=`, `?urn=` forms are not read.
- `text` = CTS URN (text apps: replaces `?urn=`, and Show now writes it into the address); `page` = CITE2 page URN (codices: replaces `#urn=`; va-facsimile: `urn:cite2:hmt:msA.v1:<canvas id>`, replaces `#page=12r`); `image` = CITE2 image URN (images: replaces `#urn=`, collection URNs allowed; va-facsimile as before). va-facsimile reads all three (`page`, then `image`, then `text`) and rewrites the address to `?page=…`.
- images: thumbnail paging moved from `&page=N` to `&n=N` so `page` means a codex page everywhere.
- In-app navigation uses `history.pushState`/`replaceState` and `popstate` (Back/Forward work); where a browser refuses to change the address of a page opened from a file, `setQuery` returns false and navigation still works without the address.
- Removed `parseFacsimileParams` (dse.js), `formatPageHash`/`parsePageHash` (codices.js), `formatHash`/`parseHash` (images.js); added `formatPageQuery`/`parsePageQuery`, `formatImageQuery`/`imageParams`/`parseImageQuery`.
- Not changed: propernames, stringsearch, stringcounter, lemmatizedsearch still keep their state in `#` hashes.

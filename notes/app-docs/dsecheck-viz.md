# dsecheck-viz.html — DSE check, light table

A light table of the pages of one codex (as in `codices.html`), each thumbnail badged with the number of DSE inconsistencies found on that page, or a green check mark if there are none. Choosing a page opens it in `codices.html` in a new tab.

## Data blocks used

Those of `dse-check.html` and `dsecheck-paginated.html` (editions, DSE records, image catalog, commentary index, codex model and its pages), plus `#!citelibrary` for the release name. The release is fetched when the page opens; a saved copy can be dropped on the page instead.

## What is counted on a page

- DSE records naming the page as their surface whose passage is not in the release's texts (or is not a CTS URN). Image problems are not counted.
- Scholia that no DSE record names, placed on the page as in `dsecheck-paginated.html` (the page of the *Iliad* line the scholion comments on).

A page that no DSE record names (a cover, a blank leaf) counts 0: it has no text to be inconsistent about. Its badge is a grey **0**; the green ✓ is only for pages that have DSE records and no inconsistencies.

Hovering a thumbnail gives the breakdown. Passages missing from the DSE that are not scholia (e.g. *Iliad* lines) are not charged to pages.

## Optional parameters

- `codex` — a codex collection URN (e.g. `urn:cite2:hmt:msA.v1:`); opens that codex's light table. Choosing a codex in the menu updates the address.

## User options and display

- Codex menu (each with its page count and total inconsistencies); **Find** a page by name; **Only pages with inconsistencies**; thumbnail **Size** slider.


## coverage.html (0.1.0)

- New app `coverage.html`: bar charts of edited Iliad lines by book (one series per manuscript with lines), pages with DSE records per codex (count and percent of the codex's pages).
- New `src/bar-chart.js` (generic SVG grouped bars, ticks, legend, table), `src/coverage.js` (`iliadLinesByBook`, `dsePagesByCodex`), tests in `test/coverage.test.js`.
- A line = passage `book.line[suffix]` with text in either exemplar; titles excluded. Real release 2024c: msA 15,639, msB 709, e3 1,692.
- DSE pages: msA 631 of 662 (95.3%), e3 71 of 660 (10.8%), others 0. Warnings: 1 DSE record skipped; msA surface `211v1` is not in the codex page list (still counted in the numerator).

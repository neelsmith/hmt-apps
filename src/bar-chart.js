// @ts-check
/**
 * A grouped bar chart drawn as SVG, with its data table: used by the coverage app.
 * The scale functions are pure (and tested); drawing needs a DOM.
 *
 * Series colours are the CSS variables `--s0`, `--s1`, … of the page, so the page sets
 * them for its light and dark themes.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Round tick values for a value axis from 0 up to at least `max`.  Counts get whole-number steps;
 * percentages get steps of 5, 10, 20, 25 or 50.
 * @param {number} max
 * @param {boolean} [percent]
 * @returns {number[]}
 */
export function axisTicks(max, percent = false) {
  if (!(max > 0)) return [0, 1];
  let step;
  if (percent) {
    step = [5, 10, 20, 25, 50].find(s => max / s <= 5) ?? 50;
  } else {
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    step = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 1);   // counts are whole numbers
  }
  const out = [];
  for (let v = 0; ; v += step) { out.push(v); if (v >= max) break; }
  return out;
}

/**
 * Break a label into lines of at most `width` characters at spaces, in at most `maxLines` lines
 * (the last takes the rest, cut with an ellipsis if still too long).
 * @param {string} label
 * @param {number} [width]
 * @param {number} [maxLines]
 * @returns {string[]}
 */
export function wrapLabel(label, width = 14, maxLines = 3) {
  const lines = [];
  let cur = '';
  for (const word of label.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + word).length > width) { lines.push(cur); cur = word; } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const rest = lines.splice(maxLines - 1).join(' ');
    lines.push(rest.length > width ? rest.slice(0, width - 1) + '…' : rest);
  }
  return lines;
}

/**
 * @typedef {Object} BarSeries
 * @property {string} name
 * @property {number[]} values   One per category.
 * @property {string} [color]    CSS colour; default `var(--s<index>)`.
 * @property {string[]} [tips]   Tooltip text per category; default "<series>, <category>: <value>".
 */

/**
 * @typedef {Object} BarSpec
 * @property {string[]} categories
 * @property {BarSeries[]} series
 * @property {string} yTitle
 * @property {boolean} [percent]            Value axis in percent.
 * @property {(v: number) => string} [format]   Text of a value (default: thousands separators).
 * @property {boolean} [wrap]               Wrap long category labels instead of printing them in one line.
 * @property {number} [minGroup]            Least width of a group of bars, in px.
 * @property {string} description           For screen readers.
 */

const fmtDefault = v => v.toLocaleString('en');

/** @param {string} tag @param {Record<string, string | number>} [attrs] @param {string} [text] */
function svg(tag, attrs = {}, text) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

/** The colour of series `i`. @param {BarSeries} s @param {number} i */
export const seriesColor = (s, i) => s.color ?? `var(--s${i % 6})`;

/**
 * Draw the chart into `box` (replacing its content), as wide as the box or wider if the bars need
 * the room (the box should then scroll sideways).
 * @param {HTMLElement} box
 * @param {BarSpec} spec
 */
export function drawBars(box, spec) {
  box.textContent = '';
  const fmt = spec.format ?? fmtDefault;
  const n = spec.categories.length, k = spec.series.length;
  if (!n || !k) return;
  const max = Math.max(0, ...spec.series.flatMap(s => s.values));
  const ticks = axisTicks(max, spec.percent);
  const top = ticks[ticks.length - 1];
  const wrapped = spec.categories.map(c => (spec.wrap ? wrapLabel(c) : [c]));
  const labelRows = Math.max(...wrapped.map(w => w.length));
  const left = 56, right = 12, topPad = 22, plotH = 220, bottom = 16 + labelRows * 15;
  const minGroup = spec.minGroup ?? (spec.wrap ? 96 : 34);
  const width = Math.max(box.clientWidth || 0, left + right + n * minGroup);
  const group = (width - left - right) / n;
  const bw = Math.min(40, (group * 0.78) / k);
  const height = topPad + plotH + bottom;
  const y = v => topPad + plotH - (v / top) * plotH;

  const s = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': spec.description });
  const grid = svg('g', { class: 'axis' });
  for (const t of ticks) {
    grid.appendChild(svg('line', { class: 'grid', x1: left, x2: width - right, y1: y(t), y2: y(t) }));
    grid.appendChild(svg('text', { x: left - 6, y: y(t) + 4, 'text-anchor': 'end' }, spec.percent ? `${t}%` : fmt(t)));
  }
  grid.appendChild(svg('text', { class: 'ytitle', x: 12, y: topPad + plotH / 2, 'text-anchor': 'middle', transform: `rotate(-90 12 ${topPad + plotH / 2})` }, spec.yTitle));
  s.appendChild(grid);

  spec.categories.forEach((cat, ci) => {
    const x0 = left + group * ci + (group - bw * k) / 2;
    const g = svg('g', { class: 'cat' });
    spec.series.forEach((ser, si) => {
      const v = ser.values[ci] ?? 0;
      const h = v > 0 ? Math.max(1, (v / top) * plotH) : 0;
      const x = x0 + bw * si;
      const bar = svg('g', { class: 'bar' });
      bar.appendChild(svg('title', {}, ser.tips?.[ci] ?? `${ser.name}, ${cat}: ${spec.percent ? fmt(v) : fmt(v)}`));
      bar.appendChild(svg('rect', { x: x + 0.5, y: y(v), width: Math.max(1, bw - 1), height: h, rx: Math.min(3, bw / 4), fill: seriesColor(ser, si) }));
      if (bw >= 22 || (k === 1 && bw >= 14)) {
        bar.appendChild(svg('text', { class: 'val', x: x + bw / 2, y: y(v) - 4, 'text-anchor': 'middle' }, fmt(v)));
      }
      g.appendChild(bar);
    });
    wrapped[ci].forEach((line, li) => {
      g.appendChild(svg('text', { class: 'tick', x: left + group * ci + group / 2, y: topPad + plotH + 16 + li * 15, 'text-anchor': 'middle' }, line));
    });
    s.appendChild(g);
  });
  s.appendChild(svg('line', { class: 'baseline', x1: left, x2: width - right, y1: y(0), y2: y(0) }));
  box.appendChild(s);
}

/**
 * A legend: a swatch and the name of each series.
 * @param {HTMLElement} box
 * @param {BarSeries[]} series
 */
export function drawLegend(box, series) {
  box.textContent = '';
  series.forEach((s, i) => {
    const item = document.createElement('span');
    item.className = 'key';
    const sw = document.createElement('i');
    sw.style.background = seriesColor(s, i);
    item.append(sw, ' ', s.name);
    box.appendChild(item);
  });
}

/**
 * The data of the chart as a table: a row per category, a column per series.
 * @param {BarSpec} spec
 * @param {string} firstHeader  Header of the column of categories.
 * @returns {HTMLTableElement}
 */
export function chartTable(spec, firstHeader) {
  const fmt = spec.format ?? fmtDefault;
  const t = document.createElement('table');
  const head = t.createTHead().insertRow();
  for (const h of [firstHeader, ...spec.series.map(s => s.name)]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    head.appendChild(th);
  }
  const body = t.createTBody();
  spec.categories.forEach((c, ci) => {
    const r = body.insertRow();
    r.insertCell().textContent = c;
    for (const s of spec.series) r.insertCell().textContent = fmt(s.values[ci] ?? 0);
  });
  return t;
}

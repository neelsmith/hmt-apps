// @ts-check
/**
 * Parsing of an HMT data release (a single CEX text file).
 *
 * Design notes
 * - No imports and no dependencies, so this file runs unchanged in Node
 *   (tests) and in a browser, and can later be inlined into a single-file app
 *   by stripping the leading `export` keywords.
 * - Parsing never throws on irregular data.  Irregularities are collected as
 *   warnings: see `HmtRelease.validate()`.
 */

/** Block labels recognised in a release, in the order given in CLAUDE.md. */
export const BLOCK_TYPES = [
  'cexversion', 'citelibrary', 'citecollections', 'citeproperties',
  'citedata', 'datamodels', 'ctscatalog', 'ctsdata', 'citerelationset',
];

/** Default location of the current release. */
export const DEFAULT_RELEASE_URL =
  'https://raw.githubusercontent.com/homermultitext/hmt-archive/refs/heads/master/releases-cex/hmt-current.cex';

/** Block types whose repeated blocks each start with the same header line. */
const FIXED_HEADER_TYPES = new Set(['citecollections', 'citeproperties', 'datamodels', 'ctscatalog']);

// ---------------------------------------------------------------------------
// Step 1: split text into labelled blocks
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Block
 * @property {string} type       Label without the `#!` prefix.
 * @property {number} startLine  1-based line number of the header line.
 * @property {string[]} lines    Data lines: comments and blank lines removed.
 */

/**
 * Split CEX text into blocks.  Lines starting with `//` and empty lines are
 * dropped.  Everything between a `#!` header line and the next belongs to the
 * first.
 * @param {string} text
 * @returns {{blocks: Block[], warnings: string[]}}
 */
export function splitBlocks(text) {
  /** @type {Block[]} */
  const blocks = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {Block | null} */
  let current = null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#!')) {
      const type = line.slice(2).trim();
      if (!BLOCK_TYPES.includes(type)) {
        warnings.push(`line ${i + 1}: unrecognized block type "${type}"`);
      }
      current = { type, startLine: i + 1, lines: [] };
      blocks.push(current);
      continue;
    }
    if (line.startsWith('//') || line.trim() === '') continue;
    if (current === null) {
      warnings.push(`line ${i + 1}: content before the first block header ignored`);
      continue;
    }
    current.lines.push(line);
  }
  return { blocks, warnings };
}

// ---------------------------------------------------------------------------
// URN helpers (CITE2 and CTS)
// ---------------------------------------------------------------------------

/** True for a collection-level CITE2 URN, e.g. `urn:cite2:hmt:e3pages.v1:`. */
export function isCollectionUrn(urn) {
  return /^urn:cite2:[^:]+:[^:]+:$/.test(urn);
}

/** Collection-level URN for an object URN, or null if `urn` is not CITE2. */
export function collectionOfObject(urn) {
  const m = /^(urn:cite2:[^:]+:[^:]+:)/.exec(urn);
  return m ? m[1] : null;
}

/**
 * Collection-level URN for a property-level URN, e.g.
 * `urn:cite2:citebl:burney86pages.v1.sequence:` gives
 * `urn:cite2:citebl:burney86pages.v1:`.  Null if not property-level.
 */
export function collectionOfProperty(urn) {
  const m = /^(urn:cite2:[^:]+:[^:]+)\.[^.:]+:$/.exec(urn);
  return m ? m[1] + ':' : null;
}

/** Property-level URN for a property name in a collection. */
export function propertyUrn(collectionUrn, name) {
  return collectionUrn.slice(0, -1) + '.' + name + ':';
}

/**
 * Work-component prefix of a CTS URN (`urn:cts:ns:group.work.version[.exemplar]:`),
 * which is version-level or exemplar-level depending on the URN.
 */
export function ctsWorkOf(urn) {
  const m = /^(urn:cts:[^:]+:[^:]+:)/.exec(urn);
  return m ? m[1] : null;
}

/** Version-level CTS URN (`urn:cts:ns:group.work.version:`): drops any exemplar part. */
export function ctsVersionOf(urn) {
  const m = /^(urn:cts:[^:]+:)([^:]+):/.exec(urn);
  return m ? m[1] + m[2].split('.').slice(0, 3).join('.') + ':' : null;
}

// ---------------------------------------------------------------------------
// Step 2: typed access
// ---------------------------------------------------------------------------

/**
 * Parse lines of delimited text into objects keyed by `fields`.  Rows with the
 * wrong number of values are still returned (padded or truncated); they are
 * reported through `warn` as one summary message per table.
 * @param {string[]} lines
 * @param {string[]} fields
 * @param {(msg: string) => void} warn
 * @param {string} label  used in warnings
 * @returns {Record<string, string>[]}
 */
function rowsToObjects(lines, fields, warn, label) {
  let ragged = 0;
  let firstBad = 0;
  const out = lines.map((line, i) => {
    const vals = line.split('|');
    if (vals.length !== fields.length) {
      if (!ragged) firstBad = i + 1;
      ragged++;
    }
    /** @type {Record<string, string>} */
    const obj = {};
    fields.forEach((f, j) => { obj[f] = vals[j] ?? ''; });
    return obj;
  });
  if (ragged) {
    warn(`${label}: ${ragged} of ${lines.length} rows do not have ${fields.length} values (first: row ${firstBad})`);
  }
  return out;
}

export class HmtRelease {
  /** @param {string} text  Full text of a CEX release. */
  constructor(text) {
    const { blocks, warnings } = splitBlocks(text);
    /** @type {Block[]} */
    this.blocks = blocks;
    /** @type {string[]} */
    this._warnings = [...warnings];
    /** @type {Map<string, any>} */
    this._cache = new Map();
  }

  /** @param {string} msg */
  _warn(msg) { if (!this._warnings.includes(msg)) this._warnings.push(msg); }

  /**
   * @template T
   * @param {string} key
   * @param {() => T} compute
   * @returns {T}
   */
  _memo(key, compute) {
    if (!this._cache.has(key)) this._cache.set(key, compute());
    return this._cache.get(key);
  }

  /** Block types actually present, in order of first appearance. */
  blockTypes() {
    return [...new Set(this.blocks.map(b => b.type))];
  }

  /**
   * Data lines of all blocks of one type, composited into a single array.
   * For types with one fixed header line (citecollections, citeproperties,
   * datamodels, ctscatalog) the first line of each repeated block is treated
   * as its header and dropped, so the result has a single header line at the
   * start.  For `citedata` and
   * `citerelationset` the composite is a plain concatenation; use `citeData()`
   * or `relationSets()` to get the per-block structure.
   * @param {string} type
   * @returns {string[]}
   */
  getBlock(type) {
    return this._memo('block:' + type, () => {
      const same = this.blocks.filter(b => b.type === type);
      if (!FIXED_HEADER_TYPES.has(type)) return same.flatMap(b => b.lines);
      /** @type {string[]} */
      const out = [];
      for (const b of same) {
        if (out.length === 0) { out.push(...b.lines); continue; }
        // Later blocks repeat the header line; drop it.
        if (b.lines[0] !== out[0]) {
          this._warn(`${type} (line ${b.startLine}): header "${b.lines[0]}" differs from first header "${out[0]}"`);
        }
        out.push(...b.lines.slice(1));
      }
      return out;
    });
  }

  /** The CEX version string, or null if absent. */
  get cexVersion() {
    const lines = this.getBlock('cexversion');
    if (this.blocks.filter(b => b.type === 'cexversion').length > 1) {
      this._warn('more than one #!cexversion block');
    }
    return lines.length ? lines[0].trim() : null;
  }

  /**
   * Library metadata from the `#!citelibrary` block.
   * @returns {{name: string, urn: string, license: string,
   *            namespaces: {abbreviation: string, uri: string}[]}}
   */
  get library() {
    return this._memo('library', () => {
      if (this.blocks.filter(b => b.type === 'citelibrary').length > 1) {
        this._warn('more than one #!citelibrary block');
      }
      const lib = { name: '', urn: '', license: '', namespaces: /** @type {{abbreviation: string, uri: string}[]} */ ([]) };
      for (const line of this.getBlock('citelibrary')) {
        const [key, ...rest] = line.split('|');
        if (key === 'namespace') {
          if (rest.length !== 2) this._warn(`citelibrary: malformed namespace line "${line}"`);
          lib.namespaces.push({ abbreviation: rest[0] ?? '', uri: rest[1] ?? '' });
        } else if (key === 'name' || key === 'urn' || key === 'license') {
          lib[key] = rest.join('|');
        } else {
          this._warn(`citelibrary: unrecognized key "${key}"`);
        }
      }
      return lib;
    });
  }

  /** @returns {{urn: string, description: string, labellingProperty: string, orderingProperty: string, license: string}[]} */
  collections() {
    return this._memo('collections', () => {
      const [, ...rows] = this.getBlock('citecollections');
      return /** @type {any} */ (rowsToObjects(rows,
        ['urn', 'description', 'labellingProperty', 'orderingProperty', 'license'],
        m => this._warn(m), 'citecollections'));
    });
  }

  /** @returns {{urn: string, label: string, type: string, authorityList: string}[]} */
  properties() {
    return this._memo('properties', () => {
      const [, ...rows] = this.getBlock('citeproperties');
      return /** @type {any} */ (rowsToObjects(rows,
        ['urn', 'label', 'type', 'authorityList'], m => this._warn(m), 'citeproperties'));
    });
  }

  /** @returns {{collection: string, model: string, label: string, description: string}[]} */
  dataModels() {
    return this._memo('datamodels', () => {
      const [, ...rows] = this.getBlock('datamodels');
      return /** @type {any} */ (rowsToObjects(rows,
        ['collection', 'model', 'label', 'description'], m => this._warn(m), 'datamodels'));
    });
  }

  /** @returns {Record<string, string>[]}  Keys: urn, citationScheme, groupName, workTitle, versionLabel, exemplarLabel, online, language. */
  ctsCatalog() {
    return this._memo('ctscatalog', () => {
      const [, ...rows] = this.getBlock('ctscatalog');
      return rowsToObjects(rows,
        ['urn', 'citationScheme', 'groupName', 'workTitle', 'versionLabel', 'exemplarLabel', 'online', 'language'],
        m => this._warn(m), 'ctscatalog');
    });
  }

  /**
   * Passages of all `#!ctsdata` blocks.  Each line is split at its first `|`.
   * @returns {{urn: string, text: string}[]}
   */
  ctsData() {
    return this._memo('ctsdata', () => {
      /** @type {{urn: string, text: string}[]} */
      const out = [];
      for (const line of this.getBlock('ctsdata')) {
        const i = line.indexOf('|');
        if (i < 0) { this._warn(`ctsdata: line without "|": "${line.slice(0, 60)}"`); continue; }
        if (line.indexOf('|', i + 1) >= 0) this._warn(`ctsdata: extra "|" in passage ${line.slice(0, i)}`);
        out.push({ urn: line.slice(0, i), text: line.slice(i + 1) });
      }
      return out;
    });
  }

  /**
   * Tables of all `#!citedata` blocks.  Each block has its own header.
   * `collections` lists the distinct collection URNs of the rows' `urn` values.
   * @returns {{header: string[], rows: Record<string, string>[], collections: string[], startLine: number}[]}
   */
  citeData() {
    return this._memo('citedata', () => this.blocks.filter(b => b.type === 'citedata').map(b => {
      const header = (b.lines[0] ?? '').split('|');
      const rows = rowsToObjects(b.lines.slice(1), header, m => this._warn(m), `citedata (line ${b.startLine})`);
      const cols = new Set();
      const urnField = header.find(h => h.toLowerCase() === 'urn');
      if (urnField !== undefined) {
        for (const r of rows) {
          const c = collectionOfObject(r[urnField]);
          if (c) cols.add(c);
        }
      } else if (b.lines.length) {
        this._warn(`citedata (line ${b.startLine}): no "urn" column, collection unknown`);
      }
      return { header, rows, collections: [...cols], startLine: b.startLine };
    }));
  }

  /**
   * Relation sets, one per `#!citerelationset` block: `urn` and `label`
   * key-value lines, then a header line, then rows.
   * @returns {{urn: string, label: string, header: string[], rows: Record<string, string>[], startLine: number}[]}
   */
  relationSets() {
    return this._memo('relationsets', () => this.blocks.filter(b => b.type === 'citerelationset').map(b => {
      let urn = '', label = '';
      let i = 0;
      for (; i < b.lines.length; i++) {
        const [key, ...rest] = b.lines[i].split('|');
        if (key === 'urn' && rest.length === 1 && !urn) urn = rest[0];
        else if (key === 'label' && !label) label = rest.join('|');
        else break;
      }
      if (!urn) this._warn(`citerelationset (line ${b.startLine}): no urn`);
      const header = (b.lines[i] ?? '').split('|');
      const rows = rowsToObjects(b.lines.slice(i + 1), header, m => this._warn(m), `citerelationset ${urn || b.startLine}`);
      return { urn, label, header, rows, startLine: b.startLine };
    }));
  }

  /**
   * Check the release for consistency.  Never throws; returns warnings
   * (including any irregularities noticed while parsing), empty if none.
   * @returns {string[]}
   */
  validate() {
    // Run every typed parser so their warnings are collected.
    this.cexVersion; this.library; this.ctsData();
    const collections = this.collections();
    const properties = this.properties();
    const models = this.dataModels();
    const catalog = this.ctsCatalog();
    const citeData = this.citeData();
    const relSets = this.relationSets();
    const warn = (/** @type {string} */ m) => this._warn(m);

    const collUrns = new Set(collections.map(c => c.urn));
    const propUrns = new Set(properties.map(p => p.urn));
    const propLower = new Set(properties.map(p => p.urn.toLowerCase()));

    for (const c of collections) {
      if (!isCollectionUrn(c.urn)) warn(`citecollections: "${c.urn}" is not a collection-level CITE2 URN`);
      if (!propUrns.has(c.labellingProperty)) {
        warn(`citecollections: labelling property "${c.labellingProperty}" of ${c.urn} is not documented in citeproperties`);
      }
      if (c.orderingProperty && !propUrns.has(c.orderingProperty)) {
        warn(`citecollections: ordering property "${c.orderingProperty}" of ${c.urn} is not documented in citeproperties`);
      }
    }
    for (const p of properties) {
      const c = collectionOfProperty(p.urn);
      if (!c) warn(`citeproperties: "${p.urn}" is not a property-level CITE2 URN`);
      else if (!collUrns.has(c)) warn(`citeproperties: collection ${c} of property ${p.urn} is not documented in citecollections`);
    }
    for (const t of citeData) {
      for (const c of t.collections) {
        if (!collUrns.has(c)) warn(`citedata (line ${t.startLine}): collection ${c} is not documented in citecollections`);
        const undocumented = t.header.filter(name => !propUrns.has(propertyUrn(c, name)))
          .map(name => propLower.has(propertyUrn(c, name).toLowerCase()) ? `${name} (documented with different capitalization)` : name);
        if (undocumented.length) {
          warn(`citedata (line ${t.startLine}): ${undocumented.length} of ${t.header.length} properties of ${c} not documented in citeproperties: ${undocumented.join(', ')}`);
        }
      }
    }
    for (const m of models) {
      if (!collUrns.has(m.collection) && !relSets.some(r => r.urn === m.collection)) {
        warn(`datamodels: ${m.collection} is neither a documented collection nor a relation set`);
      }
    }
    const modelled = new Set(models.map(m => m.collection));
    for (const r of relSets) {
      if (r.urn && !modelled.has(r.urn)) warn(`citerelationset: ${r.urn} has no entry in datamodels`);
    }
    const versions = new Set(catalog.map(c => c.urn));
    const missing = new Set();
    for (const p of this.ctsData()) {
      const w = ctsWorkOf(p.urn);
      const v = ctsVersionOf(p.urn);
      if (!(w && versions.has(w)) && !(v && versions.has(v))) missing.add(w ?? p.urn);
    }
    for (const v of missing) warn(`ctsdata: no ctscatalog entry for version ${v}`);

    return [...this._warnings];
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Parse release text. */
export function parseRelease(text) {
  return new HmtRelease(text);
}

/**
 * Fetch and parse a release.  Works when the page is served over http(s);
 * browsers block fetch from file:// pages, where apps should instead use
 * `readReleaseFile` with a file picker or drop target.
 * @param {string} [url]
 */
export async function fetchRelease(url = DEFAULT_RELEASE_URL) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Could not load ${url}: HTTP ${resp.status}`);
  return parseRelease(await resp.text());
}

/** Parse a release from a `File`/`Blob` (file picker or drag-and-drop). */
export async function readReleaseFile(file) {
  return parseRelease(await file.text());
}

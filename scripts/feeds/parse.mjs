import { parse as parseCsv } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";

/** Parse delimited text (CSV/TSV/pipe) into an array of row objects keyed by header. */
export function parseDelimited(text, { delimiter = "," } = {}) {
  return parseCsv(text, {
    columns: true,
    delimiter,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
}

/** Parse an XML feed and return an array of records found at `recordPath` (dot path). */
export function parseXml(text, { recordPath = "" } = {}) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
  const doc = parser.parse(text);
  let node = doc;
  for (const key of recordPath.split(".").filter(Boolean)) {
    node = node?.[key];
  }
  if (node == null) return [];
  return Array.isArray(node) ? node : [node];
}

/** Parse a JSON feed (scraper output): either an array, or { products: [...] }. */
export function parseJson(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

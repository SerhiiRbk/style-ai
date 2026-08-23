/** Shared rerank candidate shape — kept free of server-only so tests can import it. */

export type RerankCandidate = {
  id: string;
  brand: string | null;
  title: string;
  color: string | null;
  priceEur: number | null;
  category: string;
  subtype?: string | null;
  material?: string | null;
  fit?: string | null;
  pattern?: string | null;
};

export type RerankGarmentSlot = {
  slot: number;
  category: string;
  garment: string;
  color: string | null;
  clause: string;
  candidates: RerankCandidate[];
};

/** Three-to-four ingest tokens the model should trust over the title. */
export function formatRerankAttrs(c: RerankCandidate): string {
  return [c.subtype, c.material, c.fit, c.pattern].filter(Boolean).join("/");
}

export function formatRerankCandidate(idx: number, c: RerankCandidate): string {
  const brand = c.brand ? `${c.brand} ` : "";
  const price =
    c.priceEur != null && Number.isFinite(c.priceEur)
      ? ` · €${Math.round(c.priceEur)}`
      : "";
  const color = c.color?.trim() ? ` · colour ${c.color}` : "";
  const attrs = formatRerankAttrs(c);
  const attrBit = attrs ? ` · ${attrs}` : "";
  return `[${idx}] ${brand}${c.title}${color}${attrBit}${price}`;
}

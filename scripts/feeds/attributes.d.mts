export const ATTR_TYPING_VERSION: number;
export const GARMENT_SUBTYPES: string[];

export type ProductAttributeInput = {
  attrs?: {
    material?: string | null;
    fit?: string | null;
    pattern?: string | null;
    season?: string | null;
  } | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
};

export type ProductAttributes = {
  garment_subtype: string | null;
  material_family: string | null;
  fit: string | null;
  pattern: string | null;
  season: string | null;
};

export function parseProductAttributes(p: ProductAttributeInput): ProductAttributes;
export function normMaterial(text?: string | null): string | null;
export function normFit(text?: string | null): string | null;
export function normPattern(text?: string | null): string | null;
export function normSubtype(title?: string | null): string | null;
export function normSeason(attrsSeason?: string | null): string | null;

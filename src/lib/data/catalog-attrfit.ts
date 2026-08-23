import {
  normMaterial,
  normSubtype,
} from "../../../scripts/feeds/attributes.mjs";

export type AttrFitRow = {
  garment_subtype?: string | null;
  material_family?: string | null;
};

export function slotAttrs(
  garment: string,
  clause?: string | null,
): { subtype: string | null; material: string | null } {
  return {
    subtype: normSubtype(clause || garment) ?? normSubtype(garment) ?? null,
    material: normMaterial(clause || "") ?? normMaterial(garment) ?? null,
  };
}

export function attrFitScore(
  row: AttrFitRow,
  slot: { subtype: string | null; material: string | null },
  garmentScore = 0,
): number {
  let s = 0;
  if (slot.subtype && row.garment_subtype && garmentScore < 0.5) {
    s += row.garment_subtype === slot.subtype ? 0.1 : 0;
  }
  if (slot.material && row.material_family) {
    s += row.material_family === slot.material ? 0.06 : 0;
  }
  return s;
}

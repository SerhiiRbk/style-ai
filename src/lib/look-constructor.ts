import { decomposeLook } from "@/lib/style-extras";

/** One editable garment slot in the look constructor. */
export type ConstructorSlot = {
  category: string;
  garment: string;
  color: string;
};

export type ConstructorTypeOption = {
  id: string;
  label: string;
};

export type ConstructorColorOption = {
  id: string;
  label: string;
  hex: string;
};

/** Type choices stay inside the slot's catalogue category. */
export const CONSTRUCTOR_TYPES: Record<string, ConstructorTypeOption[]> = {
  Outerwear: [
    { id: "blazer", label: "Blazer" },
    { id: "coat", label: "Coat" },
    { id: "overshirt", label: "Overshirt" },
    { id: "bomber", label: "Bomber" },
    { id: "trench", label: "Trench" },
  ],
  Knitwear: [
    { id: "crewneck", label: "Crewneck" },
    { id: "cardigan", label: "Cardigan" },
    { id: "turtleneck", label: "Turtleneck" },
  ],
  Shirts: [
    { id: "shirt", label: "Shirt" },
    { id: "oxford", label: "Oxford" },
    { id: "polo", label: "Polo" },
    { id: "tee", label: "Tee" },
    { id: "henley", label: "Henley" },
  ],
  Trousers: [
    { id: "trousers", label: "Trousers" },
    { id: "chinos", label: "Chinos" },
    { id: "jeans", label: "Jeans" },
  ],
  Footwear: [
    { id: "loafers", label: "Loafers" },
    { id: "sneakers", label: "Sneakers" },
    { id: "boots", label: "Boots" },
    { id: "derbies", label: "Derbies" },
  ],
  Accessories: [
    { id: "belt", label: "Belt" },
    { id: "watch", label: "Watch" },
    { id: "tie", label: "Tie" },
    { id: "scarf", label: "Scarf" },
    { id: "sunglasses", label: "Sunglasses" },
  ],
};

/** Named colours the constructor can paint onto a glyph and the look brief. */
export const CONSTRUCTOR_COLORS: ConstructorColorOption[] = [
  { id: "navy", label: "Navy", hex: "#1B2A4A" },
  { id: "teal", label: "Teal", hex: "#2A6B73" },
  { id: "sky", label: "Sky", hex: "#7BA3C9" },
  { id: "blue", label: "Blue", hex: "#3D5A80" },
  { id: "sage", label: "Sage", hex: "#9AA588" },
  { id: "olive", label: "Olive", hex: "#6B6B47" },
  { id: "green", label: "Green", hex: "#3F6B4A" },
  { id: "charcoal", label: "Charcoal", hex: "#3A3A3A" },
  { id: "grey", label: "Grey", hex: "#8A8A86" },
  { id: "dove", label: "Dove", hex: "#C5C1B8" },
  { id: "black", label: "Black", hex: "#1A1A1A" },
  { id: "white", label: "White", hex: "#F4F1EA" },
  { id: "cream", label: "Cream", hex: "#E8DCC8" },
  { id: "ivory", label: "Ivory", hex: "#F3EDE0" },
  { id: "camel", label: "Camel", hex: "#C4A574" },
  { id: "stone", label: "Stone", hex: "#C2B8A8" },
  { id: "beige", label: "Beige", hex: "#D4C4A8" },
  { id: "sand", label: "Sand", hex: "#D9C7A3" },
  { id: "khaki", label: "Khaki", hex: "#9A8B5C" },
  { id: "brown", label: "Brown", hex: "#6B4A2F" },
  { id: "burgundy", label: "Burgundy", hex: "#6B2D3C" },
  { id: "rust", label: "Rust", hex: "#B85C38" },
  { id: "red", label: "Red", hex: "#8B2E2E" },
];

const COLOR_BY_ID = new Map(CONSTRUCTOR_COLORS.map((c) => [c.id, c]));

/** Map parsed garment keywords onto the constructor's type ids. */
const CANONICAL_GARMENT: Record<string, string> = {
  jacket: "blazer",
  overcoat: "coat",
  peacoat: "coat",
  parka: "coat",
  shacket: "overshirt",
  sweater: "crewneck",
  knit: "crewneck",
  jumper: "crewneck",
  pullover: "crewneck",
  hoodie: "crewneck",
  vest: "cardigan",
  rollneck: "turtleneck",
  chino: "chinos",
  pants: "trousers",
  slacks: "trousers",
  denim: "jeans",
  loafer: "loafers",
  sneaker: "sneakers",
  trainers: "sneakers",
  trainer: "sneakers",
  boot: "boots",
  chelsea: "boots",
  derby: "derbies",
  oxfords: "derbies",
  brogues: "derbies",
  shoes: "loafers",
  sandals: "loafers",
};

function lastColorToken(color: string | null): string {
  if (!color) return "";
  const words = color.toLowerCase().split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!;
    if (COLOR_BY_ID.has(w)) return w;
  }
  return words[words.length - 1] ?? "";
}

export function canonicalGarment(raw: string, category: string): string {
  const key = raw.toLowerCase().trim();
  const mapped = CANONICAL_GARMENT[key] ?? key;
  const allowed = CONSTRUCTOR_TYPES[category];
  if (allowed?.some((t) => t.id === mapped)) return mapped;
  return mapped;
}

export function colorHex(colorId: string): string {
  return COLOR_BY_ID.get(colorId)?.hex ?? "#8A8A86";
}

export function colorLabel(colorId: string): string {
  return COLOR_BY_ID.get(colorId)?.label ?? colorId;
}

export function typeLabel(category: string, garment: string): string {
  const found = CONSTRUCTOR_TYPES[category]?.find((t) => t.id === garment);
  if (found) return found.label;
  return garment.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function typesForSlot(
  category: string,
  currentGarment: string,
): ConstructorTypeOption[] {
  const base = CONSTRUCTOR_TYPES[category] ?? [];
  if (base.some((t) => t.id === currentGarment)) return base;
  return [{ id: currentGarment, label: typeLabel(category, currentGarment) }, ...base];
}

export function colorsForSlot(currentColor: string): ConstructorColorOption[] {
  if (!currentColor || COLOR_BY_ID.has(currentColor)) return CONSTRUCTOR_COLORS;
  return [
    { id: currentColor, label: colorLabel(currentColor), hex: colorHex(currentColor) },
    ...CONSTRUCTOR_COLORS,
  ];
}

export function isAllowedConstructorSlot(slot: ConstructorSlot): boolean {
  if (!slot.category || !slot.garment) return false;
  const types = CONSTRUCTOR_TYPES[slot.category];
  if (!types) return false;
  const typeOk =
    types.some((t) => t.id === slot.garment) || Boolean(slot.garment.trim());
  const colorOk = !slot.color || COLOR_BY_ID.has(slot.color) || slot.color.length <= 24;
  return typeOk && colorOk;
}

/** Build the look description the image model will render. */
export function composeLookDescription(slots: ConstructorSlot[]): string {
  return slots
    .map((s) => {
      const type = typeLabel(s.category, s.garment).toLowerCase();
      return s.color ? `${s.color} ${type}` : type;
    })
    .join(", ");
}

export function composeLookPalette(slots: ConstructorSlot[]): string[] {
  const seen = new Set<string>();
  const hexes: string[] = [];
  for (const s of slots) {
    const hex = colorHex(s.color);
    if (seen.has(hex)) continue;
    seen.add(hex);
    hexes.push(hex);
  }
  return hexes;
}

/** Parse a look brief into constructor slots (description is the source of truth). */
export function slotsFromLook(title: string, description: string): ConstructorSlot[] {
  const garments = decomposeLook([title, description].filter(Boolean).join(", "));
  const seen = new Set<string>();
  const slots: ConstructorSlot[] = [];
  for (const g of garments) {
    const garment = canonicalGarment(g.garment, g.category);
    const color = lastColorToken(g.color);
    const key = `${g.category}:${garment}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ category: g.category, garment, color });
  }
  return slots;
}

export function slotsEqual(a: ConstructorSlot[], b: ConstructorSlot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (s, i) =>
      s.category === b[i]?.category &&
      s.garment === b[i]?.garment &&
      s.color === b[i]?.color,
  );
}

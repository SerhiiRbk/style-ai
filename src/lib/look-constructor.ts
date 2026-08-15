import { decomposeLook } from "@/lib/style-extras";

/** One editable garment slot in the look constructor. */
export type ConstructorSlot = {
  category: string;
  garment: string;
  color: string;
  /** Accessories can be turned off without deleting the slot. Default on. */
  on?: boolean;
  /** Eyewear frame shape (round, wayfarer, …). Ignored for other garments. */
  shape?: string;
  /** Shirt / tee hem: tucked into the trousers, or worn untucked. */
  tuck?: "in" | "out";
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
    { id: "hiking", label: "Hiking boots" },
    { id: "derbies", label: "Derbies" },
    { id: "sandals", label: "Sandals" },
  ],
  Accessories: [
    { id: "belt", label: "Belt" },
    { id: "watch", label: "Watch" },
    { id: "tie", label: "Tie" },
    { id: "scarf", label: "Scarf" },
    { id: "sunglasses", label: "Sunglasses" },
    { id: "glasses", label: "Glasses" },
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
  { id: "plum", label: "Plum", hex: "#7A6577" },
  { id: "rose", label: "Rose", hex: "#C29AA0" },
  { id: "rust", label: "Rust", hex: "#B85C38" },
  { id: "red", label: "Red", hex: "#8B2E2E" },
  { id: "greige", label: "Greige", hex: "#DAD3C6" },
  { id: "mushroom", label: "Mushroom", hex: "#A99C8C" },
  { id: "taupe", label: "Taupe", hex: "#B49C7E" },
];

/** Sunglasses-only swatch: frame stays dark, lenses render as a mirror finish. */
export const MIRROR_COLOR: ConstructorColorOption = {
  id: "mirrored",
  label: "Mirrored",
  hex: "#9EC4D4",
};

const COLOR_BY_ID = new Map(
  [...CONSTRUCTOR_COLORS, MIRROR_COLOR].map((c) => [c.id, c]),
);

/** Tokens from look briefs that map onto a constructor colour id. */
const COLOR_ALIASES: Record<string, string> = {
  slateblue: "sky",
  powderblue: "sky",
  iceblue: "sky",
  steelblue: "blue",
  purple: "plum",
  mauve: "plum",
  aubergine: "plum",
  mirror: "mirrored",
};

const SHADE_ONLY = new Set([
  "soft",
  "muted",
  "light",
  "pale",
  "dusty",
  "dark",
  "deep",
  "mid",
  "medium",
  "midtone",
  "off",
]);

function lastColorToken(color: string | null): string {
  if (!color) return "";
  const words = color.toLowerCase().split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!;
    const mapped = COLOR_ALIASES[w] ?? w;
    if (COLOR_BY_ID.has(mapped)) return mapped;
  }
  // A bare shade ("soft", "muted") is not a colour — using it as an id
  // paints the glyph default grey, as if the garment had no colour.
  const last = words[words.length - 1] ?? "";
  if (SHADE_ONLY.has(last)) return "";
  return last;
}

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
  "oxford shoes": "derbies",
  "oxford shoe": "derbies",
  brogues: "derbies",
  chukka: "boots",
  hiking: "hiking",
  "hiking boots": "hiking",
  trail: "hiking",
  "trail boots": "hiking",
  trek: "hiking",
  shoes: "loafers",
  sandal: "sandals",
  sandals: "sandals",
  glasses: "glasses",
  eyeglasses: "glasses",
  spectacles: "glasses",
  goggles: "sunglasses",
  "ski goggles": "sunglasses",
  "sport glasses": "sunglasses",
};

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

export function colorsForSlot(
  currentColor: string,
  garment?: string,
): ConstructorColorOption[] {
  const base =
    garment === "sunglasses"
      ? [...CONSTRUCTOR_COLORS, MIRROR_COLOR]
      : CONSTRUCTOR_COLORS;
  if (!currentColor || base.some((c) => c.id === currentColor)) return base;
  return [
    { id: currentColor, label: colorLabel(currentColor), hex: colorHex(currentColor) },
    ...base,
  ];
}

export function isSlotEnabled(slot: ConstructorSlot): boolean {
  return slot.on !== false;
}

export function isEyewear(garment: string): boolean {
  return garment === "sunglasses" || garment === "glasses";
}

const TUCKABLE = new Set(["shirt", "oxford", "tee", "polo", "henley"]);

export function isTuckable(garment: string): boolean {
  return TUCKABLE.has(garment);
}

export const TUCK_OPTIONS: ConstructorTypeOption[] = [
  { id: "in", label: "Tucked in" },
  { id: "out", label: "Untucked" },
];

export function tuckLabel(tuck?: string): string {
  return TUCK_OPTIONS.find((t) => t.id === tuck)?.label ?? "";
}

export function canonicalTuck(raw: string): "in" | "out" | "" {
  const t = raw.toLowerCase();
  if (/\buntuck/.test(t) || /\bworn\s+out\b/.test(t) || /\bhanging\s+out\b/.test(t)) {
    return "out";
  }
  if (/\btucked(?:\s+in)?\b/.test(t) || /\btuck(?:ed)?\s+in\b/.test(t)) {
    return "in";
  }
  return "";
}

/** Sunglasses shapes. Legacy `ski` slots coerce to sport. */
export const SUNGLASSES_SHAPES: ConstructorTypeOption[] = [
  { id: "round", label: "Round" },
  { id: "wayfarer", label: "Wayfarer" },
  { id: "aviator", label: "Aviator" },
  { id: "rectangle", label: "Rectangular" },
  { id: "geometric", label: "Geometric" },
  { id: "oval", label: "Oval" },
  { id: "sport", label: "Sport" },
];

/** Optical glasses shapes. */
export const GLASSES_SHAPES: ConstructorTypeOption[] = [
  { id: "round", label: "Round" },
  { id: "rectangle", label: "Rectangular" },
  { id: "oval", label: "Oval" },
  { id: "geometric", label: "Geometric" },
  { id: "rimless", label: "Rimless" },
];

const ALL_EYEWEAR_SHAPES = [...SUNGLASSES_SHAPES, ...GLASSES_SHAPES];

export function shapesForEyewear(garment: string): ConstructorTypeOption[] {
  if (garment === "glasses") return GLASSES_SHAPES;
  if (garment === "sunglasses") return SUNGLASSES_SHAPES;
  return [];
}

export function defaultEyewearShape(garment: string): string {
  return garment === "glasses" ? "round" : "wayfarer";
}

export function coerceEyewearShape(garment: string, shape?: string): string {
  const allowed = new Set(shapesForEyewear(garment).map((s) => s.id));
  const id = shape === "ski" ? "sport" : shape;
  if (id && allowed.has(id)) return id;
  return defaultEyewearShape(garment);
}

export function shapeLabel(shape: string): string {
  return ALL_EYEWEAR_SHAPES.find((s) => s.id === shape)?.label ?? shape;
}

export function canonicalEyewearShape(raw: string, garment?: string): string {
  const t = raw.toLowerCase();
  let id = "";
  if (
    /\bski\b/.test(t) ||
    /\bwraparound\b/.test(t) ||
    /\bsport(?:\s+glasses)?\b/.test(t) ||
    (/\bgoggles?\b/.test(t) && !/\brimless\b/.test(t))
  ) {
    id = "sport";
  } else if (/\brimless\b|\bframeless\b/.test(t)) id = "rimless";
  else if (/\bwayfarer\b/.test(t)) id = "wayfarer";
  else if (/\baviator\b/.test(t) || /\bnavigator\b/.test(t)) id = "aviator";
  else if (/\boval\b/.test(t)) id = "oval";
  else if (/\brectang/.test(t) || /\bsquare\b/.test(t)) id = "rectangle";
  else if (/\bgeometric\b|\bbrowline\b|\bclubmaster\b/.test(t)) id = "geometric";
  else if (/\bround\b/.test(t)) id = "round";
  if (!id) return "";
  if (garment) return coerceEyewearShape(garment, id) === id ? id : "";
  return id;
}

function eyewearBrief(slot: ConstructorSlot): string {
  const mirrored = slot.color === "mirrored";
  const color = !mirrored && slot.color ? `${slot.color} ` : "";
  const lenses = mirrored ? " with mirrored lenses" : "";
  const shape = slot.shape || "";
  if (slot.garment === "sunglasses") {
    if (shape === "sport") {
      return `${color}wraparound sport sunglasses${lenses} worn on the face`;
    }
    const named = shape ? `${shapeLabel(shape).toLowerCase()} ` : "";
    return `${color}${named}sunglasses${lenses} worn on the face`;
  }
  if (shape === "rimless") {
    return `${color}rimless glasses worn on the face (lenses mounted to bridge/temples, no surrounding frame)`;
  }
  const named = shape ? `${shapeLabel(shape).toLowerCase()} ` : "";
  return `${color}${named}glasses worn on the face`;
}

/** Prompt override so face-lock on the reference photo cannot drop listed eyewear. */
export function eyewearPromptDirective(description: string): string {
  if (!/\bsunglasses\b|\bglasses\b|\bgoggles\b|\beyewear\b/i.test(description)) {
    return "";
  }
  const mirrored = /\bmirrored\b/i.test(description)
    ? `If the outfit names mirrored lenses, the sunglasses lenses are a reflective ` +
      `mirror finish (silver, chrome or coloured flash) — not a flat dark tint. `
    : "";
  return (
    `CRITICAL eyewear: the outfit lists sunglasses, glasses or goggles — they MUST ` +
    `be clearly visible on this person's face, resting on the nose over the eyes, ` +
    `in the named frame. Adding listed eyewear is required clothing, not an identity ` +
    `change: copy the face from the reference, THEN put the eyewear on that face. ` +
    `A bare face with the eyewear omitted is wrong. ` +
    mirrored
  );
}

/** Prompt override so tucked / untucked shirts render as specified. */
export function tuckPromptDirective(description: string): string {
  const tuck = canonicalTuck(description);
  if (!tuck) return "";
  if (tuck === "in") {
    return (
      `CRITICAL hem: a shirt, oxford, tee, polo or henley listed as tucked in ` +
      `has its hem inside the waistband of the trousers — not hanging over the belt. `
    );
  }
  return (
    `CRITICAL hem: a shirt, oxford, tee, polo or henley listed as worn untucked ` +
    `hangs over the trousers — do not tuck it in. `
  );
}

export const MAX_ACCESSORY_SLOTS = 3;

export function nextAccessorySlot(
  slots: ConstructorSlot[],
): ConstructorSlot | null {
  const used = new Set(
    slots.filter((s) => s.category === "Accessories").map((s) => s.garment),
  );
  const next = CONSTRUCTOR_TYPES.Accessories.find((t) => !used.has(t.id));
  if (!next) return null;
  return {
    category: "Accessories",
    garment: next.id,
    color: "black",
    on: true,
    ...(isEyewear(next.id)
      ? { shape: defaultEyewearShape(next.id) }
      : {}),
  };
}

export function isAllowedConstructorSlot(slot: ConstructorSlot): boolean {
  if (!slot.category || !slot.garment) return false;
  const types = CONSTRUCTOR_TYPES[slot.category];
  if (!types) return false;
  const typeOk =
    types.some((t) => t.id === slot.garment) || Boolean(slot.garment.trim());
  const colorOk = !slot.color || COLOR_BY_ID.has(slot.color) || slot.color.length <= 24;
  const shapeOk =
    !slot.shape ||
    !isEyewear(slot.garment) ||
    shapesForEyewear(slot.garment).some(
      (s) => s.id === coerceEyewearShape(slot.garment, slot.shape),
    );
  const tuckOk =
    !slot.tuck ||
    (isTuckable(slot.garment) && (slot.tuck === "in" || slot.tuck === "out"));
  return typeOk && colorOk && shapeOk && tuckOk;
}

/** Build the look description the image model will render. */
export function composeLookDescription(slots: ConstructorSlot[]): string {
  return slots
    .filter(isSlotEnabled)
    .map((s) => {
      if (isEyewear(s.garment)) {
        return eyewearBrief(s);
      }
      const type = typeLabel(s.category, s.garment).toLowerCase();
      const base = s.color ? `${s.color} ${type}` : type;
      if (isTuckable(s.garment) && s.tuck === "in") {
        return `${base} tucked in`;
      }
      if (isTuckable(s.garment) && s.tuck === "out") {
        return `${base} worn untucked`;
      }
      return base;
    })
    .join(", ");
}

export function composeLookPalette(slots: ConstructorSlot[]): string[] {
  const seen = new Set<string>();
  const hexes: string[] = [];
  for (const s of slots.filter(isSlotEnabled)) {
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
    const parsed = isEyewear(garment)
      ? canonicalEyewearShape(g.clause, garment)
      : "";
    const shape = parsed ? coerceEyewearShape(garment, parsed) : "";
    const tuck = isTuckable(garment) ? canonicalTuck(g.clause) : "";
    slots.push({
      category: g.category,
      garment,
      color,
      ...(shape ? { shape } : {}),
      ...(tuck ? { tuck } : {}),
    });
  }
  // Every look needs a footwear slot so colour/style can be edited even when
  // the brief named "oxford shoes" (which used to parse as a shirt) or omitted
  // shoes entirely.
  if (!slots.some((s) => s.category === "Footwear")) {
    const color =
      slots.map((s) => s.color).find((c) =>
        ["charcoal", "brown", "navy", "black", "grey", "stone"].includes(c),
      ) ?? "charcoal";
    slots.push({ category: "Footwear", garment: "derbies", color });
  }
  if (!slots.some((s) => s.category === "Accessories")) {
    slots.push({
      category: "Accessories",
      garment: "sunglasses",
      color: "black",
      shape: "wayfarer",
      on: false,
    });
  }
  return slots;
}

export function slotsEqual(a: ConstructorSlot[], b: ConstructorSlot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (s, i) =>
      s.category === b[i]?.category &&
      s.garment === b[i]?.garment &&
      s.color === b[i]?.color &&
      (s.shape || "") === (b[i]?.shape || "") &&
      (s.tuck || "") === (b[i]?.tuck || "") &&
      isSlotEnabled(s) === isSlotEnabled(b[i]!),
  );
}

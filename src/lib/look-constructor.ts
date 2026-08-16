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
  /** Sunglasses lens tint. Optical glasses stay clear — no lens colour. */
  lensColor?: string;
  /** Shirt / tee hem: tucked into the trousers, or worn untucked. */
  tuck?: "in" | "out";
  /** Necktie cut: classic, grenadine, knitted, skinny, bow, bolo. */
  tieType?: string;
  /** Headwear cut: baseball, fedora, beanie, … */
  hatType?: string;
  /** Cloth / leather / wool on jacket, blazer, trench; leather / suede / nubuck on shoes. */
  material?: string;
  /** Blazer cut: single-breasted, double-breasted, unstructured. */
  blazerType?: string;
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
    { id: "jacket", label: "Jacket" },
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
    { id: "shorts", label: "Shorts" },
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
    { id: "neckerchief", label: "Neck scarf" },
    { id: "pocket square", label: "Pocket square" },
    { id: "sunglasses", label: "Sunglasses" },
    { id: "glasses", label: "Glasses" },
    { id: "hat", label: "Hat" },
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
  { id: "lightbrown", label: "Light brown", hex: "#A3784F" },
  { id: "brown", label: "Brown", hex: "#6B4A2F" },
  { id: "darkbrown", label: "Dark brown", hex: "#3A2416" },
  { id: "burgundy", label: "Burgundy", hex: "#6B2D3C" },
  { id: "plum", label: "Plum", hex: "#7A6577" },
  { id: "rose", label: "Rose", hex: "#C29AA0" },
  { id: "rust", label: "Rust", hex: "#B85C38" },
  { id: "red", label: "Red", hex: "#8B2E2E" },
  { id: "greige", label: "Greige", hex: "#DAD3C6" },
  { id: "mushroom", label: "Mushroom", hex: "#A99C8C" },
  { id: "taupe", label: "Taupe", hex: "#B49C7E" },
];

/** Sunglasses frame finishes that are not ordinary cloth colours. */
export const FRAME_FINISHES: ConstructorColorOption[] = [
  { id: "gold", label: "Gold", hex: "#C9A227" },
  { id: "silver", label: "Silver", hex: "#C0C4C8" },
  { id: "tortoise", label: "Tortoise", hex: "#6B3A1F" },
];

/** Sunglasses lens tints. Optical glasses stay clear. */
export const LENS_COLORS: ConstructorColorOption[] = [
  { id: "grey", label: "Grey", hex: "#4A4A4A" },
  { id: "brown", label: "Brown", hex: "#5C3A1E" },
  { id: "green", label: "Green", hex: "#3D5C3A" },
  { id: "blue", label: "Blue", hex: "#2A4A6B" },
  { id: "amber", label: "Amber", hex: "#C47A2A" },
  { id: "black", label: "Black", hex: "#1A1A1A" },
  { id: "mirrored", label: "Mirrored", hex: "#9EC4D4" },
];

const COLOR_BY_ID = new Map(
  [...CONSTRUCTOR_COLORS, ...FRAME_FINISHES].map((c) => [c.id, c]),
);

const LENS_BY_ID = new Map(LENS_COLORS.map((c) => [c.id, c]));

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
  golden: "gold",
  gilt: "gold",
  chrome: "silver",
  steel: "silver",
  tortoiseshell: "tortoise",
  havana: "tortoise",
  tan: "lightbrown",
  cognac: "brown",
  chocolate: "darkbrown",
  espresso: "darkbrown",
  chestnut: "brown",
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

export function isCustomHex(color?: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color ?? "");
}

export function normalizeHex(color?: string): string | null {
  const m = (color ?? "").trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1]!.toLowerCase()}` : null;
}

/** Snap an exact named-swatch hex back to its id; otherwise keep the custom hex. */
export function coerceConstructorColor(raw: string): string {
  const hex = normalizeHex(raw);
  if (!hex) return raw.trim().toLowerCase();
  const named = [...CONSTRUCTOR_COLORS, ...FRAME_FINISHES].find(
    (c) => c.hex.toLowerCase() === hex,
  );
  return named?.id ?? hex;
}

function lastColorToken(color: string | null): string {
  if (!color) return "";
  const hex = color.match(/#([0-9a-f]{6})\b/i);
  if (hex) return `#${hex[1]!.toLowerCase()}`;
  const words = color
    .toLowerCase()
    .replace(/light[\s-]+brown/g, "lightbrown")
    .replace(/dark[\s-]+brown/g, "darkbrown")
    .split(/\s+/)
    .filter(Boolean);
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
  jacket: "jacket",
  "field jacket": "jacket",
  "suit jacket": "blazer",
  "sport coat": "blazer",
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
  shorts: "shorts",
  short: "shorts",
  bermuda: "shorts",
  bermudas: "shorts",
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
  necktie: "tie",
  bowtie: "tie",
  "bow tie": "tie",
  bolo: "tie",
  "bolo tie": "tie",
  "pocket square": "pocket square",
  pochette: "pocket square",
  handkerchief: "pocket square",
  neckerchief: "neckerchief",
  "neck scarf": "neckerchief",
  "neck-scarf": "neckerchief",
  bandana: "neckerchief",
  foulard: "neckerchief",
  cap: "hat",
  hat: "hat",
  beanie: "hat",
  fedora: "hat",
  trilby: "hat",
  borsalino: "hat",
  boater: "hat",
  bucket: "hat",
  panama: "hat",
  "bucket hat": "hat",
  "panama hat": "hat",
  "baseball cap": "hat",
  baseball: "hat",
  kartuz: "hat",
  kepi: "hat",
  "peaked cap": "hat",
  "cowboy hat": "hat",
  cowboy: "hat",
  newsboy: "hat",
  "newsboy cap": "hat",
  "flat cap": "hat",
  "fisherman beanie": "hat",
  "slouch beanie": "hat",
};

export function canonicalGarment(raw: string, category: string): string {
  const key = raw.toLowerCase().trim();
  const mapped = CANONICAL_GARMENT[key] ?? key;
  const allowed = CONSTRUCTOR_TYPES[category];
  if (allowed?.some((t) => t.id === mapped)) return mapped;
  return mapped;
}

export function colorHex(colorId: string): string {
  if (isCustomHex(colorId)) return colorId.toLowerCase();
  return COLOR_BY_ID.get(colorId)?.hex ?? LENS_BY_ID.get(colorId)?.hex ?? "#8A8A86";
}

export function lensColorHex(lensColor: string): string {
  return LENS_BY_ID.get(lensColor)?.hex ?? colorHex(lensColor);
}

export function colorLabel(colorId: string): string {
  if (isCustomHex(colorId)) return "Custom";
  return COLOR_BY_ID.get(colorId)?.label ?? colorId;
}

function colorBriefPrefix(color?: string): string {
  if (!color || color === "mirrored") return "";
  if (color === "lightbrown") return "light brown ";
  if (color === "darkbrown") return "dark brown ";
  return `${color} `;
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
      ? [...CONSTRUCTOR_COLORS, ...FRAME_FINISHES]
      : CONSTRUCTOR_COLORS;
  if (
    !currentColor ||
    base.some((c) => c.id === currentColor) ||
    isCustomHex(currentColor)
  ) {
    return base;
  }
  return [
    { id: currentColor, label: colorLabel(currentColor), hex: colorHex(currentColor) },
    ...base,
  ];
}

export function lensColorsForSlot(currentLens?: string): ConstructorColorOption[] {
  if (!currentLens || LENS_BY_ID.has(currentLens)) return LENS_COLORS;
  return [
    {
      id: currentLens,
      label: lensColorLabel(currentLens),
      hex: colorHex(currentLens),
    },
    ...LENS_COLORS,
  ];
}

export function defaultLensColor(): string {
  return "grey";
}

export function coerceLensColor(lensColor?: string): string {
  if (lensColor && LENS_BY_ID.has(lensColor)) return lensColor;
  return defaultLensColor();
}

export function lensColorLabel(lensColor?: string): string {
  return LENS_BY_ID.get(lensColor ?? "")?.label ?? lensColor ?? "";
}

export function canonicalLensColor(raw: string): string {
  const t = raw.toLowerCase();
  if (/\bmirrored\b|\bmirror(?:ed)?\s+lenses?\b/.test(t)) return "mirrored";
  if (/\b(?:g-?15|green)\s+lenses?\b/.test(t) || /\bgreen-tinted\b/.test(t)) {
    return "green";
  }
  if (/\bamber\s+lenses?\b|\byellow\s+lenses?\b/.test(t)) return "amber";
  if (/\bbrown\s+lenses?\b|\bamber-brown\s+lenses?\b/.test(t)) return "brown";
  if (/\b(?:grey|gray|smoke)\s+lenses?\b/.test(t)) return "grey";
  if (/\bblue\s+lenses?\b/.test(t)) return "blue";
  if (/\b(?:black|dark)\s+lenses?\b/.test(t)) return "black";
  const named = t.match(/\bwith\s+([a-z]+)\s+lenses?\b/);
  if (named?.[1]) {
    const mapped = COLOR_ALIASES[named[1]] ?? named[1];
    if (LENS_BY_ID.has(mapped)) return mapped;
  }
  return "";
}

export function isSlotEnabled(slot: ConstructorSlot): boolean {
  return slot.on !== false;
}

export function isEyewear(garment: string): boolean {
  return garment === "sunglasses" || garment === "glasses";
}

export function isSunglasses(garment: string): boolean {
  return garment === "sunglasses";
}

export function isTie(garment: string): boolean {
  return garment === "tie";
}

export function isHat(garment: string): boolean {
  return garment === "hat";
}

export function isSneaker(garment: string): boolean {
  return garment === "sneakers";
}

export function isFootwear(category: string): boolean {
  return category === "Footwear";
}

/** Jacket, blazer and trench can pick cloth / leather / wool. */
export function isFabricOuterwear(garment: string): boolean {
  return garment === "jacket" || garment === "blazer" || garment === "trench";
}

export function isBlazer(garment: string): boolean {
  return garment === "blazer";
}

export const OUTERWEAR_FABRICS: ConstructorTypeOption[] = [
  { id: "cloth", label: "Cloth" },
  { id: "leather", label: "Leather" },
  { id: "wool", label: "Wool" },
];

export const SHOE_MATERIALS: ConstructorTypeOption[] = [
  { id: "leather", label: "Leather" },
  { id: "suede", label: "Suede" },
  { id: "nubuck", label: "Nubuck" },
];

export const BLAZER_TYPES: ConstructorTypeOption[] = [
  { id: "single", label: "Single-breasted" },
  { id: "double", label: "Double-breasted" },
  { id: "unstructured", label: "Unstructured" },
];

export function defaultOuterwearFabric(garment: string): string {
  return garment === "blazer" ? "wool" : "cloth";
}

export function defaultShoeMaterial(): string {
  return "leather";
}

export function defaultBlazerType(): string {
  return "single";
}

export function coerceOuterwearFabric(garment: string, material?: string): string {
  if (material && OUTERWEAR_FABRICS.some((f) => f.id === material)) return material;
  return defaultOuterwearFabric(garment);
}

export function coerceShoeMaterial(material?: string): string {
  if (material && SHOE_MATERIALS.some((f) => f.id === material)) return material;
  return defaultShoeMaterial();
}

export function coerceBlazerType(blazerType?: string): string {
  if (blazerType && BLAZER_TYPES.some((t) => t.id === blazerType)) return blazerType;
  return defaultBlazerType();
}

export function materialLabel(material?: string): string {
  return (
    OUTERWEAR_FABRICS.find((f) => f.id === material)?.label ??
    SHOE_MATERIALS.find((f) => f.id === material)?.label ??
    material ??
    ""
  );
}

export function blazerTypeLabel(blazerType?: string): string {
  return BLAZER_TYPES.find((t) => t.id === blazerType)?.label ?? "";
}

export function canonicalOuterwearFabric(raw: string): string {
  const t = raw.toLowerCase();
  if (/\bleather\b|\blambskin\b|\bcalfskin\b/.test(t)) return "leather";
  if (/\bwool\b|\bmerino\b|\bcashmere\b|\bflannel\b|\btweed\b|\bworse/.test(t)) {
    return "wool";
  }
  if (/\bcloth\b|\bcotton\b|\bgabardine\b|\btwill\b|\bcanvas\b|\blinen\b/.test(t)) {
    return "cloth";
  }
  return "";
}

export function canonicalShoeMaterial(raw: string): string {
  const t = raw.toLowerCase();
  if (/\bnubuck\b/.test(t)) return "nubuck";
  if (/\bsuede\b/.test(t)) return "suede";
  if (/\bleather\b|\bcalf(?:skin)?\b|\bcordovan\b/.test(t)) return "leather";
  return "";
}

export function canonicalBlazerType(raw: string): string {
  const t = raw.toLowerCase();
  if (/\bdouble[\s-]?breasted\b|\b6\s*[x×]\s*[12]\b/.test(t)) return "double";
  if (/\bunstructured\b|\bunlined\b|\bsoft[\s-]?shoulder/.test(t)) {
    return "unstructured";
  }
  if (/\bsingle[\s-]?breasted\b|\btwo[\s-]?button\b|\b2[\s-]?button\b/.test(t)) {
    return "single";
  }
  return "";
}

function blazerCutBrief(blazerType?: string): string {
  switch (blazerType) {
    case "double":
      return "double-breasted ";
    case "unstructured":
      return "unstructured ";
    case "single":
      return "single-breasted ";
    default:
      return "";
  }
}

function fabricWord(material?: string): string {
  if (!material) return "";
  return `${material} `;
}

function outerwearBrief(slot: ConstructorSlot): string {
  const color = colorBriefPrefix(slot.color);
  const fabric = fabricWord(slot.material);
  if (isBlazer(slot.garment)) {
    return `${color}${fabric}${blazerCutBrief(slot.blazerType)}blazer`;
  }
  const type = typeLabel(slot.category, slot.garment).toLowerCase();
  return `${color}${fabric}${type}`;
}

function footwearBrief(slot: ConstructorSlot): string {
  if (isSneaker(slot.garment)) return sneakerBrief(slot);
  const color = colorBriefPrefix(slot.color);
  const finish = fabricWord(slot.material);
  const type = typeLabel(slot.category, slot.garment).toLowerCase();
  return `${color}${finish}${type}`;
}

/** Prompt override so jacket / blazer / trench render as the named cloth. */
export function fabricPromptDirective(description: string): string {
  if (!/\b(?:jacket|blazer|trench)\b/i.test(description)) return "";
  const named = description.match(
    /\b(leather|lambskin|calfskin|wool|merino|cashmere|flannel|tweed|worsted|cloth|cotton|gabardine|twill|canvas|linen)\s+(?:(?:single|double)[\s-]?breasted\s+|unstructured\s+)?(?:jacket|blazer|trench)\b/i,
  );
  const fabric = named ? canonicalOuterwearFabric(named[1]) : "";
  if (!fabric) return "";
  const cloth =
    fabric === "leather"
      ? `smooth LEATHER with natural grain and a soft sheen — not woven cloth and not wool. `
      : fabric === "wool"
        ? `WOOL (worsted, flannel or tweed) with visible wool texture — not shiny leather and not cotton. `
        : `woven CLOTH (cotton, gabardine or twill) — not leather and not a heavy wool coat. `;
  return (
    `CRITICAL outerwear fabric: the jacket, blazer or trench is ${fabric}. ` +
    cloth
  );
}

/** Prompt override so a listed blazer cut is not swapped for another. */
export function blazerTypePromptDirective(description: string): string {
  if (!/\bblazer\b|\bsport\s+coat\b/i.test(description)) return "";
  const kind = canonicalBlazerType(description);
  if (!kind) return "";
  const cut =
    kind === "double"
      ? `It is DOUBLE-BREASTED — overlapping fronts and two columns of buttons, not a single-breasted jacket. `
      : kind === "unstructured"
        ? `It is UNSTRUCTURED — soft shoulders, no heavy padding or canvas, a relaxed casual blazer. `
        : `It is SINGLE-BREASTED — one column of buttons, not double-breasted. `;
  return `CRITICAL blazer: ${cut}`;
}

/** Prompt override so shoes keep the named leather / suede / nubuck finish. */
export function shoeMaterialPromptDirective(description: string): string {
  const named = description.match(
    /\b(nubuck|suede|leather|calf(?:skin)?|cordovan)\s+(?:loafers?|sneakers?|trainers?|boots?|derbies?|sandals?|hiking|oxfords?|brogues?|shoes?)\b/i,
  );
  const finish = named ? canonicalShoeMaterial(named[1]) : "";
  if (!finish) return "";
  const note =
    finish === "suede"
      ? `matte SUEDE nap — not shiny smooth leather and not nubuck. `
      : finish === "nubuck"
        ? `matte NUBUCK (fine sanded grain) — not shiny leather and not long-nap suede. `
        : `smooth LEATHER with a natural grain — not suede and not nubuck. `;
  return `CRITICAL footwear finish: the shoes are ${finish}. The uppers are ${note}`;
}

const LIGHT_SNEAKER_UPPER = new Set([
  "white",
  "ivory",
  "cream",
  "dove",
  "greige",
]);
const WARM_SNEAKER_UPPER = new Set([
  "camel",
  "beige",
  "sand",
  "stone",
  "khaki",
  "lightbrown",
  "brown",
  "darkbrown",
  "rust",
  "burgundy",
  "taupe",
  "mushroom",
]);

/** White sole on cool/dark uppers; cream on warm or already-light uppers. */
export function sneakerSoleColor(upperColor?: string): "white" | "cream" {
  const id = (upperColor ?? "").toLowerCase();
  if (LIGHT_SNEAKER_UPPER.has(id) || WARM_SNEAKER_UPPER.has(id)) return "cream";
  if (isCustomHex(id)) {
    const r = parseInt(id.slice(1, 3), 16);
    const g = parseInt(id.slice(3, 5), 16);
    const b = parseInt(id.slice(5, 7), 16);
    const luminance = (r * 299 + g * 587 + b * 114) / 1000;
    if (luminance > 186 || r > b + 20) return "cream";
  }
  return "white";
}

function sneakerBrief(slot: ConstructorSlot): string {
  const color = colorBriefPrefix(slot.color);
  const finish = slot.material || "leather";
  const sole = sneakerSoleColor(slot.color);
  return `${color}${finish} sneakers with a ${sole} rubber sole`;
}

/** Prompt override so sneakers keep a contrasting light sole, not a monochrome shoe. */
export function sneakerPromptDirective(description: string): string {
  if (!/\bsneakers?\b|\btrainers?\b/i.test(description)) return "";
  const named = description.match(
    /\b(white|ivory|cream|dove|greige|camel|beige|sand|stone|khaki|lightbrown|light[\s-]+brown|darkbrown|dark[\s-]+brown|brown|rust|burgundy|taupe|mushroom|navy|black|charcoal|grey|gray|olive|green|blue|teal)\s+(?:(?:leather|suede|nubuck)\s+)?(?:sneakers?|trainers?)\b/i,
  );
  const sole = sneakerSoleColor(
    named?.[1]
      ?.toLowerCase()
      .replace(/light[\s-]+brown/g, "lightbrown")
      .replace(/dark[\s-]+brown/g, "darkbrown"),
  );
  const finishMatch = description.match(
    /\b(nubuck|suede|leather)\s+(?:sneakers?|trainers?)\b/i,
  );
  const finish = finishMatch?.[1]?.toLowerCase() || "leather";
  const upper =
    finish === "suede"
      ? `The UPPER is SUEDE — a matte napped finish, not shiny smooth leather. `
      : finish === "nubuck"
        ? `The UPPER is NUBUCK — a fine matte sanded grain, not shiny leather. `
        : `The UPPER is smooth LEATHER. `;
  return (
    `CRITICAL sneakers: the trainers have a coloured UPPER and a CONTRASTING ` +
    `${sole} rubber midsole and outsole — not a fully monochrome shoe where the ` +
    `sole matches the upper. A tonal sole is only acceptable if the whole trainer ` +
    `is already white, ivory or cream. ` +
    upper
  );
}

export const HAT_TYPES: ConstructorTypeOption[] = [
  { id: "cap", label: "Cap" },
  { id: "baseball", label: "Baseball" },
  { id: "kartuz", label: "Kartuz" },
  { id: "bucket", label: "Bucket" },
  { id: "boater", label: "Boater" },
  { id: "kepi", label: "Kepi" },
  { id: "peaked", label: "Peaked cap" },
  { id: "fedora", label: "Fedora" },
  { id: "trilby", label: "Trilby" },
  { id: "borsalino", label: "Borsalino" },
  { id: "beanie", label: "Beanie" },
  { id: "fisherman", label: "Fisherman" },
  { id: "slouch", label: "Slouch beanie" },
  { id: "cowboy", label: "Cowboy" },
  { id: "newsboy", label: "Newsboy" },
];

export function defaultHatType(): string {
  return "baseball";
}

export function coerceHatType(hatType?: string): string {
  if (hatType && HAT_TYPES.some((t) => t.id === hatType)) return hatType;
  return defaultHatType();
}

export function hatTypeLabel(hatType?: string): string {
  return HAT_TYPES.find((t) => t.id === hatType)?.label ?? "";
}

export function canonicalHatType(raw: string): string {
  const t = raw.toLowerCase();
  if (/\bcowboy\b|\bstetson\b/.test(t)) return "cowboy";
  if (/\bborsalino\b/.test(t)) return "borsalino";
  if (/\btrilby\b/.test(t)) return "trilby";
  if (/\bfedora\b/.test(t)) return "fedora";
  if (/\bboater\b|\bcanotier\b|\bskimmer\b/.test(t)) return "boater";
  if (/\bbucket\b|\bpanama\b/.test(t)) return "bucket";
  if (/\bfisherman\b/.test(t)) return "fisherman";
  if (/\bslouch\b|\bbaggy\s+beanie\b|\bsack\s+beanie\b/.test(t)) return "slouch";
  if (/\bbeanie\b|\bwatch\s+cap\b/.test(t)) return "beanie";
  if (/\bnewsboy\b|\bbaker\s*boy\b|\beight[\s-]?panel\b|\bвосьмиклин/.test(t)) {
    return "newsboy";
  }
  if (/\bkartuz\b|\bкартуз/.test(t)) return "kartuz";
  if (/\bkepi\b|\bкеппи/.test(t)) return "kepi";
  if (/\bpeaked\s+cap\b|\bofficer'?s?\s+cap\b|\bfуражк/.test(t)) return "peaked";
  if (/\bbaseball\b|\bdad\s+hat\b|\bsnapback\b/.test(t)) return "baseball";
  if (/\bflat\s+cap\b|\bivy\s+cap\b/.test(t)) return "cap";
  if (/\bcap\b/.test(t) && !/\bhat\b/.test(t)) return "cap";
  return "";
}

function hatBrief(slot: ConstructorSlot): string {
  const color = colorBriefPrefix(slot.color);
  switch (slot.hatType) {
    case "baseball":
      return `${color}baseball cap worn on the head`;
    case "kartuz":
      return `${color}kartuz (soft rounded crown, short visor) worn on the head`;
    case "bucket":
      return `${color}bucket hat worn on the head`;
    case "boater":
      return `${color}straw boater (flat crown, flat brim) worn on the head`;
    case "kepi":
      return `${color}English kepi (cylindrical crown, short visor) worn on the head`;
    case "peaked":
      return `${color}peaked cap (structured crown, visor) worn on the head`;
    case "fedora":
      return `${color}fedora worn on the head`;
    case "trilby":
      return `${color}trilby (short snapped brim) worn on the head`;
    case "borsalino":
      return `${color}Borsalino felt fedora worn on the head`;
    case "beanie":
      return `${color}knit beanie worn on the head`;
    case "fisherman":
      return `${color}fisherman beanie (short cuff, close fit) worn on the head`;
    case "slouch":
      return `${color}slouch beanie (baggy, extra length) worn on the head`;
    case "cowboy":
      return `${color}cowboy hat worn on the head`;
    case "newsboy":
      return `${color}newsboy cap (eight-panel, short brim) worn on the head`;
    case "cap":
      return `${color}soft cap worn on the head`;
    default:
      return `${color}hat worn on the head`;
  }
}

/** Prompt override so a listed hat renders as the named cut, on the head. */
export function hatPromptDirective(description: string): string {
  if (
    !/\bhat\b|\bcap\b|\bbeanie\b|\bfedora\b|\btrilby\b|\bborsalino\b|\bboater\b|\bbucket\b|\bkepi\b|\bkartuz\b|\bcowboy\b|\bnewsboy\b/i.test(
      description,
    )
  ) {
    return "";
  }
  const kind = canonicalHatType(description);
  const cut =
    kind === "baseball"
      ? `It is a BASEBALL CAP — structured crown and a firm curved visor at the front. `
      : kind === "kartuz"
        ? `It is a KARTUZ — a soft rounded crown with a short visor, not a baseball cap. `
        : kind === "bucket"
          ? `It is a BUCKET HAT — a soft downward brim all the way around, no visor. `
          : kind === "boater"
            ? `It is a STRAW BOATER — flat stiff crown and a flat oval brim. `
            : kind === "kepi"
              ? `It is an ENGLISH KEPI — a short cylindrical crown and a small visor. `
              : kind === "peaked"
                ? `It is a PEAKED CAP — a tall structured crown and a firm visor (officer / military style). `
                : kind === "fedora"
                  ? `It is a FEDORA — pinched crown and a medium brim, worn level. `
                  : kind === "trilby"
                    ? `It is a TRILBY — a fedora-like crown with a short brim snapped down in front. `
                    : kind === "borsalino"
                      ? `It is a BORSALINO — a refined felt fedora with a generous brim. `
                      : kind === "beanie"
                        ? `It is a KNIT BEANIE — close-fitting, no brim or visor. `
                        : kind === "fisherman"
                          ? `It is a FISHERMAN BEANIE — short folded cuff, close to the skull, no slouch. `
                          : kind === "slouch"
                            ? `It is a SLOUCH BEANIE — extra length, baggy at the crown, not a tight watch cap. `
                            : kind === "cowboy"
                              ? `It is a COWBOY HAT — high dented crown and a wide brim. `
                              : kind === "newsboy"
                                ? `It is a NEWSBOY / eight-panel cap — puffy paneled crown and a short stiff brim. `
                                : kind === "cap"
                                  ? `It is a soft CAP with a short visor — not a baseball cap and not a brimmed hat. `
                                  : "";
  return (
    `CRITICAL headwear: the outfit lists a hat or cap — it MUST be worn ON the ` +
    `head, sitting naturally, clearly visible. Do not omit it, do not hold it, ` +
    `and do not replace it with a different hat style. ` +
    cut
  );
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

export const TIE_TYPES: ConstructorTypeOption[] = [
  { id: "classic", label: "Classic" },
  { id: "grenadine", label: "Grenadine" },
  { id: "knitted", label: "Knitted" },
  { id: "skinny", label: "Skinny" },
  { id: "bow", label: "Bow tie" },
  { id: "bolo", label: "Bolo" },
];

export function defaultTieType(): string {
  return "classic";
}

export function coerceTieType(tieType?: string): string {
  if (tieType && TIE_TYPES.some((t) => t.id === tieType)) return tieType;
  return defaultTieType();
}

export function tieTypeLabel(tieType?: string): string {
  return TIE_TYPES.find((t) => t.id === tieType)?.label ?? "";
}

export function canonicalTieType(raw: string): string {
  const t = raw.toLowerCase();
  if (/\bbolo(?:\s*-?\s*tie)?\b/.test(t) || /\bbola\s+tie\b/.test(t)) return "bolo";
  if (/\bbow(?:\s*-?\s*tie)?\b/.test(t)) return "bow";
  if (/\bgrenadine\b/.test(t)) return "grenadine";
  if (/\bknitted\b/.test(t) || /\bknit(?:ted)?\s+tie\b/.test(t) || /\bsquare[\s-]?end\b/.test(t)) {
    return "knitted";
  }
  if (/\bskinny\b/.test(t) || /\bslim\s+tie\b/.test(t) || /\bnarrow\s+tie\b/.test(t)) {
    return "skinny";
  }
  if (/\bsilk\s+tie\b/.test(t) || /\bpointed\b/.test(t) || /\bclassic\s+tie\b/.test(t)) {
    return "classic";
  }
  return "";
}

function tieBrief(slot: ConstructorSlot): string {
  const color = colorBriefPrefix(slot.color);
  switch (slot.tieType) {
    case "bow":
      return `${color}bow tie tied at the collar`;
    case "bolo":
      return `${color}bolo tie — two leather cords with a decorative slide at the open collar, not a silk blade`;
    case "grenadine":
      return `${color}grenadine silk tie (open-weave texture, pointed blade) knotted at the collar`;
    case "knitted":
      return `${color}knitted tie with a square end, knotted at the collar`;
    case "skinny":
      return `${color}skinny silk tie (narrow blade) knotted at the collar`;
    case "classic":
      return `${color}silk tie with a pointed blade, knotted at the collar`;
    default:
      return `${color}tie`;
  }
}

/** Closed knits hide a tie; with a tie they must render as a V-neck over the shirt. */
function isClosedKnit(garment: string): boolean {
  return garment === "crewneck" || garment === "turtleneck";
}

function knitBriefWithTie(slot: ConstructorSlot): string {
  const color = colorBriefPrefix(slot.color);
  if (slot.garment === "cardigan") {
    return `${color}cardigan worn open over the shirt and tie`;
  }
  return `${color}V-neck jumper worn over the shirt and tie`;
}

/** Knit / jumper in the outfit — not a "knitted tie". */
function descriptionHasKnit(description: string): boolean {
  return /\b(crewnecks?|crew\s*necks?|jumpers?|sweaters?|pullovers?|knitwear|hoodies?|cardigans?|roll-?necks?|turtlenecks?|v-?necks?)\b/i.test(
    description,
  );
}

/** Prompt override so a listed tie renders as the named cut, not a generic blade. */
export function tiePromptDirective(description: string): string {
  if (!/\btie\b|\bnecktie\b|\bbow\s*tie\b|\bbolo\b/i.test(description)) return "";
  const kind = canonicalTieType(description);
  const cut =
    kind === "bow"
      ? `It is a BOW TIE — a bow at the collar, not a long hanging blade. `
      : kind === "bolo"
        ? `It is a BOLO tie: two thin leather cords through a decorative slide at the open collar, metal tips at the ends — never a silk necktie blade. `
        : kind === "grenadine"
        ? `It is a GRENADINE silk tie: open-weave textured silk, pointed blade. `
        : kind === "knitted"
          ? `It is a KNITTED tie with a square (not pointed) end. `
          : kind === "skinny"
            ? `It is a SKINNY silk tie — a narrow blade, not a standard width. `
            : kind === "classic"
              ? `It is a classic silk necktie with a pointed blade. `
              : "";
  const hasCardigan = /\bcardigans?\b/i.test(description);
  const hasClosedKnit =
    descriptionHasKnit(description) &&
    !hasCardigan &&
    !/\bv-?necks?\b/i.test(description);
  const layering =
    kind === "bolo"
      ? `The bolo sits at an OPEN collar: the slide rests at the throat and the ` +
        `two cords hang down the shirt placket. `
      : descriptionHasKnit(description)
        ? hasCardigan && !hasClosedKnit
          ? `The cardigan is worn OVER the shirt and tie. The tie lies flat on the ` +
            `SHIRT placket and is visible in the cardigan opening — NEVER on top of ` +
            `the knit. `
          : `A closed crewneck or roll-neck cannot carry a tie on its surface. Wear ` +
            `a V-neck knit OVER the shirt and tie. The tie is knotted at the shirt ` +
            `collar and lies on the shirt, visible only in the V — NEVER draped or ` +
            `painted on top of the jumper. `
        : `The tie is knotted at the shirt collar and clearly visible (between ` +
          `jacket lapels if a jacket is worn). `;
  return (
    `CRITICAL neckwear: the outfit lists a tie — it MUST be knotted at the shirt ` +
    `collar. ` +
    layering +
    `Do not omit it, do not drape it untied, and do not replace it with a scarf. ` +
    cut
  );
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
  const frame = colorBriefPrefix(slot.color);
  const lenses =
    slot.garment === "sunglasses" && slot.lensColor
      ? slot.lensColor === "mirrored"
        ? " with mirrored lenses"
        : ` with ${slot.lensColor} lenses`
      : "";
  const shape = slot.shape || "";
  if (slot.garment === "sunglasses") {
    if (shape === "sport") {
      return `${frame}wraparound sport sunglasses${lenses} worn on the face`;
    }
    const named = shape ? `${shapeLabel(shape).toLowerCase()} ` : "";
    return `${frame}${named}sunglasses${lenses} worn on the face`;
  }
  if (shape === "rimless") {
    return `${frame}rimless glasses worn on the face (lenses mounted to bridge/temples, no surrounding frame)`;
  }
  const named = shape ? `${shapeLabel(shape).toLowerCase()} ` : "";
  return `${frame}${named}glasses worn on the face`;
}

/** Prompt override so face-lock on the reference photo cannot drop listed eyewear. */
export function eyewearPromptDirective(description: string): string {
  if (!/\bsunglasses\b|\bglasses\b|\bgoggles\b|\beyewear\b/i.test(description)) {
    return "";
  }
  const isSun = /\bsunglasses\b|\bgoggles\b/i.test(description);
  const lensKind = canonicalLensColor(description);
  const lensNote = !isSun
    ? `Optical glasses have CLEAR lenses — do not tint them. Only the frame has colour. `
    : lensKind === "mirrored"
      ? `The sunglasses LENSES are a reflective mirror finish (silver, chrome or coloured flash) — not a flat dark tint. `
      : lensKind
        ? `The sunglasses LENSES are a ${lensKind} tint — not the same colour as the frame unless the brief says so. `
        : `Sunglasses have a distinct lens tint (classic grey or brown if unnamed) — do not paint the lenses the same colour as the frame. `;
  const frameNote = isSun
    ? `The FRAME has its own colour (including gold, silver or tortoise when named) — metal or acetate as implied. `
    : "";
  return (
    `CRITICAL eyewear: the outfit lists sunglasses, glasses or goggles — they MUST ` +
    `be clearly visible on this person's face, resting on the nose over the eyes, ` +
    `in the named frame. Adding listed eyewear is required clothing, not an identity ` +
    `change: copy the face from the reference, THEN put the eyewear on that face. ` +
    `A bare face with the eyewear omitted is wrong. ` +
    frameNote +
    lensNote
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
    ...(isSunglasses(next.id) ? { lensColor: defaultLensColor() } : {}),
    ...(isTie(next.id) ? { tieType: defaultTieType() } : {}),
    ...(isHat(next.id) ? { hatType: defaultHatType() } : {}),
  };
}

export function isAllowedConstructorSlot(slot: ConstructorSlot): boolean {
  if (!slot.category || !slot.garment) return false;
  const types = CONSTRUCTOR_TYPES[slot.category];
  if (!types) return false;
  const typeOk =
    types.some((t) => t.id === slot.garment) || Boolean(slot.garment.trim());
  const colorOk =
    !slot.color ||
    COLOR_BY_ID.has(slot.color) ||
    isCustomHex(slot.color) ||
    slot.color.length <= 24;
  const shapeOk =
    !slot.shape ||
    !isEyewear(slot.garment) ||
    shapesForEyewear(slot.garment).some(
      (s) => s.id === coerceEyewearShape(slot.garment, slot.shape),
    );
  const tuckOk =
    !slot.tuck ||
    (isTuckable(slot.garment) && (slot.tuck === "in" || slot.tuck === "out"));
  const tieOk =
    !slot.tieType ||
    (isTie(slot.garment) && TIE_TYPES.some((t) => t.id === slot.tieType));
  const lensOk =
    !slot.lensColor ||
    (isSunglasses(slot.garment) &&
      (LENS_BY_ID.has(slot.lensColor) || slot.lensColor.length <= 24));
  const hatOk =
    !slot.hatType ||
    (isHat(slot.garment) && HAT_TYPES.some((t) => t.id === slot.hatType));
  const materialOk =
    !slot.material ||
    (isFabricOuterwear(slot.garment) &&
      OUTERWEAR_FABRICS.some((f) => f.id === slot.material)) ||
    (isFootwear(slot.category) &&
      SHOE_MATERIALS.some((f) => f.id === slot.material));
  const blazerOk =
    !slot.blazerType ||
    (isBlazer(slot.garment) && BLAZER_TYPES.some((t) => t.id === slot.blazerType));
  return (
    typeOk &&
    colorOk &&
    shapeOk &&
    tuckOk &&
    tieOk &&
    lensOk &&
    hatOk &&
    materialOk &&
    blazerOk
  );
}

/** Build the look description the image model will render. */
export function composeLookDescription(slots: ConstructorSlot[]): string {
  const enabled = slots.filter(isSlotEnabled);
  const hasTie = enabled.some((s) => isTie(s.garment));
  return enabled
    .map((s) => {
      if (isEyewear(s.garment)) {
        return eyewearBrief(s);
      }
      if (isTie(s.garment)) {
        return tieBrief(s);
      }
      if (s.garment === "neckerchief") {
        return `${colorBriefPrefix(s.color)}silk neckerchief knotted at the open collar`;
      }
      if (s.garment === "pocket square") {
        return `${colorBriefPrefix(s.color)}pocket square folded in the jacket breast pocket`;
      }
      if (isHat(s.garment)) {
        return hatBrief(s);
      }
      if (isFabricOuterwear(s.garment)) {
        return outerwearBrief(s);
      }
      if (isFootwear(s.category)) {
        return footwearBrief(s);
      }
      if (hasTie && (s.category === "Knitwear" || isClosedKnit(s.garment))) {
        return knitBriefWithTie(s);
      }
      const type = typeLabel(s.category, s.garment).toLowerCase();
      const base = `${colorBriefPrefix(s.color)}${type}`.trim();
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
    let garment = canonicalGarment(g.garment, g.category);
    if (
      garment === "jacket" &&
      /\b(blazer|sport\s+coat|suit\s+jacket)\b/i.test(g.clause)
    ) {
      garment = "blazer";
    }
    const hexInClause = g.clause.match(/#([0-9a-f]{6})\b/i);
    const color = hexInClause
      ? `#${hexInClause[1]!.toLowerCase()}`
      : lastColorToken(g.color);
    const key = `${g.category}:${garment}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parsed = isEyewear(garment)
      ? canonicalEyewearShape(g.clause, garment)
      : "";
    const shape = parsed ? coerceEyewearShape(garment, parsed) : "";
    const tuck = isTuckable(garment) ? canonicalTuck(g.clause) : "";
    const tieType = isTie(garment) ? canonicalTieType(g.clause) : "";
    const hatType = isHat(garment) ? canonicalHatType(g.clause) : "";
    const material = isFabricOuterwear(garment)
      ? canonicalOuterwearFabric(g.clause)
      : isFootwear(g.category)
        ? canonicalShoeMaterial(g.clause)
        : "";
    const blazerType = isBlazer(garment) ? canonicalBlazerType(g.clause) : "";
    let frameColor = color;
    let lensColor = "";
    if (isSunglasses(garment)) {
      lensColor = canonicalLensColor(`${description} ${g.clause}`);
      if (frameColor === "mirrored") {
        if (!lensColor) lensColor = "mirrored";
        frameColor = "black";
      }
    }
    slots.push({
      category: g.category,
      garment,
      color: frameColor,
      ...(shape ? { shape } : {}),
      ...(tuck ? { tuck } : {}),
      ...(tieType ? { tieType } : {}),
      ...(hatType ? { hatType } : {}),
      ...(lensColor ? { lensColor } : {}),
      ...(material ? { material } : {}),
      ...(blazerType ? { blazerType } : {}),
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
      (s.tieType || "") === (b[i]?.tieType || "") &&
      (s.lensColor || "") === (b[i]?.lensColor || "") &&
      (s.hatType || "") === (b[i]?.hatType || "") &&
      (s.material || "") === (b[i]?.material || "") &&
      (s.blazerType || "") === (b[i]?.blazerType || "") &&
      isSlotEnabled(s) === isSlotEnabled(b[i]!),
  );
}

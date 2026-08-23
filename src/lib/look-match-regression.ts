/**
 * Local matching golden-set. Each case is a look slot + a fixture catalogue
 * pool + a contract on the winner. Run without Sonnet or the live DB.
 *
 * Add a case when a ranking bump fixes a real miss — that is how we learn
 * whether the next heuristic change is net-positive.
 */
import type { LookMatchCandidate } from "./look-match-rank";

export type LookMatchRegressionCase = {
  id: string;
  /** One-line "why this case exists". */
  why: string;
  slot: {
    garment: string;
    color?: string | null;
    clause?: string | null;
  };
  occasionId?: string | null;
  styleId?: string | null;
  boldness?: string;
  pool: LookMatchCandidate[];
  /** Winner id must be one of these. */
  acceptIds: string[];
  /** Winner must not be one of these. */
  rejectIds?: string[];
};

function p(
  id: string,
  title: string,
  color: string,
  extra: Partial<LookMatchCandidate> = {},
): LookMatchCandidate {
  return {
    id,
    brand: extra.brand ?? "Fixture",
    title,
    color,
    color_hex: extra.color_hex ?? null,
    similarity: extra.similarity ?? 0.84,
    garment_subtype: extra.garment_subtype ?? null,
    material_family: extra.material_family ?? null,
    fit: extra.fit ?? null,
    pattern: extra.pattern ?? null,
    description: extra.description ?? null,
    formality: extra.formality ?? null,
    trend_level: extra.trend_level ?? null,
    versatility: extra.versatility ?? null,
    same_country: extra.same_country ?? true,
  };
}

export const LOOK_MATCH_REGRESSION: LookMatchRegressionCase[] = [
  {
    id: "teal-shirt-not-sage",
    why: "Teal with no catalogue teal falls to blue/grey, never sage or oatmeal.",
    slot: {
      garment: "shirt",
      color: "muted teal",
      clause: "muted teal linen shirt",
    },
    occasionId: "work",
    pool: [
      p("shirt-sage", "Regular Fit Linen Shirt", "sage", {
        color_hex: "#8A9A7B",
        garment_subtype: "shirt",
        material_family: "linen",
        fit: "regular",
        similarity: 0.9,
      }),
      p("shirt-blue", "Regular Fit Linen Shirt", "light blue", {
        color_hex: "#A7C4DB",
        garment_subtype: "shirt",
        material_family: "linen",
        fit: "regular",
      }),
      p("shirt-oatmeal", "Regular Fit Oxford Shirt", "oatmeal", {
        color_hex: "#E8DCC8",
        garment_subtype: "shirt",
        material_family: "cotton",
        fit: "regular",
        similarity: 0.88,
      }),
      p("shirt-navy", "Slim Fit Linen Shirt", "navy", {
        color_hex: "#1B2A4A",
        garment_subtype: "shirt",
        material_family: "linen",
        fit: "slim",
      }),
    ],
    acceptIds: ["shirt-blue"],
    rejectIds: ["shirt-sage", "shirt-oatmeal", "shirt-navy"],
  },
  {
    id: "oatmeal-chinos-not-wool",
    why: "Named chinos stay cotton chinos — wool suit trousers must not win.",
    slot: {
      garment: "chinos",
      color: "oatmeal",
      clause: "oatmeal cotton chinos",
    },
    occasionId: "work",
    pool: [
      p("wool-coffee", "Pure Wool Suit Trousers", "coffee", {
        color_hex: "#4A3728",
        garment_subtype: "trousers",
        material_family: "wool",
        similarity: 0.91,
      }),
      p("chino-buff", "Barrel Fit Stretch Chinos", "Light Buff", {
        color_hex: "#D4C4A8",
        garment_subtype: "chinos",
        material_family: "cotton",
        fit: "regular",
      }),
    ],
    acceptIds: ["chino-buff"],
    rejectIds: ["wool-coffee"],
  },
  {
    id: "dusty-rose-not-nude",
    why: "A same-family pink beats beige/nude neighbours.",
    slot: {
      garment: "jumper",
      color: "dusty rose",
      clause: "dusty rose cotton jumper",
    },
    pool: [
      p("knit-nude", "Structural Cotton Jumper", "nude", {
        color_hex: "#E8D5C4",
        garment_subtype: "sweater",
        material_family: "cotton",
        similarity: 0.9,
      }),
      p("knit-beige", "Cotton Jumper", "beige", {
        color_hex: "#D8C8B0",
        garment_subtype: "sweater",
        material_family: "cotton",
        similarity: 0.88,
      }),
      p("knit-pink", "Ribbed Textured Jumper", "dusty pink", {
        color_hex: "#C9A3A8",
        garment_subtype: "sweater",
        material_family: "cotton",
      }),
    ],
    acceptIds: ["knit-pink"],
    rejectIds: ["knit-nude", "knit-beige"],
  },
  {
    id: "pocket-square-not-tie",
    why: "Accessory type is strict — a tie must not fill a pocket-square slot.",
    slot: {
      garment: "pocket square",
      color: "burgundy",
      clause: "burgundy silk pocket square",
    },
    occasionId: "work",
    pool: [
      p("acc-tie", "Silk Tie", "burgundy", {
        garment_subtype: "tie",
        material_family: "silk",
        similarity: 0.92,
      }),
      p("acc-square", "Silk Pocket Square", "burgundy", {
        garment_subtype: "pocket square",
        material_family: "silk",
      }),
      p("acc-cap", "Wool Cap", "burgundy", {
        garment_subtype: "hat",
        material_family: "wool",
      }),
    ],
    acceptIds: ["acc-square"],
    rejectIds: ["acc-tie", "acc-cap"],
  },
  {
    id: "messenger-not-weekender",
    why: "Work messenger/briefcase must not resolve to a travel bag.",
    slot: {
      garment: "messenger",
      color: "warm grey",
      clause: "warm grey leather messenger",
    },
    occasionId: "work",
    pool: [
      p("bag-weekender", "Leather Weekender", "warm grey", {
        garment_subtype: "bag",
        material_family: "leather",
        similarity: 0.9,
      }),
      p("bag-brief", "Textured Briefcase", "warm grey", {
        garment_subtype: "briefcase",
        material_family: "leather",
      }),
    ],
    acceptIds: ["bag-brief"],
    rejectIds: ["bag-weekender"],
  },
  {
    id: "coffee-trousers-not-black",
    why: "Coffee/brown trousers are not a black stand-in.",
    slot: {
      garment: "trousers",
      color: "coffee",
      clause: "coffee chinos",
    },
    occasionId: "work",
    pool: [
      p("tr-black", "Pure Wool Suit Trousers", "black", {
        color_hex: "#1A1A1A",
        garment_subtype: "trousers",
        material_family: "wool",
        similarity: 0.9,
      }),
      p("tr-coffee", "Stretch Chinos", "coffee", {
        color_hex: "#6B4A2A",
        garment_subtype: "chinos",
        material_family: "cotton",
      }),
    ],
    acceptIds: ["tr-coffee"],
    rejectIds: ["tr-black"],
  },
  {
    id: "sage-shirt-stays-green",
    why: "A named sage shirt must keep green, not flip to light blue.",
    slot: {
      garment: "shirt",
      color: "sage",
      clause: "sage linen shirt",
    },
    occasionId: "work",
    pool: [
      p("sage-blue", "Regular Fit Linen Shirt", "light blue", {
        color_hex: "#A7C4DB",
        garment_subtype: "shirt",
        material_family: "linen",
        fit: "regular",
        similarity: 0.88,
      }),
      p("sage-green", "Regular Fit Linen Shirt", "sage", {
        color_hex: "#8A9A7B",
        garment_subtype: "shirt",
        material_family: "linen",
        fit: "regular",
      }),
    ],
    acceptIds: ["sage-green"],
    rejectIds: ["sage-blue"],
  },
  {
    id: "work-shirt-not-camp",
    why: "Work oatmeal shirt prefers a dress oxford over relaxed camp viscose.",
    slot: {
      garment: "shirt",
      color: "oatmeal",
      clause: "oatmeal cotton shirt",
    },
    occasionId: "work",
    pool: [
      p("camp-viscose", "Relaxed Camp Collar Shirt", "oatmeal", {
        color_hex: "#E8DCC8",
        garment_subtype: "shirt",
        material_family: "viscose",
        fit: "relaxed",
        description: "Short-sleeve camp collar viscose",
        similarity: 0.9,
      }),
      p("oxford-oat", "Regular Fit Oxford Shirt", "oatmeal", {
        color_hex: "#E8DCC8",
        garment_subtype: "shirt",
        material_family: "cotton",
        fit: "regular",
      }),
    ],
    acceptIds: ["oxford-oat"],
    rejectIds: ["camp-viscose"],
  },
  {
    id: "plum-blazer-not-pink",
    why: "Catalogue plum is rare — evening plum falls to navy, never pastel pink.",
    slot: {
      garment: "blazer",
      color: "softplum",
      clause: "softplum unstructured blazer",
    },
    pool: [
      p("blazer-pink", "Slim Fit Blazer", "#E1A0A8", {
        color_hex: "#E1A0A8",
        garment_subtype: "blazer",
        material_family: "wool",
        similarity: 0.96,
      }),
      p("blazer-navy", "Unstructured Blazer", "#28324A", {
        color_hex: "#28324A",
        garment_subtype: "blazer",
        material_family: "wool",
        similarity: 0.55,
      }),
      p("blazer-beige", "Linen Blazer", "beige", {
        color_hex: "#E8DCC8",
        garment_subtype: "blazer",
        material_family: "linen",
        similarity: 0.88,
      }),
    ],
    acceptIds: ["blazer-navy"],
    rejectIds: ["blazer-pink", "blazer-beige"],
  },
  {
    id: "charcoal-loafers-not-teal",
    why: "Soft charcoal loafers stay grey — a dark blue-green suede must not win on shade.",
    slot: {
      garment: "loafers",
      color: "soft charcoal",
      clause: "soft charcoal suede loafers",
    },
    pool: [
      p("loafer-green", "Suede Slip On Loafers", "Blue Green", {
        color_hex: "#2F4B7C",
        garment_subtype: "loafers",
        material_family: "suede",
        similarity: 0.94,
      }),
      p("loafer-grey", "Suede Slip-On Loafers", "Grey", {
        color_hex: "#8B8B8B",
        garment_subtype: "loafers",
        material_family: "suede",
      }),
      p("loafer-navy", "Leather Loafers", "navy", {
        color_hex: "#1B2A4A",
        garment_subtype: "loafers",
        material_family: "leather",
        similarity: 0.88,
      }),
    ],
    acceptIds: ["loafer-grey"],
    rejectIds: ["loafer-green", "loafer-navy"],
  },
];

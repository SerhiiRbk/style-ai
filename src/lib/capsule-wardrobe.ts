/**
 * Capsule wardrobe contract — the look pipeline inverted the right way:
 * pick colours and roles first, then shop. Category-nearest-neighbour
 * shopping is what produced sage-on-sage dinner suits.
 */
import { hexToHsl } from "./colour-palette";

export type CapsuleSwatch = { name: string; hex: string };

export type CapsuleWardrobeRole =
  | "jacket"
  | "casualOuter"
  | "darkTrouser"
  | "casualTrouser"
  | "shirt"
  | "knit"
  | "dressShoe"
  | "loafer"
  | "sneaker"
  | "belt"
  | "bag";

export type CapsuleWardrobeSlot = {
  category: string;
  role: CapsuleWardrobeRole;
  color: CapsuleSwatch;
  query: string;
};

export type CapsuleRecipeOpts = {
  outdoorJeans?: boolean;
  polished?: boolean;
  cool?: boolean;
};

function parseHex(raw: string): string | null {
  const m = raw.trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1]!.toLowerCase()}` : null;
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function isDark(sw: CapsuleSwatch): boolean {
  const hex = parseHex(sw.hex);
  if (!hex) return /navy|charcoal|ink|black/i.test(sw.name);
  const { s, l, h } = hexToHsl(hex);
  if (l > 0.36) return false;
  if (s < 0.28) return true;
  if (h < 45 || h > 330) return true;
  return h >= 200 && h < 260;
}

function isLightNeutral(sw: CapsuleSwatch): boolean {
  const hex = parseHex(sw.hex);
  if (!hex) return /grey|gray|greige|dove|white|ivory/i.test(sw.name);
  const { s, l } = hexToHsl(hex);
  return s < 0.22 && l >= 0.55;
}

function isHero(sw: CapsuleSwatch): boolean {
  const hex = parseHex(sw.hex);
  if (!hex) return false;
  const { s, l } = hexToHsl(hex);
  return s >= 0.16 && l >= 0.22 && l <= 0.72;
}

function clones(a: CapsuleSwatch, b: CapsuleSwatch): boolean {
  const ha = parseHex(a.hex);
  const hb = parseHex(b.hex);
  if (ha && hb && ha === hb && !isDark(a)) return true;
  if (!ha || !hb) return a.name.toLowerCase() === b.name.toLowerCase();
  const A = hexToHsl(ha);
  const B = hexToHsl(hb);
  if (A.l <= 0.32 && B.l <= 0.32) return false;
  if (A.s < 0.1 || B.s < 0.1) return false;
  return hueDist(A.h, B.h) < 30 && Math.abs(A.l - B.l) < 0.32;
}

function blockedByAvoid(sw: CapsuleSwatch, avoid: CapsuleSwatch[]): boolean {
  const name = sw.name.toLowerCase();
  const hex = parseHex(sw.hex);
  for (const a of avoid) {
    const avoidName = a.name.toLowerCase();
    if (/yellow|mustard|golden/.test(avoidName)) {
      if (
        /\b(yellow|mustard|olive|khaki|lime|pistachio|mint|light green|pale green|chartreuse)\b/i.test(
          name,
        )
      ) {
        return true;
      }
      const aHex = parseHex(a.hex);
      if (hex && aHex) {
        const q = hexToHsl(aHex);
        const p = hexToHsl(hex);
        if (
          q.s >= 0.18 &&
          p.s >= 0.16 &&
          hueDist(q.h, p.h) < 28 &&
          Math.abs(q.l - p.l) < 0.28
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function pick<T>(arr: T[], pred: (x: T) => boolean): T | undefined {
  return arr.find(pred);
}

function uniquePush(out: CapsuleSwatch[], sw: CapsuleSwatch | undefined) {
  if (!sw) return;
  if (out.some((x) => x.hex.toLowerCase() === sw.hex.toLowerCase())) return;
  out.push(sw);
}

/** Colour + role contract for a mix-and-match capsule. */
export function capsuleWardrobeSlots(
  best: CapsuleSwatch[],
  avoid: CapsuleSwatch[],
  opts?: CapsuleRecipeOpts,
): CapsuleWardrobeSlot[] {
  const usable = best.filter((c) => c.hex && !blockedByAvoid(c, avoid));
  const pool = usable.length ? usable : best.filter((c) => c.hex);
  if (!pool.length) return [];

  const darks = pool.filter(isDark);
  const lights = pool.filter(isLightNeutral);
  const heroes = pool.filter((c) => isHero(c) && !isDark(c) && !isLightNeutral(c));
  const rest = pool.filter(
    (c) => !darks.includes(c) && !lights.includes(c) && !heroes.includes(c),
  );

  const jacket =
    pick(heroes, (c) => !/yellow|olive|mustard/i.test(c.name)) ??
    heroes[0] ??
    rest[0] ??
    darks[0] ??
    pool[0]!;

  const darkTrouser =
    pick(darks, (c) => !clones(c, jacket) && /navy|charcoal|ink/i.test(c.name)) ??
    pick(darks, (c) => !clones(c, jacket)) ??
    darks[0] ??
    { name: "Muted navy", hex: "#3E4C63" };

  const casualPool = [...lights, ...rest, ...heroes].filter(
    (c) => !clones(c, jacket) && !clones(c, darkTrouser),
  );
  const casualTrouser = opts?.outdoorJeans
    ? { name: "Blue-grey indigo", hex: "#5A6B7A" }
    : casualPool[0] ?? lights[0] ?? { name: "Dove grey", hex: "#AEB3B6" };

  const shirtPool = [...lights, ...rest].filter(
    (c) =>
      !/\b(yellow|lime|pistachio|mint|olive|mustard|cream|ivory|maize|butter)\b/i.test(
        c.name,
      ) && !blockedByAvoid(c, avoid),
  );
  const shirtA = shirtPool[0] ?? { name: "Dove grey", hex: "#AEB3B6" };
  const shirtB =
    shirtPool.find(
      (c) =>
        c.hex.toLowerCase() !== shirtA.hex.toLowerCase() &&
        !(opts?.cool && /greige|beige|camel/i.test(c.name)),
    ) ??
    (opts?.cool
      ? { name: "White", hex: "#F5F5F5" }
      : { name: "Greige", hex: "#DAD3C6" });

  const knit =
    pick(darks, (c) => c.hex.toLowerCase() !== darkTrouser.hex.toLowerCase()) ??
    pick(rest, (c) => /charcoal|slate|grey|gray|navy/i.test(c.name)) ??
    darkTrouser;

  const casualOuter =
    pick(lights, (c) => /grey|gray|greige/i.test(c.name)) ??
    lights[0] ??
    { name: "Fog grey", hex: "#C3C3C3" };

  const dressShoe = darkTrouser;
  const loafer =
    pick(darks, (c) => c.hex.toLowerCase() !== dressShoe.hex.toLowerCase()) ??
    darkTrouser;
  const sneaker = lights[0] ?? { name: "Grey", hex: "#8B8B8B" };

  const slots: CapsuleWardrobeSlot[] = [
    {
      category: "Outerwear",
      role: "jacket",
      color: jacket,
      query:
        `Men's ${jacket.name} unstructured blazer or sport coat — tailored, single-breasted, ` +
        `not a bomber unless no blazer exists. Colour ${jacket.name} ${jacket.hex}.`,
    },
    {
      category: "Outerwear",
      role: "casualOuter",
      color: casualOuter,
      query:
        `Men's ${casualOuter.name} overshirt, field jacket or windbreaker — casual layer, ` +
        `not a second blazer. Colour ${casualOuter.name} ${casualOuter.hex}.`,
    },
    {
      category: "Trousers",
      role: "darkTrouser",
      color: darkTrouser,
      query:
        `Men's ${darkTrouser.name} tailored trousers or wool dress trousers — full-length, ` +
        `not drawstring, not joggers, not shorts, not olive, not sage. ` +
        `Colour ${darkTrouser.name} ${darkTrouser.hex}.`,
    },
    {
      category: "Trousers",
      role: "casualTrouser",
      color: casualTrouser,
      query: opts?.outdoorJeans
        ? `Men's jeans or five-pocket denim in ${casualTrouser.name} — not cargos, not shorts.`
        : `Men's ${casualTrouser.name} chinos or casual trousers — not the same colour as the ${jacket.name} jacket, not drawstring under tailoring.`,
    },
    {
      category: "Shirts",
      role: "shirt",
      color: shirtA,
      query:
        `Men's long-sleeve ${shirtA.name} oxford or poplin button-down shirt — not short-sleeve, ` +
        `not light green, not lime, not yellow, not cream, not ivory, not V-neck. Colour ${shirtA.name} ${shirtA.hex}.`,
    },
    {
      category: "Shirts",
      role: "shirt",
      color: shirtB,
      query:
        `Men's long-sleeve ${shirtB.name} oxford or poplin button-down shirt — a second shirt, ` +
        `not light green, not lime, not yellow, not cream, not ivory. Colour ${shirtB.name} ${shirtB.hex}.`,
    },
    {
      category: "Knitwear",
      role: "knit",
      color: knit,
      query:
        `Men's plain ${knit.name} merino crewneck or fine-gauge roll-neck — long-sleeve, ` +
        `not printed, not colour-block, not geometric. Colour ${knit.name} ${knit.hex}.`,
    },
    {
      category: "Footwear",
      role: "dressShoe",
      color: dressShoe,
      query:
        `Men's ${dressShoe.name} leather derbies or oxfords — closed-toe, not loafers, not sneakers` +
        (opts?.cool ? ", not brown, not cognac, not tan" : "") +
        ".",
    },
    {
      category: "Footwear",
      role: "loafer",
      color: loafer,
      query:
        `Men's ${loafer.name} leather loafers — not derbies, not sneakers, not sandals` +
        (opts?.cool ? ", not brown, not cognac, not tan" : "") +
        ".",
    },
    {
      category: "Footwear",
      role: "sneaker",
      color: sneaker,
      query: `Men's ${sneaker.name} clean leather sneakers — not sandals, not running shoes.`,
    },
  ];

  if (opts?.polished) {
    slots.push({
      category: "Accessories",
      role: "belt",
      color: dressShoe,
      query: `Men's leather belt matching ${dressShoe.name} dress shoes — not sunglasses.`,
    });
    slots.push({
      category: "Accessories",
      role: "bag",
      color: darkTrouser,
      query: `Men's slim leather briefcase or messenger bag — not a tote, not sunglasses.`,
    });
  } else {
    slots.push({
      category: "Accessories",
      role: "belt",
      color: dressShoe,
      query: `Men's leather belt or a quiet necktie — not two pairs of sunglasses.`,
    });
  }

  const seen = new Set<string>();
  return slots.filter((s) => {
    uniquePush([], s.color);
    const key = `${s.role}:${s.color.hex}`;
    if (seen.has(key) && s.role !== "shirt") return true;
    seen.add(key);
    return true;
  });
}

function garmentNoun(title: string): string {
  const t = title.toLowerCase();
  if (/\b(sneakers?|trainers?)\b/.test(t)) return "sneakers";
  if (/\bloafers?\b/.test(t)) return "loafers";
  if (/\b(derb(?:y|ies)|oxfords?|brogues?)\b/.test(t) && !/\bshirt\b/.test(t)) {
    return "derbies";
  }
  if (/\b(shoes?|footwear)\b/.test(t)) return "shoes";
  if (/\b(blazers?|sport\s+coats?)\b/.test(t)) return "blazer";
  if (/\b(overshirts?|shackets?)\b/.test(t)) return "overshirt";
  if (/\b(windbreakers?|bombers?|parkas?|coats?|jackets?)\b/.test(t)) return "jacket";
  if (/\b(jeans?)\b/.test(t)) return "jeans";
  if (/\bchinos?\b/.test(t)) return "chinos";
  if (/\b(trousers?|pants?)\b/.test(t)) return "trousers";
  if (/\b(shirts?|oxfords?|button[- ]?(down|up))\b/.test(t)) return "shirt";
  if (/\b(jumpers?|sweaters?|crewnecks?|roll-?necks?|knit)\b/.test(t)) return "knit";
  if (/\b(ties?|neckties?)\b/.test(t)) return "tie";
  if (/\bbelts?\b/.test(t)) return "belt";
  return "piece";
}

function namedColor(
  title: string,
  hex?: string | null,
  colorName?: string | null,
): string {
  const named = colorName?.trim();
  if (named && !/^#?[0-9a-f]{6}$/i.test(named)) return named.toLowerCase();
  if (/\bnavy\b/i.test(title)) return "navy";
  const parsed = parseHex(hex ?? "");
  if (!parsed) return "";
  const { h, s, l } = hexToHsl(parsed);
  if (s < 0.12) {
    if (l <= 0.22) return "charcoal";
    if (l <= 0.4) return "dark grey";
    if (l <= 0.62) return "mid grey";
    return "light grey";
  }
  if (h >= 200 && h < 255 && l < 0.38) return "navy";
  if (h >= 70 && h < 155) return l > 0.45 ? "sage" : "green";
  if (h >= 40 && h < 80 && s < 0.38) return "olive";
  return "";
}

/**
 * Look-style one-liner for image prompts: "sage blazer, grey shirt, navy trousers".
 * Catalogue SEO titles do not go into the render brief.
 */
export function capsuleLookLine(
  pieces: string[],
  colorByTitle: Map<string, string>,
  colorNameByTitle?: Map<string, string>,
): string {
  return pieces
    .map((title) => {
      const word = namedColor(
        title,
        colorByTitle.get(title),
        colorNameByTitle?.get(title),
      );
      const noun = garmentNoun(title);
      return word ? `${word} ${noun}` : noun;
    })
    .join(", ");
}

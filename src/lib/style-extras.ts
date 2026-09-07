/**
 * Reader-facing style guides for the report: metals, watch, shoe, belt and
 * eyewear guides, accessories and headwear picks, fit and barber blueprints,
 * fabrics, care, the priority moves and the extras build.
 *
 * The rule modules this used to contain live next door and are re-exported
 * from here so existing imports keep working:
 *   garment-title  — what a title IS (loafer, shacket, pleated trouser)
 *   colour-rules   — colour families, leather tones, avoid / near-face gates
 *   look-garments  — look decomposition, title + colour scoring, harmony
 *   capsule-matrix — contexts × outfits, column blends, phases, price tiers
 * Dependency order is garment-title → colour-rules → look-garments →
 * capsule-matrix → this file. Put a new COLOUR rule in colour-rules, never here.
 */

import type { ColorRec, ShoppingItem, StyleReport } from "@/lib/report";
import {
  classifySubseason,
  SUBSEASON_LABELS,
  type StyleProfile,
} from "@/lib/style-profile";
import { NEUTRAL_SAT_MAX } from "@/lib/colour-palette";
import { humanizeProductTitle } from "@/lib/product-title";
import { type LeatherTargets } from "@/lib/capsule-wardrobe";

import {
  capsuleFrom,
  capsuleMatrix,
  priceTiersFrom,
  pickHero,
} from "@/lib/capsule-matrix";
import type {
  CapsulePlan,
  OutfitCombo,
  PriceTier,
} from "@/lib/capsule-matrix";
import {
  classicDressLeatherFamily,
  hexToHsl,
  leatherAnchorTone,
} from "@/lib/colour-rules";
import {
  CASUAL_FOOTWEAR_RE,
  SNEAKER_RE,
  cap,
  isLoaferTitle,
  lc,
} from "@/lib/garment-title";
export * from "@/lib/garment-title";
export * from "@/lib/colour-rules";
export * from "@/lib/look-garments";
export * from "@/lib/capsule-matrix";

export type FrameShapeId =
  | "rectangle"
  | "round"
  | "wayfarer"
  | "aviator"
  | "geometric";

export type Metal = { name: string; hex: string; why: string };

/** One recommended watch configuration (type + case × dial × strap) for a context. */
export type WatchVariant = {
  /** Context this variant is best for, e.g. "Boardroom", "Everyday", "Weekend". */
  context: string;
  /** Watch archetype, e.g. "Classic dress watch", "Field watch", "Dive watch". */
  type: string;
  /** Case shape, e.g. "Round", "Rectangular", "Square" (round is prioritised). */
  shape: string;
  caseMetal: string;
  caseHex: string;
  dial: string;
  dialHex: string;
  strap: string;
  strapHex: string;
  why: string;
};

export type WatchGuide = {
  intro: string;
  variants: WatchVariant[];
  /** How the watch reads from under the shirt cuff. */
  cuffNote: string;
  /** Case-shape guidance (round-first, with rectangular/square as alternatives). */
  shapeNote: string;
  avoidNote: string;
};

/** One recommended shoe "role" in the footwear system. */
export type ShoeVariant = {
  /** Role, e.g. "Dress", "Smart casual", "Everyday", "Seasonal". */
  role: string;
  /** Style archetype, e.g. "Oxfords / derbies", "Loafers", "Minimal white trainers". */
  style: string;
  /** Leather / material colour name, drawn from the client's neutral anchor. */
  color: string;
  colorHex: string;
  /**
   * Material / finish — "smooth leather", "suede", "nubuck". Prompt-only: fed
   * to the shoe-board image so the intended smooth-vs-suede contrast is rendered
   * (not left to the model's guess). NOT shown in the report/PDF and NOT
   * translated — the `why` copy already carries finish for the reader.
   */
  finish?: string;
  /** Contexts this pair covers, e.g. "Boardroom · client meeting". */
  wearWith: string;
  why: string;
};

export type ShoeGuide = {
  intro: string;
  variants: ShoeVariant[];
  /** The single-leather-tone rule (belt / bag / shoes match). */
  leatherRule: string;
  avoidNote: string;
};

/** One recommended belt for a context (strap + buckle + width). */
export type BeltVariant = {
  /** Context, e.g. "Jeans / casual", "Smart casual", "Business", "Evening / party". */
  context: string;
  /** Strap leather / material colour name. */
  strap: string;
  strapHex: string;
  /** Buckle style + metal finish, e.g. "Brushed silver single-prong". */
  buckle: string;
  /** Width guidance, e.g. "3.5–4 cm (wider, casual)". */
  width: string;
  /** Trouser types this belt pairs with. */
  wearWith: string;
  why: string;
};

/** A belt-to-trouser matching rule. */
export type BeltRule = { trouser: string; belt: string };

export type BeltGuide = {
  intro: string;
  variants: BeltVariant[];
  /** Belt leather ↔ shoes, buckle metal ↔ watch. */
  matchRule: string;
  /** How to pick a belt for each trouser type. */
  trouserRules: BeltRule[];
  avoidNote: string;
};

export type FrameRec = { shape: FrameShapeId; name: string; why: string };

export type FitSpec = { part: string; spec: string; why: string };

export type ColorCombo = { name: string; hexes: string[]; why: string };

export type GroomingItem = { title: string; detail: string };

export type PriorityMove = { n: string; title: string; why: string };

export type Pairings = {
  base: ColorRec[];
  accent: ColorRec[];
  hero: ColorRec | null;
  combos: ColorCombo[];
};

export type PatternKind =
  | "solid"
  | "stripe"
  | "check"
  | "tartan"
  | "windowpane"
  | "tonal";

export type PatternRec = { name: string; kind: PatternKind };

export type FinishingAccessory = {
  id: "watch" | "belt" | "sun" | "chain";
  name: string;
  note: string;
};

export type Archetype = { name: string; line: string };

export type ColorDNA = {
  subseason: string;
  neutrals: ColorRec[];
  bestWhite: string;
  bestDenim: string;
  metal: string;
  blackAlt: string;
  contrastRule: string;
  /** Colour-story section intro, tailored to the actual undertone + contrast. */
  colorStoryIntro: string;
};

export type StyleExtras = {
  archetype: Archetype;
  priorityMoves: PriorityMove[];
  colorDNA: ColorDNA;
  metals: { recommend: Metal[]; avoidNote: string };
  eyewear: { recommend: FrameRec[]; avoid: string[] };
  fitBlueprint: FitSpec[];
  barberBlueprint: FitSpec[];
  pairings: Pairings;
  fabrics: { name: string; why: string }[];
  /** Best patterns for this contrast / boldness — drives ch.8, not a demo set. */
  patterns: PatternRec[];
  /** Watch / belt / sun / chain notes from the same guides as the rest of the report. */
  finishingAccessories: FinishingAccessory[];
  capsule: CapsulePlan;
  matrix: OutfitCombo[];
  priceTiers: PriceTier[];
  grooming: GroomingItem[];
  styling: string[];
  care: string[];
  fragrance: string;
  /** Premium/lookbook watch styling guide (case, dial, strap tuned to palette). */
  watchGuide: WatchGuide;
  /** Premium/lookbook footwear system (3–4 shoe roles tuned to lifestyle + palette). */
  shoeGuide: ShoeGuide;
  /** Premium/lookbook belt system (casual → evening) tuned to undertone + palette. */
  beltGuide: BeltGuide;
};

function metalsFor(undertone: string): {
  recommend: Metal[];
  avoidNote: string;
} {
  if (lc(undertone) === "cool") {
    return {
      recommend: [
        { name: "Silver", hex: "#C7CCD1", why: "Cool brightness echoes your undertone and keeps metals from looking sallow." },
        { name: "Brushed steel", hex: "#9AA4AD", why: "A muted cool grey for watches and buckles — modern, never flashy." },
        { name: "White gold / platinum", hex: "#E3E4E6", why: "The dressiest cool metal for a watch or a single ring." },
      ],
      avoidNote: "Avoid bright yellow gold near the face — it fights a cool undertone.",
    };
  }
  if (lc(undertone) === "warm") {
    return {
      recommend: [
        { name: "Yellow gold", hex: "#C9A24B", why: "Warm gold harmonises with your undertone and warms the complexion." },
        { name: "Brass / bronze", hex: "#9A7B4F", why: "An understated warm metal for buckles and watch cases." },
        { name: "Cognac leather", hex: "#8A5A33", why: "Treat warm-toned leather as your 'metal' — straps, belts, shoes tie it together." },
      ],
      avoidNote: "Avoid bright chrome / cool silver next to the face — it can read cold against warm skin.",
    };
  }
  return {
    recommend: [
      { name: "Soft gold", hex: "#C2A35C", why: "Neutral undertones carry warm metals beautifully without overpowering." },
      { name: "Steel", hex: "#A2AAB2", why: "Cool steel also works — you can mix metals more freely than most." },
      { name: "Two-tone", hex: "#B8A06A", why: "A two-tone watch is a safe, versatile anchor for a neutral undertone." },
    ],
    avoidNote: "You can wear most metals — just keep the whole outfit to one dominant tone.",
  };
}

/** Pick a palette hex nearest a target lightness (0..1); falls back to `def`. */
function pickByLightness(
  palette: ColorRec[],
  target: number,
  def: { name: string; hex: string },
): { name: string; hex: string } {
  let best: { name: string; hex: string } | null = null;
  let bestGap = Infinity;
  for (const c of palette) {
    if (!/^#?[0-9a-f]{6}$/i.test((c.hex || "").trim())) continue;
    const gap = Math.abs(hexToHsl(c.hex).l - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = { name: c.name, hex: c.hex };
    }
  }
  return best ?? def;
}

/**
 * Deterministic watch styling guide — case metal (from undertone), dial and
 * strap tuned to the client's own palette, and watch *type* (dress, field,
 * diver, pilot, chronograph, skeleton, smartwatch…) chosen from the client's
 * lifestyle, goals and occupation. Three variants across a dress / everyday /
 * off-duty spread. Pure/rule-based like {@link metalsFor}; the report renders
 * these variants plus one generated flat-lay image (no brands). Dials are drawn
 * from the BEST palette so the section stays consistent with the colour chapter.
 * Case shapes are round-first (most versatile), with rectangular/square offered
 * only as a deliberate dress alternative.
 */
export function watchGuideFor(
  profile: StyleProfile,
  best: ColorRec[],
  opts?: {
    /** Footwear-system dress leather — the dress strap follows it (one leather story). */
    dressLeather?: { name: string; hex: string };
  },
): WatchGuide {
  const undertone = lc(profile.physical.undertone);
  const metals = metalsFor(undertone).recommend;
  const primaryMetal = metals[0] ?? { name: "Steel", hex: "#A2AAB2" };
  const secondaryMetal = metals[1] ?? primaryMetal;

  const warm = undertone === "warm";
  const cool = undertone === "cool";

  // Dial anchors, drawn from the client's own palette by lightness band.
  const lightDial = pickByLightness(best, 0.82, {
    name: warm ? "Warm cream" : "Silver white",
    hex: warm ? "#EFE7D6" : "#E7E9EC",
  });
  const midDial = pickByLightness(best, 0.5, {
    name: warm ? "Olive" : "Slate blue",
    hex: warm ? "#6E6A4A" : "#4E6076",
  });
  const darkDial = pickByLightness(best, 0.3, {
    name: warm ? "Espresso" : "Soft charcoal",
    hex: warm ? "#3B322A" : "#3A3F47",
  });

  // Straps: dark leather for dress, matching-metal bracelet for daily, a softer
  // suede/fabric for weekend. The dress strap is small leather goods — it
  // follows the footwear system's dress leather (black for business-etiquette
  // professions, burgundy / dark brown otherwise) so belt, shoes and strap tell
  // one story. Without that anchor: black only when Black is in BEST, else
  // cool → charcoal/navy, warm → dark brown.
  const blackFromBest = best.find((c) => /^black$/i.test((c.name || "").trim()));
  const deepDialLeather = pickByLightness(best, 0.28, {
    name: warm ? "Espresso" : "Charcoal",
    hex: warm ? "#3B322A" : "#3A3F47",
  });
  const dressLeather = opts?.dressLeather
    ? {
        name: /leather$/i.test(opts.dressLeather.name)
          ? opts.dressLeather.name
          : `${opts.dressLeather.name} leather`,
        hex: opts.dressLeather.hex,
      }
    : warm
      ? { name: "Dark brown leather", hex: "#4A3526" }
      : blackFromBest
        ? { name: "Black leather", hex: blackFromBest.hex }
        : /navy|blue|slate|indigo/i.test(deepDialLeather.name)
          ? { name: `${deepDialLeather.name} leather`, hex: deepDialLeather.hex }
          : { name: "Charcoal leather", hex: deepDialLeather.hex };
  const bracelet = { name: `${primaryMetal.name} bracelet`, hex: primaryMetal.hex };
  const casualStrap = warm
    ? { name: "Tan suede / fabric", hex: "#9A7B54" }
    : { name: "Grey suede / fabric", hex: "#7C818A" };
  const rubberStrap = warm
    ? { name: "Khaki rubber / NATO", hex: "#6E6A4A" }
    : { name: "Navy rubber / NATO", hex: "#2E3A4A" };

  const metalLine = cool
    ? "cool steel or white metal keeps the wrist crisp against your undertone"
    : warm
      ? "warm gold or bronze glows with your undertone"
      : "steel, gold or two-tone all sit comfortably on a neutral undertone";

  // --- Lifestyle / goals / occupation signals -----------------------------
  const occ = lc(profile.occupation ?? "");
  const signal = `${profile.goals.join(" ")} ${(profile.lifestyle ?? []).join(" ")} ${occ} ${profile.boldness}`.toLowerCase();
  const has = (re: RegExp) => re.test(signal);

  const formalPro = has(
    /law|legal|attorney|lawyer|solicitor|barrister|finance|bank|invest|consult|business|founder|exec|corporate|office|boardroom|suit|profession/,
  );
  const active = has(/active|outdoor|sport|gym|fitness|run|hike|athlet|dive|swim|surf/);
  const travels = has(/travel|flight|flies|jet|frequent flyer|abroad|nomad/);
  const techy = has(/software|\bit\b|developer|engineer|\btech\b|startup|creator|blog|camera|digital/);
  const bold = has(/bold|statement|stand out|attract|impress|charism/) || lc(profile.boldness) === "high";
  const heritage = has(/old money|classic|heritage|understated|timeless|elegan|refin/);
  const creative = has(/creative|artist|design|architect|music|film|fashion/);

  // 1) Dress / most-formal slot — round classic by default; a skeleton for the
  //    bold/creative, a rectangular dress watch for a heritage statement.
  const dressType = bold || creative ? "Dress skeleton (open-worked dial)" : "Classic dress watch";
  const dressShape = heritage && !bold ? "Rectangular" : "Round";
  const dressContext = formalPro ? "Boardroom" : creative ? "Evenings out" : "Dressed up";

  // 2) Everyday slot — matching-metal bracelet workhorse; type flexes to the
  //    person: smart/minimal for tech, field for active, pilot/GMT for travellers.
  const everydayType = travels
    ? "Pilot / GMT watch"
    : active
      ? "Field watch"
      : techy
        ? "Minimalist everyday (or smartwatch)"
        : "Everyday automatic";

  // 3) Off-duty slot — sportiest; diver for active/water, pilot for travellers,
  //    chronograph for sporty, field otherwise.
  const weekendType = active
    ? "Dive watch"
    : travels
      ? "Pilot / aviator"
      : has(/race|drive|motor|speed|sport/)
        ? "Sports chronograph"
        : "Field watch";
  const weekendStrap = active || weekendType === "Dive watch" ? rubberStrap : casualStrap;

  const variants: WatchVariant[] = [
    {
      context: dressContext,
      type: dressType,
      shape: dressShape,
      caseMetal: primaryMetal.name,
      caseHex: primaryMetal.hex,
      dial: lightDial.name,
      dialHex: lightDial.hex,
      strap: dressLeather.name,
      strapHex: dressLeather.hex,
      why:
        `A ${dressType.toLowerCase()} with a light dial on a slim ${dressLeather.name.toLowerCase()} ` +
        `strap is the dressiest read — clean under a suit cuff` +
        (dressShape === "Rectangular"
          ? "; a rectangular case adds vintage polish while staying discreet."
          : "."),
    },
    {
      context: "Everyday",
      type: everydayType,
      shape: "Round",
      caseMetal: primaryMetal.name,
      caseHex: primaryMetal.hex,
      dial: darkDial.name,
      dialHex: darkDial.hex,
      strap: bracelet.name,
      strapHex: bracelet.hex,
      why:
        `A ${everydayType.toLowerCase()} with a ${darkDial.name.toLowerCase()} dial on a matching metal ` +
        `bracelet is the daily workhorse — versatile with tailoring and knitwear alike.`,
    },
    {
      context: "Weekend",
      type: weekendType,
      shape: "Round",
      caseMetal: secondaryMetal.name,
      caseHex: secondaryMetal.hex,
      dial: midDial.name,
      dialHex: midDial.hex,
      strap: weekendStrap.name,
      strapHex: weekendStrap.hex,
      why:
        `A ${weekendType.toLowerCase()} with a ${midDial.name.toLowerCase()} dial on ${weekendStrap.name.toLowerCase()} ` +
        `relaxes the watch for off-duty looks while staying on your palette.`,
    },
  ];

  const lifestyleBits: string[] = [];
  if (formalPro) lifestyleBits.push("time in suits and meetings");
  if (active) lifestyleBits.push("an active, outdoors streak");
  if (travels) lifestyleBits.push("frequent travel");
  if (techy) lifestyleBits.push("a tech-forward day-to-day");
  const lifestyleLine = lifestyleBits.length
    ? ` Your picks lean into ${lifestyleBits.slice(0, 2).join(" and ")}.`
    : "";

  return {
    intro:
      `Your watch is the one piece of jewellery you wear every day — worth getting right. ` +
      `Case metal follows your undertone (${metalLine}); the dial is pulled from your own palette; ` +
      `and the watch *type* is chosen for how you actually spend your time.${lifestyleLine}`,
    variants,
    cuffNote:
      "Sizing: keep the case moderate so it slips under a shirt cuff — you want about a centimetre of cuff over it. " +
      "A light dial against a darker cuff reads sharp and intentional; a dial close to your cuff colour reads quieter and dressier.",
    shapeNote:
      "Shape: a round case is the most versatile and flattering — make it your default. " +
      "A rectangular (or soft-square) case is a sharp dress alternative for a vintage, more formal statement; " +
      "keep true squares small and dressy.",
    avoidNote:
      `${metalsFor(undertone).avoidNote} Also skip oversized, high-contrast or logo-heavy dials — they fight tailoring and date quickly.`,
  };
}

/**
 * Deterministic footwear system — 3–4 shoe "roles" (dress → smart casual →
 * everyday → seasonal) chosen from the client's undertone, palette, lifestyle,
 * goals and occupation. Leather colour follows one dominant anchor so belt /
 * strap / bag / shoes stay in a single tone. Pure/rule-based like the watch and
 * metals guides; the report renders these plus one generated flat-lay (no
 * brands). Emphasis on a small, versatile system rather than a long list.
 */
export function shoeGuideFor(
  profile: StyleProfile,
  best: ColorRec[],
  avoid: ColorRec[] = [],
): ShoeGuide {
  const undertone = lc(profile.physical.undertone);
  const warm = undertone === "warm";
  const cool = undertone === "cool";

  // Brown is broadly versatile, but only when the client's palette doesn't
  // actively reject warm brown. If any brown-family colour sits in AVOID we skip
  // the brown accent pair and fall back to a palette-safe suede.
  const avoidBrown = (avoid ?? []).some((c) =>
    /brown|cognac|tan|camel|chestnut|espresso|chocolate|mocha/i.test(
      c.name || "",
    ),
  );

  // DRESS shoes (oxfords/derbies) are the most formal item — their colour is
  // restricted to the CLASSIC formal leathers only: black, dark brown or
  // burgundy/oxblood. Coloured leather (navy/slate) is NOT worn on oxfords — it
  // clashes with suit trousers — so it lives on the smart-casual loafer instead.
  const darkBrown = { name: "Dark brown", hex: "#4A3526" };
  const cognac = { name: "Cognac", hex: "#8A5A33" };
  // Burgundy / oxblood: the cool-friendly formal dark (red-purple cast) — the
  // elegant answer to "not black" for a cool client's dress shoe.
  const burgundy = { name: "Burgundy", hex: "#5A2A2E" };
  const whiteLeather = { name: "White / off-white", hex: "#ECEAE3" };
  const suedeTaupe = warm
    ? { name: "Tan suede", hex: "#9A7B54" }
    : { name: "Grey suede", hex: "#7C818A" };

  const blackFromBest = best.find((c) => /^black$/i.test((c.name || "").trim()));
  // Coloured smart-casual leather (loafers): a blue-cast BEST swatch at mid-dark
  // lightness so it reads as navy/slate in photos, not near-black.
  const coolPool = best.filter((c) =>
    /navy|blue|slate|indigo|teal|plum|grey|gray|charcoal/i.test(c.name),
  );
  const deepFromPalette = pickByLightness(
    coolPool.length ? coolPool : best,
    0.38,
    { name: "Muted navy", hex: "#3E4C63" },
  );
  // Lifestyle / goals / occupation signals (same source as the watch guide).
  const occ = lc(profile.occupation ?? "");
  const signal = `${profile.goals.join(" ")} ${(profile.lifestyle ?? []).join(" ")} ${occ} ${profile.boldness}`.toLowerCase();
  const has = (re: RegExp) => re.test(signal);
  // Boardroom / law / finance — black and dark brown are etiquette, not a
  // seasonal colour. Read from the OCCUPATION and an explicit dress-code
  // lifestyle tag only: a "dating" goal or "business travel" must not turn a
  // cool client's dress shoe black.
  const etiquetteSignal = `${occ} ${(profile.lifestyle ?? []).join(" ")}`.toLowerCase();
  const businessEtiquette =
    /law|legal|attorney|lawyer|solicitor|barrister|finance|financial|\bbank(?:ing|er)?\b|investment bank|private equity|\bm&a\b|consultant|consulting|executive|\bceo\b|\bcfo\b|\bcoo\b|director|corporate|boardroom|dress code|suit daily|formal office/.test(
      etiquetteSignal,
    );
  // Dress leather — classic formal only, never coloured oxfords.
  const dressLeather = blackFromBest
    ? { name: "Black", hex: blackFromBest.hex }
    : businessEtiquette
      ? warm
        ? darkBrown
        : { name: "Black", hex: "#1C1C1E" }
      : warm
        ? darkBrown
        : cool
          ? burgundy
          : darkBrown;
  // Loafer / smart-casual leather — the palette's most CHARACTERFUL wearable
  // colour (navy, green, teal, plum, burgundy, olive, tobacco...) rather than a
  // fixed navy, so smart-casual shoes carry real, client-specific colour. Pick
  // the most saturated mid-dark BEST swatch that isn't the dress anchor.
  //
  // Shoe-colour guardrail (the loafer is the ONLY pair sourced from the wardrobe
  // palette, so it's the one place a non-shoe hue can leak in):
  //  • NOVELTY hues (pink/coral/turquoise/yellow/lime/lavender…) are never a
  //    believable leather — rejected for EVERYONE, including statement clients
  //    ("considered, not a fashion victim").
  //  • LOUD-but-real hues (bright/true red, cobalt, golden) are allowed only for
  //    the bold tier (statement / experimental); conservative & moderate clients
  //    fall back to a safe characterful colour instead.
  // Mocs/boots/sneakers are NOT opened up: their colours are functional (dark to
  // hide travel wear, light neutral trainer) — the penny loafer is the natural
  // statement-colour carrier.
  const boldTier = /statement|experimental/.test(lc(profile.boldness ?? ""));
  const NOVELTY_HUE =
    /fuchsia|magenta|\bpink\b|coral|salmon|peach|apricot|lilac|lavender|\bmint\b|pistachio|\blime\b|apple green|chartreuse|canary|lemon|\byellow\b|turquoise|aqua|\bcyan\b|neon|electric|fluoro/i;
  const LOUD_REAL_HUE = /true red|warm red|bright red|scarlet|cobalt/i;
  const shoeHueOk = (name: string) => {
    if (NOVELTY_HUE.test(name)) return false;
    if (!boldTier && LOUD_REAL_HUE.test(name)) return false;
    return true;
  };
  const richLoafer = best
    .filter((c) => {
      if (!/^#?[0-9a-f]{6}$/i.test((c.hex || "").trim())) return false;
      if (c.hex.toLowerCase() === dressLeather.hex.toLowerCase()) return false;
      if (!shoeHueOk(c.name || "")) return false;
      const { s, l } = hexToHsl(c.hex);
      return l >= 0.22 && l <= 0.6 && s >= 0.18;
    })
    .sort((a, b) => hexToHsl(b.hex).s - hexToHsl(a.hex).s)[0];
  const smartLeather = richLoafer
    ? { name: richLoafer.name, hex: richLoafer.hex }
    : warm
      ? cognac
      : blackFromBest
        ? { name: "Dark charcoal", hex: "#2A2E34" }
        : {
            name: /navy|blue|slate|indigo|teal/i.test(deepFromPalette.name)
              ? deepFromPalette.name
              : "Slate blue",
            hex: deepFromPalette.hex,
          };
  const blackIsOk = Boolean(blackFromBest);

  // Everyday trainer — the palette's LIGHTEST NEUTRAL (cream / stone / greige /
  // light grey) rather than a hard white, so the sneaker stays on-palette. Only
  // falls back to a universal off-white when the palette has no genuinely light
  // neutral swatch.
  const lightNeutralPool = best.filter(
    (c) =>
      /white|cream|ivory|ecru|linen|pearl|oat|oatmeal|sand|stone|greige|beige|taupe|mushroom|grey|gray|silver|dove|fog|mist|pewter|bone|chalk|alabaster|porcelain|vanilla|almond/i.test(
        c.name || "",
      ) && hexToHsl(c.hex).l >= 0.62,
  );
  const everydayLeather = lightNeutralPool.length
    ? pickByLightness(lightNeutralPool, 0.92, whiteLeather)
    : whiteLeather;

  const formalPro = has(
    /law|legal|attorney|lawyer|solicitor|barrister|finance|bank|invest|consult|business|founder|exec|corporate|office|boardroom|suit|profession/,
  );
  const active = has(/active|outdoor|sport|gym|fitness|run|hike|athlet|dive|swim|surf/);
  const travels = has(/travel|flight|flies|jet|frequent flyer|abroad|nomad/);

  const variants: ShoeVariant[] = [];

  // 1) Dress — Derbies are the default (more versatile + comfortable, perfectly
  //    office-appropriate). Oxfords, the strictest closed-lacing shoe, are
  //    reserved for the most formal, conservative professions — law/courtroom
  //    plus front-office finance, M&A, private equity and management consulting,
  //    where a plain cap-toe oxford is the expected dress code. Deliberately NOT
  //    all of `formalPro` (which includes founders / general office / "business"
  //    where a derby is entirely appropriate), so the derby + broguing nuance
  //    below still applies to everyone else. Broguing (decorative perforation)
  //    signals personality: more broguing = less formal, tuned to the client's goals.
  const veryFormal = has(
    /law|legal|attorney|lawyer|solicitor|barrister|finance|financial|\bbank(?:ing|er)?\b|invest(?:ment|or|ing)?|m&a|merger|acquisition|private equity|consult/,
  );
  const dressWord = veryFormal ? "oxford" : "derby";
  const dating = has(
    /date|dating|romance|romantic|relationship|confidence|charism|attract|impress/,
  );
  const expressive =
    has(/bold|statement|stand out|creative|fashion|expressive|personality/) ||
    /high|bold/.test(lc(profile.boldness ?? ""));
  const heritage = has(
    /old money|classic|heritage|understated|timeless|elegan|refin|tailor/,
  );
  // Formality-safe broguing: never on the law/courtroom oxford; a semi-brogue for
  // dating / expressive clients (character without shouting); a subtle
  // quarter-brogue for heritage tastes; otherwise plain.
  const brogue: "plain" | "semi" | "quarter" = veryFormal
    ? "plain"
    : dating || expressive
      ? "semi"
      : heritage
        ? "quarter"
        : "plain";
  const brogueLabel =
    brogue === "semi"
      ? "Semi-brogue derbies"
      : brogue === "quarter"
        ? "Quarter-brogue derbies"
        : "Derbies";
  const brogueNote =
    brogue === "semi"
      ? "A semi-brogue — a perforated, medallion toe cap — adds character and a little charisma without reading loud, so it still works under tailoring and shines on dinners and dates. "
      : brogue === "quarter"
        ? "A quarter-brogue — subtle perforation along the seams only — is a tasteful heritage nod that stays refined. "
        : veryFormal
          ? "Kept plain (no broguing) for maximum formality — the right call for court and the boardroom. "
          : "Kept plain for maximum versatility. ";
  variants.push({
    role: "Dress",
    style: veryFormal ? "Oxfords (plain cap-toe)" : brogueLabel,
    color: dressLeather.name,
    colorHex: dressLeather.hex,
    wearWith: formalPro ? "Boardroom · client meetings · formal" : "Weddings · evenings out · tailoring",
    why:
      `Your dressiest shoe — a sleek ${dressLeather.name.toLowerCase()} ${dressWord} anchors every ` +
      `suit and dark trouser. ` +
      (veryFormal
        ? "The closed lacing of an oxford is the strictest, most formal choice — right for court and the boardroom. "
        : "A derby's open lacing is a touch more versatile and comfortable — the ideal all-round office dress shoe. ") +
      brogueNote +
      `Leather sole or a discreet rubber one for grip.`,
  });

  // 2) Smart casual — PENNY loafers (or Chelsea boots for the rugged/cool set).
  const smartStyle = cool && active ? "Chelsea boots" : "Penny loafers";
  const smartWord = cool && active ? "chelsea boot" : "penny loafer";
  variants.push({
    role: "Smart casual",
    style: smartStyle,
    color: smartLeather.name,
    colorHex: smartLeather.hex,
    wearWith: "Client lunch · smart casual · dinner",
    why:
      `A ${smartLeather.name.toLowerCase()} ${smartWord} bridges tailoring and denim — ` +
      `wear with chinos, unstructured blazers and dark jeans. The smooth-leather workhorse of the system.`,
  });

  // 3) Everyday — minimal leather trainers in the palette's lightest neutral.
  variants.push({
    role: "Everyday",
    style: "Minimal leather trainers",
    color: everydayLeather.name,
    colorHex: everydayLeather.hex,
    wearWith: "Weekend · travel · everyday",
    why:
      `A clean, low-profile ${everydayLeather.name.toLowerCase()} leather sneaker — the lightest ` +
      `neutral in your palette, no bulky soles or loud branding. Dresses down a blazer and lifts ` +
      `jeans-and-a-tee; keep them genuinely clean.`,
  });

  // Lifestyle swaps: an active client who ALSO travels often shouldn't get three
  // loafer-ish pairs. In that case slot 4 (normally the tassel loafer) becomes a
  // weatherproof trekking boot and slot 5 (normally the moccasin) becomes a
  // travel sneaker. Active-only → boot at slot 5; travel-only → sneaker at slot 5.
  const brownWearable = !avoidBrown;
  // Cool clients who CAN wear brown get a cooler, greyed brown so it still sits
  // with a cool palette instead of a warm cognac.
  const versatileBrown = warm
    ? cognac
    : cool
      ? { name: "Cool taupe brown", hex: "#6E5A47" }
      : darkBrown;

  const pickDistinct = (
    cands: { name: string; hex: string }[],
    used: Set<string>,
  ) =>
    cands.find((c) => !used.has(c.hex.toLowerCase())) ?? cands[cands.length - 1];

  const pushTrekkingBoots = () => {
    const used = new Set(variants.map((v) => v.colorHex.toLowerCase()));
    const c = pickDistinct(
      brownWearable
        ? [
            { name: "Chocolate brown", hex: "#4B3621" },
            { name: "Dark brown", hex: "#5A4632" },
            { name: "Charcoal", hex: "#2A2E34" },
          ]
        : [
            { name: "Charcoal", hex: "#2A2E34" },
            { name: "Slate grey", hex: "#4A4E57" },
          ],
      used,
    );
    variants.push({
      role: "Outdoor",
      style: "Trekking boots",
      color: c.name,
      colorHex: c.hex,
      wearWith: "Outdoors · cold / wet · trails",
      why:
        `A weatherproof ${c.name.toLowerCase()} leather / nubuck boot with a grippy lugged sole ` +
        "for trails, cold and wet days — rugged but still tidy with denim and knitwear. " +
        "Chosen because your lifestyle is active and outdoors.",
    });
  };

  const pushTravelSneakers = () => {
    const used = new Set(variants.map((v) => v.colorHex.toLowerCase()));
    const c = pickDistinct(
      [
        { name: "Navy", hex: "#2E3A4A" },
        { name: "Charcoal", hex: "#3A3E44" },
        { name: "Slate grey", hex: "#4A4E57" },
        ...(brownWearable ? [{ name: "Dark brown", hex: "#5A4632" }] : []),
      ],
      used,
    );
    variants.push({
      role: "Travel",
      style: "Travel sneakers",
      color: c.name,
      colorHex: c.hex,
      wearWith: "Travel · long days · off-duty",
      why:
        `A cushioned, low-profile ${c.name.toLowerCase()} travel sneaker — comfortable for long ` +
        "days and dark enough to hide wear on the move, without the bulk of a running shoe. " +
        "Chosen because you travel often.",
    });
  };

  // 4) Versatile — a suede TASSEL loafer (deliberately different from the smooth
  //    penny above), UNLESS the client is both active and a frequent traveller,
  //    in which case this slot becomes the weatherproof trekking boot.
  if (active && travels) {
    pushTrekkingBoots();
  } else {
    const tasselColor = brownWearable ? versatileBrown : suedeTaupe;
    variants.push({
      role: "Versatile",
      style: "Suede tassel loafers",
      color: tasselColor.name,
      colorHex: tasselColor.hex,
      wearWith: "Smart casual · office · dinner",
      why:
        `A ${tasselColor.name.toLowerCase()} suede tassel loafer adds character and texture beyond the ` +
        `smooth penny above — dressy enough for the office, relaxed enough for dinner.` +
        (cool && brownWearable
          ? " Chosen in a cooler, greyed brown so it stays with your palette."
          : ""),
    });
  }

  // 5) Casual — driving moccasins by default. Active clients get trekking boots,
  //    frequent travellers get travel sneakers; a client who is BOTH already got
  //    the boot at slot 4, so here they get the sneaker.
  if (active && travels) {
    pushTravelSneakers();
  } else if (active) {
    pushTrekkingBoots();
  } else if (travels) {
    pushTravelSneakers();
  } else {
    // Classic driving-moc tone (tan / cognac / navy / brown) chosen by undertone,
    // not pulled from the wardrobe palette, and kept distinct from the other four
    // pairs. Browns are skipped when brown sits in AVOID.
    const usedHex = new Set(variants.map((v) => v.colorHex.toLowerCase()));
    const BROWN_MOCS = [
      { name: "Tan", hex: "#B08D57" },
      { name: "Cognac", hex: "#8A5A2B" },
      { name: "Chocolate brown", hex: "#4B3621" },
    ];
    const NEUTRAL_MOCS = [
      { name: "Navy", hex: "#2E3A4A" },
      { name: "Slate grey", hex: "#4A4E57" },
      { name: "Taupe", hex: "#8A7B66" },
    ];
    const mocCandidates = (
      avoidBrown
        ? NEUTRAL_MOCS
        : warm
          ? [...BROWN_MOCS, ...NEUTRAL_MOCS]
          : cool
            ? [NEUTRAL_MOCS[0], ...BROWN_MOCS.slice(0, 2), NEUTRAL_MOCS[1]]
            : [BROWN_MOCS[0], NEUTRAL_MOCS[0], BROWN_MOCS[1], ...NEUTRAL_MOCS.slice(1)]
    ).filter((c) => !usedHex.has(c.hex.toLowerCase()));
    const mocColor = mocCandidates[0] ?? { name: "Taupe", hex: "#8A7B66" };
    variants.push({
      role: "Casual",
      style: "Driving moccasins",
      color: mocColor.name,
      colorHex: mocColor.hex,
      wearWith: "Weekend · summer · driving",
      why:
        `A soft, unlined ${mocColor.name.toLowerCase()} driving moccasin with a pebbled rubber sole — ` +
        `your most relaxed pair. Wear it sockless with chinos or shorts in warm weather.`,
    });
  }

  // Material/finish per pair, derived from the style archetype in one place
  // (prompt-only — see ShoeVariant.finish). Guarantees the smooth penny ↔ suede
  // tassel contrast the copy promises, instead of leaving finish to the model.
  const finishForStyle = (style: string): string => {
    const s = style.toLowerCase();
    if (s.includes("suede")) return "suede";
    if (s.includes("trekking") || s.includes("hiking")) return "nubuck";
    return "smooth leather";
  };
  for (const v of variants) v.finish = finishForStyle(v.style);

  const anchorName = dressLeather.name.toLowerCase();
  const lastTwoDesc =
    active && travels
      ? "a weatherproof trekking boot and a cushioned travel sneaker"
      : active
        ? "a characterful suede tassel loafer and a weatherproof trekking boot"
        : travels
          ? "a characterful suede tassel loafer and a cushioned travel sneaker"
          : "a characterful suede tassel loafer and a relaxed driving moccasin";
  return {
    intro:
      "You don't need many shoes — you need the right few that cover every context. " +
      "This is a compact system of five with a deliberately different silhouette each: a dress " +
      `${dressWord}, a smart penny loafer, a clean everyday trainer, ${lastTwoDesc}. ` +
      "Colours follow a single leather anchor so everything coordinates.",
    variants,
    leatherRule:
      `Keep your belt, watch strap, bag and shoes to one leather tone per outfit — ${anchorName} is your anchor. ` +
      (warm
        ? businessEtiquette
          ? "Dark brown is your everyday dress leather; black remains office etiquette for the strictest boardroom looks."
          : "Warm brown / cognac leathers flatter your undertone. Black dress leather is office etiquette, not a seasonal avoid — just don't mix it with brown in the same outfit."
        : blackIsOk
          ? "Black leather is a clean formal anchor for your colouring — keep brown out of the same outfit."
          : businessEtiquette
            ? "Black or dark-brown dress leather is office etiquette — it does not have to follow seasonal colour analysis. " +
              "Keep jet-black sneakers and black near the face off the list; save navy/slate for loafers."
            : cool
              ? "Burgundy or dark-brown leather is your palette-friendly dress shoe. " +
                "Black or dark-brown derbies remain office etiquette when you need a boardroom pair. " +
                "Skip jet-black sneakers and coloured oxfords (navy oxfords fight suit trousers). Save navy/slate for loafers." +
                (brownWearable
                  ? " A cooler, greyed brown works as a relaxed accent — just don't mix it with your dress anchor in one outfit."
                  : "")
              : "Dark brown or burgundy leather is your palette-friendly dress shoe. Black remains office etiquette; save navy/slate for loafers."),
    avoidNote: blackIsOk
      ? "Avoid chunky or logo-heavy trainers with tailoring, square-toe dress shoes, " +
        "and mixing black with brown leather in the same outfit."
      : "Avoid jet-black sneakers and black near the face, chunky or logo-heavy trainers with " +
        "tailoring, square-toe dress shoes, and mixing mismatched leather tones in the same outfit. " +
        "Black or dark-brown dress leather is classic business etiquette.",
  };
}

export type ShoeGuideCard = {
  name: string;
  color: string;
  colorHex: string;
  image?: string;
};

function shoeFitsVariant(title: string, variant: ShoeVariant): boolean {
  const hay = `${variant.role} ${variant.style}`.toLowerCase();
  if (/trainer|sneaker/.test(hay) || /everyday|travel/i.test(variant.role)) {
    return SNEAKER_RE.test(title);
  }
  if (/\b(chelsea|trek(?:king)?|hiking|boots?)\b/.test(hay) && !/loafer/.test(hay)) {
    return /\b(boots?|chelsea)\b/i.test(title) && !SNEAKER_RE.test(title);
  }
  if (/loafer|moccasin|penny|driving/.test(hay)) {
    return isLoaferTitle(title) || /moccasin|driving/i.test(title);
  }
  return (
    !SNEAKER_RE.test(title) &&
    !isLoaferTitle(title) &&
    !CASUAL_FOOTWEAR_RE.test(title)
  );
}

/** Dress / smart / everyday colours the shopping recipe must follow. */
export function leatherTargetsFromGuide(guide: ShoeGuide): LeatherTargets {
  const dress = guide.variants.find((v) => /dress/i.test(v.role)) ?? guide.variants[0];
  const smart =
    guide.variants.find((v) => /smart/i.test(v.role)) ?? guide.variants[1] ?? dress;
  const everyday =
    guide.variants.find((v) => /everyday|trainer|sneaker/i.test(v.role)) ??
    guide.variants[2] ??
    dress;
  return {
    dress: { name: dress?.color ?? "Dark brown", hex: dress?.colorHex ?? "#4A3526" },
    smart: { name: smart?.color ?? "Cognac", hex: smart?.colorHex ?? "#8A5A33" },
    everyday: {
      name: everyday?.color ?? "White / off-white",
      hex: everyday?.colorHex ?? "#ECEAE3",
    },
  };
}

/** True when a shopping pick tells the same leather story as the footwear system. */
export function leatherStoryAgrees(
  guideColor: string,
  itemTitle: string,
  itemHex?: string | null,
  similarPick?: boolean,
): boolean {
  const want = classicDressLeatherFamily(guideColor);
  const got = classicDressLeatherFamily(`${itemTitle} ${itemHex ?? ""}`, itemHex);
  if (!want || !got) return false;
  if (want === got) return true;
  return Boolean(similarPick);
}

/** Soft rank: report leather family first, everything else keeps its order. */
export function preferLeatherAnchor<T>(
  rows: T[],
  familyOf: (row: T) => "black" | "brown" | null,
  want: "black" | "brown" | null,
): T[] {
  if (!want) return rows;
  return [...rows].sort((a, b) => {
    const am = familyOf(a) === want ? 1 : 0;
    const bm = familyOf(b) === want ? 1 : 0;
    return bm - am;
  });
}

/** Tiles for the details "Shoe guide" — same pairs as the footwear system. */
export function shoeGuideCards(
  guide: ShoeGuide,
  shopping: ShoppingItem[] = [],
): ShoeGuideCard[] {
  const unused = shopping.filter((i) => i.category === "Footwear");
  return guide.variants.map((v) => {
    const idx = unused.findIndex((s) => shoeFitsVariant(s.title, v));
    const item = idx >= 0 ? unused.splice(idx, 1)[0] : undefined;
    return {
      name: `${v.color} ${v.style}`,
      color: v.color,
      colorHex: v.colorHex,
      image: item?.image,
    };
  });
}

/**
 * Deterministic belt system (casual → evening). Belt leather mirrors the
 * footwear anchors so belt-and-shoes always coordinate, and the buckle metal
 * follows the undertone's recommended jewellery metal. Includes explicit
 * belt-to-trouser rules so the client knows what to reach for with each trouser.
 */
export function beltGuideFor(
  profile: StyleProfile,
  best: ColorRec[],
  avoid: ColorRec[] = [],
  shopping: ShoppingItem[] = [],
): BeltGuide {
  const undertone = lc(profile.physical.undertone);
  const warm = undertone === "warm";
  const cool = undertone === "cool";

  const metals = metalsFor(undertone).recommend;
  const buckleMetal = (metals[0]?.name ?? (warm ? "Warm gold" : "Silver")).replace(
    /\s*\(.*\)$/,
    "",
  );

  // Leather anchors mirror the footwear system so the belt matches the shoes.
  const blackFromBest = best.find((c) => /^black$/i.test((c.name || "").trim()));
  const avoidBrown = (avoid ?? []).some((c) =>
    /brown|cognac|tan|camel|chestnut|espresso|chocolate|mocha/i.test(c.name || ""),
  );
  const darkBrown = { name: "Dark brown", hex: "#4A3526" };
  const cognac = { name: "Cognac", hex: "#8A5A33" };
  const burgundy = { name: "Burgundy", hex: "#5A2A2E" };
  const charcoal = { name: "Charcoal", hex: "#3A3F47" };
  const black = { name: "Black", hex: blackFromBest?.hex ?? "#1A1A1A" };

  const dressShoe = shopping.find(
    (i) =>
      i.category === "Footwear" &&
      !SNEAKER_RE.test(i.title) &&
      !isLoaferTitle(i.title) &&
      !CASUAL_FOOTWEAR_RE.test(i.title),
  );
  const shoeLeather = (() => {
    if (!dressShoe) return null;
    const hay = `${dressShoe.title} ${dressShoe.color ?? ""}`.toLowerCase();
    if (/navy|blue|indigo|slate/i.test(hay) || dressShoe.color === "#28324A" || dressShoe.color === "#1e2a3a") {
      return { name: "Navy / slate", hex: dressShoe.color && /^#/.test(dressShoe.color) ? dressShoe.color : "#2E3A4A" };
    }
    if (/burgundy|oxblood|wine/i.test(hay)) return burgundy;
    if (/black/i.test(hay)) return black;
    if (/brown|cognac|tan|chestnut/i.test(hay)) return darkBrown;
    return null;
  })();

  // Formal belt = the dress-shoe leather: shopping first, else black if in
  // palette, else warm → dark brown, cool → burgundy.
  const formalLeather = shoeLeather
    ? shoeLeather
    : blackFromBest
      ? black
      : warm
        ? darkBrown
        : cool
          ? burgundy
          : darkBrown;
  // Casual belt = warm/neutral brown; if the palette rejects warm brown, a cool
  // charcoal reads cleaner than forcing tan.
  const casualLeather = avoidBrown ? (cool ? charcoal : darkBrown) : darkBrown;
  // Smart-casual belt — a touch richer than the everyday brown.
  const smartLeather = avoidBrown
    ? cool
      ? charcoal
      : darkBrown
    : warm
      ? cognac
      : burgundy;

  const variants: BeltVariant[] = [
    {
      context: "Jeans / casual",
      strap: casualLeather.name,
      strapHex: casualLeather.hex,
      buckle: `${buckleMetal} brushed / antiqued single-prong (matte)`,
      width: "3.5–4 cm (wider, relaxed)",
      wearWith: "Denim · casual chinos · cords",
      why:
        `A slightly wider, matte ${casualLeather.name.toLowerCase()} belt with a low-shine buckle ` +
        `balances the heavier weight of denim. Casual leather (pull-up, textured or suede) reads ` +
        `right here — save your polished belt for tailoring.`,
    },
    {
      context: "Smart casual",
      strap: smartLeather.name,
      strapHex: smartLeather.hex,
      buckle: `${buckleMetal} neat single-prong (lightly polished)`,
      width: "3.5 cm",
      wearWith: "Chinos · off-duty wool trousers · smart denim",
      why:
        `A refined ${smartLeather.name.toLowerCase()} belt bridges tailoring and casual — pair it ` +
        `with your loafers and match the tone. Suede or a fine grain keeps it from looking too formal.`,
    },
    {
      context: "Business / formal",
      strap: formalLeather.name,
      strapHex: formalLeather.hex,
      buckle: `${buckleMetal} slim polished rectangular / single-prong`,
      width: "3–3.5 cm (slim)",
      wearWith: "Suits · wool dress trousers",
      why:
        `A thin, smooth ${formalLeather.name.toLowerCase()} belt in a high-shine finish, colour-matched ` +
        `to your dress shoes, with a discreet metal buckle. The slimmer the trouser and the dressier ` +
        `the occasion, the slimmer the belt.`,
    },
    {
      context: "Evening / party",
      strap: formalLeather.name,
      strapHex: formalLeather.hex,
      buckle: `${buckleMetal} minimal, low-profile (or covered) buckle`,
      width: "≤3 cm (slimmest)",
      wearWith: "Dark tailoring · going out",
      why:
        `For evening, go slimmest and most discreet — a sleek ${formalLeather.name.toLowerCase()} strap ` +
        `with a barely-there buckle disappears under a jacket. On black tie, skip the belt entirely and ` +
        `let side-adjusters or braces hold the trousers.`,
    },
  ];

  const trouserRules: BeltRule[] = [
    {
      trouser: "Jeans / denim",
      belt: "Wider (3.5–4 cm), matte or textured casual leather; a little tonal contrast is fine.",
    },
    {
      trouser: "Chinos / cotton trousers",
      belt: "Mid-width (3.5 cm) leather or suede in brown/burgundy — matched to your shoes.",
    },
    {
      trouser: "Wool dress trousers / suits",
      belt: "Slim (3–3.5 cm) polished leather, colour-matched EXACTLY to your shoes; buckle metal matches your watch.",
    },
    {
      trouser: "Linen / summer trousers",
      belt: "A woven-fabric or light-suede belt — softer and lower-shine than smooth leather.",
    },
    {
      trouser: "Pleated / eveningwear",
      belt: "Slimmest smooth leather with a discreet buckle — or no belt at all (braces / side-adjusters) for black tie.",
    },
  ];

  return {
    intro:
      "Two or three belts cover everything — the trick is matching them to the shoe and the trouser. " +
      "Casual weight for denim, refined leather for tailoring, and the same rule always applies: " +
      "belt leather follows your shoes, buckle metal follows your watch.",
    variants,
    matchRule:
      `Two rules do the work: match your belt leather to your shoes (same tone and finish), and match ` +
      `the buckle metal to your watch and other jewellery — for you that's ${buckleMetal.toLowerCase()}. ` +
      `Keep to one leather tone per outfit.`,
    trouserRules,
    avoidNote:
      "Avoid black belts with brown shoes (and vice-versa), oversized or logo/branded buckles with " +
      "tailoring, chunky casual belts under a suit, and any belt wider than ~3.5 cm with dress trousers.",
  };
}

export function eyewearFor(faceShape: string): { recommend: FrameRec[]; avoid: string[] } {
  const f = lc(faceShape);
  if (f.includes("round")) {
    return {
      recommend: [
        { shape: "rectangle", name: "Rectangular", why: "Angular lines add definition and lengthen a round face." },
        { shape: "wayfarer", name: "Wayfarer", why: "Structured top bar sharpens soft features." },
        { shape: "geometric", name: "Geometric", why: "Defined corners counterbalance roundness." },
      ],
      avoid: ["Round frames", "Small rimless"],
    };
  }
  if (f.includes("square")) {
    return {
      recommend: [
        { shape: "round", name: "Round", why: "Soft curves balance a strong, angular jaw." },
        { shape: "aviator", name: "Aviator sunglasses", why: "Curved bottom edge softens square corners." },
        { shape: "wayfarer", name: "Wayfarer", why: "A friendly all-rounder that takes the edge off." },
      ],
      avoid: ["Sharp rectangular", "Boxy frames"],
    };
  }
  if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    return {
      recommend: [
        { shape: "round", name: "Round", why: "Adds width and breaks up a longer face." },
        { shape: "aviator", name: "Aviator sunglasses", why: "Tall lens fills vertical space and balances proportions." },
        { shape: "geometric", name: "Bold geometric", why: "Deeper frames shorten the appearance of length." },
      ],
      avoid: ["Narrow rectangles", "Very thin frames"],
    };
  }
  if (f.includes("heart") || f.includes("triang")) {
    return {
      recommend: [
        { shape: "round", name: "Round", why: "Adds softness to a wider forehead and narrower chin." },
        { shape: "aviator", name: "Aviator sunglasses", why: "Bottom-heavy shape balances the upper face." },
        { shape: "wayfarer", name: "Light wayfarer", why: "Keep it light on top to avoid widening the brow." },
      ],
      avoid: ["Heavy top-bar frames", "Embellished cat-eye"],
    };
  }
  // Oval (and default) — most shapes work; play to balance.
  return {
    recommend: [
      { shape: "wayfarer", name: "Wayfarer", why: "Classic balance for an oval face — versatile and modern." },
      { shape: "rectangle", name: "Rectangular", why: "Keeps proportions in check without elongating." },
      { shape: "aviator", name: "Aviator sunglasses", why: "Adds a relaxed, confident edge while keeping balance." },
    ],
    avoid: ["Oversized round (over-elongates)", "Very narrow frames"],
  };
}

/** Top eyewear picks for premium personalized previews (2 optical + 2 sunglasses). */
export type PremiumEyewearPick = FrameRec & { kind: "optical" | "sun" };

function sunglassesFor(faceShape: string): FrameRec[] {
  const f = lc(faceShape);
  if (f.includes("round")) {
    return [
      {
        shape: "rectangle",
        name: "Rectangular sunglasses",
        why: "Sharp angles add definition and lengthen a round face in sun.",
      },
      {
        shape: "geometric",
        name: "Flat-top geometric sunglasses",
        why: "A straight brow line and defined corners give a round face structure — and a different silhouette from your optical frames.",
      },
    ];
  }
  if (f.includes("square")) {
    return [
      {
        shape: "wayfarer",
        name: "Wayfarer sunglasses",
        why: "A different silhouette from your optical frames — structured enough for town, still soft on a square jaw.",
      },
      {
        shape: "aviator",
        name: "Aviator sunglasses",
        why: "Curved bottom edge softens square corners outdoors.",
      },
    ];
  }
  if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    return [
      {
        shape: "aviator",
        name: "Aviator sunglasses",
        why: "A tall teardrop lens fills vertical space and balances a longer face outdoors.",
      },
      {
        shape: "round",
        name: "Round sunglasses",
        why: "Adds width and breaks up a longer face in sun.",
      },
    ];
  }
  if (f.includes("heart") || f.includes("triang")) {
    return [
      {
        shape: "aviator",
        name: "Aviator sunglasses",
        why: "Bottom-heavy shape balances a wider forehead outdoors.",
      },
      {
        shape: "round",
        name: "Round sunglasses",
        why: "Adds softness to a narrower chin without widening the brow.",
      },
    ];
  }
  return [
    {
      shape: "wayfarer",
      name: "Wayfarer sunglasses",
      why: "Classic balance for an oval face — versatile in sun.",
    },
    {
      shape: "aviator",
      name: "Aviator sunglasses",
      why: "Relaxed edge while keeping proportions balanced outdoors.",
    },
  ];
}

/** Frame shapes that read as sunglasses: never an optical pick, whatever the face-shape table says. */
const SUN_ONLY_SHAPES: ReadonlySet<FrameShapeId> = new Set(["aviator"]);

export function premiumEyewearPicks(profile: StyleProfile): PremiumEyewearPick[] {
  // The aviator is a sunglasses silhouette; a clear-lens "optical aviator"
  // is a real product but not what a man pictures when told to try aviators.
  const optical = eyewearFor(profile.physical.faceShape)
    .recommend.filter((f) => !SUN_ONLY_SHAPES.has(f.shape))
    .slice(0, 2);
  const sun = sunglassesFor(profile.physical.faceShape);
  return [
    ...optical.map((f) => ({ ...f, kind: "optical" as const })),
    ...sun.map((f) => ({ ...f, kind: "sun" as const })),
  ];
}

/**
 * Four ADDITIONAL eyewear picks (2 optical + 2 sunglasses) for the one-time
 * paid extra generation — versatile alternates, distinct from the base picks.
 */
export function premiumEyewearExtraPicks(): PremiumEyewearPick[] {
  return [
    {
      shape: "geometric",
      name: "Browline frames",
      why: "A bold upper brow line adds character and structure to optical frames.",
      kind: "optical",
    },
    {
      shape: "round",
      name: "Keyhole round frames",
      why: "A softer round optical with a keyhole bridge for a refined, classic look.",
      kind: "optical",
    },
    {
      shape: "wayfarer",
      name: "Clubmaster sunglasses",
      why: "Half-rim browline sunglasses — a timeless, smart-casual alternative.",
      kind: "sun",
    },
    {
      shape: "aviator",
      name: "Navigator sunglasses",
      why: "A squared aviator shape for a confident, contemporary edge in the sun.",
      kind: "sun",
    },
  ];
}

/** One accessory styling pick for the premium add-on. */
export type AccessoryPick = {
  name: string;
  why: string;
  kind: "scarf" | "neckwear" | "tie";
};

/**
 * Two accessory styling picks (scarf / neckwear / tie) for the premium add-on,
 * tuned to the user's climate and goals. Pure + deterministic, like the other
 * stylist-layer helpers.
 */
export function accessoryPicksFor(profile: StyleProfile): AccessoryPick[] {
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);
  const summer = isSummerSeason(profile);
  const quiet = wantsQuietFinishing(profile);
  const goals = profile.goals.map(lc).join(" ");
  const formal =
    quiet ||
    /(work|office|business|promotion|professional|formal|interview|leadership|executive|client)/.test(
      goals,
    );
  const gender = lc(profile.demographics.genderPresentation);

  if (formal) {
    return [
      {
        name: "Silk grenadine tie",
        why: "A textured, matte tie in your palette reads refined — the detail that elevates a jacket for work.",
        kind: "tie",
      },
      {
        name: "Knitted tie",
        why: "A matte knitted tie with a square end reads relaxed-smart — ideal under a blazer.",
        kind: "tie",
      },
    ];
  }

  const picks: AccessoryPick[] = [];
  if (cold && !summer) {
    picks.push({
      name: "Wool-blend scarf",
      why: "A soft neutral scarf in your palette adds warmth and a finished, considered layer over coats and knitwear.",
      kind: "scarf",
    });
  } else {
    picks.push({
      name: "Lightweight cotton-silk scarf",
      why: "A featherweight scarf adds an elegant accent at the neck without heat — easy to wear loosely looped.",
      kind: "scarf",
    });
  }

  if (gender === "female") {
    picks.push({
      name: "Silk neck-scarf",
      why: "A small silk scarf knotted at the neck adds colour and polish to an open collar.",
      kind: "neckwear",
    });
  } else {
    picks.push({
      name: "Silk neckerchief",
      why: "A loosely knotted neckerchief brings quiet personality to an open-collar shirt.",
      kind: "neckwear",
    });
  }

  return picks;
}

/** Two ADDITIONAL accessory picks for the one-time paid "generate 2 more" add-on. */
export function accessoryExtraPicksFor(profile: StyleProfile): AccessoryPick[] {
  const gender = lc(profile.demographics.genderPresentation);
  if (gender === "female") {
    return [
      {
        name: "Printed silk neck-scarf",
        why: "A bolder print at the neck adds a confident focal point to a plain outfit.",
        kind: "neckwear",
      },
      {
        name: "Twilly scarf",
        why: "A slim silk twilly tied at the collar or bag handle is an easy, elegant accent.",
        kind: "scarf",
      },
    ];
  }
  if (wantsQuietFinishing(profile)) {
    return [
      {
        name: "Linen pocket square",
        why: "A quiet square in your palette finishes a jacket pocket without another scarf at the neck.",
        kind: "neckwear",
      },
      {
        name: "Silk neckerchief",
        why: "One optional neck accent for open-collar evenings — not a second winter scarf.",
        kind: "neckwear",
      },
    ];
  }
  return [
    {
      name: "Patterned silk scarf",
      why: "A subtle pattern adds depth at the neck while staying within your palette.",
      kind: "scarf",
    },
    {
      name: "Knitted tie",
      why: "A matte knitted tie with a square end reads relaxed-smart — ideal under a blazer.",
      kind: "tie",
    },
  ];
}

/** One headwear styling pick (hat / cap / beanie / bandana). */
export type HeadwearPick = {
  name: string;
  why: string;
  kind: "hat" | "cap" | "beanie" | "bandana";
};

/**
 * Two headwear picks chosen for the user's face shape (brim balances the
 * proportions of the face) and climate (a warmer beanie vs. a lighter cap).
 * Pure + deterministic, like the other stylist-layer helpers.
 */
export function headwearPicksFor(profile: StyleProfile): HeadwearPick[] {
  const f = lc(profile.physical.faceShape);
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);
  const summer = isSummerSeason(profile);
  const quiet = wantsQuietFinishing(profile);
  const country = (profile.lifestyle ?? []).some((l) =>
    /old money|country|heritage/i.test(l),
  );

  const picks: HeadwearPick[] = [];

  if (quiet || country) {
    picks.push({
      name: "Wool flat cap",
      why: "A wool flat cap reads smart-casual and pairs cleanly with overcoats and knitwear.",
      kind: "cap",
    });
    if (country) {
      picks.push({
        name: "Soft-brim felt hat",
        why: "A rounded, softer brim takes the edge off a strong jaw on a country weekend.",
        kind: "hat",
      });
    } else if (summer) {
      picks.push({
        name: "Baseball cap",
        why: "A structured cap in a palette neutral is the easy, versatile casual option for warmer days.",
        kind: "cap",
      });
    } else if (cold) {
      picks.push({
        name: "Ribbed wool beanie",
        why: "A fitted beanie in a neutral from your palette adds warmth and a clean, modern casual finish.",
        kind: "beanie",
      });
    } else {
      picks.push({
        name: "Baseball cap",
        why: "A structured cap in a palette neutral is the easy, versatile casual option for warmer days.",
        kind: "cap",
      });
    }
    return picks;
  }

  if (f.includes("round")) {
    picks.push({
      name: "Structured fedora",
      why: "A defined brim and a higher crown add angles and vertical length that flatter a round face.",
      kind: "hat",
    });
  } else if (f.includes("square")) {
    picks.push({
      name: "Soft-brim felt hat",
      why: "A rounded, softer brim takes the edge off a strong, angular jaw.",
      kind: "hat",
    });
  } else if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    picks.push({
      name: "Wide-brim hat",
      why: "A wider brim adds horizontal balance and visually shortens a longer face.",
      kind: "hat",
    });
  } else if (f.includes("heart") || f.includes("triang")) {
    picks.push({
      name: "Medium-brim trilby",
      why: "A medium brim balances a wider forehead without overwhelming a narrower chin.",
      kind: "hat",
    });
  } else {
    picks.push({
      name: "Classic brimmed hat",
      why: "A balanced brim suits an oval face — versatile and easy to wear in your palette.",
      kind: "hat",
    });
  }

  picks.push(
    cold && !summer
      ? {
          name: "Ribbed wool beanie",
          why: "A fitted beanie in a neutral from your palette adds warmth and a clean, modern casual finish.",
          kind: "beanie",
        }
      : {
          name: "Baseball cap",
          why: "A structured cap in a palette neutral is the easy, versatile casual option for warmer days.",
          kind: "cap",
        },
  );

  return picks;
}

/** Two ADDITIONAL headwear picks for the one-time paid "generate 2 more" add-on. */
export function headwearExtraPicksFor(profile: StyleProfile): HeadwearPick[] {
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);
  const summer = isSummerSeason(profile);
  if (wantsQuietFinishing(profile)) {
    return [
      summer
        ? {
            name: "Straw fedora",
            why: "A light straw brim for summer days — quieter than a bandana, still on your palette.",
            kind: "hat",
          }
        : {
            name: "Soft-brim felt hat",
            why: "A rounded brim for colder weekends — the country register without costume extras.",
            kind: "hat",
          },
      {
        name: "Unstructured linen cap",
        why: "A soft cap for travel and outdoors that stays in the same register as the rest of the wardrobe.",
        kind: "cap",
      },
    ];
  }
  return [
    cold && !summer
      ? {
          name: "Wool flat cap",
          why: "A wool flat cap reads smart-casual and pairs cleanly with overcoats and knitwear.",
          kind: "cap",
        }
      : {
          name: "Bucket hat",
          why: "A relaxed bucket hat in a palette neutral is an easy warm-weather cover-up.",
          kind: "hat",
        },
    {
      name: "Bandana",
      why: "A folded bandana in your palette adds a confident accent — worn as a headband or knotted at the neck.",
      kind: "bandana",
    },
  ];
}

/** Named facial-hair styles for premium photo previews (up to 4). */
export function facialHairFor(
  profile: StyleProfile,
): { name: string; why: string }[] {
  const gender = lc(profile.demographics.genderPresentation);
  if (gender === "female") {
    return [
      {
        name: "Clean-shaven",
        why: "Keeps focus on your features and pairs cleanly with structured tailoring.",
      },
      {
        name: "Soft natural brows",
        why: "Well-groomed brows frame the face — the detail that reads as polished.",
      },
      {
        name: "Defined brow arch",
        why: "A subtle arch lifts the eye area and adds structure without heaviness.",
      },
      {
        name: "Polished neckline",
        why: "Clean jaw and neck line keep the silhouette sharp under open collars.",
      },
    ];
  }

  const f = lc(profile.physical.faceShape);
  if (f.includes("round")) {
    return [
      {
        name: "Short boxed beard",
        why: "A slightly longer chin with tighter cheeks adds length to a round face.",
      },
      {
        name: "Light stubble",
        why: "Even 2–3 mm stubble sharpens the jaw without adding width.",
      },
      {
        name: "Goatee, clean cheeks",
        why: "Vertical length at the chin elongates a round face without widening the sides.",
      },
      {
        name: "Tapered full beard",
        why: "Length at the chin with trimmed cheeks adds definition while staying balanced.",
      },
    ];
  }
  if (f.includes("square")) {
    return [
      {
        name: "Rounded full beard",
        why: "Soft curves along the jaw balance strong, angular bone structure.",
      },
      {
        name: "Classic mustache",
        why: "A neat mustache draws the eye upward and softens a square jawline.",
      },
      {
        name: "Medium stubble",
        why: "Even coverage softens sharp corners without hiding bone structure.",
      },
      {
        name: "Short rounded beard",
        why: "A rounded neckline and cheek line takes the edge off a square jaw.",
      },
    ];
  }
  if (f.includes("oblong") || f.includes("rectang") || f.includes("long")) {
    return [
      {
        name: "Full beard with side volume",
        why: "Width on the cheeks breaks up vertical length and balances proportions.",
      },
      {
        name: "Short goatee",
        why: "Concentrated length at the chin adds width without elongating the face.",
      },
      {
        name: "Wide sideburns + stubble",
        why: "Horizontal emphasis at the temples adds width to a longer face.",
      },
      {
        name: "Chevron mustache",
        why: "A bold upper-lip line draws attention horizontally across the face.",
      },
    ];
  }
  if (f.includes("heart") || f.includes("triang")) {
    return [
      {
        name: "Medium stubble",
        why: "Even coverage adds weight to a narrower chin and balances a wider forehead.",
      },
      {
        name: "Short beard, clean cheeks",
        why: "Keeps the upper face light while defining the jaw.",
      },
      {
        name: "Anchor beard",
        why: "Focused length along the chin adds weight where the face is narrowest.",
      },
      {
        name: "Light goatee",
        why: "Minimal chin definition without adding bulk to the upper face.",
      },
    ];
  }
  return [
    {
      name: "Short even beard",
      why: "A tidy, even line suits an oval face — natural cheek line, clean neckline.",
    },
    {
      name: "Refined stubble",
      why: "Low-maintenance texture that reads modern without overpowering your features.",
    },
    {
      name: "Classic full beard",
      why: "Even growth with a defined neckline — versatile on an oval face.",
    },
    {
      name: "Van Dyke",
      why: "A neat mustache paired with a small chin patch adds character without bulk.",
    },
  ];
}

/** Two ADDITIONAL facial-hair picks for the one-time paid "generate 2 more" add-on. */
export function facialHairExtraFor(
  profile: StyleProfile,
): { name: string; why: string }[] {
  const gender = lc(profile.demographics.genderPresentation);
  if (gender === "female") {
    return [
      {
        name: "Soft natural finish",
        why: "A fresh, even complexion with minimal product — the polished baseline.",
      },
      {
        name: "Defined jawline contour",
        why: "Subtle contour along the jaw sharpens the profile under open collars.",
      },
    ];
  }
  return [
    {
      name: "Heavy stubble",
      why: "A fuller 5–7 mm stubble adds depth and a rugged, modern edge.",
    },
    {
      name: "Long statement beard",
      why: "A longer, well-shaped beard makes a confident, characterful statement.",
    },
  ];
}

function fitBlueprint(profile: StyleProfile): FitSpec[] {
  const bt = lc(profile.physical.bodyType);
  const m = profile.physical.measurements;
  const specs: FitSpec[] = [];

  // Measurement interpretation (shoulder-to-waist drop).
  if (m?.shoulderCm && m?.waistCm) {
    const drop = m.shoulderCm - m.waistCm;
    const reading =
      drop >= 18
        ? "an athletic V-taper"
        : drop >= 10
          ? "a balanced build"
          : "a straight, even frame";
    specs.push({
      part: "Your proportions",
      spec: `Shoulder ${m.shoulderCm} to waist ${m.waistCm} cm (drop ${drop} cm)`,
      why: `This reads as ${reading} — the cuts below are tuned to it.`,
    });
  }

  const structuredShoulder =
    bt === "rectangle" || bt === "triangle" || bt === "oval";
  specs.push({
    part: "Jacket shoulder",
    spec: structuredShoulder
      ? "Lightly structured, sits exactly at your shoulder bone"
      : "Natural, soft shoulder — no padding",
    why: structuredShoulder
      ? "Adds definition and a clean line to your frame."
      : "You already have width up top; extra padding would exaggerate it.",
  });

  specs.push({
    part: "Jacket length",
    spec: "Hem covers the seat, roughly mid-crotch with arm relaxed",
    why: "Balances torso and legs; too short looks boxy, too long shortens you.",
  });

  const waistSuppression =
    bt === "oval"
      ? "Minimal waist suppression; single-breasted, button open when standing"
      : "Gentle waist suppression for shape without pulling";
  specs.push({
    part: "Jacket waist",
    spec: waistSuppression,
    why:
      bt === "oval"
        ? "Clean vertical lines flatter more than a nipped waist."
        : "Hints at shape while keeping comfort and movement.",
  });

  const rise = bt === "oval" ? "Mid-to-high rise, flat front, no pleats" : "Mid-rise, flat front";
  specs.push({
    part: "Trouser rise",
    spec: rise,
    why: "Sits at the natural waist and lengthens the leg line.",
  });

  const leg =
    bt === "triangle"
      ? "Straight leg, slightly darker than the top"
      : bt === "trapezoid" || bt === "inverted-triangle"
        ? "Straight leg to balance a stronger upper body"
        : "Slim-straight, clean line to the shoe";
  specs.push({
    part: "Trouser leg & break",
    spec: `${leg}; slight break (one soft fold)`,
    why: "A slight break is the most flattering, modern length.",
  });

  if (m?.sleeveCm) {
    specs.push({
      part: "Sleeve",
      spec: `~${m.sleeveCm} cm — show ~1 cm of shirt cuff`,
      why: "A sliver of cuff signals a jacket that actually fits.",
    });
  }

  const h = profile.physical.heightCm;
  if (h) {
    const tall = h >= 185;
    const short = h <= 172;
    specs.push({
      part: `Proportion (${h} cm)`,
      spec: tall
        ? "You can carry a slightly longer jacket and a full break; medium-to-large pattern scale."
        : short
          ? "Keep jackets a touch shorter, no/slight break, small-scale patterns, tonal looks to elongate."
          : "Standard proportions: slight break, medium pattern scale, mid-rise.",
      why: tall
        ? "Your height balances longer lines without looking overwhelmed."
        : short
          ? "Vertical, uninterrupted lines make you read taller."
          : "Classic proportions flatter an average height without tricks.",
    });
  }

  return specs;
}

/**
 * A concise, hand-to-your-barber cut brief keyed to the client's face shape and
 * hair colour — the grooming counterpart to the fit blueprint. Rule-based and
 * deterministic so it reads consistently and translates cleanly.
 */
function barberBlueprint(profile: StyleProfile): FitSpec[] {
  const f = lc(profile.physical.faceShape);
  const specs: FitSpec[] = [];

  const round = f.includes("round");
  const square = f.includes("square");
  const long = f.includes("oblong") || f.includes("rectang") || f.includes("long");
  const heart = f.includes("heart") || f.includes("triang");
  const diamond = f.includes("diamond");

  const shapeLabel = round
    ? "round"
    : square
      ? "square"
      : long
        ? "longer"
        : heart
          ? "heart-shaped"
          : diamond
            ? "diamond"
            : "oval";
  specs.push({
    part: "Face shape",
    spec: `Your face reads as ${shapeLabel} — the cut below is tuned to it.`,
    why: "A haircut's job is to balance your proportions, not fight them.",
  });

  // Length on top — the main lever for balancing face length/width.
  specs.push({
    part: "Length on top",
    spec: round
      ? "Keep good height on top; ask for length to style up and back."
      : long
        ? "Keep the top moderate — avoid piling on height."
        : heart
          ? "Medium length on top with soft movement, nothing too tall."
          : square
            ? "Short-to-medium with texture; a little height works well."
            : "Medium length with natural movement — most shapes suit you.",
    why: round
      ? "Vertical volume lengthens a round face and adds structure."
      : long
        ? "Too much height stretches an already-long face."
        : heart
          ? "Soft volume avoids widening the upper face further."
          : square
            ? "Texture keeps a strong jaw from looking heavy."
            : "Balanced length flatters oval proportions without tricks.",
  });

  // Sides / fade.
  specs.push({
    part: "Sides & fade",
    spec: round
      ? "Tight/short sides — a high taper or fade to slim the face."
      : long
        ? "Leave a little more length on the sides; low-to-mid taper."
        : heart
          ? "Keep some weight at the sides; avoid very tight fades."
          : "Clean mid taper — versatile and easy to maintain.",
    why: round
      ? "Short sides narrow the face and sharpen the jaw."
      : long
        ? "Side volume adds width and shortens a long face."
        : heart
          ? "Width lower down balances a wider forehead."
          : "A mid taper suits most shapes and grows out cleanly.",
  });

  // Fringe / parting / hairline.
  specs.push({
    part: "Fringe & parting",
    spec: long || heart
      ? "Consider a soft fringe or forward-textured front."
      : "A defined side part or natural push-back both work.",
    why: long || heart
      ? "A fringe shortens the forehead and softens the top third."
      : "A clean part adds polish and structure to your look.",
  });

  // Beard / neckline — pairs with the grooming section.
  specs.push({
    part: "Beard & neckline",
    spec: round
      ? "A slightly longer, squared beard elongates the face; keep cheek lines crisp."
      : square
        ? "Keep the beard neat and rounded at the base to soften the jaw."
        : long
          ? "Fuller on the cheeks, shorter at the chin to add width."
          : heart
            ? "A little more beard at the jaw balances a narrower chin."
            : "A tidy, even beard or clean shave both suit your balance.",
    why: "Facial hair reshapes the lower face — use it to balance the top.",
  });

  // Colour care note when the client reports grey/silver hair.
  const hair = lc(profile.physical.hairColor ?? "");
  if (hair.includes("grey") || hair.includes("gray") || hair.includes("silver") || hair.includes("salt")) {
    specs.push({
      part: "Colour & upkeep",
      spec: "Embrace the grey — ask for a clean, sharp shape and use a silver/purple shampoo weekly.",
      why: "Well-cut grey reads distinguished; a toning shampoo keeps it bright, not yellow.",
    });
  }

  return specs;
}

export function colorPairings(best: ColorRec[]): Pairings {
  const ranked = [...best].sort(
    (a, b) => hexToHsl(b.hex).s - hexToHsl(a.hex).s,
  );
  const pool = ranked.filter((c) => c.role !== "versatile");
  const safeAccent = (pool.length ? pool : ranked).slice(0, 2);
  const accentHex = new Set(safeAccent.map((c) => c.hex.toLowerCase()));
  // "Neutral base" = the palette's own low-chroma swatches, quietest first. The
  // versatile office tail (charcoal / dove grey) is explained separately and
  // only joins when the palette has fewer than two other neutrals.
  const nonAccent = best.filter((c) => !accentHex.has(c.hex.toLowerCase()));
  const bySat = (a: ColorRec, b: ColorRec) => hexToHsl(a.hex).s - hexToHsl(b.hex).s;
  const paletteBase = nonAccent.filter((c) => c.role !== "versatile").sort(bySat);
  const safeBase =
    paletteBase.length >= 2
      ? paletteBase
      : [...paletteBase, ...nonAccent.filter((c) => c.role === "versatile").sort(bySat)];
  const hero = safeAccent[0] ?? best[0] ?? null;

  const combos: ColorCombo[] = [];
  const seen = new Set<string>();
  const pushCombo = (combo: ColorCombo) => {
    const key = combo.hexes.map((h) => h.toLowerCase()).sort().join("|");
    if (!key || seen.has(key)) return;
    seen.add(key);
    combos.push(combo);
  };
  for (const a of safeAccent) {
    const b1 = safeBase[0];
    const b2 = safeBase[1];
    if (!b1) continue;
    pushCombo({
      name: `${a.name} + ${b1.name}${b2 && b2 !== b1 ? ` + ${b2.name}` : ""}`,
      hexes: [a.hex, b1.hex, ...(b2 ? [b2.hex] : [])],
      why: `One accent (${a.name}) on a neutral base reads considered, not loud.`,
    });
  }
  if (safeBase.length >= 2) {
    pushCombo({
      name: `${safeBase[0]!.name} + ${safeBase[1]!.name}`,
      hexes: [safeBase[0]!.hex, safeBase[1]!.hex],
      why: "An all-neutral pairing is your fail-safe for any occasion.",
    });
  }

  return { base: safeBase, accent: safeAccent, hero, combos: combos.slice(0, 3) };
}

export function fabricsFor(profile: StyleProfile): { name: string; why: string }[] {
  const climate = lc(profile.demographics.climate);
  const cold = /(cold|nordic|maritime|temperate)/.test(climate);
  const cool = lc(profile.physical.undertone) === "cool";
  const list: { name: string; why: string }[] = [
    { name: "Merino wool", why: "Fine, breathable knit that layers cleanly under a jacket." },
    { name: "Brushed cotton / flannel", why: "Soft matte surface adds warmth and depth to shirts and trousers." },
    {
      name: "Suede & nubuck",
      why: cool
        ? "Matte texture in cool taupe, grey and navy suede ties your palette together."
        : "Matte texture in warm browns ties your palette together.",
    },
  ];
  if (cold)
    list.push({
      name: "Worsted & tweed wool",
      why: "Holds shape and reads refined in cooler weather.",
    });
  else
    list.push({
      name: "Linen & cotton-linen",
      why: "Breathable and relaxed for warmer days without losing structure.",
    });
  list.push({
    name: "Matte over shiny",
    why: "Keep sheen low — matte fabrics look more expensive on most men.",
  });
  return list;
}

export function patternsFor(profile: StyleProfile): PatternRec[] {
  const contrast = lc(profile.physical.contrast);
  const bold = /statement|experimental/.test(lc(profile.boldness ?? ""));
  const sub = lc(profile.colorSubseason ?? "");
  const soft = /soft-/.test(sub);
  const out: PatternRec[] = [
    { name: "Solid", kind: "solid" },
    { name: "Fine stripe", kind: "stripe" },
  ];
  if (contrast === "low") out.push({ name: "Tonal", kind: "tonal" });
  else out.push({ name: "Small gingham", kind: "check" });
  if (contrast === "high") out.push({ name: "Windowpane", kind: "windowpane" });
  if (bold && !soft) out.push({ name: "Tartan", kind: "tartan" });
  return out.slice(0, 4);
}

export function finishingAccessoriesFor(
  profile: StyleProfile,
  watch: WatchGuide,
): FinishingAccessory[] {
  const everyday =
    watch.variants.find((v) => /everyday/i.test(v.context)) ??
    watch.variants[1] ??
    watch.variants[0];
  const cool = lc(profile.physical.undertone) === "cool";
  const metal =
    metalsFor(profile.physical.undertone).recommend[0]?.name ??
    (cool ? "Steel" : "Gold");
  return [
    {
      id: "watch",
      name: everyday?.type ?? "Dress watch",
      note: everyday ? `${everyday.dial} dial` : "Light dial",
    },
    { id: "belt", name: "Leather belt", note: "Match to your shoes" },
    {
      id: "sun",
      name: "Sunglasses",
      note: cool
        ? "Grey, gunmetal or navy acetate, steel temples"
        : "Warm tortoiseshell",
    },
    {
      id: "chain",
      name: "Minimal chain",
      note: `One piece, in ${metal} — never more`,
    },
  ];
}

export function finishingChapterCopy(extras: {
  patterns: PatternRec[];
  finishingAccessories: FinishingAccessory[];
  fabrics: { name: string; why: string }[];
}): string {
  return [
    extras.patterns.map((p) => p.name).join(" · "),
    extras.finishingAccessories.map((a) => `${a.name} · ${a.note}`).join(" · "),
    extras.fabrics.map((f) => `${f.name} — ${f.why}`).join(" · "),
  ].join("\n");
}

function groomingFor(profile: StyleProfile): GroomingItem[] {
  const f = lc(profile.physical.faceShape);
  let beard: string;
  if (f.includes("round"))
    beard = "Keep the beard slightly longer at the chin and tighter on the cheeks to lengthen the face.";
  else if (f.includes("square"))
    beard = "Soften the jaw with a rounded, even beard line — avoid sharp corners.";
  else if (f.includes("oblong") || f.includes("long"))
    beard = "Keep length on the sides, shorter at the chin, to add width, not length.";
  else
    beard = "A short, even beard suits you; keep the cheek line natural and the neckline clean.";

  return [
    { title: "Beard shape", detail: beard },
    { title: "Maintenance", detail: "Reshape the neckline weekly; full trim every 3–4 weeks to keep the cut intact." },
    { title: "Skin", detail: "Daily moisturiser and SPF; aim for a healthy matte finish, not shine." },
    { title: "Brows & details", detail: "Tidy stray brow hairs and nostril/ear hair — small things that read as 'polished'." },
    { title: "Styling product", detail: "A matte clay or paste for the textured crop — pea-sized, worked through towel-dry hair." },
  ];
}

const STYLING_MECHANICS = [
  "Match your belt to your shoes — same tone, same finish.",
  "Roll shirt sleeves to just below the elbow when going jacket-free.",
  "Layer in a ratio: one structured piece, one soft, one anchor (shoe).",
  "Half-tuck or full-tuck with mid-rise trousers to define the waistline.",
  "Keep one point of interest per outfit — let the rest stay quiet.",
];

const CARE_GUIDE = [
  "Buy on cost-per-wear: a €189 blazer worn 100× beats five €40 impulse buys.",
  "Brush suede after each wear and use a cedar shoe tree to hold shape.",
  "Rotate shoes — never wear the same pair two days running.",
  "Budget ~10% of each purchase for tailoring; fit is what people notice.",
];

function fragranceFor(profile: StyleProfile): string {
  const season = lc(profile.colorSeason);
  const bold = lc(profile.boldness);
  const family =
    season === "autumn" || season === "winter"
      ? "warm woody-amber (sandalwood, cedar, vetiver)"
      : "fresh aromatic (citrus, neroli, light woods)";
  const strength =
    bold === "statement" || bold === "experimental"
      ? "you can carry more projection in the evening"
      : "keep it close to the skin for daytime";
  return `A ${family} fragrance suits your colouring; ${strength}.`;
}

function priorityMoves(
  profile: StyleProfile,
  shopping: ShoppingItem[],
): PriorityMove[] {
  const goal = profile.goals[0]?.toLowerCase() ?? "look more polished";
  const heroItem = pickHero(shopping, profile.boldness);
  const hero = heroItem?.title ?? "one excellent jacket";
  // Undertone-aware so a cool Soft Summer isn't told to build on "warm neutrals"
  // with gold metals. Names the primary metal from the same source as the
  // Colour DNA section (metalsFor) to keep the report internally consistent.
  const undertone = lc(profile.physical.undertone);
  const neutralsWord =
    undertone === "warm" ? "warm" : undertone === "cool" ? "cool" : "muted";
  const metal = metalsFor(profile.physical.undertone).recommend[0]?.name.toLowerCase();
  const metalPhrase = metal ? `metals (${metal})` : "metals";
  return [
    {
      n: "01",
      title: "Fix fit before you buy anything else",
      why: `Tailoring the shoulders and hem of what you own does more for your goal to ${goal} than any new purchase.`,
    },
    {
      n: "02",
      title: "Anchor everything to your palette",
      why: `Build on ${neutralsWord} neutrals and one accent near the face; match ${metalPhrase} and leather to your undertone.`,
    },
    {
      n: "03",
      title: `Invest in your hero piece — ${humanizeProductTitle(hero)}`,
      // Prefer the investment-framed LLM reason written specifically for the
      // hero (ai/shopping-reasons); the category template remains the fallback.
      // The fit-framed per-item `why` is NOT reused here — wrong frame for an
      // "invest" headline, and it already appears on the shopping card.
      why: heroItem?.heroWhy ?? heroWhy(heroItem?.category),
    },
  ];
}

/** Category-aware rationale for the hero piece (not every hero is a "layer"). */
function heroWhy(category?: string): string {
  switch (category) {
    case "Footwear":
      return "One excellent pair of shoes anchors every outfit and outlasts three cheap pairs.";
    case "Trousers":
      return "A precisely-cut pair of trousers is the quiet foundation every look is built on.";
    case "Knitwear":
    case "Shirts":
      return "One beautifully-made piece worn near the face lifts the perceived quality of everything else.";
    case "Accessories":
      return "The right finishing piece is what makes an outfit look considered rather than thrown together.";
    default:
      return "One high-impact layer raises the perceived quality of everything you already own.";
  }
}

function archetypeFor(profile: StyleProfile): Archetype {
  const b = lc(profile.boldness);
  const warm = lc(profile.physical.undertone) === "warm";
  const signature = warm
    ? "a warm, earthy signature"
    : lc(profile.physical.undertone) === "cool"
      ? "a cool, crisp signature"
      : "a balanced, neutral signature";
  const map: Record<string, { name: string; tone: string }> = {
    conservative: { name: "Refined Classic", tone: "timeless, understated, quietly expensive" },
    moderate: { name: "Modern Classic", tone: "clean, current, never trend-chasing" },
    experimental: { name: "Contemporary Eclectic", tone: "considered with a creative edge" },
    statement: { name: "Bold Editorial", tone: "confident, directional, high-impact" },
  };
  const a = map[b] ?? map.moderate;
  return {
    name: a.name,
    line: `${a.tone} — with ${signature}.`,
  };
}

function colorDNAFor(profile: StyleProfile, best: ColorRec[]): ColorDNA {
  const contrast = lc(profile.physical.contrast) as "low" | "medium" | "high";
  const undertone = lc(profile.physical.undertone) as
    | "warm"
    | "cool"
    | "neutral";

  // Real 12-subseason classification (stored on the profile when available),
  // falling back to a fresh classification from the profile's signals.
  const subId =
    profile.colorSubseason ??
    classifySubseason({
      season: profile.colorSeason,
      undertone,
      contrast,
      hairColor: profile.physical.hairColor,
      eyeColor: profile.physical.eyeColor,
    });
  const subseason = SUBSEASON_LABELS[subId];

  const neutrals = best
    .filter((c) => hexToHsl(c.hex).s < NEUTRAL_SAT_MAX)
    .slice(0, 4);

  const bestWhite =
    undertone === "warm"
      ? "Cream / ecru — never optic white"
      : undertone === "cool"
        ? "Soft white"
        : "Off-white";
  const bestDenim =
    undertone === "warm"
      ? "Warm mid-indigo, slightly brown-cast"
      : undertone === "cool"
        ? "Clean blue-grey indigo"
        : "Classic mid-indigo";
  const metal =
    undertone === "warm"
      ? "Yellow gold / brass"
      : undertone === "cool"
        ? "Silver / steel"
        : "Soft gold or steel";
  const blackAlt =
    undertone === "warm"
      ? "Espresso brown or deep olive instead of black"
      : undertone === "cool"
        ? "Charcoal or navy instead of black"
        : "Charcoal instead of black";
  const contrastRule =
    contrast === "low"
      ? "Keep top-to-bottom contrast soft — tonal, layered looks flatter you. Avoid white-next-to-black."
      : contrast === "high"
        ? "You can carry sharp contrast — a crisp light-vs-dark split reads intentional and strong."
        : "Moderate contrast suits you — one clear light/dark step, not a stark jump.";

  const undertoneWord =
    undertone === "warm" ? "warm" : undertone === "cool" ? "cool" : "balanced";
  const wheelLine =
    "Here's where your palette sits on the wheel — and exactly why each tone works.";
  const colorStoryIntro =
    (contrast === "low"
      ? `Soft, ${undertoneWord} neutrals flatter your low-contrast colouring.`
      : contrast === "high"
        ? `Crisp, ${undertoneWord} tones let you carry your high-contrast colouring with intent.`
        : `${cap(undertoneWord)} neutrals with one clear light-to-dark step suit your medium-contrast colouring.`) +
    ` ${wheelLine}`;

  return {
    subseason,
    neutrals: neutrals.length ? neutrals : best.slice(0, 3),
    bestWhite,
    bestDenim,
    metal,
    blackAlt,
    contrastRule,
    colorStoryIntro,
  };
}

/** Professional / speaking briefs should never spend a footwear slot on sandals. */
export function wantsPolishedFootwear(profile: StyleProfile): boolean {
  const hay =
    `${profile.goals.join(" ")} ${(profile.lifestyle ?? []).join(" ")} ${profile.occupation ?? ""}`.toLowerCase();
  return /profession|office|career|business|speak|stage|client|board|law|legal|interview|promot/.test(
    hay,
  );
}

export function wantsOutdoorJeans(profile: StyleProfile): boolean {
  return (profile.lifestyle ?? []).some((l) => /outdoor|active/i.test(l));
}

/** Professional / speaking / old-money briefs — quiet finishing, no costume extras. */
export function wantsQuietFinishing(profile: StyleProfile): boolean {
  const hay =
    `${profile.goals.join(" ")} ${(profile.lifestyle ?? []).join(" ")} ${profile.occupation ?? ""}`.toLowerCase();
  return /profession|office|career|business|speak|stage|client|board|law|legal|old money|heritage/.test(
    hay,
  );
}

export function isSummerSeason(profile: StyleProfile): boolean {
  return /summer/i.test(profile.colorSeason);
}

/**
 * Render-time extras for a report. Prefers a pre-translated stored snapshot
 * (non-English reports) and otherwise computes them live in English.
 */
export function extrasForReport(report: StyleReport): StyleExtras {
  if (!report.extras) return buildExtras(report);
  // Older stored snapshots may lack `watchGuide` entirely (pre-watch section) or
  // carry an early version without the `type`/`shape`/`shapeNote` fields. Backfill
  // in both cases so premium/lookbook renders never read undefined. The backfill
  // is computed in English; new reports translate it in `trExtras`.
  const wg = report.extras.watchGuide;
  const shoeGuideNow = shoeGuideFor(
    report.profile,
    report.colors.best,
    report.colors.avoid,
  );
  const dressLeatherNow = leatherTargetsFromGuide(shoeGuideNow).dress;
  const watchStale =
    !wg ||
    !wg.shapeNote ||
    !wg.variants?.[0]?.type ||
    // The dress strap must tell the same leather story as the dress shoe —
    // black strap with burgundy shoes (or the reverse) is a stale snapshot.
    (() => {
      const strap = wg.variants[0]?.strap ?? "";
      const strapTone = leatherAnchorTone(strap);
      const shoeTone = leatherAnchorTone(dressLeatherNow.name);
      return Boolean(strapTone && shoeTone && strapTone !== shoeTone);
    })();
  const isLawClient = /law|legal|attorney|lawyer|solicitor|barrister/i.test(
    `${report.profile.occupation ?? ""} ${(report.profile.goals ?? []).join(" ")} ` +
      `${(report.profile.lifestyle ?? []).join(" ")}`,
  );
  const shoeStale =
    !report.extras.shoeGuide?.variants?.length ||
    // Older snapshots carried fewer than the current five roles — backfill.
    report.extras.shoeGuide.variants.length < 5 ||
    // Pre-"classic formal only" snapshots put coloured (navy/slate) leather on
    // the DRESS oxford — that's now moved to the loafer, so recompute.
    /navy|slate|blue|indigo|teal/i.test(
      report.extras.shoeGuide.variants[0]?.color ?? "",
    ) ||
    // Pre-"derby-default" snapshots put oxfords on non-law clients — derbies are
    // now the default office dress shoe, so recompute for anyone but lawyers.
    (/oxford/i.test(report.extras.shoeGuide.variants[0]?.style ?? "") &&
      !isLawClient);
  // Belt system was added after some snapshots were stored — backfill when the
  // guide (or its trouser rules) is missing.
  const beltStale =
    !report.extras.beltGuide?.variants?.length ||
    !report.extras.beltGuide.trouserRules?.length;
  const patternsStale = !report.extras.patterns?.length;
  const finishingStale = !report.extras.finishingAccessories?.length;
  const fabricsStale =
    !report.extras.fabrics?.length ||
    (lc(report.profile.physical.undertone) === "cool" &&
      report.extras.fabrics.some((f) => /warm brown/i.test(f.why)));
  if (
    watchStale ||
    shoeStale ||
    beltStale ||
    patternsStale ||
    finishingStale ||
    fabricsStale
  ) {
    const watchGuide = watchStale
      ? watchGuideFor(report.profile, report.colors.best, {
          dressLeather: dressLeatherNow,
        })
      : report.extras.watchGuide;
    return {
      ...report.extras,
      watchGuide,
      shoeGuide: shoeStale
        ? shoeGuideFor(report.profile, report.colors.best, report.colors.avoid)
        : report.extras.shoeGuide,
      beltGuide: beltStale
        ? beltGuideFor(
            report.profile,
            report.colors.best,
            report.colors.avoid,
            report.shopping,
          )
        : report.extras.beltGuide,
      patterns: patternsStale
        ? patternsFor(report.profile)
        : report.extras.patterns,
      finishingAccessories: finishingStale
        ? finishingAccessoriesFor(report.profile, watchGuide)
        : report.extras.finishingAccessories,
      fabrics: fabricsStale
        ? fabricsFor(report.profile)
        : report.extras.fabrics,
    };
  }
  return report.extras;
}

export function buildExtras(report: StyleReport): StyleExtras {
  const { profile } = report;
  const shoeGuide = shoeGuideFor(profile, report.colors.best, report.colors.avoid);
  const watchGuide = watchGuideFor(profile, report.colors.best, {
    dressLeather: leatherTargetsFromGuide(shoeGuide).dress,
  });
  return {
    archetype: archetypeFor(profile),
    priorityMoves: priorityMoves(profile, report.shopping),
    colorDNA: colorDNAFor(profile, report.colors.best),
    metals: metalsFor(profile.physical.undertone),
    eyewear: eyewearFor(profile.physical.faceShape),
    fitBlueprint: fitBlueprint(profile),
    barberBlueprint: barberBlueprint(profile),
    pairings: colorPairings(report.colors.best),
    fabrics: fabricsFor(profile),
    patterns: patternsFor(profile),
    finishingAccessories: finishingAccessoriesFor(profile, watchGuide),
    capsule: capsuleFrom(report.shopping, profile),
    matrix: capsuleMatrix(report.shopping, profile, report.colors.best),
    priceTiers: priceTiersFrom(report.shopping),
    grooming: groomingFor(profile),
    styling: STYLING_MECHANICS,
    care: CARE_GUIDE,
    fragrance: fragranceFor(profile),
    watchGuide,
    shoeGuide,
    beltGuide: beltGuideFor(
      profile,
      report.colors.best,
      report.colors.avoid,
      report.shopping,
    ),
  };
}

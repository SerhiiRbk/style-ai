import type { StyleReport } from "@/lib/report";
import type { StyleExtras } from "@/lib/style-extras";
import { SUBSEASON_LABELS, type SubseasonId } from "@/lib/style-profile";

export type StyleSystemKey =
  | "colour"
  | "silhouette"
  | "texture"
  | "grooming"
  | "impression"
  | "avoid";

export type StyleSystem = {
  key: StyleSystemKey;
  label: string;
  value: string;
  sub?: string;
  palette?: string[];
};

export type StyleCard = {
  title: string;
  systems: StyleSystem[];
};

type Season = "winter" | "spring" | "summer" | "autumn";

/** Card-tight colour descriptor per 12-subseason — accurate to depth/chroma. */
const SUBSEASON_ADJECTIVES: Record<SubseasonId, string> = {
  "deep-winter": "Cool, deep, saturated, high-contrast.",
  "cool-winter": "Cool, clear, crisp, true.",
  "bright-winter": "Cool, bright, vivid, high-contrast.",
  "bright-spring": "Warm, bright, clear, high-energy.",
  "warm-spring": "Warm, golden, clear, medium.",
  "light-spring": "Warm, light, fresh, delicate.",
  "light-summer": "Cool, light, soft, airy.",
  "cool-summer": "Cool, refined, muted, medium.",
  "soft-summer": "Cool-neutral, soft, muted, hazy.",
  "soft-autumn": "Warm-neutral, soft, muted, earthy.",
  "warm-autumn": "Warm, golden, rich, earthy.",
  "deep-autumn": "Warm, deep, earthy, saturated.",
};

/** Season-level fallback when the subseason is unavailable. */
const SEASON_ADJECTIVES: Record<Season, string> = {
  autumn: "Warm, rich, earthy, muted.",
  spring: "Warm, clear, fresh, luminous.",
  summer: "Cool, soft, muted, refined.",
  winter: "Cool, deep, crisp, high-contrast.",
};

/** Tight, lowercase material token per known fabric name (falls back to the first term). */
const FABRIC_TOKENS: Record<string, string> = {
  "Merino wool": "wool",
  "Brushed cotton / flannel": "brushed cotton",
  "Suede & nubuck": "suede",
  "Worsted & tweed wool": "tweed",
  "Linen & cotton-linen": "linen",
};

/** "Matte and tactile — wool, suede, …" — clean, climate-aware, card-tight. */
function textureLine(fabrics: { name: string }[]): string {
  const tokens = fabrics
    .map(
      (f) =>
        FABRIC_TOKENS[f.name] ??
        f.name.toLowerCase().split(/\s*[/&]\s*/)[0].trim(),
    )
    .filter((t) => t && !/matte|shiny/.test(t));
  const uniq = [...new Set(tokens)].slice(0, 4);
  return uniq.length ? `Matte and tactile — ${uniq.join(", ")}.` : "";
}

const AVOID_BY_UNDERTONE: Record<string, string> = {
  warm: "Optic white, cold black, icy pastels, high-shine synthetics, shapeless volume.",
  cool: "Muddy earth tones, orange-reds, beige-on-beige, shiny synthetics, shapeless volume.",
  neutral: "Extreme contrast, neon brights, shiny synthetics, harsh geometry, shapeless volume.",
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function beardWord(faceShape: string): string {
  const f = (faceShape ?? "").toLowerCase();
  if (f.includes("round")) return "rounded";
  if (f.includes("square")) return "softened";
  if (f.includes("oblong") || f.includes("long")) return "fuller-sided";
  return "even";
}

/**
 * "Your Personal Style Card" — the report's closing summary, distilled purely
 * from data already computed elsewhere (profile, palette, extras). No AI call and
 * no persistence, so it renders identically for every report, old or new. The
 * colour/grooming/avoid descriptors are deterministic English (routed through the
 * report translator in the UI); silhouette, texture and impression inherit the
 * report's language from the already-localised source fields.
 */
export function buildStyleCard(
  report: StyleReport,
  extras: StyleExtras,
): StyleCard {
  const p = report.profile;
  const season = p.colorSeason as Season;
  const colourName = p.colorSubseason
    ? SUBSEASON_LABELS[p.colorSubseason]
    : cap(season);
  const palette = report.colors.best.slice(0, 8).map((c) => c.hex);
  const colourAdj = p.colorSubseason
    ? SUBSEASON_ADJECTIVES[p.colorSubseason]
    : SEASON_ADJECTIVES[season];
  const texture = textureLine(extras.fabrics);
  const undertone = (p.physical.undertone ?? "neutral").toLowerCase();

  return {
    title: extras.archetype.name,
    systems: [
      {
        key: "colour",
        label: "Colour",
        value: colourName,
        sub: colourAdj,
        palette,
      },
      { key: "silhouette", label: "Silhouette", value: report.silhouette.fit },
      { key: "texture", label: "Texture", value: texture },
      {
        key: "grooming",
        label: "Grooming",
        value: `Textured hair, ${beardWord(p.physical.faceShape)} beard, softened edges, matte finish.`,
      },
      {
        key: "impression",
        label: "Impression",
        value: cap(extras.archetype.line),
      },
      {
        key: "avoid",
        label: "Avoid",
        value: AVOID_BY_UNDERTONE[undertone] ?? AVOID_BY_UNDERTONE.neutral,
      },
    ],
  };
}

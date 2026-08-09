import "server-only";
import type { ColorRec, ShoppingItem } from "@/lib/report";
import type { StyleExtras } from "@/lib/style-extras";
import type { ReportLanguage } from "@/lib/languages";
import { withTranslator, type TranslateFn } from "@/lib/ai/translate";

type Named = { name: string; why: string };
type LookLike = {
  context: string;
  title: string;
  description: string;
  palette?: string[];
};

const trColor = (c: ColorRec, tr: TranslateFn): ColorRec => ({
  ...c,
  name: tr(c.name),
  why: tr(c.why),
});

const trNamed = <T extends Named>(i: T, tr: TranslateFn): T => ({
  ...i,
  name: tr(i.name),
  why: tr(i.why),
});

/** Only the "why" prose is translated — brand/product titles and colours stay unchanged. */
const trShopping = (items: ShoppingItem[], tr: TranslateFn): ShoppingItem[] =>
  items.map((i) => ({
    ...i,
    why: tr(i.why),
    ...(i.heroWhy ? { heroWhy: tr(i.heroWhy) } : {}),
  }));

function trExtras(e: StyleExtras, tr: TranslateFn): StyleExtras {
  return {
    archetype: { name: tr(e.archetype.name), line: tr(e.archetype.line) },
    priorityMoves: e.priorityMoves.map((m) => ({
      n: m.n,
      title: tr(m.title),
      why: tr(m.why),
    })),
    colorDNA: {
      ...e.colorDNA,
      subseason: tr(e.colorDNA.subseason),
      neutrals: e.colorDNA.neutrals.map((c) => trColor(c, tr)),
      bestWhite: tr(e.colorDNA.bestWhite),
      bestDenim: tr(e.colorDNA.bestDenim),
      metal: tr(e.colorDNA.metal),
      blackAlt: tr(e.colorDNA.blackAlt),
      contrastRule: tr(e.colorDNA.contrastRule),
      colorStoryIntro: tr(e.colorDNA.colorStoryIntro),
    },
    metals: {
      recommend: e.metals.recommend.map((m) => ({
        ...m,
        name: tr(m.name),
        why: tr(m.why),
      })),
      avoidNote: tr(e.metals.avoidNote),
    },
    eyewear: {
      recommend: e.eyewear.recommend.map((f) => ({
        ...f,
        name: tr(f.name),
        why: tr(f.why),
      })),
      avoid: e.eyewear.avoid.map((s) => tr(s)),
    },
    fitBlueprint: e.fitBlueprint.map((f) => ({
      part: tr(f.part),
      spec: tr(f.spec),
      why: tr(f.why),
    })),
    barberBlueprint: (e.barberBlueprint ?? []).map((f) => ({
      part: tr(f.part),
      spec: tr(f.spec),
      why: tr(f.why),
    })),
    pairings: {
      base: e.pairings.base.map((c) => trColor(c, tr)),
      accent: e.pairings.accent.map((c) => trColor(c, tr)),
      hero: e.pairings.hero ? trColor(e.pairings.hero, tr) : null,
      combos: e.pairings.combos.map((c) => ({
        ...c,
        name: tr(c.name),
        why: tr(c.why),
      })),
    },
    fabrics: e.fabrics.map((f) => ({ name: tr(f.name), why: tr(f.why) })),
    capsule: {
      ...e.capsule,
      now: trShopping(e.capsule.now, tr),
      next: trShopping(e.capsule.next, tr),
      later: trShopping(e.capsule.later, tr),
    },
    matrix: e.matrix.map((c) => ({
      ...c,
      context: tr(c.context),
      pieces: c.pieces.map((p) => tr(p)),
      owned: c.owned ? c.owned.map((p) => tr(p)) : c.owned,
    })),
    priceTiers: e.priceTiers.map((p) => ({
      ...p,
      category: tr(p.category),
      note: tr(p.note),
    })),
    grooming: e.grooming.map((g) => ({ title: tr(g.title), detail: tr(g.detail) })),
    styling: e.styling.map((s) => tr(s)),
    care: e.care.map((s) => tr(s)),
    fragrance: tr(e.fragrance),
    watchGuide: {
      ...e.watchGuide,
      intro: tr(e.watchGuide.intro),
      variants: e.watchGuide.variants.map((v) => ({
        ...v,
        context: tr(v.context),
        type: tr(v.type),
        shape: tr(v.shape),
        caseMetal: tr(v.caseMetal),
        dial: tr(v.dial),
        strap: tr(v.strap),
        why: tr(v.why),
      })),
      cuffNote: tr(e.watchGuide.cuffNote),
      shapeNote: tr(e.watchGuide.shapeNote),
      avoidNote: tr(e.watchGuide.avoidNote),
    },
  };
}

/** Every translatable piece of a report. Fields are optional so callers can
 *  translate only the deterministic parts (at generation) or everything
 *  (when changing an existing report's language). Shapes are preserved. */
export type ReportParts = {
  headline?: string;
  summary?: string;
  colors?: { best: ColorRec[]; avoid: ColorRec[] };
  hair?: { recommend: Named[]; avoid: Named[] };
  silhouette?: { fit: string; rules: string[] };
  doList?: string[];
  dontList?: string[];
  looks?: LookLike[];
  shopping?: ShoppingItem[];
  lookItems?: Record<number, ShoppingItem[]>;
  facialHair?: Named[];
  eyewear?: Named[];
  headwear?: Named[];
  accessories?: Named[];
  extras?: StyleExtras;
};

/**
 * Translate the provided report parts into `language`. No-op for English or
 * when AI is unavailable. Only present fields are returned.
 */
export async function translateReportParts<T extends ReportParts>(
  parts: T,
  language: ReportLanguage,
): Promise<T> {
  return withTranslator(language, (tr) => {
    const out: ReportParts = {};
    if (parts.headline !== undefined) out.headline = tr(parts.headline);
    if (parts.summary !== undefined) out.summary = tr(parts.summary);
    if (parts.colors)
      out.colors = {
        best: parts.colors.best.map((c) => trColor(c, tr)),
        avoid: parts.colors.avoid.map((c) => trColor(c, tr)),
      };
    if (parts.hair)
      out.hair = {
        recommend: parts.hair.recommend.map((h) => trNamed(h, tr)),
        avoid: parts.hair.avoid.map((h) => trNamed(h, tr)),
      };
    if (parts.silhouette)
      out.silhouette = {
        fit: tr(parts.silhouette.fit),
        rules: parts.silhouette.rules.map((r) => tr(r)),
      };
    if (parts.doList) out.doList = parts.doList.map((s) => tr(s));
    if (parts.dontList) out.dontList = parts.dontList.map((s) => tr(s));
    if (parts.looks)
      out.looks = parts.looks.map((l) => ({
        ...l,
        context: tr(l.context),
        title: tr(l.title),
        description: tr(l.description),
      }));
    if (parts.shopping) out.shopping = trShopping(parts.shopping, tr);
    if (parts.lookItems) {
      const li: Record<number, ShoppingItem[]> = {};
      for (const [k, items] of Object.entries(parts.lookItems)) {
        li[Number(k)] = trShopping(items, tr);
      }
      out.lookItems = li;
    }
    if (parts.facialHair)
      out.facialHair = parts.facialHair.map((h) => trNamed(h, tr));
    if (parts.eyewear) out.eyewear = parts.eyewear.map((h) => trNamed(h, tr));
    if (parts.headwear) out.headwear = parts.headwear.map((h) => trNamed(h, tr));
    if (parts.accessories)
      out.accessories = parts.accessories.map((h) => trNamed(h, tr));
    if (parts.extras) out.extras = trExtras(parts.extras, tr);
    return out as T;
  });
}

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getReportViewForDownload } from "@/lib/data/reports";
import {
  resolveReportOgImage,
  resolveLookOgImage,
  type ReportOgImageResult,
} from "@/lib/data/report-og";
import { extrasForReport } from "@/lib/style-extras";
import { SUBSEASON_LABELS, type SubseasonId } from "@/lib/style-profile";

/** Everything the branded share card needs — resolved server-side, gated to public reports. */
export type ShareCardData = {
  headline: string;
  seasonLabel: string;
  undertone: string;
  contrast: string;
  archetype: string;
  /** Best-colour hexes, ready to render as swatches. */
  palette: string[];
  /** Hero look photo as a data URL, embedded so Satori needs no network. */
  heroDataUrl: string | null;
};

function cap(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * Inline image bytes as a data URL. When `maxWidth` is set the source is
 * downscaled first (jpeg) so a full-res hero can't blow the render function's
 * memory — a real risk for the 1080×1920 vertical card (A4).
 */
async function inlineImage(
  bytes: Buffer,
  contentType: string,
  maxWidth?: number,
): Promise<string> {
  if (maxWidth) {
    try {
      const sharp = (await import("sharp")).default;
      const jpeg = await sharp(bytes)
        .resize({ width: maxWidth, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    } catch {
      // sharp unavailable — fall back to the raw bytes below.
    }
  }
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

/** Turn a resolved OG image (storage bytes or public asset) into a data URL. */
async function ogResultToDataUrl(
  resolved: ReportOgImageResult,
  maxWidth?: number,
): Promise<string | null> {
  try {
    if (resolved.kind === "bytes") {
      return inlineImage(Buffer.from(resolved.bytes), resolved.contentType, maxWidth);
    }
    const filePath = path.join(
      process.cwd(),
      "public",
      resolved.path.replace(/^\//, ""),
    );
    const bytes = await readFile(filePath);
    return inlineImage(bytes, resolved.contentType, maxWidth);
  } catch {
    return null;
  }
}

/** Resolve the hero image to an inline data URL (storage bytes or a public asset). */
async function heroDataUrl(id: string, maxWidth?: number): Promise<string | null> {
  return ogResultToDataUrl(await resolveReportOgImage(id), maxWidth);
}

/**
 * Build share-card data for a report, or `null` when it isn't publicly
 * shareable (private reports never expose personal data in the OG image).
 */
export async function getReportShareCard(
  id: string,
  opts?: { heroWidth?: number },
): Promise<ShareCardData | null> {
  const view = await getReportViewForDownload(id).catch(() => null);
  if (!view || !view.isPublic) return null;

  const { report } = view;
  const { profile } = report;

  const subId = profile.colorSubseason as SubseasonId | undefined;
  const seasonLabel = subId
    ? SUBSEASON_LABELS[subId]
    : cap(profile.colorSeason);

  let archetype = "";
  try {
    archetype = extrasForReport(report).archetype.name;
  } catch {
    archetype = "";
  }

  const palette = (report.colors?.best ?? [])
    .map((c) => c.hex)
    .filter((hex): hex is string => Boolean(hex))
    .slice(0, 6);

  return {
    headline: report.headline || "Your style, decoded",
    seasonLabel,
    undertone: cap(profile.physical.undertone),
    contrast: `${cap(profile.physical.contrast)} contrast`,
    archetype,
    palette,
    heroDataUrl: await heroDataUrl(id, opts?.heroWidth),
  };
}

/**
 * Build share-card data for a single look, or `null` when the report isn't
 * publicly shareable or the look index is out of range.
 */
export async function getLookShareCard(
  id: string,
  index: number,
): Promise<ShareCardData | null> {
  const view = await getReportViewForDownload(id).catch(() => null);
  if (!view || !view.isPublic) return null;

  const { report } = view;
  const look = report.looks[index];
  if (!look) return null;

  const { profile } = report;
  const subId = profile.colorSubseason as SubseasonId | undefined;
  const seasonLabel = subId
    ? SUBSEASON_LABELS[subId]
    : cap(profile.colorSeason);

  const palette = (look.palette ?? [])
    .filter((hex): hex is string => Boolean(hex))
    .slice(0, 6);

  return {
    headline: look.title || report.headline || "Your style, decoded",
    seasonLabel,
    undertone: cap(profile.physical.undertone),
    contrast: look.context || `${cap(profile.physical.contrast)} contrast`,
    archetype: "",
    palette,
    heroDataUrl: await ogResultToDataUrl(await resolveLookOgImage(id, index)),
  };
}

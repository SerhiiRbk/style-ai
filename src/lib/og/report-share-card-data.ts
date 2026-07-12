import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getReportViewForDownload } from "@/lib/data/reports";
import { resolveReportOgImage } from "@/lib/data/report-og";
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

/** Resolve the hero image to an inline data URL (storage bytes or a public asset). */
async function heroDataUrl(id: string): Promise<string | null> {
  try {
    const resolved = await resolveReportOgImage(id);
    if (resolved.kind === "bytes") {
      const base64 = Buffer.from(resolved.bytes).toString("base64");
      return `data:${resolved.contentType};base64,${base64}`;
    }
    const filePath = path.join(
      process.cwd(),
      "public",
      resolved.path.replace(/^\//, ""),
    );
    const bytes = await readFile(filePath);
    return `data:${resolved.contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Build share-card data for a report, or `null` when it isn't publicly
 * shareable (private reports never expose personal data in the OG image).
 */
export async function getReportShareCard(
  id: string,
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
    heroDataUrl: await heroDataUrl(id),
  };
}

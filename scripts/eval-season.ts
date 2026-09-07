/**
 * Season stability eval on real reports.
 *
 *   npm run eval:season -- [--runs=3] [--ids=<reportId,...>]
 *
 * For every case in src/lib/fixtures/colouring-eval.json (or the ids given)
 * the report's stored intake and photos are read from the database and
 * `analyzeProfile` is run N times. Printed per case: undertone / contrast /
 * season / subseason per run, the measured hue angle, agreement across runs,
 * and agreement with the stylist's `expected` label when one is set.
 *
 * Each run is one vision call plus the pixel measurement — paid. Run it when a
 * season rule changes, not in CI.
 */
import { readFileSync } from "node:fs";
import { analyzeProfile, type PhotoInput } from "../src/lib/ai/pipeline";
import { createAdminSupabase } from "../src/lib/supabase/server";
import { classifySubseason, intakeSchema } from "../src/lib/style-profile";

type Expected = { undertone?: string; contrast?: string; season?: string; subseason?: string } | null;
type Case = { reportId: string; label?: string; expected: Expected };

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const runs = Math.max(1, Number(arg("runs") ?? 3));
  const only = arg("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
  const file = JSON.parse(readFileSync("src/lib/fixtures/colouring-eval.json", "utf8")) as { cases: Case[] };
  const cases = only ? only.map((id) => file.cases.find((c) => c.reportId === id) ?? { reportId: id, expected: null }) : file.cases;
  const admin = createAdminSupabase();
  const summary: { id: string; agree: number; expectedHit: string }[] = [];

  for (const c of cases) {
    const { data: row } = await admin.from("report_intake").select("intake").eq("report_id", c.reportId).maybeSingle();
    if (!row?.intake) {
      console.log(`\n== ${c.reportId}: no intake row — skipped`);
      continue;
    }
    const raw = row.intake as Record<string, unknown> & { photoPaths?: { role: string; path: string }[] };
    const intake = intakeSchema.parse(raw);
    const paths = raw.photoPaths ?? [];
    const { data: rows } = await admin
      .from("photos")
      .select("storage_path, created_at")
      .in("storage_path", paths.map((p) => p.path));
    const uploadedAt = new Map<string, string>();
    for (const r of rows ?? []) {
      const prev = uploadedAt.get(r.storage_path as string);
      if (!prev || (r.created_at as string) < prev) uploadedAt.set(r.storage_path as string, r.created_at as string);
    }
    const photos: PhotoInput[] = [];
    for (const p of paths) {
      const { data } = await admin.storage.from("photos").createSignedUrl(p.path, 1800);
      if (data?.signedUrl) photos.push({ role: p.role, url: data.signedUrl, uploadedAt: uploadedAt.get(p.path) });
    }
    if (!photos.length) {
      console.log(`\n== ${c.reportId}: no photos — skipped`);
      continue;
    }
    console.log(`\n== ${c.reportId}${c.label ? ` — ${c.label}` : ""} (${photos.map((p) => p.role).join("+")}, ${runs} runs)`);
    const results: { undertone: string; contrast: string; season: string; subseason: string; hue: number | null; conf: number | null }[] = [];
    for (let i = 0; i < runs; i++) {
      const profile = await analyzeProfile(intake, photos);
      const ph = profile.physical;
      // The pipeline classifies the subseason WITH the model's clarity read;
      // recomputing here without it would split Soft from Cool Summer wrongly.
      const subseason =
        profile.colorSubseason ??
        classifySubseason({
          season: profile.colorSeason,
          undertone: ph.undertone,
          contrast: ph.contrast,
          hairColor: ph.hairColor,
          eyeColor: ph.eyeColor,
        });
      const measured = (ph as { measured?: { undertoneHueAngle?: number; undertoneConfidence?: number; bodySkinUsed?: boolean; bodySkinSkipped?: string } }).measured;
      results.push({
        undertone: ph.undertone,
        contrast: ph.contrast,
        season: profile.colorSeason,
        subseason,
        hue: measured?.undertoneHueAngle ?? null,
        conf: measured?.undertoneConfidence ?? null,
      });
      console.log(
        `  run ${i + 1}: ${ph.undertone.padEnd(7)} ${ph.contrast.padEnd(6)} ${profile.colorSeason.padEnd(6)} ${subseason.padEnd(14)}` +
          ` hue=${measured?.undertoneHueAngle?.toFixed(1) ?? "-"} conf=${measured?.undertoneConfidence?.toFixed(2) ?? "-"}` +
          ` body=${measured?.bodySkinSkipped ?? (measured?.bodySkinUsed ? "used" : "none")}` +
          ` hair="${ph.hairColor ?? ""}" eyes="${ph.eyeColor ?? ""}"`,
      );
    }
    const key = (r: (typeof results)[number]) => `${r.undertone}|${r.contrast}|${r.subseason}`;
    const counts = new Map<string, number>();
    for (const r of results) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
    const agree = Math.max(...counts.values()) / results.length;
    let expectedHit = "unlabelled";
    if (c.expected) {
      const hits = results.filter(
        (r) =>
          (!c.expected!.undertone || r.undertone === c.expected!.undertone) &&
          (!c.expected!.contrast || r.contrast === c.expected!.contrast) &&
          (!c.expected!.season || r.season === c.expected!.season) &&
          (!c.expected!.subseason || r.subseason === c.expected!.subseason),
      ).length;
      expectedHit = `${hits}/${results.length}`;
    }
    console.log(`  agreement across runs: ${(agree * 100).toFixed(0)}%  · expected: ${expectedHit}`);
    summary.push({ id: c.reportId, agree, expectedHit });
  }

  console.log("\n== summary");
  for (const s of summary) console.log(`  ${s.id}  runs agree ${(s.agree * 100).toFixed(0)}%  expected ${s.expectedHit}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

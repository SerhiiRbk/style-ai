import "server-only";
import { createAdminSupabase } from "@/lib/supabase/server";

/** Structured personal-data export for GDPR data portability (Art. 20). */
export async function exportUserData(userId: string) {
  const admin = createAdminSupabase();

  const [
    profileRes,
    userProfileRes,
    reportsRes,
    intakesRes,
    photosRes,
    consentsRes,
    creditsRes,
    tryonsRes,
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin
      .from("reports")
      .select("id, tier, status, headline, summary, created_at, is_public")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("report_intake")
      .select("report_id, intake")
      .eq("user_id", userId),
    admin
      .from("photos")
      .select("id, role, storage_path, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("consents")
      .select("type, version, granted_at, revoked_at")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false }),
    admin
      .from("credits_ledger")
      .select("amount, reason, ref_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("tryons")
      .select("id, report_id, created_at, garments")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const intakeByReport = new Map(
    (intakesRes.data ?? []).map((row) => [row.report_id as string, row.intake]),
  );
  const reportsWithIntake = (reportsRes.data ?? []).map((row) => ({
    ...row,
    intake: intakeByReport.get(row.id as string) ?? null,
  }));

  return {
    exportedAt: new Date().toISOString(),
    format: "valetti-gdpr-export-v1",
    profile: profileRes.data ?? null,
    styleProfile: userProfileRes.data ?? null,
    reports: reportsWithIntake,
    photos: (photosRes.data ?? []).map((p) => ({
      id: p.id,
      role: p.role,
      storagePath: p.storage_path,
      status: p.status,
      createdAt: p.created_at,
    })),
    consents: consentsRes.data ?? [],
    creditsLedger: creditsRes.data ?? [],
    tryOns: tryonsRes.data ?? [],
    note:
      "Generated images and full report JSON are stored in your account and included here as metadata. Contact contact@system.valetti.fit if you need a fuller archive.",
  };
}

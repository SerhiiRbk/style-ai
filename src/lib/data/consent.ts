import "server-only";
import { LEGAL } from "@/lib/legal";
import { createAdminSupabase } from "@/lib/supabase/server";

/** Record explicit biometric-processing consent (GDPR Art. 9). */
export async function recordBiometricConsent(userId: string): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from("consents").insert({
    user_id: userId,
    type: "biometric",
    version: LEGAL.consentVersion,
  });
}

/** Mark open biometric consents as revoked when the user has no remaining reports. */
export async function revokeBiometricConsentIfIdle(userId: string): Promise<void> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count && count > 0) return;

  await admin
    .from("consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", "biometric")
    .is("revoked_at", null);
}

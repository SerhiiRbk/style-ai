import { redirect } from "next/navigation";
import { countryNameFromCode } from "@/lib/countries";
import { getCreditBalance } from "@/lib/credits";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { getGeoPrefill } from "@/lib/geo";
import { applyWelcomeCredits } from "@/lib/welcome-credits";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { StartForm } from "./StartForm";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const sp = await searchParams;
  const showWelcome = sp.welcome === "1";
  let userId: string | null = null;
  let userEmail: string | null = null;
  let creditBalance: number | null = null;

  if (hasSupabase) {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) redirect("/login");
    userId = user.id;
    userEmail = user.email ?? null;

    if (hasSupabaseAdmin) {
      try {
        await applyWelcomeCredits(createAdminSupabase(), userId);
      } catch {
        // Non-fatal — Navbar and /reports also attempt the grant.
      }
    }
    creditBalance = await getCreditBalance();
  }

  const geo = await getGeoPrefill();

  return (
    <StartForm
      userId={userId}
      showWelcome={showWelcome}
      userEmail={userEmail}
      creditBalance={creditBalance}
      initialGeo={{
        city: geo.city ?? "",
        countryName: countryNameFromCode(geo.country) ?? "",
        currency: geo.currency,
      }}
    />
  );
}

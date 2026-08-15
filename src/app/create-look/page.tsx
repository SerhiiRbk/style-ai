import { redirect } from "next/navigation";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import {
  createServerSupabase,
  createAdminSupabase,
} from "@/lib/supabase/server";
import { getCreditBalance, creditsPurchased } from "@/lib/credits";
import { getUserProfile } from "@/lib/data/user-profile";
import { resolveExistingProfile } from "@/lib/data/look-sets";
import { isLoyalty } from "@/lib/look-sets";
import type { BodyTypeId } from "@/lib/style-profile";
import { CreateLookForm } from "@/components/CreateLookForm";

export const metadata = {
  title: "Create a Look · Valetti",
  description:
    "Generate a set of outfit looks for any occasion, styled to your colour profile.",
};

export default async function CreateLookPage() {
  if (!hasSupabase) {
    return (
      <main className="bg-paper">
        <div className="container-luxe max-w-2xl py-16 text-center text-stone">
          Create a Look is unavailable in demo mode.
        </div>
      </main>
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/create-look");

  const profile = await getUserProfile(user.id);
  const creditBalance = (await getCreditBalance()) ?? 0;

  let loyalty = false;
  let hasReusableProfile = false;
  if (hasSupabaseAdmin) {
    const admin = createAdminSupabase();
    loyalty = isLoyalty(await creditsPurchased(admin, user.id));
    hasReusableProfile = (await resolveExistingProfile(admin, user.id)) != null;
  }

  const currentYear = new Date().getFullYear();
  const initialAge =
    typeof profile?.birthYear === "number"
      ? currentYear - profile.birthYear
      : "";

  return (
    <CreateLookForm
      userId={user.id}
      initialAge={initialAge}
      initialBodyType={(profile?.bodyType as BodyTypeId | undefined) ?? ""}
      creditBalance={creditBalance}
      loyalty={loyalty}
      hasReusableProfile={hasReusableProfile}
    />
  );
}

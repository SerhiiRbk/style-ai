import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserProfile, upsertUserProfile } from "@/lib/data/user-profile";
import { userProfileSchema } from "@/lib/style-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  if (!hasSupabase) return null;
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ?? null;
}

/** The signed-in user's saved profile (defaults for new reports). */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const profile = await getUserProfile(user.id);
  return NextResponse.json({ profile });
}

/** Save the user's profile defaults (from the account page or the wizard). */
export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = userProfileSchema.safeParse(body?.profile ?? body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile", issues: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }
  const ok = await upsertUserProfile(user.id, parsed.data);
  if (!ok) {
    return NextResponse.json({ error: "Could not save profile" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: parsed.data });
}

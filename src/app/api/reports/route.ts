import { NextResponse } from "next/server";
import { intakeSchema } from "@/lib/style-profile";
import { type Tier } from "@/lib/report";
import { createAndRunReport } from "@/lib/data/reports";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

const TIERS: Tier[] = ["free", "basic", "lookbook", "premium"];

/** Vision + reasoning + catalogue matching can take 1–2 min; look photos run in `after()`. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = intakeSchema.safeParse(body.intake);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid intake", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const tier: Tier = TIERS.includes(body.tier) ? body.tier : "basic";

  let userId: string | null = null;
  if (hasSupabase) {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    userId = user.id;
  }

  try {
    const id = await createAndRunReport({
      intake: parsed.data,
      tier,
      userId,
      photoPaths: Array.isArray(body.photoPaths) ? body.photoPaths : [],
    });
    return NextResponse.json({ id, tier }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    );
  }
}

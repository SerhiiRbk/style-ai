import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { intakeSchema } from "@/lib/style-profile";
import { type Tier } from "@/lib/report";
import { createAndRunReport } from "@/lib/data/reports";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { LEGAL } from "@/lib/legal";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  REPORT_COST,
  spendCredits,
  refundReportCredits,
  ensureSignupBonus,
  InsufficientCreditsError,
} from "@/lib/credits";

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
  const photoPaths = Array.isArray(body.photoPaths) ? body.photoPaths : [];
  const biometricConsent = body.biometricConsent === true;
  const consentVersion =
    typeof body.consentVersion === "string" ? body.consentVersion : "";

  if (photoPaths.length && hasSupabase) {
    if (!biometricConsent || consentVersion !== LEGAL.consentVersion) {
      return NextResponse.json(
        {
          error:
            "Explicit consent for photo processing is required. Please accept on the photo step.",
          code: "consent_required",
        },
        { status: 422 },
      );
    }
  }

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

  if (tier === "free" && !userId) {
    return NextResponse.json(
      { error: "Sign in required for the Starter Report.", code: "auth_required" },
      { status: 401 },
    );
  }

  const cost = REPORT_COST[tier];
  const reportId =
    userId && hasSupabaseAdmin ? randomUUID() : undefined;
  let creditsCharged = false;

  if (userId && hasSupabaseAdmin && cost > 0 && reportId) {
    const admin = createAdminSupabase();
    try {
      await ensureSignupBonus(admin, userId);
    } catch {
      // Non-fatal — spendCredits still guards the balance atomically.
    }
    try {
      await spendCredits(admin, {
        userId,
        amount: cost,
        reason: "report",
        refId: reportId,
      });
      creditsCharged = true;
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits to generate this report.",
            code: "insufficient_credits",
            balance: e.balance,
            needed: e.needed,
          },
          { status: 402 },
        );
      }
      throw e;
    }
  }

  try {
    const id = await createAndRunReport({
      intake: parsed.data,
      tier,
      userId,
      reportId,
      photoPaths,
      biometricConsent: photoPaths.length ? biometricConsent : undefined,
      consentVersion: photoPaths.length ? consentVersion : undefined,
    });

    return NextResponse.json({ id, tier }, { status: 201 });
  } catch (e) {
    if (creditsCharged && userId && hasSupabaseAdmin && reportId && cost > 0) {
      try {
        await refundReportCredits(createAdminSupabase(), {
          userId,
          amount: cost,
          reportId,
        });
      } catch (refundErr) {
        console.error("[report] credit refund failed", refundErr);
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 },
    );
  }
}

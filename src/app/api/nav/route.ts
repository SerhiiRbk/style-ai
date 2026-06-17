import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-visitor navbar state (auth + admin + credit balance).
 *
 * Lives in a route handler so marketing/report pages can stay statically
 * rendered: the navbar reads this from the client instead of forcing every
 * page that renders <Navbar /> into dynamic rendering.
 */
export async function GET() {
  const empty = { authed: false, isAdmin: false, balance: null as number | null };
  const noStore = { "Cache-Control": "private, no-store" };

  if (!hasSupabase) {
    return NextResponse.json(empty, { headers: noStore });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json(empty, { headers: noStore });
  }

  const isAdmin = isAdminEmail(user.email);
  let balance: number | null = null;
  try {
    balance = await getCreditBalance();
  } catch {
    /* leave balance null if the lookup fails */
  }

  return NextResponse.json(
    { authed: true, isAdmin, balance },
    { headers: noStore },
  );
}

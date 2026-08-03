import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { verifyUnsubscribeToken } from "@/lib/email/send";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

function page(message: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Unsubscribe — ${BRAND.name}</title></head><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f5efe6;color:#1a1712;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;box-sizing:border-box;"><div style="max-width:420px;background:#fff;border:1px solid #e7ddcf;border-radius:16px;padding:32px;text-align:center;"><h1 style="font-size:20px;margin:0 0 12px;">${BRAND.name}</h1><p style="color:#6b6357;font-size:15px;line-height:1.6;margin:0;">${message}</p></div></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** One-click unsubscribe from reminder / lifecycle email (signed link). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("t") ?? "";

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return page("This unsubscribe link is invalid or has expired.");
  }

  if (hasSupabaseAdmin) {
    try {
      const admin = createAdminSupabase();
      await admin
        .from("email_unsubscribes")
        .upsert({ email }, { onConflict: "email" });
    } catch (err) {
      console.error("[unsubscribe]", err);
      return page(
        "Something went wrong. Please email us and we'll remove you.",
      );
    }
  }

  return page(
    "You've been unsubscribed from reminder emails. You'll still receive essential messages about your reports.",
  );
}

import Link from "next/link";
import { gateAdminPage } from "@/lib/admin-page";
import { AdminShell } from "@/components/AdminShell";
import { PromoAdminPanel } from "@/components/PromoAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <AdminShell currentPath="/admin/promos">
        <h1 className="font-display text-2xl">
          {gate.reason === "no_supabase" ? "Unavailable in demo mode" : "Not authorised"}
        </h1>
        <p className="mt-2 text-stone">
          {gate.reason === "no_supabase"
            ? "Promotion tools require live mode (Supabase configured)."
            : "Add your email to ADMIN_EMAILS to manage promotions."}
        </p>
        {gate.reason === "forbidden" && (
          <Link href="/login" className="mt-6 inline-block text-sm text-brass hover:text-ink">
            Sign in →
          </Link>
        )}
      </AdminShell>
    );
  }

  return (
    <AdminShell currentPath="/admin/promos">
      <h1 className="font-display text-3xl">Promotions</h1>
      <p className="mt-2 max-w-2xl text-stone">
        Create promo codes and invite links. Credits are granted once per user
        when they sign in via the invite link or enter the code while logged in.
      </p>
      <div className="mt-10">
        <PromoAdminPanel />
      </div>
    </AdminShell>
  );
}

import Link from "next/link";
import { gateAdminPage } from "@/lib/admin-page";
import { AdminShell } from "@/components/AdminShell";
import { UsersAdminPanel } from "@/components/UsersAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <AdminShell currentPath="/admin/users">
        <h1 className="font-display text-2xl">
          {gate.reason === "no_supabase" ? "Unavailable in demo mode" : "Not authorised"}
        </h1>
        <p className="mt-2 text-stone">
          {gate.reason === "no_supabase"
            ? "User analytics require live mode (Supabase configured)."
            : "Add your email to ADMIN_EMAILS to browse user activity."}
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
    <AdminShell currentPath="/admin/users">
      <h1 className="font-display text-3xl">Users</h1>
      <p className="mt-2 max-w-2xl text-stone">
        Per-user activity across the platform — reports, Stripe purchases, promo
        redemptions, try-ons, grooming renders, and the full credit ledger.
      </p>
      <div className="mt-10">
        <UsersAdminPanel />
      </div>
    </AdminShell>
  );
}

import Link from "next/link";
import { gateAdminPage } from "@/lib/admin-page";
import { AdminShell } from "@/components/AdminShell";
import { LooksAdminPanel } from "@/components/LooksAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminLooksPage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <AdminShell currentPath="/admin/looks">
        <h1 className="font-display text-2xl">
          {gate.reason === "no_supabase" ? "Unavailable in demo mode" : "Not authorised"}
        </h1>
        <p className="mt-2 text-stone">
          {gate.reason === "no_supabase"
            ? "Look tools require live mode (Supabase configured)."
            : "Add your email to ADMIN_EMAILS to browse all look sets."}
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
    <AdminShell currentPath="/admin/looks">
      <h1 className="font-display text-3xl">Looks</h1>
      <p className="mt-2 max-w-2xl text-stone">
        All look sets generated on the platform. Open any set to review the
        looks, even when they are not public.
      </p>
      <div className="mt-10">
        <LooksAdminPanel />
      </div>
    </AdminShell>
  );
}

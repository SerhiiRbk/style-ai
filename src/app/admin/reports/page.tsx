import Link from "next/link";
import { gateAdminPage } from "@/lib/admin-page";
import { AdminShell } from "@/components/AdminShell";
import { ReportsAdminPanel } from "@/components/ReportsAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <AdminShell currentPath="/admin/reports">
        <h1 className="font-display text-2xl">
          {gate.reason === "no_supabase" ? "Unavailable in demo mode" : "Not authorised"}
        </h1>
        <p className="mt-2 text-stone">
          {gate.reason === "no_supabase"
            ? "Report tools require live mode (Supabase configured)."
            : "Add your email to ADMIN_EMAILS to browse all reports."}
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
    <AdminShell currentPath="/admin/reports">
      <h1 className="font-display text-3xl">Reports</h1>
      <p className="mt-2 max-w-2xl text-stone">
        All style reports generated on the platform. Open any report to review
        colours, looks, and shopping lists.
      </p>
      <div className="mt-10">
        <ReportsAdminPanel />
      </div>
    </AdminShell>
  );
}

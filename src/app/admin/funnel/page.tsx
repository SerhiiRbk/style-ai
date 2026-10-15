import Link from "next/link";
import { gateAdminPage } from "@/lib/admin-page";
import { AdminShell } from "@/components/AdminShell";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { loadFunnelWeek } from "@/lib/funnel-stats";

export const dynamic = "force-dynamic";

export default async function AdminFunnelPage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <AdminShell currentPath="/admin/funnel">
        <h1 className="font-display text-2xl">
          {gate.reason === "no_supabase"
            ? "Unavailable in demo mode"
            : "Not authorised"}
        </h1>
      </AdminShell>
    );
  }

  if (!hasSupabaseAdmin) {
    return (
      <AdminShell currentPath="/admin/funnel">
        <h1 className="font-display text-3xl">Launch funnel</h1>
        <p className="mt-2 text-stone">Admin database is not configured.</p>
      </AdminShell>
    );
  }

  const week = await loadFunnelWeek(createAdminSupabase());

  return (
    <AdminShell currentPath="/admin/funnel">
      <h1 className="font-display text-3xl">Launch funnel</h1>
      <p className="mt-2 max-w-2xl text-stone">
        Last seven days from {new Date(week.since).toISOString().slice(0, 10)}.
        Visitors are unique user or anonymous ids. Vercel Analytics does not
        replace this.
      </p>
      <div className="mt-10 overflow-hidden rounded-2xl border hairline">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wide text-stone-soft">
            <tr>
              <th className="px-4 py-3">Step</th>
              <th className="px-4 py-3">Events</th>
              <th className="px-4 py-3">Visitors</th>
            </tr>
          </thead>
          <tbody>
            {week.steps.map((s) => (
              <tr key={s.name} className="border-t hairline">
                <td className="px-4 py-3 font-mono text-ink">{s.name}</td>
                <td className="px-4 py-3">{s.events}</td>
                <td className="px-4 py-3">{s.visitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-stone">
        <Link href="/admin" className="text-brass hover:text-ink">
          ← Admin home
        </Link>
      </p>
    </AdminShell>
  );
}

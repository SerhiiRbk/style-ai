import Link from "next/link";
import { gateAdminPage } from "@/lib/admin-page";
import { AdminShell } from "@/components/AdminShell";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <AdminShell>
        <h1 className="font-display text-3xl">
          {gate.reason === "no_supabase" ? "Unavailable in demo mode" : "Not authorised"}
        </h1>
        <p className="mt-4 max-w-lg text-stone">
          {gate.reason === "no_supabase"
            ? "Admin tools require live mode (Supabase configured)."
            : "Sign in with an email listed in ADMIN_EMAILS to access the admin console."}
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
    <AdminShell currentPath="/admin">
      <p className="eyebrow">Admin console</p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">Site administration</h1>
      <p className="mt-3 max-w-xl text-stone">
        Signed in as <span className="text-ink">{gate.user.email}</span>. Choose a
        section below.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-2xl border hairline bg-paper p-6 transition-colors hover:border-brass/40 hover:bg-cream/40"
          >
            <h2 className="font-display text-xl group-hover:text-brass">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone">{s.description}</p>
            <span className="mt-4 inline-block text-xs text-brass">Open →</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}

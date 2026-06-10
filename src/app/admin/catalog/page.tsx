import Link from "next/link";
import { gateAdminPage } from "@/lib/admin-page";
import { AdminShell } from "@/components/AdminShell";
import { listSources, sourceConfig } from "../../../../scripts/feeds/run.mjs";
import { CatalogRefreshPanel } from "@/components/CatalogRefreshPanel";
import { CatalogAdminPanel } from "@/components/CatalogAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <AdminShell currentPath="/admin/catalog">
        <h1 className="font-display text-2xl">
          {gate.reason === "no_supabase" ? "Unavailable in demo mode" : "Not authorised"}
        </h1>
        <p className="mt-2 text-stone">
          {gate.reason === "no_supabase"
            ? "Catalogue tools require live mode (Supabase configured)."
            : "Add your email to ADMIN_EMAILS to manage the catalogue."}
        </p>
        {gate.reason === "forbidden" && (
          <Link href="/login" className="mt-6 inline-block text-sm text-brass hover:text-ink">
            Sign in →
          </Link>
        )}
      </AdminShell>
    );
  }

  const sources = (listSources() as string[]).map((key) => {
    const cfg = sourceConfig(key) as { label: string; urlEnv: string };
    return {
      key,
      label: cfg.label,
      urlEnv: cfg.urlEnv,
      configured: Boolean(process.env[cfg.urlEnv]),
    };
  });
  const configuredCount = sources.filter((s) => s.configured).length;
  const hasAI = Boolean(process.env.AI_GATEWAY_API_KEY);

  return (
    <AdminShell currentPath="/admin/catalog">
      <h1 className="font-display text-3xl">Catalogue refresh</h1>
      <p className="mt-2 max-w-2xl text-stone">
        Pull the latest products from configured affiliate feeds, embed them, and
        upsert into the catalogue. Runs the same durable workflow as the daily
        cron — safe to trigger anytime. {configuredCount} of {sources.length}{" "}
        sources configured.
      </p>

      <div className="mt-8">
        <CatalogRefreshPanel sources={sources} hasAI={hasAI} />
      </div>

      <div className="mt-14 border-t hairline pt-14">
        <CatalogAdminPanel />
      </div>

      <div className="mt-14 border-t hairline pt-10">
        <h2 className="text-sm uppercase tracking-wider text-stone-soft">
          Sources
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-xl border hairline bg-paper px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{s.label}</div>
                <code className="text-xs text-stone-soft">{s.urlEnv}</code>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  s.configured
                    ? "bg-ink text-paper"
                    : "bg-cream/60 text-stone-soft"
                }`}
              >
                {s.configured ? "configured" : "not set"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

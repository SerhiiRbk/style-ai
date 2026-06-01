import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { listSources, sourceConfig } from "../../../../scripts/feeds/run.mjs";
import { CatalogRefreshPanel } from "@/components/CatalogRefreshPanel";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-cream/20">
      <header className="flex items-center justify-between border-b hairline px-6 py-4">
        <Link href="/" className="font-display text-lg">
          StyleAI
        </Link>
        <span className="text-sm text-stone-soft">Admin · Catalogue</span>
      </header>
      <div className="container-luxe py-12">{children}</div>
    </main>
  );
}

export default async function AdminCatalogPage() {
  if (!hasSupabase) {
    return (
      <Shell>
        <p className="text-stone">
          Catalogue tools are available in live mode only (Supabase not
          configured).
        </p>
      </Shell>
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  if (!isAdminEmail(user.email)) {
    return (
      <Shell>
        <h1 className="font-display text-2xl">Not authorised</h1>
        <p className="mt-2 text-stone">
          This area is restricted. Add your email to{" "}
          <code>ADMIN_EMAILS</code> to manage the catalogue.
        </p>
      </Shell>
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
    <Shell>
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

      <div className="mt-10">
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
    </Shell>
  );
}

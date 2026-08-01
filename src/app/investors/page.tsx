import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PrintDeckButton } from "@/components/PrintDeckButton";
import {
  DiagramFrame,
  ProductLoopDiagram,
  RevenueMixChart,
  SreFlowDiagram,
  StackDiagram,
  UnitEconomicsChart,
} from "@/components/investors/InvestorDiagrams";
import { gateAdminPage } from "@/lib/admin-page";
import { BRAND } from "@/lib/brand";
import {
  COMPETITORS,
  CREDIT_PACKS,
  ENGINES,
  INVESTOR_DECK_META,
  INVESTOR_STATS,
  MOAT,
  PROBLEM_SOLUTION,
  PRODUCT_PILLARS,
  ROADMAP,
  STACK_LAYERS,
  TIERS_TABLE,
  UNIT_ECON_TAKEAWAY,
  compSymbol,
  tierCogsEur,
  unitEconomicsRows,
} from "@/lib/investor-deck-en";
import "./investors.css";

export const metadata: Metadata = {
  title: `Investors · ${BRAND.name}`,
  description:
    "Valetti investor overview — Style Recommendation Engine, unit economics, pricing, and competitive positioning. Confidential.",
  alternates: { canonical: "/investors" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InvestorsPage() {
  const gate = await gateAdminPage();

  if (!gate.ok) {
    return (
      <div className="investors-deck">
        <Navbar />
        <main className="flex-1 bg-paper">
          <div className="container-luxe py-24">
            <h1 className="font-display text-3xl text-ink">
              {gate.reason === "no_supabase"
                ? "Unavailable in demo mode"
                : "Not authorised"}
            </h1>
            <p className="mt-4 max-w-lg text-stone">
              {gate.reason === "no_supabase"
                ? "The investor deck requires live mode (Supabase and ADMIN_EMAILS configured)."
                : "This page is restricted to administrators. Sign in with an email listed in ADMIN_EMAILS."}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return <InvestorsDeckContent />;
}

function InvestorsDeckContent() {
  const unitRows = unitEconomicsRows();

  return (
    <div className="investors-deck">
      <Navbar />
      <main className="flex-1 bg-paper">
        {/* Cover hero */}
        <section className="investors-section relative overflow-hidden border-b hairline bg-ink text-paper">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(169,124,60,0.28),transparent_50%)]"
          />
          <div className="container-luxe relative grid items-end gap-10 py-14 md:grid-cols-2 md:gap-12 md:py-20">
            <div>
              <p className="eyebrow !text-brass-soft">
                Confidential · Investor overview · {INVESTOR_DECK_META.year}
              </p>
              <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                {INVESTOR_DECK_META.tagline}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-paper/70">
                AI-assisted personal styling atelier. Users upload photos — the
                system builds a Style Profile, generates looks, matches real
                catalog products, enables virtual try-on, and delivers a
                structured report. Powered by a proprietary{" "}
                <span className="text-paper">
                  Style Recommendation Engine (SRE)
                </span>
                .
              </p>
              <p className="mt-4 text-sm text-paper/45">
                {INVESTOR_DECK_META.site}/investors · {INVESTOR_DECK_META.contact}
              </p>
              <div className="no-print mt-8 flex flex-wrap items-center gap-3">
                <PrintDeckButton variant="dark" />
                <a
                  href="/api/admin/investor-deck"
                  download="valetti-investor-deck-en.pptx"
                  className="rounded-full border border-paper/25 px-5 py-2.5 text-sm text-paper transition hover:border-brass-soft hover:text-brass-soft"
                >
                  Google Slides (.pptx)
                </a>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-md md:max-w-none">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-paper/10 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)]">
                <Image
                  src="/images/hero-editorial.png"
                  alt="Editorial portrait — Valetti brand visual"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 480px"
                  className="object-cover object-top"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/40 to-transparent px-5 pb-5 pt-20">
                  <p className="font-display text-lg text-paper">
                    Analysis → look → catalog → try-on
                  </p>
                  <p className="mt-1 text-xs tracking-wide text-paper/60">
                    One Style Profile · explainable recommendations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="container-luxe py-12 md:py-16">
          <div className="investors-section grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INVESTOR_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border hairline bg-cream/50 px-5 py-4"
              >
                <div className="font-display text-2xl text-ink">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-stone-soft">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* 01 Approach */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="01" title="Approach" />
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-display text-xl text-ink">Problem</h3>
                <p className="mt-3 text-sm leading-relaxed text-stone">
                  {PROBLEM_SOLUTION.problem}
                </p>
              </div>
              <div>
                <h3 className="font-display text-xl text-ink">Valetti solution</h3>
                <p className="mt-3 text-sm leading-relaxed text-stone">
                  {PROBLEM_SOLUTION.solution}
                </p>
              </div>
            </div>
            <p className="mt-6 rounded-2xl border hairline bg-cream/40 px-5 py-4 text-sm leading-relaxed text-stone">
              <span className="font-medium text-ink">Differentiator: </span>
              {PROBLEM_SOLUTION.differentiator}
            </p>
            <DiagramFrame
              title="The Valetti loop"
              footnote="Closed loop from photos to purchase decision — not a chat wrapper."
            >
              <ProductLoopDiagram />
            </DiagramFrame>
          </section>

          {/* 02 Product */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="02" title="Product & site" />
            <h3 className="mt-6 font-display text-2xl text-ink">
              {INVESTOR_DECK_META.site} — live product surface
            </h3>
            <p className="mt-3 max-w-2xl text-sm text-stone">
              Reports, catalogue try-on, Shop a Look, and a personal Looks
              gallery — one credit ledger, card + crypto checkout.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {PRODUCT_PILLARS.map((p) => (
                <article
                  key={p.title}
                  className="overflow-hidden rounded-2xl border hairline bg-paper"
                >
                  <div className="relative aspect-[5/3]">
                    <Image
                      src={p.image}
                      alt={p.imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 480px"
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="p-5">
                    <h4 className="font-display text-lg text-ink">{p.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-stone">
                      {p.body}
                    </p>
                    <Link
                      href={p.href}
                      className="mt-4 inline-block text-sm text-brass transition-colors hover:text-ink"
                    >
                      Open →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <InfoCard
                title="Acquisition"
                body="SEO landing, brand face · inspired by Carlo Valetti, 6 free credits on signup — Starter Report with no card. EUR + USD pricing."
              />
              <InfoCard
                title="Core flow"
                body="Intake → photo upload → async SRE pipeline → interactive report with looks, shopping list, Shop the Look, and Shop a Look."
              />
              <InfoCard
                title="Monetization"
                body="Credits for reports and try-on, credit packs (card via Lemon Squeezy / Stripe, crypto via NOWPayments), affiliate deeplinks, PDF export."
              />
            </div>
          </section>

          {/* 03 Pricing */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="03" title="Pricing" />
            <p className="mt-4 text-sm text-stone">
              1 credit ≈ €1. Paid reports: €10 (Basic) · €20 (Lookbook) · €35
              (Premium). New accounts get 6 free credits. Credits never expire.
              Checkout: card + crypto.
            </p>
            <DeckTable
              className="mt-8"
              headers={["Tier", "Price (EUR)", "Credits", "Includes"]}
              rows={TIERS_TABLE.map((r) => [...r])}
            />
            <div className="mt-10 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-display text-lg text-ink">Credit packages</h3>
                <DeckTable
                  className="mt-4"
                  headers={["Pack", "Price", "Volume"]}
                  rows={CREDIT_PACKS.map((r) => [...r])}
                />
              </div>
              <div>
                <h3 className="font-display text-lg text-ink">Roadmap tiers</h3>
                <p className="mt-4 text-sm leading-relaxed text-stone">
                  <strong className="text-ink">Membership</strong> — from
                  €19.99/mo: monthly credits, refreshed looks, unlimited try-on
                  (planned).
                </p>
                <p className="mt-3 text-sm leading-relaxed text-stone">
                  <strong className="text-ink">Business white-label</strong> —
                  from €99/mo: branded reports, own catalog as source of truth
                  (planned).
                </p>
              </div>
            </div>
          </section>

          {/* 04 Monetization */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="04" title="Monetization" />
            <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <DiagramFrame
                title="Target revenue mix · Year 2"
                footnote="Illustrative projection — credit packs and paid reports dominate early; affiliate and B2B scale later."
              >
                <RevenueMixChart />
              </DiagramFrame>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline">
                <Image
                  src="/images/flatlay-essentials.png"
                  alt="Catalog merchandise — affiliate-ready shopping surface"
                  fill
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-5 pb-5 pt-16">
                  <p className="text-sm text-paper">
                    Affiliate deeplinks on shopping lists & Shop a Look — no
                    inventory held.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 05 Unit economics */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="05" title="Unit economics" />
            <p className="mt-4 text-sm text-stone">
              Variable COGS per report: vision + reasoning + embeddings + image
              generation. Try-on billed separately (1 credit ≈ €0.04 COGS).
              Provider prices mid-2026.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {(["Basic", "Lookbook", "Premium"] as const).map((tier) => (
                <div
                  key={tier}
                  className="rounded-2xl border hairline bg-cream/40 px-5 py-4"
                >
                  <div className="text-xs uppercase tracking-wider text-stone-soft">
                    COGS · {tier}
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink">
                    €{tierCogsEur(tier).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <DiagramFrame title="Price vs COGS · paid tiers">
                <UnitEconomicsChart />
              </DiagramFrame>
              <div>
                <DeckTable
                  headers={[
                    "Tier",
                    "Price",
                    "COGS",
                    "Fees ~",
                    "Contribution",
                    "Margin",
                  ]}
                  rows={unitRows}
                />
                <p className="mt-6 text-sm leading-relaxed text-stone">
                  {UNIT_ECON_TAKEAWAY}
                </p>
              </div>
            </div>
          </section>

          {/* 06 Competitors */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="06" title="Competitive landscape" />
            <p className="mt-4 text-sm text-stone">● full · ◐ partial · ○ none</p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b hairline text-left text-xs uppercase tracking-wider text-stone-soft">
                    <th className="py-3 pr-4">Player</th>
                    <th className="py-3 pr-4">Price</th>
                    {[
                      "Colour",
                      "Shape",
                      "Looks",
                      "Catalog",
                      "VTON",
                      "Why",
                      "Pay-go",
                      "EU/USA",
                    ].map((h) => (
                      <th key={h} className="px-2 py-3 text-center">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPETITORS.map((c) => (
                    <tr
                      key={c.name}
                      className={`border-b hairline ${
                        c.name === "Valetti" ? "bg-cream/60" : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium text-ink">
                        {c.name}
                      </td>
                      <td className="py-3 pr-4 text-stone">{c.price}</td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.color)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.shape)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.looks)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.catalog)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.vton)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.explain)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.payg)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {compSymbol(c.markets)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-stone">
              Market white space: no competitor closes the full loop —
              appearance analysis → photorealistic look on your photo → real
              catalog → identity-preserving try-on → explainable report — at
              pay-as-you-go €10–35, plus Shop a Look from any inspiration photo.
            </p>
          </section>

          {/* 07 Technology */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="07" title="Technology — SRE" />
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-stone">
              Modular Style Recommendation Engine: analytical engines form a
              single Style Profile; SRE orchestrates looks, catalog match,
              try-on, Shop a Look, and report delivery.
            </p>
            <div className="mt-8">
              <SreFlowDiagram />
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {ENGINES.map((e) => (
                <div key={e.code} className="rounded-2xl border hairline p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-display text-lg text-ink">{e.title}</h3>
                    <span className="rounded-full border hairline px-2.5 py-0.5 text-xs text-brass">
                      {e.code}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-stone-soft">{e.subtitle}</p>
                  <ul className="mt-4 space-y-2 text-sm text-stone">
                    {e.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="text-brass">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 08 Infrastructure */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="08" title="Infrastructure" />
            <div className="mt-8">
              <StackDiagram layers={STACK_LAYERS} />
            </div>
          </section>

          {/* 09 Moat */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="09" title="Competitive advantage" />
            <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline">
                <Image
                  src="/images/carlo-valetti.png"
                  alt="Carlo Valetti — Valetti lead stylist persona"
                  fill
                  sizes="(max-width: 1024px) 100vw, 400px"
                  className="object-cover object-top"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 to-transparent px-5 pb-5 pt-16">
                  <p className="font-display text-lg text-paper">Carlo Valetti</p>
                  <p className="mt-1 text-xs text-paper/70">
                    Brand voice · explainable recommendations on every try-on
                  </p>
                </div>
              </div>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <ul className="space-y-3">
                  {MOAT.map((m) => (
                    <li key={m} className="flex gap-3 text-sm text-stone">
                      <span className="font-medium text-brass">+</span>
                      {m}
                    </li>
                  ))}
                </ul>
                <div className="rounded-2xl border hairline bg-cream/40 p-5">
                  <h3 className="font-display text-lg text-ink">
                    Roadmap · investment focus
                  </h3>
                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-stone">
                    {ROADMAP.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ol>
                  <p className="mt-6 text-xs text-stone-soft">
                    Production: {INVESTOR_DECK_META.site} · 10,000+ SKUs · live
                    pipeline · card + crypto · EU/USA
                  </p>
                </div>
              </div>
            </div>
          </section>

          <footer className="investors-section mt-20 border-t hairline pt-8 text-xs text-stone-soft">
            <div className="flex flex-col justify-between gap-2 sm:flex-row">
              <span>
                {BRAND.name} · Personal style atelier · Confidential ·{" "}
                {INVESTOR_DECK_META.year}
              </span>
              <span>Brand face · inspired by Carlo Valetti</span>
            </div>
            <p className="no-print mt-4 text-stone">
              Cloud & AI credits application pack: see{" "}
              <code className="text-ink">docs/investors/cloud-credits-en.md</code>{" "}
              in the repository.
            </p>
          </footer>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <div>
      <p className="eyebrow">
        {n} · {title}
      </p>
      <h2 className="mt-3 font-display text-3xl leading-tight text-ink">
        {title}
      </h2>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border hairline bg-cream/30 p-5">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-stone">{body}</p>
    </div>
  );
}

function DeckTable({
  headers,
  rows,
  className = "",
}: {
  headers: string[];
  rows: string[][];
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b hairline text-left text-xs uppercase tracking-wider text-stone-soft">
            {headers.map((h) => (
              <th key={h} className="py-3 pr-4 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b hairline">
              {row.map((cell, j) => (
                <td key={j} className="py-3 pr-4 text-stone last:pr-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

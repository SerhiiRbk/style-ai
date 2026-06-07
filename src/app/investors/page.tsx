import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PrintDeckButton } from "@/components/PrintDeckButton";
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
  REVENUE_STREAMS,
  ROADMAP,
  SRE_FLOW,
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

export default function InvestorsPage() {
  const unitRows = unitEconomicsRows();

  return (
    <div className="investors-deck">
      <Navbar />
      <main className="flex-1 bg-paper">
        <div className="container-luxe py-16 md:py-20">
          {/* Hero */}
          <div className="investors-section flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Confidential · Investor overview · {INVESTOR_DECK_META.year}</p>
              <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
                {INVESTOR_DECK_META.tagline}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-stone">
                AI-assisted personal styling atelier. Users upload photos — the system builds a
                Style Profile, generates looks, matches real catalog products, enables virtual
                try-on, and delivers a structured report. Powered by a proprietary{" "}
                <strong className="font-medium text-ink">Style Recommendation Engine (SRE)</strong>.
              </p>
              <p className="mt-4 text-sm text-stone-soft">
                Share this page:{" "}
                <span className="text-ink">{INVESTOR_DECK_META.site}/investors</span>
                {" · "}
                Contact: {INVESTOR_DECK_META.contact}
              </p>
            </div>
            <div className="no-print flex shrink-0 flex-wrap items-center gap-3">
              <PrintDeckButton />
              <a
                href="/investors/valetti-investor-deck-en.pptx"
                download="valetti-investor-deck-en.pptx"
                className="rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm text-ink transition hover:border-brass hover:text-brass"
              >
                Google Slides (.pptx)
              </a>
            </div>
          </div>

          <div className="investors-section mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="mt-3 text-sm leading-relaxed text-stone">{PROBLEM_SOLUTION.problem}</p>
              </div>
              <div>
                <h3 className="font-display text-xl text-ink">Valetti solution</h3>
                <p className="mt-3 text-sm leading-relaxed text-stone">{PROBLEM_SOLUTION.solution}</p>
              </div>
            </div>
            <p className="mt-6 rounded-2xl border hairline bg-cream/40 px-5 py-4 text-sm leading-relaxed text-stone">
              <span className="font-medium text-ink">Differentiator: </span>
              {PROBLEM_SOLUTION.differentiator}
            </p>
          </section>

          {/* 02 Product */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="02" title="Product & site" />
            <h3 className="mt-6 font-display text-2xl text-ink">
              {INVESTOR_DECK_META.site} — first visit to purchase
            </h3>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <InfoCard
                title="Acquisition"
                body="SEO landing, brand face · inspired by Carlo Valetti, 6 free credits on signup — Starter Report with no card. EUR + USD pricing."
              />
              <InfoCard
                title="Core flow"
                body="Intake → photo upload → async SRE pipeline → interactive report with looks, shopping list, and Shop the Look."
              />
              <InfoCard
                title="Monetization"
                body="Credits for reports and try-on, credit packs, affiliate deeplinks, PDF export."
              />
            </div>
          </section>

          {/* 03 Pricing */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="03" title="Pricing" />
            <p className="mt-4 text-sm text-stone">
              1 credit ≈ €1. Paid reports: €10 (Basic) · €20 (Lookbook) · €35 (Premium). New accounts
              get 6 free credits. Credits never expire.
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
                  <strong className="text-ink">Membership</strong> — €14.99/mo: monthly credits,
                  refreshed looks, unlimited try-on (planned).
                </p>
                <p className="mt-3 text-sm leading-relaxed text-stone">
                  <strong className="text-ink">Business white-label</strong> — from €99/mo: branded
                  reports, own catalog as source of truth (planned).
                </p>
              </div>
            </div>
          </section>

          {/* 04 Monetization */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="04" title="Monetization" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {REVENUE_STREAMS.map((r) => (
                <div key={r.name} className="rounded-2xl border hairline px-4 py-3">
                  <div className="font-display text-xl text-brass">{r.pct}%</div>
                  <div className="text-sm text-stone">{r.name}</div>
                  <div className="mt-2 h-1.5 rounded-full bg-sand">
                    <div
                      className="h-full rounded-full bg-brass"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-soft">
              Target revenue mix · Year 2 projection (illustrative)
            </p>
          </section>

          {/* 05 Unit economics */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="05" title="Unit economics" />
            <p className="mt-4 text-sm text-stone">
              Variable COGS per report: vision + reasoning + embeddings + image generation. Try-on
              billed separately (1 credit ≈ €0.04 COGS). Provider prices Jun 2026.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {(["Basic", "Lookbook", "Premium"] as const).map((tier) => (
                <div key={tier} className="rounded-2xl border hairline bg-cream/40 px-5 py-4">
                  <div className="text-xs uppercase tracking-wider text-stone-soft">
                    COGS · {tier}
                  </div>
                  <div className="mt-1 font-display text-2xl text-ink">
                    €{tierCogsEur(tier).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <DeckTable
              className="mt-8"
              headers={["Tier", "Price", "COGS", "Stripe ~", "Contribution", "Margin"]}
              rows={unitRows}
            />
            <p className="mt-6 text-sm leading-relaxed text-stone">{UNIT_ECON_TAKEAWAY}</p>
          </section>

          {/* 06 Competitors */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="06" title="Competitive landscape" />
            <p className="mt-4 text-sm text-stone">
              ● full · ◐ partial · ○ none
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b hairline text-left text-xs uppercase tracking-wider text-stone-soft">
                    <th className="py-3 pr-4">Player</th>
                    <th className="py-3 pr-4">Price</th>
                    {["Colour", "Shape", "Looks", "Catalog", "VTON", "Why", "Pay-go", "EU/USA"].map(
                      (h) => (
                        <th key={h} className="px-2 py-3 text-center">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {COMPETITORS.map((c) => (
                    <tr
                      key={c.name}
                      className={`border-b hairline ${c.name === "Valetti" ? "bg-cream/60" : ""}`}
                    >
                      <td className="py-3 pr-4 font-medium text-ink">{c.name}</td>
                      <td className="py-3 pr-4 text-stone">{c.price}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.color)}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.shape)}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.looks)}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.catalog)}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.vton)}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.explain)}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.payg)}</td>
                      <td className="px-2 py-3 text-center">{compSymbol(c.markets)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-stone">
              Market white space: no competitor closes the full loop — appearance analysis →
              photorealistic look on your photo → real catalog → identity-preserving try-on →
              explainable report — at pay-as-you-go €10–35.
            </p>
          </section>

          {/* 07 Technology */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="07" title="Technology — SRE" />
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-stone">
              Modular Style Recommendation Engine: analytical engines form a single Style Profile;
              SRE orchestrates looks, catalog match, try-on, and report delivery.
            </p>
            <ol className="mt-8 space-y-3 border-l-2 border-brass/40 pl-6">
              {SRE_FLOW.map((step, i) => (
                <li key={step} className="text-sm text-stone">
                  <span className="mr-2 font-medium text-brass">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
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
            <DeckTable
              className="mt-8"
              headers={["Layer", "Stack & role"]}
              rows={STACK_LAYERS.map((r) => [...r])}
            />
          </section>

          {/* 09 Moat */}
          <section className="investors-section investors-section-major mt-20">
            <SectionHead n="09" title="Competitive advantage" />
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <ul className="space-y-3">
                {MOAT.map((m) => (
                  <li key={m} className="flex gap-3 text-sm text-stone">
                    <span className="font-medium text-brass">+</span>
                    {m}
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border hairline bg-cream/40 p-5">
                <h3 className="font-display text-lg text-ink">Roadmap · investment focus</h3>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-stone">
                  {ROADMAP.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ol>
                <p className="mt-6 text-xs text-stone-soft">
                  Production: {INVESTOR_DECK_META.site} · 5,000+ SKUs · live pipeline · EU/USA
                </p>
              </div>
            </div>
          </section>

          <footer className="investors-section mt-20 border-t hairline pt-8 text-xs text-stone-soft">
            <div className="flex flex-col justify-between gap-2 sm:flex-row">
              <span>
                {BRAND.name} · Personal style atelier · Confidential · {INVESTOR_DECK_META.year}
              </span>
              <span>Brand face · inspired by Carlo Valetti</span>
            </div>
            <p className="no-print mt-4 text-stone">
              Cloud & AI credits application pack: see{" "}
              <code className="text-ink">docs/investors/cloud-credits-en.md</code> in the repository.
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
      <h2 className="mt-3 font-display text-3xl leading-tight text-ink">{title}</h2>
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

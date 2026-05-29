import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportById } from "@/lib/data/reports";
import { TryOnButton } from "@/components/TryOnButton";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { PrintButton } from "@/components/PrintButton";
import type { ColorRec, ShoppingItem } from "@/lib/report";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) notFound();

  const { profile, intake } = report;
  const tierLabel = report.tier.charAt(0).toUpperCase() + report.tier.slice(1);

  const grouped = report.shopping.reduce<Record<string, ShoppingItem[]>>(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {},
  );

  return (
    <>
      {/* Report header */}
      <header className="border-b hairline bg-ink text-paper">
        <div className="container-luxe flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-xl">
            StyleAI
          </Link>
          <div className="flex items-center gap-3">
            <PrintButton className="rounded-full border border-paper/25 px-5 py-2 text-sm text-paper/90 transition-colors hover:bg-paper hover:text-ink">
              Download PDF
            </PrintButton>
            <ButtonLink
              href="/start"
              className="!bg-paper !text-ink hover:!bg-cream !px-5 !py-2"
            >
              New report
            </ButtonLink>
          </div>
        </div>

        <div className="container-luxe grid items-center gap-12 pb-16 pt-12 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-xs text-paper/50">
              <span className="rounded-full border border-paper/20 px-2.5 py-1 uppercase tracking-wider">
                {tierLabel} report
              </span>
              <span>
                {intake.city}, {intake.country} · {profile.demographics.climate} climate
              </span>
            </div>
            <h1 className="mt-5 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
              {report.headline}
            </h1>
            <p className="mt-5 max-w-xl leading-relaxed text-paper/70">
              {report.summary}
            </p>
          </div>
          <div className="relative hidden aspect-[4/5] overflow-hidden rounded-2xl border border-paper/15 md:block">
            <Image
              src="/images/hero-editorial.png"
              alt="Editorial portrait reflecting the recommended direction"
              fill
              sizes="(max-width: 768px) 0px, 33vw"
              className="object-cover object-top"
              priority
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Profile snapshot */}
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe grid grid-cols-2 gap-px overflow-hidden py-0 sm:grid-cols-3 lg:grid-cols-6">
            <Snapshot label="Season" value={cap(profile.colorSeason)} />
            <Snapshot label="Undertone" value={cap(profile.physical.undertone)} />
            <Snapshot label="Contrast" value={cap(profile.physical.contrast)} />
            <Snapshot label="Face shape" value={cap(profile.physical.faceShape)} />
            <Snapshot label="Build" value={cap(profile.physical.bodyType)} />
            <Snapshot label="Boldness" value={cap(profile.boldness)} />
          </div>
        </section>

        {/* Colours */}
        <section className="container-luxe py-20">
          <SectionHead
            n="01"
            title="Your colours"
            sub="Soft, warm neutrals flatter your low-contrast colouring. Here's what to lean into — and what to leave behind."
          />
          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            <ColorColumn title="Colours that work for you" recs={report.colors.best} />
            <ColorColumn
              title="Colours to avoid"
              recs={report.colors.avoid}
              muted
            />
          </div>
        </section>

        {/* Hair + silhouette */}
        <section className="border-y hairline bg-cream/40">
          <div className="container-luxe grid gap-14 py-20 lg:grid-cols-2">
            <div>
              <SectionHead n="02" title="Hair" />
              <div className="mt-8 space-y-5">
                {report.hair.recommend.map((h) => (
                  <RecRow key={h.name} name={h.name} why={h.why} good />
                ))}
                {report.hair.avoid.map((h) => (
                  <RecRow key={h.name} name={h.name} why={h.why} />
                ))}
              </div>
            </div>
            <div>
              <SectionHead n="03" title="Silhouette & fit" />
              <p className="mt-6 font-display text-2xl">{report.silhouette.fit}</p>
              <ul className="mt-5 space-y-3">
                {report.silhouette.rules.map((r) => (
                  <li key={r} className="flex items-start gap-3 text-stone">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Looks */}
        <section className="container-luxe py-20">
          <SectionHead
            n="04"
            title="Your looks"
            sub="Photorealistic outfit directions for the moments that matter."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {report.looks.map((look) => (
              <article
                key={look.title}
                className="overflow-hidden rounded-2xl border hairline bg-cream/30"
              >
                <div className="relative aspect-[3/4] bg-sand">
                  <Image
                    src={look.image}
                    alt={`${look.title} — ${look.description}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-gradient-to-t from-ink/60 to-transparent p-3 pt-8">
                    {look.palette.map((c) => (
                      <span
                        key={c}
                        className="h-6 w-6 rounded-full border border-paper/40"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-paper backdrop-blur-sm">
                    {look.context}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-xl">{look.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone">
                    {look.description}
                  </p>
                  <button className="mt-4 text-sm text-brass transition-colors hover:text-ink">
                    Try this on →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Shopping list */}
        <section className="border-y hairline bg-ink text-paper">
          <div className="container-luxe py-20">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow !text-brass-soft">05</p>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl">
                  Your shopping list
                </h2>
                <p className="mt-3 max-w-md text-paper/60">
                  The pieces that unlock the most new outfits. Real products,
                  real links — affiliate links are disclosed.
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <div className="font-display text-3xl">
                  €{report.shopping.reduce((s, i) => s + i.priceEur, 0)}
                </div>
                <div className="text-xs text-paper/50">
                  {report.shopping.length} essential pieces
                </div>
              </div>
            </div>

            <div className="mt-12 space-y-10">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="eyebrow !text-paper/40">{cat}</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <div
                        key={item.title}
                        className="group rounded-xl border border-paper/12 bg-ink-soft/50 p-5 transition-colors hover:border-paper/30"
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow sponsored"
                          className="block"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="h-8 w-8 rounded-full border border-paper/20"
                              style={{ background: item.color }}
                            />
                            <span className="font-display text-lg">
                              €{item.priceEur}
                            </span>
                          </div>
                          <h4 className="mt-4 text-paper">{item.title}</h4>
                          <p className="mt-1.5 text-sm leading-relaxed text-paper/55">
                            {item.why}
                          </p>
                          <div className="mt-4 flex items-center justify-between text-xs text-paper/50">
                            <span>{item.retailer}</span>
                            <span className="text-brass-soft transition-colors group-hover:text-paper">
                              Shop →
                            </span>
                          </div>
                        </a>
                        {item.productId && (
                          <TryOnButton productId={item.productId} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Do / Don't */}
        <section className="container-luxe py-20">
          <SectionHead n="06" title="Do & don't" />
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <ListCard title="Do" items={report.doList} good />
            <ListCard title="Avoid" items={report.dontList} />
          </div>

          <div className="mt-16 rounded-2xl border hairline bg-cream/40 p-10 text-center">
            <h3 className="font-display text-2xl">Want the full lookbook?</h3>
            <p className="mx-auto mt-2 max-w-md text-stone">
              Unlock 12 photorealistic looks, virtual try-on of every item, and a
              capsule wardrobe built around these pieces.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <ButtonLink href="/#pricing">Upgrade to Lookbook</ButtonLink>
              <PrintButton className="rounded-full border border-ink/25 px-7 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-paper">
                Download PDF
              </PrintButton>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

/* ---------------------------------------------------------------- */

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper px-6 py-7 outline outline-1 outline-line">
      <div className="text-xs uppercase tracking-wider text-stone-soft">
        {label}
      </div>
      <div className="mt-1.5 font-display text-xl">{value}</div>
    </div>
  );
}

function SectionHead({
  n,
  title,
  sub,
}: {
  n: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{n}</p>
      <h2 className="mt-3 font-display text-3xl sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 leading-relaxed text-stone">{sub}</p>}
    </div>
  );
}

function ColorColumn({
  title,
  recs,
  muted = false,
}: {
  title: string;
  recs: ColorRec[];
  muted?: boolean;
}) {
  return (
    <div>
      <h3 className={`text-sm ${muted ? "text-stone-soft" : "text-ink"}`}>
        {title}
      </h3>
      <div className="mt-5 space-y-5">
        {recs.map((c) => (
          <div key={c.name} className="flex items-start gap-4">
            <span
              className="mt-0.5 h-12 w-12 shrink-0 rounded-xl border border-ink/10"
              style={{ background: c.hex }}
            />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg">{c.name}</span>
                <span className="text-xs text-stone-soft">{c.hex}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-stone">{c.why}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecRow({
  name,
  why,
  good = false,
}: {
  name: string;
  why: string;
  good?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
          good ? "bg-ink text-paper" : "border border-line text-stone-soft"
        }`}
      >
        {good ? "✓" : "✕"}
      </span>
      <div>
        <div className="font-display text-lg">{name}</div>
        <p className="mt-0.5 text-sm leading-relaxed text-stone">{why}</p>
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  good = false,
}: {
  title: string;
  items: string[];
  good?: boolean;
}) {
  return (
    <div className="rounded-2xl border hairline p-8">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
            good ? "bg-ink text-paper" : "bg-sand text-stone"
          }`}
        >
          {good ? "✓" : "✕"}
        </span>
        <h3 className="font-display text-2xl">{title}</h3>
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-3 text-stone">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
            <span className="leading-relaxed">{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

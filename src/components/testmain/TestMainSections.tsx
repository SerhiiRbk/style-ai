import Image from "next/image";
import { ButtonLink } from "@/components/Button";
import { TESTMAIN_FAQS } from "@/lib/marketing/testmain-content";

export function TestMainFaq() {
  return (
    <section id="faq" className="border-t hairline">
      <div className="container-luxe py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Credibility questions, answered honestly.
          </h2>
          <p className="mt-4 text-stone">
            Including how Carlo fits in — and why we don&apos;t fake reviews.
          </p>
        </div>
        <dl className="mt-12 grid gap-x-12 gap-y-9 md:grid-cols-2">
          {TESTMAIN_FAQS.map((f) => (
            <div key={f.q}>
              <dt className="font-display text-lg text-ink">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-stone">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function TestMainHowItWorks() {
  const steps = [
    [
      "Answer",
      "Age, city, lifestyle, goals, budget — optional hair and eye colour for sharper analysis.",
    ],
    [
      "Upload",
      "Front portrait and full length. Private storage; explicit consent before analysis.",
    ],
    [
      "Analyse",
      "Style Profile from vision + styling rules — every major call gets a why.",
    ],
    [
      "Receive",
      "Structured report, palette, looks, shopping links, try-on — act the same day.",
    ],
  ] as const;

  return (
    <section id="how" className="container-luxe scroll-mt-24 py-24">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            From a few questions to a finished plan in minutes.
          </h2>
        </div>
        <ButtonLink href="/start" variant="outline">
          Start now
        </ButtonLink>
      </div>

      <div className="mt-16 grid gap-10 md:grid-cols-4">
        {steps.map(([title, body], i) => (
          <div key={title}>
            <div className="font-display text-5xl text-sand">
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="mt-3 font-display text-xl">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TestMainFinalCta() {
  return (
    <section className="bg-ink text-paper">
      <div className="container-luxe py-24 text-center">
        <p className="eyebrow !text-brass-soft">Ready when you are</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl leading-tight sm:text-4xl">
          Judge the demo first. Then create your own report.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-paper/70">
          No invented testimonials — just a public example and a clear
          methodology. If it reads true, we&apos;ll earn your trust the same
          way.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <ButtonLink
            href="/report/valetti-style-prospect-demo"
            className="!bg-paper !text-ink hover:!bg-cream"
          >
            Open demo report
          </ButtonLink>
          <ButtonLink
            href="/start"
            variant="outline"
            className="!border-paper/30 !text-paper hover:!bg-paper/10"
          >
            Create my report
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function TestMainProblem() {
  return (
    <section className="container-luxe py-24">
      <div className="grid items-center gap-14 md:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border hairline">
          <Image
            src="/images/flatlay-essentials.png"
            alt="Flat lay of warm-toned menswear essentials"
            fill
            sizes="(max-width: 768px) 100vw, 560px"
            className="object-cover"
          />
        </div>
        <div>
          <p className="eyebrow">The problem</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            You want to look better — but generic advice doesn&apos;t explain
            why.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-stone">
            <p>
              A human stylist is expensive and opaque. Fashion apps show pretty
              pictures without tying them to your colouring or proportions.
              ChatGPT gives paragraphs — not a plan, not products, not your
              face.
            </p>
            <p>
              Valetti is built for people who need{" "}
              <span className="text-ink">reasons</span>, not hype — and who
              want to see proof before they share a photo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

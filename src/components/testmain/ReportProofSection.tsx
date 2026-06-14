import Image from "next/image";
import { ButtonLink } from "@/components/Button";
import {
  DEMO_REPORT_HREF,
  REPORT_PROOF_CARDS,
} from "@/lib/marketing/testmain-content";

const PALETTE = ["#6B6B47", "#9E5C3C", "#EFE6D3", "#27324A", "#B08A5B"];

export function ReportProofSection() {
  return (
    <section className="border-y hairline bg-cream/30">
      <div className="container-luxe py-24">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Inside the demo report</p>
            <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
              See the actual advice before you sign up.
            </h2>
            <p className="mt-4 max-w-xl text-stone">
              Not a moodboard dump. Specific decisions — start here, colour
              diagnosis, hair direction, buying plan — each with a reason you
              can check against the full demo.
            </p>
          </div>
          <ButtonLink href={DEMO_REPORT_HREF} variant="outline">
            Open full demo report
          </ButtonLink>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-px overflow-hidden rounded-2xl border hairline bg-line sm:grid-cols-2">
            {REPORT_PROOF_CARDS.map((card, index) => (
              <article key={card.title} className="bg-paper p-7">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brass">
                    {card.eyebrow}
                  </p>
                  <span className="font-display text-sm text-stone-soft">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl leading-snug">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-stone">
                  {card.body}
                </p>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border hairline bg-paper p-5">
            <div className="rounded-xl bg-ink p-5 text-paper">
              <div className="flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.18em] text-paper/50">
                <span>Report excerpt</span>
                <span>Soft Autumn</span>
              </div>
              <h3 className="mt-4 font-display text-2xl leading-tight">
                Your first three moves
              </h3>
              <div className="mt-5 space-y-3">
                {[
                  "Move from black to warm navy, olive and tobacco.",
                  "Keep contrast soft around the face: cream over optic white.",
                  "Choose textured hair and clean tailoring over hard lines.",
                ].map((item, index) => (
                  <div key={item} className="flex gap-3 text-sm text-paper/75">
                    <span className="font-display text-brass-soft">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-xl border hairline bg-cream/40 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-stone-soft">
                  Palette
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {PALETTE.map((c) => (
                    <span
                      key={c}
                      className="aspect-square rounded-md border border-ink/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-stone">
                  Each swatch in the report includes a why tied to your
                  subseason.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Look", "/images/look-work.png"],
                  ["Hair", "/images/demo/hair-textured-crop-side.png"],
                ].map(([label, src]) => (
                  <div key={label}>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border hairline bg-cream">
                      <Image
                        src={src}
                        alt={`${label} preview from demo report`}
                        fill
                        sizes="150px"
                        className="object-cover object-top"
                      />
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-stone-soft">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

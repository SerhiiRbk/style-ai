import Image from "next/image";
import { ImageComparisonSlider } from "@/components/ImageComparisonSlider";
import { ButtonLink } from "@/components/Button";
import {
  DEMO_REPORT_HREF,
  WHY_THIS_WORKS,
} from "@/lib/marketing/testmain-content";

export function WhyThisWorksSection() {
  return (
    <section id="why" className="container-luxe scroll-mt-24 py-24">
      <div className="max-w-2xl">
        <p className="eyebrow">Why this works</p>
        <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
          Three calls from the demo — with the logic spelled out.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-stone">
          Not invented testimonials. Teaching cases you can verify in the public
          demo report.
        </p>
      </div>

      <div className="mt-14 space-y-16">
        {WHY_THIS_WORKS.map((item, index) => (
          <article
            key={item.id}
            className={`grid items-center gap-10 lg:grid-cols-2 ${
              index % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
            }`}
          >
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-brass">
                {item.label}
              </span>
              <h3 className="mt-3 font-display text-2xl leading-snug">
                The call
              </h3>
              <p className="mt-2 text-lg text-ink">{item.call}</p>

              <h4 className="mt-6 font-display text-lg text-ink">Why</h4>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                {item.why}
              </p>

              <h4 className="mt-6 font-display text-lg text-ink">
                What you&apos;d do
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                {item.action}
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              {item.useSlider ? (
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline shadow-sm">
                  <ImageComparisonSlider
                    beforeImage={item.imageBefore}
                    afterImage={item.imageAfter}
                    beforeAlt="Incorrect cold high-contrast palette"
                    afterAlt="Correct warm Soft Autumn palette"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border hairline bg-cream">
                      <Image
                        src={item.imageBefore}
                        alt={`Before — ${item.label}`}
                        fill
                        sizes="200px"
                        className="object-cover object-top"
                      />
                    </div>
                    <p className="mt-2 text-center text-[11px] uppercase tracking-wider text-stone-soft">
                      Avoid / default
                    </p>
                  </div>
                  <div>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-brass/30 bg-cream">
                      <Image
                        src={item.imageAfter}
                        alt={`After — ${item.label}`}
                        fill
                        sizes="200px"
                        className="object-cover object-top"
                      />
                    </div>
                    <p className="mt-2 text-center text-[11px] uppercase tracking-wider text-brass">
                      Recommend
                    </p>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-12 text-center">
        <ButtonLink href={DEMO_REPORT_HREF} variant="outline">
          Verify all three in the demo report
        </ButtonLink>
      </div>
    </section>
  );
}

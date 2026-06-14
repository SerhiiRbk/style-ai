import Image from "next/image";
import { ButtonLink } from "@/components/Button";
import { BRAND } from "@/lib/brand";
import { DEMO_REPORT_HREF } from "@/lib/marketing/testmain-content";

export function TestMainSampleReport() {
  return (
    <section id="sample" className="border-y hairline bg-ink text-paper">
      <div className="container-luxe grid items-center gap-14 py-24 md:grid-cols-2">
        <div>
          <p className="eyebrow !text-brass-soft">The deliverable</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Not a pretty picture. A consultation you can verify.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-paper/70">
            Every report is structured and explainable — written in{" "}
            {BRAND.stylist.first}&apos;s voice, with the reason behind each
            call. Open the demo and scroll every section before you pay.
          </p>
          <ul className="mt-8 space-y-3 text-paper/80">
            {[
              "Structured Style Profile with subseason",
              "Start here — 3 priority moves",
              "Colour, hair, fit — each with why",
              "Photorealistic looks on your photo",
              "Shopping list with real product links",
              "Virtual try-on when you are ready",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass-soft" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            <ButtonLink
              href={DEMO_REPORT_HREF}
              className="!bg-paper !text-ink hover:!bg-cream"
            >
              Open the example report
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-2xl border border-paper/15 bg-ink-soft/60 p-6">
          <div className="flex items-center justify-between text-xs text-paper/50">
            <span>STYLE REPORT · DEMO</span>
            <span>Berlin · Soft Autumn</span>
          </div>
          <h3 className="mt-3 font-display text-2xl">
            Warm, modern, and quietly confident
          </h3>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {["#6B6B47", "#9E5C3C", "#EFE6D3", "#27324A", "#B08A5B"].map(
              (c) => (
                <div
                  key={c}
                  className="aspect-square rounded-lg border border-paper/10"
                  style={{ background: c }}
                />
              ),
            )}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Work", "/images/look-work.png"],
              ["Dinner", "/images/look-dinner.png"],
              ["Weekend", "/images/look-weekend.png"],
            ].map(([c, src]) => (
              <div key={c}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-paper/10">
                  <Image
                    src={src}
                    alt={`${c} look`}
                    fill
                    sizes="140px"
                    className="object-cover"
                  />
                </div>
                <div className="mt-2 text-xs text-paper/60">{c}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-paper/60">
            <span className="text-brass-soft">Why brown over black:</span>{" "}
            warm-toned leather ties your whole palette together far better than
            black ever will — see the shopping list for the exact pick.
          </p>
        </div>
      </div>
    </section>
  );
}

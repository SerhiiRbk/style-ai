import Image from "next/image";
import { BRAND } from "@/lib/brand";

/**
 * Homepage section introducing Carlo Valetti — the brand's stylist persona and
 * the human voice through which Valetti speaks in every report.
 */
export function MeetStylist() {
  const credentials = [
    [
      "Stylist persona",
      "The calm, considered voice behind every Valetti report — European quiet luxury",
    ],
    [
      "Quiet luxury",
      "No logos, no trends for their own sake — only what suits you",
    ],
    [
      "Method, not opinion",
      "Every recommendation comes with the reason behind it",
    ],
  ];
  return (
    <section id="stylist" className="border-y hairline bg-cream/40">
      <div className="container-luxe grid items-center gap-14 py-24 md:grid-cols-[1fr_1.15fr]">
        <div className="relative mx-auto w-full max-w-md">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline shadow-[0_40px_80px_-40px_rgba(21,18,13,0.45)]">
            <Image
              src={BRAND.stylist.portrait}
              alt={`${BRAND.stylist.name}, ${BRAND.stylist.role} at ${BRAND.name}`}
              fill
              sizes="(max-width: 768px) 100vw, 460px"
              className="object-cover object-top"
            />
          </div>
          <div className="absolute -bottom-6 left-4 rounded-xl border hairline bg-paper/95 px-5 py-3 shadow-[0_24px_48px_-24px_rgba(21,18,13,0.4)] backdrop-blur-sm sm:-left-6">
            <div className="font-display text-lg leading-none">
              {BRAND.stylist.name}
            </div>
            <div className="mt-1 text-xs text-stone-soft">
              {BRAND.stylist.role} · {BRAND.name}
            </div>
          </div>
        </div>

        <div>
          <p className="eyebrow">Meet Carlo · the voice of Valetti</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            I&apos;m {BRAND.stylist.first}. I help you find your own style —
            not the latest trend.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-stone">
            <p>
              I&apos;m how Valetti talks to you — calm, direct, never loud for
              its own sake. Good style should feel{" "}
              <span className="text-ink">clear</span>, not mysterious.
            </p>
            <p>
              Share a few photos and honest answers; our engine reads your
              colouring, proportions and life. I turn that into a practical plan
              you can act on — hair, colours, silhouettes, shopping — with the
              reason behind every call.
            </p>
          </div>

          <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border hairline bg-line sm:grid-cols-3">
            {credentials.map(([h, b]) => (
              <div key={h} className="bg-paper p-5">
                <div className="font-display text-lg">{h}</div>
                <p className="mt-2 text-sm leading-relaxed text-stone">{b}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 font-display text-xl italic text-stone">
            &ldquo;Elegance is knowing what to leave out.&rdquo;
          </p>
          <p className="mt-2 text-sm text-stone-soft">
            — {BRAND.stylist.signature} · {BRAND.tagline}
          </p>
        </div>
      </div>
    </section>
  );
}

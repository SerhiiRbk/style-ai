import Image from "next/image";
import { BRAND } from "@/lib/brand";

/**
 * Homepage section introducing Carlo Valetti — the brand's stylist persona and
 * the human voice through which Valetti speaks in every report.
 */
export function MeetStylist() {
  const credentials = [
    [
      "Men's styling",
      "Tailoring, grooming and menswear — the calm voice behind every Valetti report",
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
            I&apos;m {BRAND.stylist.first}. I help men find their own style —
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

          <div className="mt-10 flex gap-5 rounded-2xl border border-brass/30 bg-brass/5 p-7">
            <svg
              className="h-8 w-8 shrink-0 text-brass-soft"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z" />
            </svg>
            <div>
              <p className="font-display text-xl leading-relaxed text-ink">
                Good style isn&apos;t about fashion. It&apos;s the removal of
                visual noise between who you are and how you are perceived.
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-stone">
                — {BRAND.stylist.signature}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

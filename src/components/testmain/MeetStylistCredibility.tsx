import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { CARLO_CREDENTIALS } from "@/lib/marketing/testmain-content";

export function MeetStylistCredibility() {
  return (
    <section id="stylist" className="border-y hairline bg-cream/40">
      <div className="container-luxe grid items-start gap-14 py-24 md:grid-cols-[1fr_1.15fr]">
        <div className="mx-auto w-full max-w-md">
          <div className="relative pb-10">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline shadow-[0_40px_80px_-40px_rgba(21,18,13,0.45)]">
              <Image
                src={BRAND.stylist.portrait}
                alt={`${BRAND.stylist.name}, brand face of ${BRAND.name}`}
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
                Brand face · inspired by Carlo Valetti
              </div>
            </div>
          </div>

          <blockquote className="rounded-2xl border border-brass/30 bg-brass/5 p-6">
            <svg
              className="h-6 w-6 text-brass-soft"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z" />
            </svg>
            <p className="mt-4 font-display text-lg leading-relaxed text-ink">
              Good style isn&apos;t about fashion. It&apos;s the removal of
              visual noise between who you are and how you are perceived.
            </p>
            <footer className="mt-4 text-xs font-medium uppercase tracking-wider text-stone">
              — {BRAND.stylist.signature}
            </footer>
          </blockquote>
        </div>

        <div>
          <p className="eyebrow">Credibility, not lore</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            {BRAND.stylist.first} is how {BRAND.name} speaks to men — clearly
            and honestly.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-stone">
            <p>
              We don&apos;t ask you to trust a celebrity stylist. We ask you to
              trust a{" "}
              <span className="text-ink">method for men&apos;s wardrobes</span>:
              structured analysis, explainable calls, real menswear products —
              presented in a calm voice.
            </p>
            <p>
              Share photos and honest answers; the engine builds your Style
              Profile. {BRAND.stylist.first} turns the output into a plan you
              can show a barber, a tailor, or your own mirror.
            </p>
          </div>

          <ul className="mt-8 space-y-2 text-sm text-stone">
            {[
              "Men's styling · fit, tailoring & grooming",
              "Brand face · inspired by Carlo Valetti",
              "Styling rules shaped with human input (SRE)",
              "GDPR-first · photos deletable anytime",
              "AI-assisted · disclosed openly",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border hairline bg-line sm:grid-cols-3">
            {CARLO_CREDENTIALS.map(({ title, body }) => (
              <div key={title} className="bg-paper p-5">
                <div className="font-display text-lg">{title}</div>
                <p className="mt-2 text-sm leading-relaxed text-stone">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { BRAND } from "@/lib/brand";
import {
  DEMO_REPORT_HREF,
  HERO_PROOF,
  SIGNUP_LINE,
  TRUST_CHIPS,
} from "@/lib/marketing/testmain-content";
import { lookCountForTier } from "@/lib/report";

const PALETTE = ["#6B6B47", "#9E5C3C", "#EFE6D3", "#27324A", "#B08A5B"];

export function TestMainHero() {
  return (
    <section className="relative border-b hairline">
      <div className="container-luxe py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/30 bg-brass/5 px-4 py-3 text-sm">
          <span className="text-stone">
            <span className="font-medium text-ink">Test landing</span> — men&apos;s
            styling · social proof concept. Production home also updated for men&apos;s
            focus.
          </span>
          <Link href="/" className="text-ink underline underline-offset-2 hover:text-brass">
            Back to live homepage
          </Link>
        </div>
      </div>

      <div className="container-luxe grid items-center gap-12 pb-20 pt-4 md:grid-cols-2 md:pb-28">
        <div className="animate-rise">
          <p className="eyebrow">
            {BRAND.eyebrow} · {BRAND.tagline}
          </p>
          <h1 className="mt-5 font-display text-[2.7rem] leading-[1.05] tracking-tight sm:text-6xl">
            Men&apos;s style advice you can{" "}
            <em className="not-italic text-brass">trust</em> — with the reason
            behind every call.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone">
            {BRAND.name} is a men&apos;s personal style atelier.{" "}
            <span className="text-ink">{BRAND.stylist.name}</span> is our brand
            face — the voice behind tailored fit, grooming, colour and shopping
            for your wardrobe. See the methodology, read real demo excerpts, and
            judge the quality before you sign up.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href={DEMO_REPORT_HREF}>See demo report</ButtonLink>
            <ButtonLink href="/start" variant="outline">
              Create my report
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-stone-soft">{SIGNUP_LINE}</p>

          {/* Mobile-first proof strip */}
          <div className="mt-8 rounded-2xl border hairline bg-cream/50 p-4 md:hidden">
            <div className="text-[10px] uppercase tracking-widest text-stone-soft">
              From the demo report
            </div>
            <div className="mt-2 font-display text-lg text-ink">
              {HERO_PROOF.season}
            </div>
            <div className="text-xs text-stone">
              {HERO_PROOF.undertone} · {HERO_PROOF.contrast}
            </div>
            <div className="mt-3 flex gap-1.5">
              {PALETTE.map((c) => (
                <span
                  key={c}
                  className="h-5 w-5 rounded-full border border-ink/10"
                  style={{ background: c }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-stone">
              {HERO_PROOF.moves.map((m) => (
                <li key={m} className="flex gap-2">
                  <span className="text-brass">·</span>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms]">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border hairline shadow-[0_40px_80px_-40px_rgba(21,18,13,0.45)]">
        <Image
          src="/images/hero-editorial.png"
          alt="Editorial portrait demonstrating warm Soft Autumn palette"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 480px"
          className="object-cover object-top"
        />
        <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          <span className="rounded-full bg-paper/90 px-3 py-1.5 text-[11px] text-ink backdrop-blur-sm">
            {HERO_PROOF.season.toLowerCase()} · warm · low contrast
          </span>
          <span className="hidden rounded-full border hairline bg-paper px-4 py-2 text-xs text-stone shadow-sm sm:inline-block">
            Demo · {lookCountForTier("premium")} looks · real links
          </span>
        </div>
      </div>

      <div className="absolute -bottom-8 left-2 w-56 rounded-xl border hairline bg-paper/95 p-4 shadow-[0_24px_48px_-24px_rgba(21,18,13,0.4)] backdrop-blur-sm sm:-left-8 sm:w-60">
        <div className="eyebrow">Style profile</div>
        <div className="mt-3 text-xs text-stone">Best colours</div>
        <div className="mt-2 flex gap-1.5">
          {PALETTE.map((c) => (
            <span
              key={c}
              className="h-6 w-6 rounded-full border border-ink/10"
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          <Mini label="Season" value={HERO_PROOF.season} />
          <Mini label="Priority" value="3 moves" />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b hairline pb-1.5 text-xs">
      <span className="text-stone-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export function TestMainTrustBar() {
  return (
    <div className="border-b hairline bg-ink text-paper">
      <div className="container-luxe flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-5 text-sm">
        {TRUST_CHIPS.map((item, idx) => (
          <span key={item} className="flex items-center gap-8">
            <span className="text-paper/80">{item}</span>
            {idx < TRUST_CHIPS.length - 1 && (
              <span className="hidden h-1 w-1 rounded-full bg-brass-soft sm:block" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TestMainProofStats() {
  return (
    <section className="border-b hairline bg-cream/30">
      <div className="container-luxe grid grid-cols-2 gap-px overflow-hidden rounded-none border-b hairline bg-line py-0 sm:grid-cols-4">
        {[
          { value: "9", label: "structured sections" },
          { value: String(lookCountForTier("premium")), label: "looks on Premium" },
          { value: "12", label: "subseason colour model" },
          { value: "100%", label: "explainable major calls" },
        ].map(({ value, label }) => (
          <div key={label} className="bg-paper px-6 py-8 text-center sm:py-10">
            <div className="font-display text-3xl text-ink sm:text-4xl">{value}</div>
            <div className="mt-2 text-xs uppercase tracking-wider text-stone-soft">
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

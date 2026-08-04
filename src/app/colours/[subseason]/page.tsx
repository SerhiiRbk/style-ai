import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { PaletteSwatches } from "@/components/PaletteSwatches";
import { Subseason } from "@/lib/style-profile";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import {
  paletteForSubseason,
  subseasonLabel,
  seasonForSubseason,
  seasonNoteFor,
  carloNoteFor,
  type Undertone,
  type Contrast,
} from "@/lib/colour-palette";
import { absoluteUrl } from "@/lib/site-url";

type Params = Promise<{ subseason: string }>;
type Search = Promise<{ u?: string; c?: string }>;

const UNDERTONES: Undertone[] = ["warm", "cool", "neutral"];
const CONTRASTS: Contrast[] = ["low", "medium", "high"];

function ogImagePath(subseason: string, u?: string, c?: string): string {
  const q = new URLSearchParams();
  if (u) q.set("u", u);
  if (c) q.set("c", c);
  const qs = q.toString();
  return `/api/og/colours/${subseason}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const { subseason } = await params;
  const { u, c } = await searchParams;
  const parsed = Subseason.safeParse(subseason);
  if (!parsed.success) return { title: "Colour analysis | Valetti" };

  const label = subseasonLabel(parsed.data);
  const title = `${label} — colour palette | Valetti`;
  const description = `The ${label} palette. Find your own colours free in 20 seconds with Valetti's colour analysis for men.`;
  const image = absoluteUrl(ogImagePath(subseason, u, c));
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/colours/${subseason}`) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/colours/${subseason}`),
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ColoursSharePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  // Gated by the single `COLOURS_ENABLED` flag shared with `/colours` and the
  // API route, so the whole initiative flips on/off in one place.
  if (!COLOURS_ENABLED) notFound();

  const { subseason } = await params;
  const { u, c } = await searchParams;
  const parsed = Subseason.safeParse(subseason);
  if (!parsed.success) notFound();

  const sub = parsed.data;
  const label = subseasonLabel(sub);
  const season = seasonForSubseason(sub);
  const palette = paletteForSubseason(sub);
  const undertone = UNDERTONES.find((x) => x === u);
  const contrast = CONTRASTS.find((x) => x === c);
  // Personalised note when the sharer's undertone/contrast came through; else a
  // season-level blurb (the page is a showcase, the photo was never stored).
  const note =
    undertone && contrast
      ? carloNoteFor({ season, subseasonLabel: label, undertone, contrast })
      : seasonNoteFor(season);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16 sm:py-20">
            <p className="eyebrow">Colour analysis · for men</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
              The <em className="not-italic text-brass">{label}</em> palette
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone">
              {note}
            </p>
          </div>
        </section>

        <section className="container-luxe py-12">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border hairline bg-paper p-6 sm:p-8">
              <PaletteSwatches palette={palette} />
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href="/colours">
                  Find your colours — free
                </ButtonLink>
                <ButtonLink href="/start" variant="outline">
                  See a full report
                </ButtonLink>
              </div>
              <p className="mt-6 text-xs text-stone-soft">
                This is the {label} palette. Upload one selfie to see your own
                season, undertone and colours — free, no signup.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

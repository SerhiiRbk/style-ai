import { ImageComparisonSlider } from "@/components/ImageComparisonSlider";

export function ImpactOfColourSection() {
  return (
    <section className="border-b hairline bg-cream/20">
      <div className="container-luxe py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div className="order-2 lg:order-1">
            <p className="eyebrow">The science of colour</p>
            <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
              The wrong palette drains you.
              <br />
              The right one does the heavy lifting.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-stone">
              <p>
                Drag the slider — same person, two palettes. When colouring is
                warm and muted, optic white and black overpower the face. Warm
                ecru and tobacco brown harmonize with undertone instead.
              </p>
              <p>
                Valetti assigns a 12-subseason profile (here: Soft Autumn) and
                explains each swatch — so you learn the rule, not just the
                colour names.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-paper p-5 opacity-80">
                <div className="flex items-center gap-2 font-display text-sm text-ink">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone/10 text-stone-soft">
                    ✕
                  </span>
                  The default (wrong)
                </div>
                <p className="mt-2 text-xs leading-relaxed text-stone-soft">
                  Cold light, stark contrast — highlights fatigue on warm skin.
                </p>
              </div>
              <div className="rounded-xl border border-brass/30 bg-brass/5 p-5">
                <div className="flex items-center gap-2 font-display text-sm text-ink">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brass/20 text-brass">
                    ✓
                  </span>
                  The Valetti palette
                </div>
                <p className="mt-2 text-xs leading-relaxed text-stone">
                  Warm ecru and tobacco — skin reads healthier, features in
                  focus.
                </p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto w-full max-w-[460px]">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border hairline shadow-sm">
                <ImageComparisonSlider
                  beforeImage="/images/hero-editorial-bad-palette.png"
                  afterImage="/images/hero-editorial.png"
                  beforeAlt="Incorrect cold high-contrast palette"
                  afterAlt="Correct warm Soft Autumn palette"
                />
              </div>
              <div className="absolute -bottom-5 right-4 z-10 rounded-xl border hairline bg-paper/95 px-4 py-2 shadow-sm backdrop-blur-sm sm:-right-4">
                <div className="text-[10px] uppercase tracking-widest text-stone-soft">
                  Profile
                </div>
                <div className="mt-1 font-display text-sm text-ink">
                  Soft Autumn
                </div>
                <div className="text-xs text-stone">
                  Warm undertone · Low contrast
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

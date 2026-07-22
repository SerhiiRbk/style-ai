import type { PaletteSwatch } from "@/lib/colour-palette";

/**
 * Premium palette swatch grid (fabric sheen + weave grain) — presentational and
 * hook-free, so it renders in both server and client components.
 */
export function PaletteSwatches({ palette }: { palette: PaletteSwatch[] }) {
  return (
    <div className="grid grid-cols-4 gap-3.5 sm:grid-cols-8 sm:gap-4">
      {palette.map((s) => (
        <div key={s.hex} className="flex flex-col items-center gap-2">
          <span
            className="relative h-14 w-14 overflow-hidden rounded-xl ring-1 ring-ink/10 sm:h-16 sm:w-16"
            style={{ background: s.hex }}
            title={s.name}
          >
            <span
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-ink/20"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-multiply"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(21,18,13,0.06) 1px, rgba(21,18,13,0.06) 2px), repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(21,18,13,0.05) 1px, rgba(21,18,13,0.05) 2px)",
                backgroundSize: "3px 3px",
              }}
              aria-hidden
            />
            <span
              className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-6px_12px_rgba(21,18,13,0.12)]"
              aria-hidden
            />
          </span>
          <span className="text-[10px] leading-tight text-stone">{s.name}</span>
        </div>
      ))}
    </div>
  );
}

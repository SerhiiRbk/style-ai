import type { PaletteSwatch } from "@/lib/colour-palette";
import { FabricSwatch } from "@/components/FabricSwatch";

/**
 * Premium palette swatch grid — same textured fabric cards as `/colours`
 * (weave, pinked edges, soft shadow). Hook-free for server pages.
 */
export function PaletteSwatches({ palette }: { palette: PaletteSwatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 sm:gap-6">
      {palette.map((s, i) => (
        <div key={`${s.hex}-${i}`} className="flex flex-col items-center gap-2.5">
          <FabricSwatch hex={s.hex} name={s.name} uid={`ps${i}`} size="lg" />
          <span className="text-xs leading-tight text-stone">{s.name}</span>
        </div>
      ))}
    </div>
  );
}

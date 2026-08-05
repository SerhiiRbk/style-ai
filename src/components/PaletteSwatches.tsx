import type { PaletteSwatch } from "@/lib/colour-palette";
import { FabricSwatch } from "@/components/FabricSwatch";

/**
 * Premium palette swatch grid — same textured fabric cards as `/colours`
 * (weave, pinked edges, soft shadow). Hook-free for server pages.
 */
export function PaletteSwatches({ palette }: { palette: PaletteSwatch[] }) {
  return (
    <div className="grid grid-cols-4 gap-3.5 sm:grid-cols-8 sm:gap-4">
      {palette.map((s, i) => (
        <div key={`${s.hex}-${i}`} className="flex flex-col items-center gap-2">
          <FabricSwatch hex={s.hex} name={s.name} uid={`ps${i}`} />
          <span className="text-[10px] leading-tight text-stone">{s.name}</span>
        </div>
      ))}
    </div>
  );
}

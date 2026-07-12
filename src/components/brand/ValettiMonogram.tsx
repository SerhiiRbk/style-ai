import Image from "next/image";

/** Intrinsic pixels of public/images/valetti-emblem.png (keep in sync if rebuilt). */
const EMBLEM_W = 775;
const EMBLEM_H = 940;

/**
 * Valetti emblem — ornate gilded "V" initial. Rendered from a transparent PNG so
 * it sits cleanly on the paper background. `size` sets the rendered height; width
 * follows the artwork's aspect ratio.
 */
export function ValettiMonogram({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/images/valetti-emblem.png"
      alt=""
      width={EMBLEM_W}
      height={EMBLEM_H}
      aria-hidden
      className={className}
      style={{ height: size, width: "auto" }}
    />
  );
}

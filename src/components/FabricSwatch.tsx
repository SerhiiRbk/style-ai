/**
 * Builds the inline SVG for a single palette swatch. It mirrors the atelier
 * "fabric colour card" reference — a textured cloth with fine warp/weft weave,
 * a soft diagonal sheen, sparse long fibres and pinked (zig-zag) shear edges —
 * but drops the dark card mount so the swatch floats on the light page.
 *
 * `uid` makes every gradient / pattern / filter id unique so multiple swatches
 * can coexist on the page without cross-referencing each other's defs. `hex`
 * is inlined directly (cloth fill + pinking teeth), so no CSS var is needed.
 */
export function buildColoursSwatchSvg(hex: string, uid: string): string {
  const c = hex.replace(/"/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="24 18 132 214" preserveAspectRatio="xMidYMid meet" role="img" style="width:100%;height:100%;display:block">
  <defs>
    <linearGradient id="clothLight-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#fff" stop-opacity=".22"/>
      <stop offset=".26" stop-color="#fff" stop-opacity=".04"/>
      <stop offset=".7" stop-color="#000" stop-opacity=".03"/>
      <stop offset="1" stop-color="#000" stop-opacity=".22"/>
    </linearGradient>
    <pattern id="weave-${uid}" width="5.2" height="5.2" patternUnits="userSpaceOnUse">
      <path d="M0 .75H5.2 M0 3.35H5.2" stroke="#fff" stroke-opacity=".105" stroke-width=".52"/>
      <path d="M.85 0V5.2 M3.45 0V5.2" stroke="#050806" stroke-opacity=".14" stroke-width=".58"/>
      <path d="M0 1.7H5.2 M1.8 0V5.2" stroke="#fff" stroke-opacity=".035" stroke-width=".32"/>
    </pattern>
    <filter id="clothTexture-${uid}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".16 .72" numOctaves="3" seed="17" result="fibres"/>
      <feColorMatrix in="fibres" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .23 0" result="softFibres"/>
      <feBlend in="SourceGraphic" in2="softFibres" mode="soft-light"/>
    </filter>
    <filter id="clothShadow-${uid}" x="-30%" y="-25%" width="160%" height="165%">
      <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000" flood-opacity=".28"/>
      <feDropShadow dx="-1" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".22"/>
    </filter>
    <pattern id="teethH-${uid}" width="6" height="4" patternUnits="userSpaceOnUse">
      <path d="M0 4 3 0 6 4Z" fill="${c}"/>
    </pattern>
    <pattern id="teethV-${uid}" width="4" height="6" patternUnits="userSpaceOnUse">
      <path d="M4 0 0 3 4 6Z" fill="${c}"/>
    </pattern>
    <clipPath id="clothArea-${uid}"><rect x="34" y="27" width="112" height="176" rx="1"/></clipPath>
  </defs>
  <g filter="url(#clothShadow-${uid})" transform="rotate(-1.25 90 115)">
    <rect x="34" y="23" width="112" height="4" fill="url(#teethH-${uid})"/>
    <rect x="34" y="203" width="112" height="4" fill="url(#teethH-${uid})" transform="rotate(180 90 205)"/>
    <rect x="30" y="27" width="4" height="176" fill="url(#teethV-${uid})"/>
    <rect x="146" y="27" width="4" height="176" fill="url(#teethV-${uid})" transform="rotate(180 148 115)"/>
    <g clip-path="url(#clothArea-${uid})" filter="url(#clothTexture-${uid})">
      <rect x="34" y="27" width="112" height="176" fill="${c}"/>
      <rect x="34" y="27" width="112" height="176" fill="url(#weave-${uid})"/>
      <rect x="34" y="27" width="112" height="176" fill="url(#clothLight-${uid})"/>
      <g fill="none" stroke-linecap="round">
        <path d="M42 31v165 M57 30v169 M81 31v166 M108 29v169 M132 30v168" stroke="#fff" stroke-opacity=".055" stroke-width=".7"/>
        <path d="M36 48h108 M36 83h108 M36 126h108 M36 171h108" stroke="#0b0c0a" stroke-opacity=".07" stroke-width=".65"/>
        <path d="M43 58c22-2 56 2 94-1 M39 148c31 2 66-3 101 0" stroke="#fff" stroke-opacity=".075" stroke-width=".55"/>
      </g>
    </g>
    <path d="M35 28V202H145" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width=".7"/>
    <path d="M146 28V203H34" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1"/>
  </g>
</svg>`;
}

/**
 * Aspect ratio of a swatch card, matching the atelier fabric-card reference
 * (its cropped cloth-plus-pinking viewBox of 132×214).
 */
export const COLOURS_SWATCH_ASPECT_RATIO = 132 / 214;

/**
 * A single palette colour rendered as the atelier fabric card: textured woven
 * cloth with pinked (zig-zag) shear edges, a soft sheen and a light drop
 * shadow — floating on the page (no dark mount). Hook-free so it can render
 * in both server and client components; pass a unique `uid` per swatch.
 */
export function FabricSwatch({
  hex,
  name,
  uid,
}: {
  hex: string;
  name: string;
  uid: string;
}) {
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, "") || "swatch";
  return (
    <span
      className="block w-14 sm:w-16"
      title={name}
      role="img"
      aria-label={name}
      style={{ aspectRatio: COLOURS_SWATCH_ASPECT_RATIO }}
      dangerouslySetInnerHTML={{
        __html: buildColoursSwatchSvg(hex, safeUid),
      }}
    />
  );
}

import type { ReactNode } from "react";
import { colorHex, type ConstructorSlot } from "@/lib/look-constructor";

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

function GlyphFrame({
  fill,
  children,
}: {
  fill: string;
  children: ReactNode;
}) {
  const stroke = isLight(fill) ? "rgba(26,26,26,0.35)" : "rgba(26,26,26,0.12)";
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-full w-full"
      aria-hidden
    >
      <g fill={fill} stroke={stroke} strokeWidth="1.25" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

function eyewearLenses(shape: string | undefined, outlined: boolean): ReactNode {
  const fill = outlined ? "none" : undefined;
  const bridge = (
    <path d="M8 28 H20 A8 8 0 0 0 36 28 H44 A8 8 0 0 0 56 28" fill="none" />
  );
  switch (shape) {
    case "round":
      return (
        <>
          {bridge}
          <circle cx="20" cy="32" r="9" fill={fill} />
          <circle cx="44" cy="32" r="9" fill={fill} />
        </>
      );
    case "aviator":
      return (
        <>
          {bridge}
          <path
            d="M11 26 C11 22 29 22 29 28 C29 38 22 42 20 42 C18 42 11 38 11 28 Z"
            fill={fill}
          />
          <path
            d="M35 26 C35 22 53 22 53 28 C53 38 46 42 44 42 C42 42 35 38 35 28 Z"
            fill={fill}
          />
        </>
      );
    case "rectangle":
      return (
        <>
          {bridge}
          <rect x="10" y="24" width="20" height="16" rx="2" fill={fill} />
          <rect x="34" y="24" width="20" height="16" rx="2" fill={fill} />
        </>
      );
    case "geometric":
      return (
        <>
          {bridge}
          <path d="M10 24 L30 24 L28 40 L12 40 Z" fill={fill} />
          <path d="M34 24 L54 24 L52 40 L36 40 Z" fill={fill} />
        </>
      );
    case "oval":
      return (
        <>
          {bridge}
          <ellipse cx="20" cy="32" rx="11" ry="7" fill={fill} />
          <ellipse cx="44" cy="32" rx="11" ry="7" fill={fill} />
        </>
      );
    case "sport":
      return (
        <>
          <path d="M6 30 C8 22 22 20 32 24 C42 20 56 22 58 30 C56 40 44 44 32 40 C20 44 8 40 6 30 Z" fill={fill} />
          <path d="M32 24 V40" fill="none" />
        </>
      );
    case "ski":
      return (
        <>
          <path d="M4 30 H10" fill="none" />
          <path d="M54 30 H60" fill="none" />
          <path d="M10 24 C18 18 46 18 54 24 C56 28 56 36 52 40 C42 46 22 46 12 40 C8 36 8 28 10 24 Z" />
          <path d="M16 30 C24 26 40 26 48 30" fill="none" />
        </>
      );
    case "rimless":
      return (
        <>
          <path d="M6 30 H14" fill="none" />
          <path d="M50 30 H58" fill="none" />
          <path d="M30 30 H34" fill="none" />
          <circle cx="20" cy="32" r="9" fill="none" />
          <circle cx="44" cy="32" r="9" fill="none" />
          <circle cx="14" cy="30" r="1.4" />
          <circle cx="50" cy="30" r="1.4" />
          <circle cx="30" cy="30" r="1.4" />
          <circle cx="34" cy="30" r="1.4" />
        </>
      );
    case "wayfarer":
    default:
      return (
        <>
          {bridge}
          <path d="M9 26 L31 24 L29 40 L11 40 Z" fill={fill} />
          <path d="M33 24 L55 26 L53 40 L35 40 Z" fill={fill} />
        </>
      );
  }
}

function pathsFor(garment: string, category: string, shape?: string): ReactNode {
  switch (garment) {
    case "blazer":
      return (
        <>
          <path d="M18 14 L32 18 L46 14 L50 22 L50 54 L14 54 L14 22 Z" />
          <path d="M32 18 L32 54" fill="none" />
          <path d="M18 14 L26 28 L32 18 L38 28 L46 14" fill="none" />
        </>
      );
    case "coat":
    case "trench":
      return (
        <>
          <path d="M16 12 L32 16 L48 12 L52 20 L50 56 L14 56 L12 20 Z" />
          <path d="M32 16 L32 56" fill="none" />
          <path d="M20 12 L20 22 M44 12 L44 22" fill="none" />
        </>
      );
    case "overshirt":
      return (
        <>
          <path d="M18 16 L32 20 L46 16 L50 24 L48 52 L16 52 L14 24 Z" />
          <path d="M32 20 L32 52" fill="none" />
          <rect x="28" y="30" width="8" height="6" rx="1" fill="none" />
        </>
      );
    case "bomber":
      return (
        <>
          <path d="M16 18 C16 14 48 14 48 18 L52 26 L50 48 C50 52 14 52 14 48 L12 26 Z" />
          <path d="M16 46 H48" fill="none" />
        </>
      );
    case "crewneck":
      return (
        <>
          <path d="M20 16 C20 12 44 12 44 16 L48 22 L46 52 L18 52 L16 22 Z" />
          <path d="M26 16 C28 22 36 22 38 16" fill="none" />
        </>
      );
    case "cardigan":
      return (
        <>
          <path d="M18 16 L32 22 L46 16 L50 24 L48 54 L16 54 L14 24 Z" />
          <path d="M32 22 L26 54 M32 22 L38 54" fill="none" />
        </>
      );
    case "turtleneck":
      return (
        <>
          <path d="M22 10 H42 V16 C42 12 22 12 22 16 Z" />
          <path d="M18 16 L46 16 L50 22 L48 54 L16 54 L14 22 Z" />
        </>
      );
    case "polo":
      return (
        <>
          <path d="M20 16 L32 22 L44 16 L48 22 L46 52 L18 52 L16 22 Z" />
          <path d="M28 16 L32 24 L36 16" fill="none" />
        </>
      );
    case "tee":
      return (
        <path d="M14 20 L22 16 L26 16 L26 20 L38 20 L38 16 L42 16 L50 20 L46 26 L46 52 L18 52 L18 26 Z" />
      );
    case "henley":
      return (
        <>
          <path d="M18 16 L46 16 L50 22 L48 54 L16 54 L14 22 Z" />
          <path d="M32 16 V34" fill="none" />
          <circle cx="32" cy="22" r="1.2" />
          <circle cx="32" cy="28" r="1.2" />
        </>
      );
    case "oxford":
    case "shirt":
      return (
        <>
          <path d="M18 14 L32 20 L46 14 L50 22 L48 54 L16 54 L14 22 Z" />
          <path d="M32 20 L32 54" fill="none" />
          <path d="M26 14 L32 24 L38 14" fill="none" />
        </>
      );
    case "jeans":
      return (
        <>
          <path d="M22 10 H42 L44 22 L40 58 H34 L32 30 L30 58 H24 L20 22 Z" />
          <path d="M24 16 H40" fill="none" />
        </>
      );
    case "chinos":
    case "trousers":
      return (
        <path d="M22 10 H42 L44 20 L41 58 H33 L32 28 L31 58 H23 L20 20 Z" />
      );
    case "loafers":
      return (
        <>
          <path d="M10 40 C10 34 18 32 28 34 L54 36 C58 36 58 44 52 46 L16 48 C10 48 10 44 10 40 Z" />
          <path d="M24 36 L30 42 L44 40" fill="none" />
        </>
      );
    case "sneakers":
      return (
        <>
          <path d="M12 38 C12 32 22 30 32 34 L52 38 C56 38 56 46 50 48 L18 50 C12 50 12 44 12 38 Z" />
          <path d="M20 42 H46" fill="none" />
        </>
      );
    case "boots":
      return (
        <path d="M22 14 H40 L42 36 L54 40 C58 42 58 50 50 52 L18 52 C14 52 14 46 16 44 L20 36 Z" />
      );
    case "hiking":
      return (
        <>
          <path d="M22 12 H40 L42 32 L56 38 C60 40 60 50 52 54 L16 54 C12 54 12 46 14 44 L20 32 Z" />
          <path d="M16 50 H52" fill="none" />
        </>
      );
    case "derbies":
      return (
        <>
          <path d="M10 40 C12 32 24 30 34 34 L54 38 C58 38 58 46 52 48 L16 50 C10 50 8 44 10 40 Z" />
          <path d="M22 36 C24 42 32 44 38 40" fill="none" />
        </>
      );
    case "sandals":
      return (
        <>
          <path d="M12 42 C14 36 28 34 40 38 L54 42 C58 44 56 50 50 50 L16 50 C10 50 10 46 12 42 Z" />
          <path d="M22 38 L28 48 M36 40 L40 48" fill="none" />
        </>
      );
    case "belt":
      return (
        <>
          <path d="M8 30 H48 V38 H8 Z" />
          <rect x="46" y="26" width="12" height="16" rx="2" />
        </>
      );
    case "watch":
      return (
        <>
          <rect x="28" y="8" width="8" height="14" rx="1" />
          <rect x="28" y="42" width="8" height="14" rx="1" />
          <circle cx="32" cy="32" r="10" />
        </>
      );
    case "tie":
      return (
        <path d="M28 8 H36 L34 16 L40 52 L32 58 L24 52 L30 16 Z" />
      );
    case "scarf":
      return (
        <>
          <path d="M22 8 C18 14 18 22 24 28 L28 56 H36 L32 28 C40 22 42 12 36 8 Z" />
          <path d="M24 28 C28 32 36 32 40 26" fill="none" />
        </>
      );
    case "sunglasses":
      return eyewearLenses(shape, false);
    case "glasses":
      return eyewearLenses(shape, true);
    default:
      if (category === "Outerwear") return pathsFor("blazer", category);
      if (category === "Knitwear") return pathsFor("crewneck", category);
      if (category === "Shirts") return pathsFor("shirt", category);
      if (category === "Trousers") return pathsFor("trousers", category);
      if (category === "Footwear") return pathsFor("loafers", category);
      return <circle cx="32" cy="32" r="16" />;
  }
}

export function LookGarmentGlyph({
  slot,
  className = "",
}: {
  slot: ConstructorSlot;
  className?: string;
}) {
  const fill = colorHex(slot.color);
  return (
    <span className={`block ${className}`}>
      <GlyphFrame fill={fill}>
        {pathsFor(slot.garment, slot.category, slot.shape)}
      </GlyphFrame>
    </span>
  );
}

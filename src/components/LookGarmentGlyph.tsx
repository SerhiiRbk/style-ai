import type { ReactNode } from "react";
import {
  colorHex,
  lensColorHex,
  sneakerSoleColor,
  type ConstructorSlot,
} from "@/lib/look-constructor";

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
      <defs>
        <linearGradient id="lens-mirror" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8F2F6" />
          <stop offset="45%" stopColor="#7EB8C9" />
          <stop offset="100%" stopColor="#2A4A5C" />
        </linearGradient>
      </defs>
      <g fill={fill} stroke={stroke} strokeWidth="1.25" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

function eyewearLenses(
  shape: string | undefined,
  outlined: boolean,
  lensFill?: string,
): ReactNode {
  const fill = outlined ? "none" : (lensFill ?? undefined);
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
    case "ski":
      return (
        <>
          <path d="M6 30 C8 22 22 20 32 24 C42 20 56 22 58 30 C56 40 44 44 32 40 C20 44 8 40 6 30 Z" fill={fill} />
          <path d="M32 24 V40" fill="none" />
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

function hatPaths(hatType?: string): ReactNode {
  switch (hatType) {
    case "baseball":
      return (
        <>
          <path d="M14 34 C16 20 48 20 50 34 L50 38 H14 Z" />
          <path d="M14 36 C8 38 6 44 18 44 H36" />
        </>
      );
    case "kartuz":
      return (
        <>
          <path d="M16 36 C18 22 46 22 48 36 L46 40 H18 Z" />
          <path d="M16 38 C10 40 10 44 20 44 H34" />
        </>
      );
    case "bucket":
      return (
        <>
          <path d="M20 22 H44 L48 36 H16 Z" />
          <path d="M8 36 C12 44 52 44 56 36 H8 Z" />
        </>
      );
    case "boater":
      return (
        <>
          <rect x="18" y="20" width="28" height="14" rx="1" />
          <path d="M6 34 H58 L54 40 H10 Z" />
        </>
      );
    case "kepi":
      return (
        <>
          <path d="M20 16 H44 L46 34 H18 Z" />
          <path d="M18 34 H36 L34 40 H12 Z" />
        </>
      );
    case "peaked":
      return (
        <>
          <path d="M18 12 H46 L48 34 H16 Z" />
          <path d="M16 34 H38 L36 42 H8 Z" />
        </>
      );
    case "fedora":
    case "borsalino":
      return (
        <>
          <path d="M18 28 C20 14 44 14 46 28 L48 32 H16 Z" />
          <path d="M6 32 C14 40 50 40 58 32 H6 Z" />
          <path d="M28 16 L32 22 L36 16" fill="none" />
        </>
      );
    case "trilby":
      return (
        <>
          <path d="M20 26 C22 14 42 14 44 26 L46 30 H18 Z" />
          <path d="M12 30 C18 36 46 36 52 30 H12 Z" />
        </>
      );
    case "beanie":
      return <path d="M16 38 C16 20 48 20 48 38 L46 44 H18 Z" />;
    case "fisherman":
      return (
        <>
          <path d="M16 32 C16 18 48 18 48 32 Z" />
          <path d="M16 32 H48 L46 40 H18 Z" />
        </>
      );
    case "slouch":
      return <path d="M14 42 C10 18 28 8 40 14 C54 20 54 34 48 42 L44 48 H18 Z" />;
    case "cowboy":
      return (
        <>
          <path d="M22 26 C24 10 40 10 42 26 L44 30 H20 Z" />
          <path d="M4 30 C16 24 48 24 60 30 C50 40 14 40 4 30 Z" />
        </>
      );
    case "newsboy":
      return (
        <>
          <path d="M14 34 C16 18 48 18 50 34 L48 38 H16 Z" />
          <path d="M16 36 H40 L38 42 H14 Z" />
          <path d="M32 18 L32 36 M24 22 L24 36 M40 22 L40 36" fill="none" />
        </>
      );
    case "cap":
    default:
      return (
        <>
          <path d="M16 34 C18 22 46 22 48 34 L46 38 H18 Z" />
          <path d="M16 36 H34 L32 42 H12 Z" />
        </>
      );
  }
}

function pathsFor(
  garment: string,
  category: string,
  shape?: string,
  tieType?: string,
  lensFill?: string,
  hatType?: string,
  soleFill?: string,
): ReactNode {
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
          <path
            d="M14 46 C16 51 50 51 52 46 L50 48 C48 52 16 52 14 48 Z"
            fill={soleFill ?? "#F3EDE0"}
          />
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
      if (tieType === "bow") {
        return (
          <>
            <path d="M8 26 L28 30 L28 38 L8 42 Z" />
            <path d="M36 30 L56 26 L56 42 L36 38 Z" />
            <rect x="28" y="28" width="8" height="12" rx="1" />
          </>
        );
      }
      if (tieType === "knitted") {
        return <path d="M28 8 H36 L34 16 L38 54 H26 L30 16 Z" />;
      }
      if (tieType === "skinny") {
        return <path d="M29 8 H35 L33 16 L36 54 L32 58 L28 54 L31 16 Z" />;
      }
      return <path d="M28 8 H36 L34 16 L40 52 L32 58 L24 52 L30 16 Z" />;
    case "scarf":
      return (
        <>
          <path d="M22 8 C18 14 18 22 24 28 L28 56 H36 L32 28 C40 22 42 12 36 8 Z" />
          <path d="M24 28 C28 32 36 32 40 26" fill="none" />
        </>
      );
    case "hat":
      return hatPaths(hatType);
    case "sunglasses":
      return eyewearLenses(shape, false, lensFill);
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
  const fill = colorHex(slot.color === "mirrored" ? "black" : slot.color);
  const lensFill =
    slot.garment === "sunglasses"
      ? slot.lensColor === "mirrored" || slot.color === "mirrored"
        ? "url(#lens-mirror)"
        : lensColorHex(slot.lensColor || "grey")
      : undefined;
  return (
    <span className={`block ${className}`}>
      <GlyphFrame fill={fill}>
        {pathsFor(
          slot.garment,
          slot.category,
          slot.shape,
          slot.tieType,
          lensFill,
          slot.hatType,
          slot.garment === "sneakers"
            ? sneakerSoleColor(slot.color) === "cream"
              ? "#E8DCC8"
              : "#F4F1EA"
            : undefined,
        )}
      </GlyphFrame>
    </span>
  );
}

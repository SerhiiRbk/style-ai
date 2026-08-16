import { useId, type ReactNode } from "react";
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
  gradientId,
  children,
}: {
  fill: string;
  gradientId: string;
  children: ReactNode;
}) {
  const light = isLight(fill);
  const stroke = light ? "rgba(28,24,20,0.5)" : "rgba(255,246,232,0.42)";
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4FBFD" />
          <stop offset="48%" stopColor="#8EC4D4" />
          <stop offset="100%" stopColor="#2A4554" />
        </linearGradient>
      </defs>
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth="1.15"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
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
  const temples = (
    <>
      <path d="M7 29 H12" fill="none" />
      <path d="M52 29 H57" fill="none" />
    </>
  );
  const bridge = <path d="M29 30 H35" fill="none" />;
  switch (shape) {
    case "round":
      return (
        <>
          {temples}
          {bridge}
          <circle cx="20" cy="32" r="9.5" fill={fill} />
          <circle cx="44" cy="32" r="9.5" fill={fill} />
        </>
      );
    case "aviator":
      return (
        <>
          {temples}
          {bridge}
          <path
            d="M11 25 C12 21 29 21 30 27 C30 38 24 43 20 43 C16 43 11 38 11 28 Z"
            fill={fill}
          />
          <path
            d="M34 25 C35 21 52 21 53 27 C53 38 47 43 44 43 C40 43 34 38 34 28 Z"
            fill={fill}
          />
        </>
      );
    case "rectangle":
      return (
        <>
          {temples}
          {bridge}
          <rect x="10" y="24" width="19" height="15" rx="2.2" fill={fill} />
          <rect x="35" y="24" width="19" height="15" rx="2.2" fill={fill} />
        </>
      );
    case "geometric":
      return (
        <>
          {temples}
          {bridge}
          <path d="M11 24 L30 24 L28 40 L13 40 Z" fill={fill} />
          <path d="M34 24 L53 24 L51 40 L36 40 Z" fill={fill} />
        </>
      );
    case "oval":
      return (
        <>
          {temples}
          {bridge}
          <ellipse cx="20" cy="32" rx="11" ry="7.5" fill={fill} />
          <ellipse cx="44" cy="32" rx="11" ry="7.5" fill={fill} />
        </>
      );
    case "sport":
    case "ski":
      return (
        <>
          <path
            d="M6 31 C8 22 22 20 32 24 C42 20 56 22 58 31 C56 40 44 44 32 40 C20 44 8 40 6 31 Z"
            fill={fill}
          />
          <path d="M32 24 V40" fill="none" />
        </>
      );
    case "rimless":
      return (
        <>
          <path d="M6 30 H13" fill="none" />
          <path d="M51 30 H58" fill="none" />
          <path d="M29 30 H35" fill="none" />
          <circle cx="20" cy="32" r="9" fill="none" />
          <circle cx="44" cy="32" r="9" fill="none" />
        </>
      );
    case "wayfarer":
    default:
      return (
        <>
          {temples}
          {bridge}
          <path d="M9 25 L31 23 L29 41 L11 40 Z" fill={fill} />
          <path d="M33 23 L55 25 L53 40 L35 41 Z" fill={fill} />
        </>
      );
  }
}

function hatPaths(hatType?: string): ReactNode {
  switch (hatType) {
    case "baseball":
      return (
        <>
          <path d="M16 34 C18 18 46 18 48 34 L48 38 H16 Z" />
          <path d="M16 36 C6 38 5 46 20 46 H38" />
          <path d="M32 18 V34" fill="none" />
        </>
      );
    case "kartuz":
      return (
        <>
          <path d="M17 36 C19 21 45 21 47 36 L45 40 H19 Z" />
          <path d="M17 38 C10 40 10 45 21 45 H35" />
        </>
      );
    case "bucket":
      return (
        <>
          <path d="M21 20 H43 L48 36 H16 Z" />
          <path d="M7 36 C12 46 52 46 57 36 H7 Z" />
        </>
      );
    case "boater":
      return (
        <>
          <rect x="19" y="18" width="26" height="13" rx="1.5" />
          <path d="M6 32 H58 L53 40 H11 Z" />
          <path d="M19 25 H45" fill="none" />
        </>
      );
    case "kepi":
      return (
        <>
          <path d="M20 15 H44 L47 34 H17 Z" />
          <path d="M17 34 H38 L35 42 H10 Z" />
        </>
      );
    case "peaked":
      return (
        <>
          <path d="M18 11 H46 L49 34 H15 Z" />
          <path d="M15 34 H40 L37 43 H7 Z" />
        </>
      );
    case "fedora":
    case "borsalino":
      return (
        <>
          <path d="M19 27 C21 12 43 12 45 27 L48 32 H16 Z" />
          <path d="M5 32 C14 42 50 42 59 32 H5 Z" />
          <path d="M27 14 L32 22 L37 14" fill="none" />
        </>
      );
    case "trilby":
      return (
        <>
          <path d="M21 25 C23 13 41 13 43 25 L46 30 H18 Z" />
          <path d="M11 30 C18 37 46 37 53 30 H11 Z" />
        </>
      );
    case "beanie":
      return (
        <>
          <path d="M16 38 C16 18 48 18 48 38 L45 46 H19 Z" />
          <path d="M16 36 H48" fill="none" />
        </>
      );
    case "fisherman":
      return (
        <>
          <path d="M16 31 C16 17 48 17 48 31 Z" />
          <path d="M16 31 H48 L45 41 H19 Z" />
        </>
      );
    case "slouch":
      return <path d="M14 42 C9 16 28 7 41 14 C55 21 55 34 48 42 L43 50 H18 Z" />;
    case "cowboy":
      return (
        <>
          <path d="M22 26 C24 9 40 9 42 26 L44 31 H20 Z" />
          <path d="M3 31 C16 24 48 24 61 31 C50 42 14 42 3 31 Z" />
        </>
      );
    case "newsboy":
      return (
        <>
          <path d="M14 34 C16 16 48 16 50 34 L47 39 H17 Z" />
          <path d="M17 36 H41 L38 43 H13 Z" />
          <path d="M32 17 V36 M24 21 V36 M40 21 V36" fill="none" />
        </>
      );
    case "cap":
    default:
      return (
        <>
          <path d="M16 33 C18 20 46 20 48 33 L45 38 H19 Z" />
          <path d="M16 35 H36 L33 43 H11 Z" />
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
  blazerType?: string,
): ReactNode {
  switch (garment) {
    case "blazer":
      return blazerType === "double" ? (
        <>
          <path d="M17 12 L32 17 L47 12 L52 21 L51 56 H13 L12 21 Z" />
          <path d="M17 12 L27 31 L32 17 L37 31 L47 12" fill="none" />
          <path d="M25 24 V56 M39 24 V56" fill="none" />
          <path d="M16 40 H25 M39 40 H48" fill="none" />
          <circle cx="28" cy="34" r="1.15" />
          <circle cx="36" cy="34" r="1.15" />
          <circle cx="28" cy="43" r="1.15" />
          <circle cx="36" cy="43" r="1.15" />
        </>
      ) : (
        <>
          <path d="M17 12 L32 17 L47 12 L52 21 L51 56 H13 L12 21 Z" />
          <path d="M17 12 L26 30 L32 17 L38 30 L47 12" fill="none" />
          <path d="M32 17 V56" fill="none" />
          <path d="M16 41 H26" fill="none" />
          <circle cx="35" cy="34" r="1.15" />
          <circle cx="35" cy="42" r="1.15" />
        </>
      );
    case "jacket":
      return (
        <>
          <path d="M15 15 L32 19 L49 15 L53 24 L51 52 C51 56 13 56 13 52 L11 24 Z" />
          <path d="M32 19 V52" fill="none" />
          <path d="M19 15 L24 27 M45 15 L40 27" fill="none" />
          <path d="M15 48 H49" fill="none" />
        </>
      );
    case "coat":
    case "trench":
      return (
        <>
          <path d="M15 10 L32 15 L49 10 L54 19 L52 58 H12 L10 19 Z" />
          <path d="M32 15 V58" fill="none" />
          <path d="M20 10 V22 M44 10 V22" fill="none" />
          <path d="M18 34 H46" fill="none" />
          <path d="M31 34 V40" fill="none" />
        </>
      );
    case "overshirt":
      return (
        <>
          <path d="M17 14 L32 19 L47 14 L51 23 L49 54 H15 L13 23 Z" />
          <path d="M32 19 V54" fill="none" />
          <rect x="18" y="30" width="10" height="9" rx="1" fill="none" />
          <rect x="36" y="30" width="10" height="9" rx="1" fill="none" />
        </>
      );
    case "bomber":
      return (
        <>
          <path d="M16 20 C16 13 48 13 48 20 L53 27 L51 48 C51 53 13 53 13 48 L11 27 Z" />
          <path d="M16 20 H48" fill="none" />
          <path d="M14 47 H50" fill="none" />
          <path d="M32 20 V47" fill="none" />
        </>
      );
    case "crewneck":
      return (
        <>
          <path d="M19 17 C19 12 45 12 45 17 L50 24 L48 54 H16 L14 24 Z" />
          <path d="M26 16 C28 24 36 24 38 16" fill="none" />
          <path d="M16 50 H48" fill="none" />
        </>
      );
    case "cardigan":
      return (
        <>
          <path d="M17 14 L32 24 L47 14 L51 23 L49 56 H15 L13 23 Z" />
          <path d="M32 24 L25 56 M32 24 L39 56" fill="none" />
          <circle cx="29" cy="32" r="1.1" />
          <circle cx="28" cy="40" r="1.1" />
          <circle cx="27" cy="48" r="1.1" />
        </>
      );
    case "turtleneck":
      return (
        <>
          <path d="M23 8 H41 V18 C41 13 23 13 23 18 Z" />
          <path d="M17 18 L47 18 L51 25 L49 56 H15 L13 25 Z" />
          <path d="M23 13 H41" fill="none" />
        </>
      );
    case "polo":
      return (
        <>
          <path d="M18 15 L32 22 L46 15 L51 23 L49 54 H15 L13 23 Z" />
          <path d="M27 15 L32 25 L37 15" fill="none" />
          <path d="M32 22 V34" fill="none" />
          <path d="M18 15 H27 M37 15 H46" fill="none" />
        </>
      );
    case "tee":
      return (
        <>
          <path d="M12 22 L22 15 H26 V20 H38 V15 H42 L52 22 L47 28 V54 H17 V28 Z" />
          <path d="M26 15 C28 21 36 21 38 15" fill="none" />
        </>
      );
    case "henley":
      return (
        <>
          <path d="M17 14 L47 14 L51 22 L49 56 H15 L13 22 Z" />
          <path d="M32 14 V36" fill="none" />
          <circle cx="32" cy="20" r="1.2" />
          <circle cx="32" cy="27" r="1.2" />
          <path d="M26 14 C28 20 36 20 38 14" fill="none" />
        </>
      );
    case "oxford":
    case "shirt":
      return (
        <>
          <path d="M16 12 L32 20 L48 12 L52 21 L50 56 H14 L12 21 Z" />
          <path d="M16 12 L26 14 L32 24 L38 14 L48 12" fill="none" />
          <path d="M32 20 V56" fill="none" />
          <path d="M14 48 H22 M42 48 H50" fill="none" />
        </>
      );
    case "jeans":
      return (
        <>
          <path d="M21 8 H43 L46 20 L42 58 H33 L32 28 L31 58 H22 L18 20 Z" />
          <path d="M23 16 H41" fill="none" />
          <path d="M24 8 V16 M40 8 V16" fill="none" />
          <path d="M32 20 V28" fill="none" />
          <path d="M22 36 L31 38 M33 38 L42 36" fill="none" />
        </>
      );
    case "chinos":
    case "trousers":
      return (
        <>
          <path d="M21 8 H43 L46 18 L43 58 H34 L32 26 L30 58 H21 L18 18 Z" />
          <path d="M23 14 H41" fill="none" />
          <path d="M32 14 V26" fill="none" />
          <path d="M26 8 V14 M38 8 V14" fill="none" />
        </>
      );
    case "shorts":
      return (
        <>
          <path d="M20 10 H44 L47 20 L44 42 H34 L32 24 L30 42 H20 L17 20 Z" />
          <path d="M22 16 H42" fill="none" />
          <path d="M32 16 V24" fill="none" />
          <path d="M20 40 H30 M34 40 H44" fill="none" />
        </>
      );
    case "loafers":
      return (
        <>
          <path d="M8 39 C8 32 18 30 30 33 L54 36 C59 36 59 46 51 48 L15 50 C8 50 8 44 8 39 Z" />
          <path d="M22 34 L28 43 L46 40" fill="none" />
          <path d="M26 37 H42" fill="none" />
          <path d="M10 46 H50" fill="none" />
        </>
      );
    case "sneakers":
      return (
        <>
          <path d="M10 37 C10 30 22 28 34 33 L52 37 C57 37 57 46 50 48 L16 50 C10 50 10 43 10 37 Z" />
          <path d="M20 34 L24 40 M26 33 L30 40 M32 33 L35 40" fill="none" />
          <path d="M18 42 H46" fill="none" />
          <path
            d="M12 46 C15 52 50 52 53 46 L50 48 C47 53 15 53 12 48 Z"
            fill={soleFill ?? "#F3EDE0"}
          />
        </>
      );
    case "boots":
      return (
        <>
          <path d="M22 10 H41 L43 34 L55 39 C59 41 59 51 50 53 L17 53 C13 53 13 46 15 44 L20 34 Z" />
          <path d="M22 22 H41" fill="none" />
          <path d="M16 49 H52" fill="none" />
        </>
      );
    case "hiking":
      return (
        <>
          <path d="M21 9 H41 L43 30 L57 37 C61 40 61 51 52 55 L15 55 C11 55 11 46 13 44 L19 30 Z" />
          <path d="M21 20 H41" fill="none" />
          <path d="M14 50 H54" fill="none" />
          <path d="M18 53 L22 50 L26 53 L30 50 L34 53 L38 50 L42 53 L46 50 L50 53" fill="none" />
        </>
      );
    case "derbies":
      return (
        <>
          <path d="M8 39 C10 30 24 28 36 33 L54 37 C59 37 59 47 51 49 L15 51 C8 51 6 44 8 39 Z" />
          <path d="M22 34 C24 42 34 44 40 38" fill="none" />
          <path d="M24 36 L26 41 M28 35 L30 41 M32 35 L34 41" fill="none" />
          <path d="M10 47 H50" fill="none" />
        </>
      );
    case "sandals":
      return (
        <>
          <path d="M11 43 C13 35 30 33 42 38 L55 43 C59 45 57 52 50 52 L16 52 C9 52 9 47 11 43 Z" />
          <path d="M20 37 L26 50 M34 39 L39 50 M28 36 L32 42" fill="none" />
          <path d="M14 49 H50" fill="none" />
        </>
      );
    case "belt":
      return (
        <>
          <path d="M6 29 H46 V39 H6 Z" />
          <path d="M14 29 V39 M22 29 V39 M30 29 V39" fill="none" />
          <rect x="44" y="25" width="14" height="18" rx="2" />
          <path d="M48 29 V39" fill="none" />
        </>
      );
    case "watch":
      return (
        <>
          <path d="M27 7 H37 L36 18 H28 Z" />
          <path d="M28 46 H36 L37 57 H27 Z" />
          <circle cx="32" cy="32" r="11" />
          <circle cx="32" cy="32" r="7" fill="none" />
          <path d="M32 32 L32 26 M32 32 L37 34" fill="none" />
        </>
      );
    case "tie":
      if (tieType === "bow") {
        return (
          <>
            <path d="M7 25 L27 30 L27 38 L7 43 Z" />
            <path d="M37 30 L57 25 L57 43 L37 38 Z" />
            <rect x="27" y="28" width="10" height="12" rx="1.2" />
          </>
        );
      }
      if (tieType === "knitted") {
        return (
          <>
            <path d="M27 7 H37 L35 16 L39 54 H25 L29 16 Z" />
            <path d="M29 22 H35 M28 30 H36 M27 38 H37 M26 46 H38" fill="none" />
          </>
        );
      }
      if (tieType === "skinny") {
        return <path d="M29 7 H35 L33 16 L36 53 L32 58 L28 53 L31 16 Z" />;
      }
      return (
        <>
          <path d="M27 7 H37 L34 16 L41 51 L32 59 L23 51 L30 16 Z" />
          <path d="M32 16 V28" fill="none" />
        </>
      );
    case "scarf":
      return (
        <>
          <path d="M22 7 C17 14 17 23 24 29 L29 58 H37 L32 29 C41 22 43 11 36 7 Z" />
          <path d="M24 29 C29 34 37 33 41 26" fill="none" />
          <path d="M29 48 H35" fill="none" />
        </>
      );
    case "tote":
    case "tote bag":
      return (
        <>
          <path d="M16 22 H48 L45 56 H19 Z" />
          <path d="M22 22 C22 12 28 10 32 10 C36 10 42 12 42 22" fill="none" />
          <path d="M20 30 H44" fill="none" />
        </>
      );
    case "pocket square":
    case "pochette":
      return (
        <>
          <path d="M14 18 H50 V50 H14 Z" />
          <path d="M14 18 L32 8 L50 18" />
          <path d="M20 28 H44 M20 36 H38" fill="none" />
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
  const gradientId = `${useId().replace(/:/g, "")}-mirror`;
  const lensFill =
    slot.garment === "sunglasses"
      ? slot.lensColor === "mirrored" || slot.color === "mirrored"
        ? `url(#${gradientId})`
        : lensColorHex(slot.lensColor || "grey")
      : undefined;
  return (
    <span className={`block ${className}`}>
      <GlyphFrame fill={fill} gradientId={gradientId}>
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
          slot.blazerType,
        )}
      </GlyphFrame>
    </span>
  );
}

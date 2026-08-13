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

function pathsFor(garment: string, category: string): ReactNode {
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
    case "derbies":
      return (
        <>
          <path d="M10 40 C12 32 24 30 34 34 L54 38 C58 38 58 46 52 48 L16 50 C10 50 8 44 10 40 Z" />
          <path d="M22 36 C24 42 32 44 38 40" fill="none" />
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
    case "sunglasses":
      return (
        <>
          <path d="M8 28 H20 A8 8 0 0 0 36 28 H44 A8 8 0 0 0 56 28" fill="none" />
          <ellipse cx="20" cy="32" rx="10" ry="8" />
          <ellipse cx="44" cy="32" rx="10" ry="8" />
        </>
      );
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
      <GlyphFrame fill={fill}>{pathsFor(slot.garment, slot.category)}</GlyphFrame>
    </span>
  );
}

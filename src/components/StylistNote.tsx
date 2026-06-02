import Image from "next/image";
import { BRAND } from "@/lib/brand";

/**
 * Compact, signed note from the brand's stylist persona. Used inside reports
 * to give the analysis a calm, human voice — Carlo "presenting" the findings.
 */
export function StylistNote({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border p-5 ${
        dark
          ? "border-paper/15 bg-ink-soft/60 text-paper/85"
          : "border-line bg-cream/40 text-stone"
      }`}
    >
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border hairline">
        <Image
          src={BRAND.stylist.avatar}
          alt={BRAND.stylist.name}
          fill
          sizes="48px"
          className="object-cover"
        />
      </span>
      <div className="min-w-0">
        <div className="text-sm leading-relaxed">{children}</div>
        <div
          className={`mt-2 text-xs ${dark ? "text-paper/50" : "text-stone-soft"}`}
        >
          — {BRAND.stylist.signature}
        </div>
      </div>
    </div>
  );
}

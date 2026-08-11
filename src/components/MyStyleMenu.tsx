"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import { useNavSession } from "./NavSession";

const MY_STYLE_LINKS = [
  { href: "/reports", label: "Style Reports" },
  { href: "/gallery", label: "Gallery" },
  ...(COLOURS_ENABLED
    ? [{ href: "/colours", label: "Colours" }]
    : []),
  { href: "/account", label: "Style Profile" },
] as const;

const triggerClass =
  "inline-flex items-center gap-1 whitespace-nowrap text-xs xl:text-sm text-stone transition-colors hover:text-ink";

/**
 * Desktop "My Style" dropdown — personal destinations for signed-in visitors
 * (reports, gallery, colours, style profile). Anon visitors never see this;
 * they keep Colours / Demo as top-level links.
 */
export function MyStyleMenu() {
  const { authed } = useNavSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!authed) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        My Style
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="My Style"
          className="absolute left-0 top-full z-50 mt-2 min-w-[11.5rem] rounded-xl border hairline bg-paper py-1.5 shadow-[0_8px_28px_rgba(21,18,13,0.10)]"
        >
          {MY_STYLE_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-ink transition-colors hover:bg-cream hover:text-brass"
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Links shown under the "My Style" group in the mobile slide-over. */
export function myStyleMobileLinks(): { href: string; label: string }[] {
  return [...MY_STYLE_LINKS];
}

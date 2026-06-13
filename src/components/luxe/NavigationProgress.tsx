"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LuxeSpinner } from "./LuxeSpinner";
import { navigationMessage } from "./messages";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    setPending(false);
    setTarget(null);
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;

        const next = url.pathname + url.search;
        const current =
          pathname +
          (searchParams.toString() ? `?${searchParams.toString()}` : "");
        if (next === current) return;

        setTarget(url.pathname);
        setPending(true);
      } catch {
        /* ignore malformed href */
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, searchParams]);

  if (!pending) return null;

  const message = navigationMessage(target);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px] overflow-hidden bg-line/30"
        aria-hidden
      >
        <div className="h-full w-full animate-luxe-progress bg-gradient-to-r from-transparent via-brass to-brass-soft" />
      </div>
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[119] flex justify-center px-4">
        <p className="inline-flex items-center gap-2.5 rounded-full border hairline bg-paper/95 px-4 py-2 text-[11px] tracking-wide text-stone shadow-sm backdrop-blur-md animate-rise">
          <LuxeSpinner size="xs" tone="brass" />
          {message}
        </p>
      </div>
    </>
  );
}

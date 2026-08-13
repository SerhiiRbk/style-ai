"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 5_000;

/** Re-fetch the page while a look set is still rendering, so placeholders
 *  swap for images without a manual refresh. Mirrors ReportGenerationBanner's
 *  poll + router.refresh. */
export function LookGeneratingRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

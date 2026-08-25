"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Warm adjacent catalog pages as soon as the current one paints. */
export function CatalogPrefetch({
  nextHref,
  prevHref,
}: {
  nextHref?: string;
  prevHref?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
  }, [nextHref, prevHref, router]);
  return null;
}

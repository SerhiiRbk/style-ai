"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportZoomImage } from "./ReportZoomImage";
import type { SavedOutfitTryOn } from "@/lib/outfit-tryon";

export const OUTFIT_TRYON_SAVED_EVENT = "outfit-tryon-saved";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Saved catalogue / outfit try-ons for this report — full-size zoom on click,
 * with the garments used listed under each render.
 */
export function SavedOutfitTryOns({
  reportId,
  initial,
}: {
  reportId: string;
  /** Server-rendered list for first paint; refreshed after new saves. */
  initial?: SavedOutfitTryOn[];
}) {
  const [outfits, setOutfits] = useState<SavedOutfitTryOn[]>(initial ?? []);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tryon/outfits?reportId=${reportId}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.outfits)) setOutfits(data.outfits);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    const onSaved = () => void refresh();
    window.addEventListener(OUTFIT_TRYON_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(OUTFIT_TRYON_SAVED_EVENT, onSaved);
  }, [refresh]);

  if (!outfits.length && !loading) return null;

  return (
    <div className="mt-14 border-t border-paper/10 pt-10">
      <h3 className="text-sm uppercase tracking-wider text-brass-soft">
        Your saved try-ons
      </h3>
      <p className="mt-2 max-w-lg text-sm text-paper/50">
        Renders you generated from the catalogue — click any image for full
        size.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {outfits.map((o) => (
          <article
            key={o.id}
            className="overflow-hidden rounded-2xl border border-paper/12 bg-ink-soft/50"
          >
            <ReportZoomImage
              src={o.image}
              alt={
                o.kind === "outfit"
                  ? `Outfit try-on with ${o.garments.length} pieces`
                  : `Try-on: ${o.garments[0]?.title ?? "item"}`
              }
              className="aspect-[3/4] w-full object-cover object-top"
              wrapperClassName="block w-full"
            />
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-paper/40">
                  {o.kind === "outfit"
                    ? `Outfit · ${o.garments.length} pieces`
                    : "Single item"}
                </span>
                <time
                  dateTime={o.createdAt}
                  className="text-[11px] text-paper/35"
                >
                  {formatWhen(o.createdAt)}
                </time>
              </div>
              <ul className="mt-3 space-y-2">
                {o.garments.map((g) => (
                  <li
                    key={g.productId}
                    className="flex items-start gap-2.5 text-sm text-paper/70"
                  >
                    {g.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.imageUrl}
                        alt=""
                        className="mt-0.5 h-10 w-8 shrink-0 rounded border border-paper/10 object-cover"
                      />
                    ) : (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brass-soft/60" />
                    )}
                    <span>
                      <span className="text-paper/90">{g.title}</span>
                      <span className="block text-[11px] text-paper/40">
                        {g.category}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

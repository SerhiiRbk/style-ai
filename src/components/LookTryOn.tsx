"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { ReportZoomImage } from "./ReportZoomImage";
import { useCredits } from "./CreditsContext";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";
import { WORKING } from "@/components/luxe/messages";

/**
 * Renders an entire outfit on the signed-in user's own photo via the image
 * model. Uses catalogue picks from “Shop a look like this” when lookIndex is set.
 */
export function LookTryOn({
  reportId,
  title,
  description,
  palette = [],
  pieces = [],
  outfitReferenceUrl,
  lookIndex,
  kind = "look",
  label,
  regenLabel,
  cost = 1,
}: {
  reportId: string;
  title: string;
  description: string;
  palette?: string[];
  /** Capsule combo piece titles — used to resolve catalogue garments. */
  pieces?: string[];
  /** Pre-rendered capsule outfit image — clothing reference for try-on. */
  outfitReferenceUrl?: string;
  /** Index into report.looks / look_items (main looks only). */
  lookIndex?: number;
  kind?: "look" | "capsule";
  label?: string;
  /** Button label after the first render (defaults differ for looks vs capsule mixes). */
  regenLabel?: string;
  /** Credit cost per render (try-on and re-render are both 1). */
  cost?: number;
}) {
  const isCapsule = kind === "capsule";
  const actionLabelDefault = isCapsule
    ? "Try this mix on me"
    : "Try this look on me";
  const regenLabelDefault = isCapsule ? "Try another mix" : "Render again";
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ reportId, kind });
    if (typeof lookIndex === "number") {
      query.set("lookIndex", String(lookIndex));
    } else {
      query.set("title", title);
    }
    void (async () => {
      try {
        const res = await fetch(`/api/tryon/look?${query}`);
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (data.url && !cancelled) {
          startTransition(() => {
            setUrl(data.url);
            setState("done");
          });
        }
      } catch {
        /* ignore — user can generate fresh */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId, kind, lookIndex, title]);

  async function run() {
    if (insufficient) return;
    const regen = state === "done";
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/tryon/look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          title,
          description,
          palette,
          pieces: kind === "capsule" ? pieces : undefined,
          outfitReferenceUrl:
            kind === "capsule" ? outfitReferenceUrl : undefined,
          lookIndex,
          kind,
          regen,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState(url ? "done" : "error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Try-on unavailable");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setUrl(data.url);
      setState("done");
    } catch {
      setState(url ? "done" : "error");
      setMsg("Try-on failed");
    }
  }

  const actionLabel =
    state === "done"
      ? (regenLabel ?? regenLabelDefault)
      : (label ?? actionLabelDefault);

  const loadingMessage = url ? WORKING.regen : WORKING.tryon;
  const loadingDetail = isCapsule
    ? "We're dressing your photo in this capsule combination — the same mix of pieces shown above, styled on you."
    : "We're dressing your photo in this look — fabric, fit, and colours aligned with the outfit above.";

  return (
    <div aria-busy={state === "loading"}>
      <button
        onClick={run}
        disabled={state === "loading" || insufficient}
        title={
          insufficient
            ? "Not enough credits — top up to render"
            : undefined
        }
        className="inline-flex min-h-[2.25rem] items-center rounded-full border border-brass/30 bg-brass/5 px-4 py-2 text-sm text-brass transition-colors hover:border-brass/50 hover:bg-brass/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "loading" ? (
          <LuxeWorkingLabel message={loadingMessage} tone="brass" />
        ) : (
          <>
            {actionLabel}
            <span className="text-stone-soft">
              {" "}
              · {cost} credit{cost === 1 ? "" : "s"} →
            </span>
          </>
        )}
      </button>
      {creditsApply && (
        <p className="mt-1 text-[11px] text-stone-soft">
          {insufficient ? (
            <>
              Not enough credits ({balance} left).{" "}
              <Link href="/pricing" className="text-brass hover:text-ink">
                Buy credits
              </Link>
            </>
          ) : (
            <>Balance: {balance} credits</>
          )}
        </p>
      )}
      {msg && <p className="mt-1 text-xs text-stone-soft">{msg}</p>}
      {state === "loading" && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 overflow-hidden rounded-xl border hairline bg-gradient-to-br from-cream/80 via-paper to-brass/5"
        >
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <LuxeSpinner size="lg" tone="brass" />
            <p className="mt-4 font-display text-lg text-ink">{loadingMessage}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone">
              {loadingDetail}
            </p>
            <p className="mt-3 text-xs text-stone-soft">
              Usually 30–90 seconds · stay on this page
            </p>
          </div>
        </div>
      )}
      {url && state !== "loading" && (
        <div className="mt-3 overflow-hidden rounded-xl border hairline">
          <ReportZoomImage
            src={url}
            alt={`${title} on you`}
            className="w-full"
            wrapperClassName="block w-full"
          />
        </div>
      )}
    </div>
  );
}

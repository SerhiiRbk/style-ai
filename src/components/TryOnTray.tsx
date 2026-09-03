"use client";

import Link from "next/link";
import { useState } from "react";
import { MAX_TRYON_ITEMS, useTryOnSelection } from "./TryOnContext";
import { OUTFIT_TRYON_SAVED_EVENT } from "./SavedOutfitTryOns";
import { ReportZoomImage } from "./ReportZoomImage";
import { DownloadIconButton } from "./DownloadIconButton";
import { ShareImageButton } from "./ShareImageButton";
import { useCredits } from "./CreditsContext";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";
import { WORKING } from "@/components/luxe/messages";
import type { TryOnOpinion, TryOnVerdict } from "@/lib/ai/tryon-opinion";
import {
  TryOnStyleToggle,
  type CatalogTryOnStyle,
} from "./TryOnStyleToggle";
import { useCompleteLook } from "./CompleteLookContext";
import { EXTRA_LOOK_CONTEXTS } from "@/lib/look-contexts";
import { MAX_COMPLETE_LOOK_ANCHORS } from "@/lib/complete-look";
import { CREDIT_COSTS } from "@/lib/credit-costs";

const VERDICT_STYLE: Record<TryOnVerdict, { dot: string; label: string }> = {
  great: { dot: "bg-emerald-400", label: "Strong match" },
  good: { dot: "bg-brass", label: "Works for you" },
  caution: { dot: "bg-amber-400", label: "Wearable, with a caveat" },
};

/**
 * Floating tray for the combined catalog try-on: shows the selected pieces
 * (up to 6) and renders them together on the user's photo in one credit.
 */
export function TryOnTray({
  reportId,
  cost = 1,
  variant = "report",
}: {
  reportId?: string;
  cost?: number;
  /** Catalog try-ons omit reportId and skip the saved-to-report hint. */
  variant?: "report" | "catalog";
}) {
  const selection = useTryOnSelection();
  const completeLook = useCompleteLook();
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [opinion, setOpinion] = useState<TryOnOpinion | null>(null);
  const [opinionState, setOpinionState] = useState<
    "idle" | "loading" | "done"
  >("idle");
  const [opinionNoProfile, setOpinionNoProfile] = useState(false);
  const [tryOnStyle, setTryOnStyle] = useState<CatalogTryOnStyle>("photo");

  if (!selection || selection.items.length === 0) return null;
  const { items } = selection;

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;

  async function run() {
    if (insufficient || !selection) return;
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: selection.items.map((i) => i.productId),
          reportId,
          style: tryOnStyle,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!res.ok || !data.url) {
        setState("error");
        if (res.status === 401) {
          setMsg("Sign in to try on — open Log in from the menu.");
        } else {
          setMsg(data.error ?? "Try-on failed");
        }
        return;
      }
      setUrl(data.url);
      setState("done");
      if (data.savedToReport) {
        window.dispatchEvent(new CustomEvent(OUTFIT_TRYON_SAVED_EVENT));
      }
      void fetchOpinion(
        selection.items.map((i) => i.productId),
        typeof data.tryonId === "string" ? data.tryonId : undefined,
      );
    } catch {
      setState("error");
      setMsg("Try-on failed");
    }
  }

  /** Carlo's expert read — fetched after the image so it never blocks the preview. */
  async function fetchOpinion(productIds: string[], tryonId?: string) {
    setOpinion(null);
    setOpinionNoProfile(false);
    setOpinionState("loading");
    try {
      const res = await fetch("/api/tryon/opinion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, reportId, tryonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.opinion) {
        setOpinion(data.opinion as TryOnOpinion);
        setOpinionNoProfile(data.hasProfile === false);
      }
    } catch {
      /* opinion is best-effort — the try-on image already renders */
    } finally {
      setOpinionState("done");
    }
  }

  const busy = state === "loading" || Boolean(completeLook?.loading);
  const tooManyForComplete =
    items.length > MAX_COMPLETE_LOOK_ANCHORS && variant === "catalog";

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem]">
      <div className="max-h-[min(36rem,calc(100dvh-1.5rem))] overflow-y-auto rounded-2xl border hairline bg-paper p-4 shadow-[0_24px_56px_-24px_rgba(21,18,13,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-brass">
              Your selection · {items.length}/{MAX_TRYON_ITEMS}
            </p>
            <p className="mt-0.5 text-xs text-stone">
              Tap × to remove a piece.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              selection.clear();
              setUrl(null);
              setMsg(null);
              setState("idle");
              setOpinion(null);
              setOpinionState("idle");
              setOpinionNoProfile(false);
            }}
            className="shrink-0 text-xs text-stone-soft transition-colors hover:text-ink"
          >
            Clear
          </button>
        </div>

        <ul className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
          {items.map((item) => (
            <li key={item.productId} className="relative w-16 shrink-0">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={item.title}
                  title={item.title}
                  className="h-20 w-16 rounded-lg border hairline object-cover"
                />
              ) : (
                <div
                  title={item.title}
                  className="flex h-20 w-16 items-center justify-center rounded-lg border hairline bg-cream px-1 text-center text-[9px] leading-tight text-stone"
                >
                  {item.title.slice(0, 18)}
                </div>
              )}
              <button
                type="button"
                onClick={() => selection.remove(item.productId)}
                aria-label={`Remove ${item.title}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border hairline bg-paper text-[11px] leading-none text-ink shadow-sm"
              >
                ×
              </button>
              <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-ink">
                {item.title}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <TryOnStyleToggle
            value={tryOnStyle}
            onChange={setTryOnStyle}
            disabled={busy}
            tone="light"
          />
        </div>

        {variant === "catalog" && completeLook ? (
          <div className="mt-4 rounded-xl border hairline bg-cream/50 p-3">
            <p className="text-[11px] uppercase tracking-wider text-brass">
              Complete the look
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone">
              {tooManyForComplete
                ? `Keep ${MAX_COMPLETE_LOOK_ANCHORS} pieces — we fill the rest and render the outfit.`
                : `We fill the missing pieces and render the outfit on you · ${CREDIT_COSTS.complete_look} credit.`}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {EXTRA_LOOK_CONTEXTS.map((ctx) => {
                const active = completeLook.occasionId === ctx.id;
                return (
                  <button
                    key={ctx.id}
                    type="button"
                    onClick={() => completeLook.setOccasionId(ctx.id)}
                    disabled={completeLook.loading}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? "border-brass/40 bg-brass/15 text-ink"
                        : "hairline text-stone hover:border-ink/20 hover:text-ink"
                    }`}
                  >
                    {ctx.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() =>
                void completeLook.complete(
                  items.map((i) => i.productId),
                  { style: tryOnStyle },
                )
              }
              disabled={
                completeLook.loading ||
                insufficient ||
                items.length < 1 ||
                tooManyForComplete
              }
              className="mt-3 inline-flex min-h-[2.25rem] w-full items-center justify-center rounded-full bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {completeLook.loading ? (
                <LuxeWorkingLabel message={WORKING.outfit} tone="paper" />
              ) : tooManyForComplete ? (
                `Deselect to ${MAX_COMPLETE_LOOK_ANCHORS} pieces`
              ) : insufficient ? (
                "Not enough credits"
              ) : (
                `Complete the look · ${CREDIT_COSTS.complete_look} credit`
              )}
            </button>
            {completeLook.error ? (
              <p className="mt-2 text-xs text-stone">{completeLook.error}</p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={run}
          disabled={busy || insufficient}
          className="mt-3 inline-flex min-h-[2.25rem] w-full items-center justify-center rounded-full border hairline bg-paper px-4 py-2 text-sm text-ink transition-colors hover:border-brass/50 hover:text-brass disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "loading" ? (
            <LuxeWorkingLabel message={WORKING.outfit} tone="ink" />
          ) : state === "done" ? (
            `Render these again · ${cost} credit`
          ) : (
            `Try ${items.length === 1 ? "this piece" : `these ${items.length}`} on me · ${cost} credit`
          )}
        </button>

        {creditsApply && insufficient && (
          <p className="mt-2 text-xs text-stone">
            Not enough credits ({balance} left).{" "}
            <Link href="/pricing" className="text-brass hover:text-ink">
              Buy credits
            </Link>
          </p>
        )}
        {msg && <p className="mt-2 text-xs text-stone">{msg}</p>}
        {state === "done" && reportId && (
          <p className="mt-2 text-xs text-stone">Saved to your report below.</p>
        )}
        {state === "done" && variant === "catalog" && (
          <p className="mt-2 text-xs text-stone">
            Preview only — not linked to a report.
          </p>
        )}

        {url && (
          <div className="mt-3">
            <div className="group/dl relative mx-auto w-fit">
              <ReportZoomImage
                src={`${url}&orig=1`}
                alt="Combined outfit try-on"
                className="block max-h-80 w-auto rounded-xl border hairline"
                wrapperClassName="block"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover/dl:opacity-100">
                <DownloadIconButton href={`${url}&dl=1`} />
                <ShareImageButton src={url} title="My Valetti try-on" />
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-stone-soft">
              Tap image for full size
            </p>
          </div>
        )}

        {state === "done" && opinionState === "loading" && (
          <p className="mt-3 text-xs text-stone">
            <LuxeWorkingLabel message="Carlo is taking a look…" tone="ink" />
          </p>
        )}

        {state === "done" && opinion && (
          <div className="mt-3 rounded-xl border hairline bg-cream/40 p-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${VERDICT_STYLE[opinion.verdict].dot}`}
                aria-hidden
              />
              <span className="text-[10px] uppercase tracking-wider text-brass">
                Carlo · {VERDICT_STYLE[opinion.verdict].label}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-snug text-ink">
              {opinion.headline}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone">
              {opinion.body}
            </p>
            {opinion.pairWith.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-wider text-stone-soft">
                  Pair with
                </p>
                <ul className="mt-1 space-y-0.5">
                  {opinion.pairWith.map((p, i) => (
                    <li key={i} className="text-xs leading-snug text-stone">
                      · {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {opinionNoProfile && (
              <p className="mt-2 border-t hairline pt-2 text-xs text-stone">
                General guidance —{" "}
                <Link
                  href="/start"
                  className="text-brass underline-offset-2 hover:text-ink hover:underline"
                >
                  create your style report
                </Link>{" "}
                for advice tailored to your colouring and build.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

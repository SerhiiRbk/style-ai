"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { LookShopAndTryOn } from "@/components/LookShopAndTryOn";
import { LookConstructor } from "@/components/LookConstructor";
import { LookEstimate, LookEstimateBody } from "@/components/LookEstimate";
import { ReportImageGenerating } from "@/components/luxe/ReportImageGenerating";
import { useCredits } from "@/components/CreditsContext";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import type { ShoppingItem } from "@/lib/report";
import type { Currency } from "@/lib/currency";
import type { StoredLookEstimate } from "@/lib/look-estimate";

/**
 * One look in a set: image, constructor (owner), shop + try-on. Keeps local
 * image/description/items in sync after an Apply so the card doesn't wait on
 * a full page refresh — and so a stale try-on for the previous outfit is cleared.
 */
export function LookSetCard({
  setId,
  lookIndex,
  occasionId,
  title: initialTitle,
  description: initialDescription,
  palette: initialPalette,
  imageSrc: initialImage,
  imageTqSrc: initialImageTq,
  items: initialItems,
  isOwner,
  canRevert: canRevertInitial = false,
  initialEstimate = null,
  currency = "EUR",
}: {
  setId: string;
  lookIndex: number;
  occasionId?: string | null;
  title: string;
  description: string;
  palette: string[];
  imageSrc: string;
  imageTqSrc?: string | null;
  items: ShoppingItem[];
  isOwner: boolean;
  /** True when this look was rebuilt and Carlo's original is stored. */
  canRevert?: boolean;
  initialEstimate?: StoredLookEstimate | null;
  currency?: Currency;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [palette, setPalette] = useState(initialPalette);
  const [imageSrc, setImageSrc] = useState(initialImage);
  const [imageTqSrc, setImageTqSrc] = useState<string | null>(
    initialImageTq ?? null,
  );
  const [view, setView] = useState<"front" | "tq">("front");
  const [items, setItems] = useState(initialItems);
  const [applying, setApplying] = useState(false);
  const [tqBusy, setTqBusy] = useState(false);
  const [tqMsg, setTqMsg] = useState<string | null>(null);
  const [tryOnReset, setTryOnReset] = useState<string | undefined>();
  const [canRevert, setCanRevert] = useState(canRevertInitial);
  const [estimate, setEstimate] = useState<StoredLookEstimate | null>(
    initialEstimate,
  );
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertMsg, setRevertMsg] = useState<string | null>(null);
  const { balance, setBalance } = useCredits();
  const tqCost = CREDIT_COSTS.look_three_quarter;
  const tqInsufficient = balance !== null && balance < tqCost;
  const shownSrc = view === "tq" && imageTqSrc ? imageTqSrc : imageSrc;
  const busy = applying || tqBusy || reverting;
  const showEstimate = isOwner && (canRevert || Boolean(estimate?.opinion));

  useEffect(() => {
    if (!isOwner || !canRevert || estimate?.opinion) return;
    let cancelled = false;
    setEstimateLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/look-set/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setId, lookIndex }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !data.opinion) return;
        setEstimate({
          opinion: data.opinion,
          fingerprint: "",
          savedAt: new Date().toISOString(),
        });
      } catch {
        /* keep the Estimate control visible */
      } finally {
        if (!cancelled) setEstimateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, canRevert, estimate?.opinion, setId, lookIndex]);

  async function revertToOriginal() {
    if (!isOwner || !canRevert || busy) return;
    setReverting(true);
    setRevertMsg(null);
    try {
      const res = await fetch("/api/look-set/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, lookIndex }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRevertMsg(data.error ?? "Could not restore Carlo's look");
        return;
      }
      setTitle(data.title ?? title);
      setDescription(data.description ?? "");
      setPalette(Array.isArray(data.palette) ? data.palette : []);
      if (typeof data.image === "string") setImageSrc(data.image);
      setImageTqSrc(typeof data.imageTq === "string" ? data.imageTq : null);
      setView("front");
      setItems(Array.isArray(data.items) ? data.items : []);
      setTryOnReset(typeof data.image === "string" ? data.image : "revert");
      setCanRevert(false);
      setEstimate(null);
    } catch {
      setRevertMsg("Could not restore Carlo's look");
    } finally {
      setReverting(false);
    }
  }

  async function generateThreeQuarter() {
    if (!isOwner || imageTqSrc || tqBusy || applying || tqInsufficient) return;
    setTqBusy(true);
    setTqMsg(null);
    try {
      const res = await fetch("/api/look-set/three-quarter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, lookIndex }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!res.ok) {
        setTqMsg(data.error ?? "Could not generate 3/4 view");
        return;
      }
      if (typeof data.imageTq === "string" && data.imageTq) {
        setImageTqSrc(data.imageTq);
        setView("tq");
      }
    } catch {
      setTqMsg("Could not generate 3/4 view");
    } finally {
      setTqBusy(false);
    }
  }

  return (
    <article className="flex flex-col">
      {busy ? (
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border hairline bg-cream/40">
          <ReportImageGenerating
            label={
              title ||
              (reverting ? "Restoring look" : tqBusy ? "3/4 view" : "Redrawing look")
            }
            detail={
              reverting
                ? "Putting Carlo's original look back"
                : tqBusy
                  ? "Turning this look to a three-quarter angle"
                  : "Applying the new pieces and getting Carlo's estimate"
            }
          />
        </div>
      ) : (
        <div className="group relative">
          <ReportZoomImage
            src={shownSrc}
            alt={
              view === "tq"
                ? `${title || "Look"} · 3/4`
                : title || "Look"
            }
            wrapperClassName="relative block aspect-[9/16] w-full overflow-hidden rounded-2xl border hairline"
            className="h-full w-full object-cover"
          />
          {showEstimate ? (
            estimate?.opinion ? (
              <LookEstimate opinion={estimate.opinion} />
            ) : (
              <div className="absolute top-3 left-3 z-20">
                <span className="inline-flex h-10 items-center rounded-full border border-paper/40 bg-ink/70 px-3 text-xs font-medium text-paper shadow-sm backdrop-blur-sm">
                  {estimateLoading ? "Estimate…" : "Estimate"}
                </span>
              </div>
            )
          ) : null}
          {imageTqSrc ? (
            <button
              type="button"
              onClick={() => setView((v) => (v === "front" ? "tq" : "front"))}
              aria-label={
                view === "front" ? "Show 3/4 view" : "Show front view"
              }
              title={view === "front" ? "3/4 view" : "Front view"}
              className="absolute bottom-3 right-3 z-10 inline-flex h-10 items-center gap-1.5 rounded-full border border-paper/30 bg-ink/55 px-3 text-xs text-paper backdrop-blur-sm transition-colors hover:bg-ink/75"
            >
              <LookAngleGlyph turned={view === "front"} />
              <span>{view === "front" ? "3/4" : "Front"}</span>
            </button>
          ) : null}
        </div>
      )}
      {title ? (
        <h2 className="mt-3 font-display text-lg text-ink">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-1 text-sm text-stone">{description}</p>
      ) : null}
      {showEstimate ? (
        <details
          className="mt-3 rounded-2xl border hairline bg-cream/40 p-4"
          open={Boolean(estimate?.opinion)}
        >
          <summary className="cursor-pointer text-sm font-medium text-ink">
            Estimate
          </summary>
          <div className="mt-3">
            {estimate?.opinion ? (
              <LookEstimateBody opinion={estimate.opinion} />
            ) : (
              <p className="text-sm text-stone">
                {estimateLoading
                  ? "Carlo is reading this look…"
                  : "Carlo's estimate will appear here."}
              </p>
            )}
          </div>
        </details>
      ) : null}
      {palette.length ? (
        <div className="mt-3 flex gap-1.5">
          {palette.map((hex, k) => (
            <span
              key={`${hex}-${k}`}
              title={hex}
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      ) : null}
      {isOwner && !imageTqSrc ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void generateThreeQuarter()}
            disabled={busy || tqInsufficient}
            title={
              tqInsufficient
                ? "Not enough credits — top up to generate 3/4"
                : "Generate a 3/4 view of this look"
            }
            className="inline-flex min-h-[2.25rem] items-center rounded-full border border-line px-4 py-2 text-sm text-stone transition-colors hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generate 3/4 view
            <span className="text-stone-soft"> · {tqCost} credit</span>
          </button>
          {balance !== null ? (
            <p className="mt-1 text-[11px] text-stone-soft">
              {tqInsufficient ? (
                <>
                  Not enough credits ({balance} left).{" "}
                  <Link href="/pricing" className="text-brass hover:text-ink">
                    Buy credits
                  </Link>
                </>
              ) : (
                <>Adds a side angle of this look · {balance} credits left</>
              )}
            </p>
          ) : null}
          {tqMsg ? <p className="mt-1 text-xs text-stone-soft">{tqMsg}</p> : null}
        </div>
      ) : null}
      {isOwner ? (
        <LookConstructor
          key={description}
          setId={setId}
          lookIndex={lookIndex}
          occasionId={occasionId}
          title={title}
          description={description}
          disabled={busy}
          onApplyingChange={setApplying}
          onApplied={(look) => {
            setTitle(look.title);
            setDescription(look.description);
            setPalette(look.palette);
            setImageSrc(look.image);
            setImageTqSrc(look.imageTq ?? null);
            setView("front");
            setItems(look.items);
            setTryOnReset(look.image);
            setTqMsg(null);
            setCanRevert(true);
            setEstimate(look.estimate ?? null);
          }}
        />
      ) : null}
      {isOwner && canRevert ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void revertToOriginal()}
            disabled={busy}
            className="inline-flex min-h-[2.25rem] items-center rounded-full border border-line px-4 py-2 text-sm text-stone transition-colors hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Restore Carlo&apos;s look
          </button>
          <p className="mt-1 text-[11px] text-stone-soft">
            Puts back the brief, image and shop from before the constructor.
          </p>
          {revertMsg ? <p className="mt-1 text-xs text-stone-soft">{revertMsg}</p> : null}
        </div>
      ) : null}
      <LookShopAndTryOn
        key={`${lookIndex}-${description}`}
        items={items}
        currency={currency}
        canTryOn={isOwner}
        setId={isOwner ? setId : undefined}
        title={title}
        description={description}
        palette={palette}
        lookIndex={lookIndex}
        resetStoredTryOn={Boolean(tryOnReset)}
      />
    </article>
  );
}

function LookAngleGlyph({ turned }: { turned: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      {turned ? (
        <path d="M8 4.5h7.2L18.5 19.5H10.2L8 4.5z" />
      ) : (
        <rect x="7" y="4.5" width="10" height="15" rx="1" />
      )}
    </svg>
  );
}

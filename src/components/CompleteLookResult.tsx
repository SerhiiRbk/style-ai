"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LookShopChips } from "@/components/LookShopChips";
import { LookEstimate, LookEstimateBody } from "@/components/LookEstimate";
import { TryOnStyleToggle, type CatalogTryOnStyle } from "@/components/TryOnStyleToggle";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";
import { WORKING } from "@/components/luxe/messages";
import { useCredits } from "@/components/CreditsContext";
import { useDisplayCurrency } from "@/components/CatalogDisplayCurrency";
import { useCompleteLook } from "@/components/CompleteLookContext";
import { lookItemKey } from "@/lib/look-item-alts";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { lookContextById } from "@/lib/look-contexts";

export function CompleteLookResult() {
  const complete = useCompleteLook();
  const currency = useDisplayCurrency();
  const { balance, setBalance } = useCredits();
  const [tryOnStyle, setTryOnStyle] = useState<CatalogTryOnStyle>("studio");
  const [tryState, setTryState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [tryUrl, setTryUrl] = useState<string | null>(null);
  const [tryMsg, setTryMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [prevRunId, setPrevRunId] = useState<string | undefined>(undefined);
  const panelRef = useRef<HTMLElement>(null);

  const result = complete?.result;
  const runId = result?.runId;
  if (runId !== prevRunId) {
    setPrevRunId(runId);
    setSelected(null);
    setTryUrl(result?.tryOnUrl ?? null);
    setTryMsg(result?.tryOnError ?? null);
    setTryState(
      result?.tryOnUrl ? "done" : result?.tryOnError ? "error" : "idle",
    );
    if (result?.tryOnStyle) setTryOnStyle(result.tryOnStyle);
  }
  const items = result?.items ?? [];
  const locked = useMemo(
    () => new Set(result?.lockedProductIds ?? []),
    [result?.lockedProductIds],
  );
  const selectedIds = selected ?? new Set(items.map((i) => lookItemKey(i)));
  const cost = CREDIT_COSTS.tryon;
  const insufficient = balance !== null && balance < cost;
  const tryIds = items
    .filter((i) => selectedIds.has(lookItemKey(i)) && i.productId)
    .map((i) => i.productId as string);

  useEffect(() => {
    if (!runId) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [runId]);

  if (!complete || !result) return null;
  const occasion = lookContextById(result.occasionId)?.label ?? "Look";

  async function runTryOn() {
    if (!tryIds.length || insufficient) return;
    setTryState("loading");
    setTryMsg(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: tryIds,
          style: tryOnStyle,
          origin: "catalog",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!res.ok || !data.url) {
        setTryState("error");
        setTryMsg(data.error ?? "Try-on failed");
        return;
      }
      setTryUrl(data.url);
      setTryState("done");
    } catch {
      setTryState("error");
      setTryMsg("Try-on failed");
    }
  }

  return (
    <section
      ref={panelRef}
      className="mt-6 rounded-2xl border hairline bg-paper p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-brass">
            Complete the look · {occasion}
          </p>
          <h2 className="mt-1 font-display text-xl text-ink">{result.title}</h2>
          {result.description ? (
            <p className="mt-1 max-w-xl text-sm text-stone">{result.description}</p>
          ) : null}
          {!result.personalised ? (
            <p className="mt-2 text-xs text-stone-soft">
              General matching.{" "}
              <Link href="/start" className="text-brass hover:text-ink">
                Create a style report
              </Link>{" "}
              to tune this to your colours.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={complete.clear}
          className="text-xs text-stone-soft transition-colors hover:text-ink"
        >
          Clear look
        </button>
      </div>

      {result.palette.length ? (
        <div className="mt-3 flex gap-1.5">
          {result.palette.map((hex) => (
            <span
              key={hex}
              title={hex}
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      ) : null}

      <LookShopChips
        items={items}
        currency={currency}
        selectable
        selectedIds={selectedIds}
        onToggle={(id) => {
          setSelected((prev) => {
            const next = new Set(prev ?? items.map((i) => lookItemKey(i)));
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        swappable
        lockedIds={locked}
        onNeedAlternatives={async (item) => item.alternatives ?? []}
        onChooseAlternative={(fromId, alt) => complete.replaceItem(fromId, alt)}
      />

      {result.estimate || complete.estimateLoading ? (
        <details className="mt-4 rounded-2xl border hairline bg-cream/40 p-4" open>
          <summary className="cursor-pointer text-sm font-medium text-ink">
            Estimate
          </summary>
          <div className="mt-3">
            {result.estimate ? (
              <LookEstimateBody opinion={result.estimate} />
            ) : (
              <p className="text-sm text-stone-soft">Carlo is reading the look…</p>
            )}
          </div>
        </details>
      ) : null}

      <div className="mt-4">
        <TryOnStyleToggle
          value={tryOnStyle}
          onChange={setTryOnStyle}
          disabled={tryState === "loading"}
        />
        <button
          type="button"
          onClick={() => void runTryOn()}
          disabled={tryState === "loading" || insufficient || tryIds.length === 0}
          className="mt-3 inline-flex min-h-[2.25rem] items-center rounded-full bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {tryState === "loading" ? (
            <LuxeWorkingLabel message={WORKING.outfit} tone="paper" />
          ) : tryState === "done" ? (
            `Render again · ${cost} credit`
          ) : (
            `Try this look on me · ${cost} credit`
          )}
        </button>
        {insufficient ? (
          <p className="mt-2 text-xs text-stone-soft">
            Not enough credits.{" "}
            <Link href="/pricing" className="text-brass hover:text-ink">
              Buy credits
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-xs text-stone-soft">
            Complete the look includes this render. Another pass uses {cost}{" "}
            credit
            {balance != null ? ` · ${balance} left` : ""}.
          </p>
        )}
        {tryMsg ? <p className="mt-2 text-xs text-stone-soft">{tryMsg}</p> : null}
      </div>

      {tryUrl ? (
        <div className="relative mt-4 max-w-sm">
          {result.estimate ? <LookEstimate opinion={result.estimate} /> : null}
          <ReportZoomImage
            src={`${tryUrl}&orig=1`}
            alt={result.title}
            wrapperClassName="relative block aspect-[9/16] w-full overflow-hidden rounded-2xl border hairline"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
    </section>
  );
}

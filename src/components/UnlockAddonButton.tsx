"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "./CreditsContext";

export type UnlockOption = {
  /** Number of previews to generate now (base*2 = full set). Omit for the base set. */
  count?: number;
  cost: number;
  label: string;
};

/**
 * One-time paid "unlock" of a preview set (facial hair / eyewear / accessories /
 * headwear) on a non-premium report. Offers one or more options (e.g. generate 2
 * or generate 4) and charges the matching price. The server only renders this
 * control when the set hasn't been generated yet, so it disappears after unlock.
 */
export function UnlockAddonButton({
  reportId,
  type,
  options,
  included = false,
}: {
  reportId: string;
  type: "accessories" | "headwear" | "facial_hair" | "eyewear";
  options: UnlockOption[];
  /** When true the preview is already covered (Premium) — no credit charge. */
  included?: boolean;
}) {
  const router = useRouter();
  const { balance, setBalance } = useCredits();
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const creditsApply = balance !== null && !included;
  const cheapest = Math.min(...options.map((o) => o.cost));
  const insufficientAll = creditsApply && (balance ?? 0) < cheapest;

  async function run(opt: UnlockOption, idx: number) {
    const insufficient = creditsApply && (balance ?? 0) < opt.cost;
    if (insufficient || loadingIdx !== null) return;
    setLoadingIdx(idx);
    setMsg(null);
    try {
      const res = await fetch("/api/report-extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, type, count: opt.count }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadingIdx(null);
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Could not generate");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setLoadingIdx(null);
      router.refresh();
    } catch {
      setLoadingIdx(null);
      setMsg("Could not generate");
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        {options.map((opt, i) => {
          const insufficient = creditsApply && (balance ?? 0) < opt.cost;
          const primary = i === 0;
          return (
            <button
              key={`${opt.label}-${opt.cost}`}
              onClick={() => run(opt, i)}
              disabled={loadingIdx !== null || insufficient}
              title={
                insufficient
                  ? "Not enough credits — top up to generate"
                  : undefined
              }
              className={
                primary
                  ? "rounded-full bg-ink px-5 py-2 text-sm text-cream transition-colors hover:bg-ink/90 disabled:opacity-50"
                  : "rounded-full border border-ink/25 px-5 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
              }
            >
              {loadingIdx === i
                ? "Generating… this can take a minute"
                : included
                  ? `${opt.label} · included`
                  : `${opt.label} · ${opt.cost} credits`}
            </button>
          );
        })}
      </div>
      {creditsApply ? (
        <p className="mt-2 text-[11px] text-stone-soft">
          {insufficientAll ? (
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
      ) : null}
      {msg ? <p className="mt-2 text-xs text-stone-soft">{msg}</p> : null}
    </div>
  );
}

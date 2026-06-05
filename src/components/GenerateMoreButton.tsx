"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "./CreditsContext";

/**
 * One-time paid "generate more" control for a premium report's facial-hair,
 * eyewear or accessory previews. Hidden once the extra batch is bought (count
 * moves past the base) or while the base previews are still generating
 * (count below the base). On success it refreshes the server-rendered grid.
 */
export function GenerateMoreButton({
  reportId,
  type,
  cost,
  count,
  baseCount,
  label,
}: {
  reportId: string;
  type: "accessories" | "facial_hair" | "eyewear";
  cost: number;
  /** Number of previews already generated WITH an image. */
  count: number;
  /** Base preview count included by default. */
  baseCount: number;
  label: string;
}) {
  const router = useRouter();
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  // Only offer the add-on when exactly the base set is ready (not before, not
  // after a purchase).
  if (count !== baseCount) return null;

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;

  async function run() {
    if (insufficient) return;
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/report-extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Could not generate");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
      setMsg("Could not generate");
    }
  }

  return (
    <div className="mt-5">
      <button
        onClick={run}
        disabled={state === "loading" || insufficient}
        title={insufficient ? "Not enough credits — top up to generate" : undefined}
        className="rounded-full border border-brass/40 bg-brass/5 px-5 py-2 text-sm text-ink transition-colors hover:bg-brass/10 disabled:opacity-50"
      >
        {state === "loading" ? "Generating…" : `${label} · ${cost} credits`}
      </button>
      {creditsApply ? (
        <p className="mt-2 text-[11px] text-stone-soft">
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
      ) : null}
      {msg ? <p className="mt-2 text-xs text-stone-soft">{msg}</p> : null}
    </div>
  );
}

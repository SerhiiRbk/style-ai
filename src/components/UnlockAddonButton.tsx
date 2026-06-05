"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "./CreditsContext";

/**
 * One-time paid "unlock" of a preview set (facial hair / eyewear / accessories)
 * on a non-premium report. Generates the full base set on the user's photo and
 * charges the per-type unlock price. The server only renders this control when
 * the set hasn't been generated yet, so it disappears after a successful unlock.
 */
export function UnlockAddonButton({
  reportId,
  type,
  cost,
  label,
}: {
  reportId: string;
  type: "accessories" | "facial_hair" | "eyewear";
  cost: number;
  label: string;
}) {
  const router = useRouter();
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

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
    <div className="mt-4">
      <button
        onClick={run}
        disabled={state === "loading" || insufficient}
        title={insufficient ? "Not enough credits — top up to generate" : undefined}
        className="rounded-full bg-ink px-5 py-2 text-sm text-cream transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        {state === "loading"
          ? "Generating… this can take a minute"
          : `${label} · ${cost} credits`}
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

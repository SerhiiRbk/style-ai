"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "./CreditsContext";

/**
 * Owner-only control to re-generate the report's bespoke editorial cover photo
 * for a credit. Overlays the header hero; refreshes the server-rendered page on
 * success so the new cover (and PDF) pick up immediately.
 */
export function RegenerateCoverButton({
  reportId,
  cost,
}: {
  reportId: string;
  cost: number;
}) {
  const router = useRouter();
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;

  async function run() {
    if (state === "loading" || insufficient) return;
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/cover`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Could not regenerate the cover");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
      setMsg("Could not regenerate the cover");
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-1.5 p-3">
      {msg ? (
        <span className="max-w-full rounded-md bg-ink/80 px-2 py-1 text-[11px] text-paper backdrop-blur-sm">
          {msg}
          {insufficient ? (
            <>
              {" "}
              <Link href="/pricing" className="underline hover:text-brass-soft">
                Buy credits
              </Link>
            </>
          ) : null}
        </span>
      ) : null}
      <button
        type="button"
        onClick={run}
        disabled={state === "loading" || insufficient}
        title={
          insufficient
            ? "Not enough credits — top up to regenerate"
            : `Regenerate this cover for ${cost} credit`
        }
        className="inline-flex items-center gap-1.5 rounded-full border border-paper/25 bg-ink/60 px-3 py-1.5 text-[11px] text-paper/90 backdrop-blur-sm transition-colors hover:bg-ink/80 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path
            d="M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 16M4 20v-4h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {state === "loading"
          ? "Regenerating…"
          : `Regenerate cover · ${cost} credit`}
      </button>
    </div>
  );
}

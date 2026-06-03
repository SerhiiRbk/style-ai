"use client";

import Link from "next/link";
import { useState } from "react";
import { useCredits } from "./CreditsContext";

export function TryOnButton({
  productId,
  reportId,
  cost = 1,
}: {
  productId: string;
  reportId?: string;
  /** Credit cost per try-on. */
  cost?: number;
}) {
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;

  async function run() {
    if (insufficient) return;
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, reportId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Try-on unavailable");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setUrl(data.url);
      setState("done");
    } catch {
      setState("error");
      setMsg("Try-on failed");
    }
  }

  return (
    <div className="mt-3 border-t border-paper/10 pt-3">
      <button
        onClick={run}
        disabled={state === "loading" || insufficient}
        title={insufficient ? "Not enough credits — top up to try on" : undefined}
        className="text-xs text-brass-soft transition-colors hover:text-paper disabled:opacity-50"
      >
        {state === "loading" ? "Generating try-on…" : "Try this on"}
        {state !== "loading" && (
          <span className="text-paper/40">
            {" "}
            · {cost} credit{cost === 1 ? "" : "s"} →
          </span>
        )}
      </button>
      {creditsApply && insufficient && (
        <p className="mt-1 text-[11px] text-paper/40">
          Not enough credits ({balance} left).{" "}
          <Link href="/pricing" className="text-brass-soft hover:text-paper">
            Buy credits
          </Link>
        </p>
      )}
      {msg && <p className="mt-1 text-xs text-paper/40">{msg}</p>}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Virtual try-on preview"
          className="mt-2 w-full rounded-lg border border-paper/12"
        />
      )}
    </div>
  );
}

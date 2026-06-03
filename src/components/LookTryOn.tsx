"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useCredits } from "./CreditsContext";

/**
 * Renders an entire outfit on the signed-in user's own photo via the image
 * model. Uses catalogue picks from “Shop a look like this” when lookIndex is set.
 */
export function LookTryOn({
  reportId,
  title,
  description,
  palette = [],
  lookIndex,
  kind = "look",
  label = "Try this look on me",
  cost = 1,
}: {
  reportId: string;
  title: string;
  description: string;
  palette?: string[];
  /** Index into report.looks / look_items (main looks only). */
  lookIndex?: number;
  kind?: "look" | "capsule";
  label?: string;
  /** Credit cost per render (try-on and re-render are both 1). */
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
    state === "loading"
      ? "Rendering on you…"
      : state === "done"
        ? "Render again"
        : label;

  return (
    <div>
      <button
        onClick={run}
        disabled={state === "loading" || insufficient}
        title={
          insufficient
            ? "Not enough credits — top up to render"
            : undefined
        }
        className="text-sm text-brass transition-colors hover:text-ink disabled:opacity-50"
      >
        {actionLabel}
        {state !== "loading" && (
          <span className="text-stone-soft">
            {" "}
            · {cost} credit{cost === 1 ? "" : "s"} →
          </span>
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
      {url && (
        <div className="mt-3 overflow-hidden rounded-xl border hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${title} on you`} className="w-full" />
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { MAX_TRYON_ITEMS, useTryOnSelection } from "./TryOnContext";
import { ReportZoomImage } from "./ReportZoomImage";
import { useCredits } from "./CreditsContext";

/**
 * Floating tray for the combined catalog try-on: shows the selected pieces
 * (up to 4) and renders them together on the user's photo in one credit.
 */
export function TryOnTray({
  reportId,
  cost = 1,
}: {
  reportId?: string;
  cost?: number;
}) {
  const selection = useTryOnSelection();
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!res.ok || !data.url) {
        setState("error");
        setMsg(data.error ?? "Try-on failed");
        return;
      }
      setUrl(data.url);
      setState("done");
    } catch {
      setState("error");
      setMsg("Try-on failed");
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[400px]">
      <div className="rounded-2xl border border-paper/15 bg-ink/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-brass-soft">
            Outfit try-on · {items.length}/{MAX_TRYON_ITEMS}
          </p>
          <button
            type="button"
            onClick={() => {
              selection.clear();
              setUrl(null);
              setMsg(null);
              setState("idle");
            }}
            className="text-[11px] text-paper/40 transition-colors hover:text-paper"
          >
            Clear
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {items.map((item) => (
            <div key={item.productId} className="relative">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={item.title}
                  title={item.title}
                  className="h-14 w-11 rounded-md border border-paper/15 object-cover"
                />
              ) : (
                <div
                  title={item.title}
                  className="flex h-14 w-11 items-center justify-center rounded-md border border-paper/15 bg-ink-soft/60 px-1 text-center text-[8px] leading-tight text-paper/50"
                >
                  {item.title.slice(0, 18)}
                </div>
              )}
              <button
                type="button"
                onClick={() => selection.remove(item.productId)}
                aria-label={`Remove ${item.title}`}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-paper text-[10px] leading-none text-ink"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={run}
          disabled={state === "loading" || insufficient}
          className="mt-3 w-full rounded-full bg-brass px-4 py-2 text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state === "loading"
            ? "Rendering your outfit…"
            : state === "done"
              ? `Render again · ${cost} credit`
              : `Try ${items.length === 1 ? "it" : `${items.length} pieces`} on me · ${cost} credit`}
        </button>

        {creditsApply && insufficient && (
          <p className="mt-2 text-[11px] text-paper/40">
            Not enough credits ({balance} left).{" "}
            <Link href="/pricing" className="text-brass-soft hover:text-paper">
              Buy credits
            </Link>
          </p>
        )}
        {msg && <p className="mt-2 text-xs text-paper/45">{msg}</p>}

        {url && (
          <ReportZoomImage
            src={url}
            alt="Combined outfit try-on"
            className="max-h-72 w-full rounded-lg border border-paper/12 object-cover object-top"
            wrapperClassName="mt-3 block w-full"
          />
        )}
      </div>
    </div>
  );
}

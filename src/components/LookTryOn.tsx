"use client";

import { useState } from "react";

/**
 * Renders an entire outfit on the signed-in user's own photo via the image
 * model. Used under each look and each capsule "week of outfits" combination.
 */
export function LookTryOn({
  reportId,
  title,
  description,
  palette = [],
  label = "Try this look on me",
}: {
  reportId: string;
  title: string;
  description: string;
  palette?: string[];
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/tryon/look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, title, description, palette }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMsg(data.error ?? "Try-on unavailable");
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
    <div>
      <button
        onClick={run}
        disabled={state === "loading"}
        className="text-sm text-brass transition-colors hover:text-ink disabled:opacity-50"
      >
        {state === "loading"
          ? "Rendering on you…"
          : state === "done"
            ? "Render again →"
            : `${label} →`}
      </button>
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

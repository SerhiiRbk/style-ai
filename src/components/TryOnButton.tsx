"use client";

import { useState } from "react";

export function TryOnButton({ productId }: { productId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
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
    <div className="mt-3 border-t border-paper/10 pt-3">
      <button
        onClick={run}
        disabled={state === "loading"}
        className="text-xs text-brass-soft transition-colors hover:text-paper disabled:opacity-50"
      >
        {state === "loading" ? "Generating try-on…" : "Try this on →"}
      </button>
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

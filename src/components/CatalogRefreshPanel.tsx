"use client";

import { useEffect, useRef, useState } from "react";

type Source = {
  key: string;
  label: string;
  urlEnv: string;
  configured: boolean;
};

type SourceSummary = {
  source: string;
  valid: number;
  invalid: number;
  upserted: number;
  error?: string;
};

export function CatalogRefreshPanel({
  sources,
  hasAI,
}: {
  sources: Source[];
  hasAI: boolean;
}) {
  const [sourceKey, setSourceKey] = useState("");
  const [limit, setLimit] = useState("");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<SourceSummary[] | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const configured = sources.filter((s) => s.configured);
  const canRun = hasAI && configured.length > 0 && !running;

  useEffect(() => () => void (poll.current && clearInterval(poll.current)), []);

  function readStatus(status: unknown): {
    phase: string;
    output?: SourceSummary[];
  } {
    const s = (status ?? {}) as Record<string, unknown>;
    const phase =
      (s.status as string) ?? (s.state as string) ?? "running";
    const output = Array.isArray(s.output)
      ? (s.output as SourceSummary[])
      : undefined;
    return { phase, output };
  }

  async function start() {
    setRunning(true);
    setMessage(null);
    setSummary(null);
    setPhase("starting…");
    try {
      const res = await fetch("/api/admin/refresh-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKey: sourceKey || undefined,
          limit: limit ? Number(limit) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setRunning(false);
        setPhase(null);
        setMessage(data.error ?? data.reason ?? "Could not start refresh");
        return;
      }
      setPhase("running");
      setMessage(`Started for: ${(data.sources ?? []).join(", ")}`);
      const runId = data.runId as string;

      poll.current = setInterval(async () => {
        try {
          const r = await fetch(
            `/api/admin/refresh-catalog?runId=${encodeURIComponent(runId)}`,
          );
          const d = await r.json().catch(() => ({}));
          if (!r.ok) return;
          const { phase: p, output } = readStatus(d.status);
          setPhase(p);
          if (output) setSummary(output);
          if (["completed", "complete", "failed", "errored"].includes(p)) {
            if (poll.current) clearInterval(poll.current);
            setRunning(false);
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    } catch {
      setRunning(false);
      setPhase(null);
      setMessage("Could not start refresh");
    }
  }

  return (
    <div className="rounded-2xl border hairline bg-paper p-6">
      {!hasAI && (
        <p className="mb-4 rounded-lg bg-cream/50 p-3 text-sm text-stone">
          Set <code>AI_GATEWAY_API_KEY</code> to enable embeddings before
          refreshing.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-stone-soft">Source</span>
          <select
            value={sourceKey}
            onChange={(e) => setSourceKey(e.target.value)}
            disabled={running}
            className="rounded-lg border hairline bg-paper px-3 py-2 text-sm"
          >
            <option value="">All configured ({configured.length})</option>
            {sources.map((s) => (
              <option key={s.key} value={s.key} disabled={!s.configured}>
                {s.label}
                {s.configured ? "" : " — not configured"}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-stone-soft">Limit / source</span>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="all"
            inputMode="numeric"
            disabled={running}
            className="w-28 rounded-lg border hairline bg-paper px-3 py-2 text-sm"
          />
        </label>

        <button
          onClick={start}
          disabled={!canRun}
          className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {running ? "Refreshing…" : "Refresh now"}
        </button>
      </div>

      {(phase || message) && (
        <div className="mt-5 text-sm">
          {phase && (
            <p className="text-stone">
              Status: <span className="font-medium text-ink">{phase}</span>
            </p>
          )}
          {message && <p className="mt-1 text-stone-soft">{message}</p>}
        </div>
      )}

      {summary && summary.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border hairline">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream/40 text-stone-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Valid</th>
                <th className="px-3 py-2 font-medium">Invalid</th>
                <th className="px-3 py-2 font-medium">Upserted</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.source} className="border-t hairline">
                  <td className="px-3 py-2">{r.source}</td>
                  <td className="px-3 py-2">{r.valid}</td>
                  <td className="px-3 py-2">{r.invalid}</td>
                  <td className="px-3 py-2">
                    {r.error ? (
                      <span className="text-red-700">{r.error}</span>
                    ) : (
                      r.upserted
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

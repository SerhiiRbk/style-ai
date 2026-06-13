"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "./CreditsContext";
import { LOOK_CONTEXTS } from "@/lib/look-contexts";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";
import { WORKING } from "@/components/luxe/messages";

const NOTE_MAX = 160;

/**
 * Paid add-on: generate one more photorealistic look on the user's photo for an
 * existing report. The user picks an occasion (never a tier) and may add a short
 * note. Costs `cost` credits; refreshes the server-rendered looks grid on success.
 */
export function GenerateLookButton({
  reportId,
  cost,
}: {
  reportId: string;
  cost: number;
}) {
  const router = useRouter();
  const { balance, setBalance } = useCredits();
  const [open, setOpen] = useState(false);
  const [contextId, setContextId] = useState(LOOK_CONTEXTS[0]!.id);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;

  async function run() {
    if (insufficient) return;
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/look-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, contextId, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Could not generate the look");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setState("idle");
      setOpen(false);
      setNote("");
      router.refresh();
    } catch {
      setState("error");
      setMsg("Could not generate the look");
    }
  }

  if (!open) {
    return (
      <div className="mt-12 flex flex-col items-center gap-2 border-t hairline pt-10 text-center">
        <h3 className="font-display text-xl">Need another look?</h3>
        <p className="max-w-md text-sm text-stone">
          Generate one more photorealistic outfit on your photo for a specific
          occasion — matched to your style profile.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-2 rounded-full border border-brass/40 bg-brass/5 px-5 py-2 text-sm text-ink transition-colors hover:bg-brass/10"
        >
          Add a look · {cost} credits
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-12 max-w-lg rounded-2xl border hairline bg-cream/30 p-6">
      <h3 className="font-display text-xl">Add one more look</h3>
      <p className="mt-1 text-sm text-stone">Pick the occasion for this outfit.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {LOOK_CONTEXTS.map((c) => (
          <button
            key={c.id}
            onClick={() => setContextId(c.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              contextId === c.id
                ? "border-brass bg-brass/10 text-ink"
                : "border-ink/15 text-stone hover:border-brass/40"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-sm text-stone">
        Anything specific? <span className="text-stone-soft">(optional)</span>
        <input
          type="text"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. outdoor summer wedding, no tie"
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-paper px-3.5 py-2 text-sm text-ink outline-none focus:border-brass"
        />
      </label>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={run}
          disabled={state === "loading" || insufficient}
          title={insufficient ? "Not enough credits — top up to generate" : undefined}
          className="rounded-full bg-ink px-5 py-2 text-sm text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {state === "loading" ? (
            <LuxeWorkingLabel message={WORKING.look} />
          ) : (
            `Generate · ${cost} credits`
          )}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          disabled={state === "loading"}
          className="text-sm text-stone hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {creditsApply ? (
        <p className="mt-3 text-[11px] text-stone-soft">
          {insufficient ? (
            <>
              Not enough credits ({balance} left).{" "}
              <Link href="/pricing" className="text-brass hover:text-ink">
                Buy credits
              </Link>
            </>
          ) : (
            <>
              Balance: {balance} credits · try-on on this look costs 1 credit
              extra
            </>
          )}
        </p>
      ) : null}
      {msg ? <p className="mt-2 text-xs text-stone-soft">{msg}</p> : null}
    </div>
  );
}

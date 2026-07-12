"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "./CreditsContext";
import {
  REPORT_LANGUAGES,
  languageNativeLabel,
  type ReportLanguage,
} from "@/lib/languages";

/**
 * Owner-only control to re-translate an existing report's text into another
 * language for `cost` credits. Recommendations and images are unchanged.
 */
export function ChangeLanguageButton({
  reportId,
  current,
  cost,
}: {
  reportId: string;
  current: ReportLanguage;
  cost: number;
}) {
  const router = useRouter();
  const { balance, setBalance } = useCredits();
  const [choice, setChoice] = useState<ReportLanguage>(current);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;
  const changed = choice !== current;

  async function run() {
    if (state === "loading" || !changed || insufficient) return;
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/language`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Could not change the language");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
      setMsg("Could not change the language");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-stone" htmlFor="report-language">
          Language
        </label>
        <select
          id="report-language"
          value={choice}
          onChange={(e) => setChoice(e.target.value as ReportLanguage)}
          disabled={state === "loading"}
          className="rounded-full border hairline bg-paper px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-brass/50"
        >
          {REPORT_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.native}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={state === "loading" || !changed || insufficient}
          title={
            insufficient
              ? "Not enough credits — top up to change the language"
              : `Translate this report into ${languageNativeLabel(choice)} for ${cost} credits`
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/5 px-4 py-1.5 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10 disabled:opacity-50"
        >
          {state === "loading"
            ? "Translating…"
            : changed
              ? `Change · ${cost} credits`
              : "Current language"}
        </button>
      </div>
      {msg ? (
        <span className="text-xs text-rust">
          {msg}
          {insufficient ? (
            <>
              {" "}
              <Link href="/pricing" className="underline hover:text-brass">
                Buy credits
              </Link>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useCredits } from "@/components/CreditsContext";

/** Manual promo-code entry for signed-in users (pricing page, etc.). */
export function PromoRedeemForm() {
  const { setBalance } = useCredits();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as {
        credits?: number;
        balance?: number;
        name?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not redeem code.");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      setSuccess(
        `+${data.credits} credits added (${data.name ?? "promo"}). New balance: ${data.balance}.`,
      );
      setCode("");
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={redeem} className="flex flex-wrap items-end gap-3">
      <label className="min-w-[12rem] flex-1">
        <span className="text-xs uppercase tracking-wider text-stone-soft">
          Promo code
        </span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="VLT-XXXXXXXX"
          className="mt-1 w-full rounded-lg border hairline bg-paper px-3 py-2 text-sm outline-none focus:border-ink/30"
        />
      </label>
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="rounded-full border border-ink/25 px-5 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {loading ? "Applying…" : "Apply code"}
      </button>
      {error ? <p className="w-full text-sm text-[#9E5C3C]">{error}</p> : null}
      {success ? <p className="w-full text-sm text-ink">{success}</p> : null}
    </form>
  );
}

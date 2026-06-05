"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_WORD = "DELETE";

/**
 * GDPR "delete my account" control. Requires the user to type DELETE before the
 * destructive call is enabled. On success it clears the local session and sends
 * the user home.
 */
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not delete account");
      }
      try {
        await createClient().auth.signOut();
      } catch {
        // session already invalidated server-side
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-red-200 px-5 py-2 text-sm text-red-700 transition-colors hover:bg-red-50"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="max-w-md rounded-2xl border border-red-200 bg-red-50/50 p-5">
      <p className="text-sm font-medium text-red-900">
        This permanently deletes your account and all data.
      </p>
      <p className="mt-2 text-sm text-red-800/90">
        Every report, generated image, uploaded photo, try-on and credit history
        is erased. This cannot be undone. Type{" "}
        <span className="font-semibold">{CONFIRM_WORD}</span> to confirm.
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={CONFIRM_WORD}
        autoComplete="off"
        className="mt-3 w-full rounded-lg border border-red-300 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-red-500"
      />
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || value.trim() !== CONFIRM_WORD}
          onClick={() => void remove()}
          className="rounded-full border border-red-300 bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete everything"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setValue("");
            setError(null);
          }}
          className="rounded-full border border-line px-4 py-2 text-sm text-stone transition-colors hover:bg-cream/60 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

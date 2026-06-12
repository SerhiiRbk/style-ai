"use client";

import { useState } from "react";
import Link from "next/link";
import { updatePassword } from "@/app/login/actions";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch =
    confirm.length > 0 && password.length > 0 && password !== confirm;

  return (
    <form action={updatePassword} className="mt-7 space-y-4">
      <label className="block">
        <span className="text-sm text-stone">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="mt-1.5 w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
        />
      </label>
      <label className="block">
        <span className="text-sm text-stone">Confirm password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          className="mt-1.5 w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
        />
      </label>
      {mismatch ? (
        <p className="text-xs text-[#9E5C3C]">Passwords do not match.</p>
      ) : null}
      <button
        type="submit"
        disabled={mismatch}
        className="w-full rounded-full bg-ink px-6 py-3 text-sm text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        Update password
      </button>
      <p className="text-center text-sm text-stone">
        <Link href="/login/forgot-password" className="text-brass hover:text-ink">
          Request a new link
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useNavSession } from "./NavSession";

const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export function AuthControls({ className }: { className?: string }) {
  const router = useRouter();
  // Drive off the shared nav session so this button appears in sync with the
  // rest of the nav (including the optimistic cache) instead of resolving its
  // own auth call on a different clock — which caused the "renders in parts" jump.
  const { authed, ready } = useNavSession();

  if (!LIVE || !ready) return null;

  if (authed) {
    return (
      <button
        onClick={async () => {
          await createClient().auth.signOut();
          router.push("/");
          router.refresh();
        }}
        className={
          className ??
          "whitespace-nowrap text-sm text-stone transition-colors hover:text-ink"
        }
      >
        Sign out
      </button>
    );
  }

  return (
    <Link
      href="/login"
      className={
        className ??
        "whitespace-nowrap text-sm text-stone transition-colors hover:text-ink"
      }
    >
      Log in
    </Link>
  );
}

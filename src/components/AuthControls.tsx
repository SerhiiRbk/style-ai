"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export function AuthControls({ className }: { className?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!LIVE) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
  }, []);

  if (!LIVE || !ready) return null;

  if (email) {
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

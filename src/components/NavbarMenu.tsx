"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink } from "./Button";
import { createClient } from "@/lib/supabase/client";

export type NavLink = {
  href: string;
  label: string;
  hideWhenAuthed?: boolean;
};

const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      {open ? (
        <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
      ) : (
        <>
          <path d="M3 6h14" strokeLinecap="round" />
          <path d="M3 10h14" strokeLinecap="round" />
          <path d="M3 14h14" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function NavbarMenu({
  authed,
  primaryLinks,
  secondaryLinks,
}: {
  authed: boolean;
  primaryLinks: NavLink[];
  secondaryLinks: NavLink[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!LIVE) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleSecondary = secondaryLinks.filter(
    (l) => !(l.hideWhenAuthed && authed),
  );
  const menuLinks = [...primaryLinks, ...visibleSecondary];

  const linkClass =
    "block py-3 text-base text-ink transition-colors hover:text-brass";

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-cream xl:hidden"
      >
        <MenuIcon open={open} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-ink/15 backdrop-blur-[2px] xl:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col border-l hairline bg-paper shadow-[0_8px_40px_rgba(21,18,13,0.12)] xl:hidden"
          >
            <div className="flex items-center justify-between border-b hairline px-6 py-4">
              <span className="eyebrow">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-cream"
              >
                <MenuIcon open />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="divide-y hairline">
                {menuLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={linkClass}
                      onClick={() => setOpen(false)}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
                {authed && (
                  <li>
                    <Link
                      href="/reports"
                      className={linkClass}
                      onClick={() => setOpen(false)}
                    >
                      My reports
                    </Link>
                  </li>
                )}
              </ul>

              <div className="mt-8 space-y-3 border-t hairline pt-6">
                {LIVE && email ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await createClient().auth.signOut();
                      setOpen(false);
                      router.push("/");
                      router.refresh();
                    }}
                    className="block w-full py-2 text-left text-sm text-stone transition-colors hover:text-ink"
                  >
                    Sign out
                  </button>
                ) : LIVE ? (
                  <Link
                    href="/login"
                    className="block py-2 text-sm text-stone transition-colors hover:text-ink"
                    onClick={() => setOpen(false)}
                  >
                    Log in
                  </Link>
                ) : null}
                <ButtonLink
                  href="/start"
                  className="w-full !px-5 !py-3"
                  onClick={() => setOpen(false)}
                >
                  Create my report
                </ButtonLink>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateReportButton } from "./CreateReportButton";
import { useNavSession } from "./NavSession";
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
  primaryLinks,
  secondaryLinks,
}: {
  primaryLinks: NavLink[];
  secondaryLinks: NavLink[];
}) {
  const router = useRouter();
  const { authed, isAdmin, balance } = useNavSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const menuPanel = open ? (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-[100] bg-ink/15 backdrop-blur-[2px] lg:hidden"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        translate="no"
        className="notranslate fixed inset-y-0 right-0 z-[101] flex w-full max-w-xs flex-col border-l hairline bg-paper shadow-[0_8px_40px_rgba(21,18,13,0.12)] lg:hidden"
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
          {authed && balance !== null && (
            <Link
              href="/account#credits"
              onClick={() => setOpen(false)}
              className="mb-4 inline-flex rounded-full border border-brass/40 bg-brass/5 px-3 py-1 text-xs text-ink transition-colors hover:border-brass md:hidden"
            >
              {balance} credits
            </Link>
          )}

          <ul className="divide-y hairline">
            {authed && (
              <li>
                <Link
                  href="/reports"
                  className={linkClass}
                  onClick={() => setOpen(false)}
                >
                  Reports
                </Link>
              </li>
            )}
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
                  href="/gallery"
                  className={linkClass}
                  onClick={() => setOpen(false)}
                >
                  Looks
                </Link>
              </li>
            )}
            {authed && (
              <li>
                <Link
                  href="/account"
                  className={linkClass}
                  onClick={() => setOpen(false)}
                >
                  Account
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  className={`${linkClass} text-brass`}
                  onClick={() => setOpen(false)}
                >
                  Admin
                </Link>
              </li>
            )}
          </ul>

          <div className="mt-8 space-y-3 border-t hairline pt-6">
            {LIVE && authed ? (
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
            <CreateReportButton
              className="w-full !px-5 !py-3"
              compact
              label="Create my report"
              onNavigate={() => setOpen(false)}
            />
          </div>
        </nav>
      </div>
    </>
  ) : null;

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink transition-colors hover:border-ink/30 hover:bg-cream lg:hidden"
      >
        <MenuIcon open={open} />
      </button>

      {mounted && menuPanel ? createPortal(menuPanel, document.body) : null}
    </>
  );
}

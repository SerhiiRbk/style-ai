"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { COLOURS_ENABLED } from "@/lib/colours-feature";

type NavSessionValue = {
  authed: boolean;
  isAdmin: boolean;
  balance: number | null;
  /** True once the client has resolved the session (or there is nothing to resolve). */
  ready: boolean;
  setBalance: (next: number | null) => void;
};

const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const NavSessionContext = createContext<NavSessionValue | null>(null);

type NavPayload = {
  authed?: boolean;
  isAdmin?: boolean;
  balance?: number | null;
};

async function fetchNavSession(): Promise<NavPayload | null> {
  const res = await fetch("/api/nav", { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as NavPayload;
}

/**
 * Resolves per-visitor navbar state on the client via /api/nav.
 *
 * Keeping this off the server render lets pages that include <Navbar /> stay
 * statically cacheable instead of being forced into dynamic rendering by a
 * server-side auth check.
 */
export function NavSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [balance, setBalanceState] = useState<number | null>(null);
  const [ready, setReady] = useState(!LIVE);

  const setBalance = useCallback((next: number | null) => {
    setBalanceState(next);
  }, []);

  const applyPayload = useCallback((data: NavPayload | null) => {
    if (!data) {
      setReady(true);
      return;
    }
    setAuthed(Boolean(data.authed));
    setIsAdmin(Boolean(data.isAdmin));
    setBalanceState(typeof data.balance === "number" ? data.balance : null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!LIVE) return;
    let cancelled = false;

    fetchNavSession()
      .then((data) => {
        if (!cancelled) applyPayload(data);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, applyPayload]);

  return (
    <NavSessionContext.Provider
      value={{ authed, isAdmin, balance, ready, setBalance }}
    >
      {children}
    </NavSessionContext.Provider>
  );
}

export function useNavSession(): NavSessionValue {
  return (
    useContext(NavSessionContext) ?? {
      authed: false,
      isAdmin: false,
      balance: null,
      ready: false,
      setBalance: () => {},
    }
  );
}

const navLinkClass =
  "whitespace-nowrap text-xs xl:text-sm text-stone transition-colors hover:text-ink";

const creditsPillClass =
  "whitespace-nowrap rounded-full border border-brass/40 bg-brass/5 text-ink transition-colors hover:border-brass";

/** Desktop "Reports" link — rendered first in the nav when signed in. */
export function NavDesktopReportsLink() {
  const { authed } = useNavSession();
  if (!authed) return null;
  return (
    <Link href="/reports" className={navLinkClass}>
      Reports
    </Link>
  );
}

/** Desktop nav links that depend on the visitor's session. */
export function NavDesktopAuthLinks() {
  const { authed, isAdmin } = useNavSession();
  return (
    <>
      {!authed && COLOURS_ENABLED && (
        <Link href="/colours" className={navLinkClass}>
          Colours
        </Link>
      )}
      {!authed && (
        <Link
          href="/report/valetti-style-prospect-demo"
          className={`${navLinkClass} hidden 2xl:inline-flex`}
        >
          Demo
        </Link>
      )}
      {authed && (
        <Link href="/gallery" className={navLinkClass}>
          Looks
        </Link>
      )}
      {authed && (
        <Link href="/account" className={navLinkClass}>
          Account
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/admin"
          className={`${navLinkClass} text-brass hover:text-brass/80`}
        >
          Admin
        </Link>
      )}
    </>
  );
}

/** Desktop credit-balance pill (only for signed-in visitors). */
export function NavCreditPill() {
  const { authed, balance } = useNavSession();
  if (!authed || balance === null) return null;
  return (
    <>
      <Link
        href="/account#credits"
        title="Your credit balance"
        className={`${creditsPillClass} px-2 py-0.5 text-[11px] xl:hidden`}
      >
        {balance} cr
      </Link>
      <Link
        href="/account#credits"
        title="Your credit balance"
        className={`${creditsPillClass} hidden px-3 py-1 text-xs xl:inline-flex`}
      >
        {balance} credits
      </Link>
    </>
  );
}

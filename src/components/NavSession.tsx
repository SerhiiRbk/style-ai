"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type NavSessionValue = {
  authed: boolean;
  isAdmin: boolean;
  balance: number | null;
  /** True once the client has resolved the session (or there is nothing to resolve). */
  ready: boolean;
};

const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const NavSessionContext = createContext<NavSessionValue | null>(null);

/**
 * Resolves per-visitor navbar state on the client via /api/nav.
 *
 * Keeping this off the server render lets pages that include <Navbar /> stay
 * statically cacheable instead of being forced into dynamic rendering by a
 * server-side auth check.
 */
export function NavSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavSessionValue>({
    authed: false,
    isAdmin: false,
    balance: null,
    ready: !LIVE,
  });

  useEffect(() => {
    if (!LIVE) return;
    let cancelled = false;

    fetch("/api/nav", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setState({
            authed: Boolean(data.authed),
            isAdmin: Boolean(data.isAdmin),
            balance: typeof data.balance === "number" ? data.balance : null,
            ready: true,
          });
        } else {
          setState((s) => ({ ...s, ready: true }));
        }
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, ready: true }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <NavSessionContext.Provider value={state}>
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
    }
  );
}

const navLinkClass =
  "whitespace-nowrap text-xs xl:text-sm text-stone transition-colors hover:text-ink";

const creditsPillClass =
  "whitespace-nowrap rounded-full border border-brass/40 bg-brass/5 text-ink transition-colors hover:border-brass";

/** Desktop nav links that depend on the visitor's session. */
export function NavDesktopAuthLinks() {
  const { authed, isAdmin } = useNavSession();
  return (
    <>
      {!authed && (
        <Link
          href="/report/valetti-style-prospect-demo"
          className={`${navLinkClass} hidden 2xl:inline-flex`}
        >
          View example
        </Link>
      )}
      {authed && (
        <Link href="/reports" className={navLinkClass}>
          My reports
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
        href="/pricing"
        title="Your credit balance — buy more"
        className={`${creditsPillClass} px-2 py-0.5 text-[11px] xl:hidden`}
      >
        {balance} cr
      </Link>
      <Link
        href="/pricing"
        title="Your credit balance — buy more"
        className={`${creditsPillClass} hidden px-3 py-1 text-xs xl:inline-flex`}
      >
        {balance} credits
      </Link>
    </>
  );
}

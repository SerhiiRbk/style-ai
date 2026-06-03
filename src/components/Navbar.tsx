import Link from "next/link";
import { ButtonLink } from "./Button";
import { AuthControls } from "./AuthControls";
import { NavbarMenu, type NavLink } from "./NavbarMenu";
import { BRAND } from "@/lib/brand";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";

const primaryLinks: NavLink[] = [
  { href: "/#stylist", label: "Your stylist" },
  { href: "/#how", label: "How it works" },
  { href: "/catalog", label: "Catalog" },
  { href: "/pricing", label: "Pricing" },
];

const secondaryLinks: NavLink[] = [
  { href: "/#sample", label: "Sample report" },
  { href: "/report/demo", label: "View example", hideWhenAuthed: true },
];

const navLinkClass =
  "whitespace-nowrap text-sm text-stone transition-colors hover:text-ink";

export async function Navbar() {
  let authed = false;
  let balance: number | null = null;
  if (hasSupabase) {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    authed = Boolean(user);
    if (authed) balance = await getCreditBalance();
  }

  return (
    <header className="sticky top-0 z-50 border-b hairline bg-paper/80 backdrop-blur-md">
      <nav className="container-luxe grid h-16 grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-x-3 md:gap-x-4">
        <Link
          href="/"
          className="group flex min-w-0 shrink-0 items-baseline gap-2"
        >
          <span className="font-display text-xl tracking-tight">
            {BRAND.name}
          </span>
          <span className="eyebrow hidden lg:inline">{BRAND.eyebrow}</span>
        </Link>

        <div className="hidden min-w-0 items-center justify-center gap-x-5 overflow-hidden xl:flex 2xl:gap-x-7">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className={navLinkClass}>
              {l.label}
            </Link>
          ))}
          <Link
            href="/#sample"
            className={`${navLinkClass} hidden 2xl:inline`}
          >
            Sample report
          </Link>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          <div className="hidden items-center gap-3 xl:flex">
            {!authed && (
              <Link href="/report/demo" className={navLinkClass}>
                View example
              </Link>
            )}
            {authed && (
              <Link href="/reports" className={navLinkClass}>
                My reports
              </Link>
            )}
            {authed && balance !== null && (
              <Link
                href="/pricing"
                title="Your credit balance — buy more"
                className="whitespace-nowrap rounded-full border border-brass/40 bg-brass/5 px-3 py-1 text-xs text-ink transition-colors hover:border-brass"
              >
                {balance} credits
              </Link>
            )}
            <AuthControls />
          </div>

          <ButtonLink href="/start" className="!px-4 !py-2.5 sm:!px-5">
            <span className="xl:hidden">Create report</span>
            <span className="hidden xl:inline">Create my report</span>
          </ButtonLink>

          <NavbarMenu
            authed={authed}
            primaryLinks={primaryLinks}
            secondaryLinks={secondaryLinks}
          />
        </div>
      </nav>
    </header>
  );
}

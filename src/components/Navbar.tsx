import Link from "next/link";
import { ButtonLink } from "./Button";
import { AuthControls } from "./AuthControls";
import { NavbarMenu, type NavLink } from "./NavbarMenu";
import { BRAND } from "@/lib/brand";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";

const primaryLinks: NavLink[] = [
  { href: "/#how", label: "How it works" },
  { href: "/catalog", label: "Catalog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#sample", label: "Sample" },
];

const secondaryLinks: NavLink[] = [
  { href: "/report/demo", label: "View example", hideWhenAuthed: true },
];

const navLinkClass =
  "whitespace-nowrap text-xs xl:text-sm text-stone transition-colors hover:text-ink";

const creditsPillClass =
  "whitespace-nowrap rounded-full border border-brass/40 bg-brass/5 text-ink transition-colors hover:border-brass";

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
      <nav className="container-luxe flex h-16 items-center gap-2 lg:gap-4">
        <Link
          href="/"
          className="group flex shrink-0 items-baseline gap-1.5 xl:gap-2"
        >
          <span className="font-display text-lg tracking-tight xl:text-xl">
            {BRAND.name}
          </span>
          <span className="eyebrow hidden whitespace-nowrap xl:inline">
            {BRAND.eyebrow}
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-between lg:flex">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className={navLinkClass}>
              {l.label}
            </Link>
          ))}
          {!authed && (
            <Link
              href="/report/demo"
              className={`${navLinkClass} hidden xl:inline-flex`}
            >
              View example
            </Link>
          )}
          {authed && (
            <Link href="/reports" className={navLinkClass}>
              My reports
            </Link>
          )}
          {authed && balance !== null && (
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
          )}
          <AuthControls className="whitespace-nowrap text-xs text-stone transition-colors hover:text-ink xl:text-sm" />
          <ButtonLink href="/start" className="!px-3 !py-2 xl:!px-5">
            <span className="xl:hidden">Create report</span>
            <span className="hidden xl:inline">Create my report</span>
          </ButtonLink>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2 lg:hidden">
          <ButtonLink
            href="/start"
            className="!px-2.5 !py-2 sm:!px-3 md:!px-4"
          >
            Create report
          </ButtonLink>
          <NavbarMenu
            authed={authed}
            primaryLinks={primaryLinks}
            secondaryLinks={secondaryLinks}
            balance={balance}
          />
        </div>
      </nav>
    </header>
  );
}

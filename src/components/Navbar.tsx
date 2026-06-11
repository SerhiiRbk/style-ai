import Link from "next/link";
import { ButtonLink } from "./Button";
import { AuthControls } from "./AuthControls";
import { NavbarMenu, type NavLink } from "./NavbarMenu";
import { ValettiLogo } from "./brand/ValettiLogo";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";
import { isAdminEmail } from "@/lib/admin";

const primaryLinks: NavLink[] = [
  { href: "/#how", label: "How it works" },
  { href: "/catalog", label: "Catalog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#sample", label: "Sample" },
];

const secondaryLinks: NavLink[] = [
  { href: "/report/valetti-style-prospect-demo", label: "View example", hideWhenAuthed: true },
];

const navLinkClass =
  "whitespace-nowrap text-xs xl:text-sm text-stone transition-colors hover:text-ink";

const creditsPillClass =
  "whitespace-nowrap rounded-full border border-brass/40 bg-brass/5 text-ink transition-colors hover:border-brass";

export async function Navbar() {
  let authed = false;
  let isAdmin = false;
  let balance: number | null = null;
  if (hasSupabase) {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    authed = Boolean(user);
    if (user) isAdmin = isAdminEmail(user.email);
    if (authed) balance = await getCreditBalance();
  }

  return (
    <header className="sticky top-0 z-50 border-b hairline bg-paper/80 backdrop-blur-md">
      <nav className="container-luxe flex h-16 items-center gap-3 lg:gap-6">
        <ValettiLogo
          eyebrow="inline"
          monogramSize={24}
          wordmarkClass="text-lg xl:text-xl"
        />

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-4 lg:flex xl:gap-5">
          <div className="flex items-center gap-4 xl:gap-5">
            {primaryLinks.map((l) => (
              <Link key={l.href} href={l.href} className={navLinkClass}>
                {l.label}
              </Link>
            ))}
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
          </div>
          <div className="flex items-center gap-3 xl:gap-4">
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
            isAdmin={isAdmin}
            primaryLinks={primaryLinks}
            secondaryLinks={secondaryLinks}
            balance={balance}
          />
        </div>
      </nav>
    </header>
  );
}

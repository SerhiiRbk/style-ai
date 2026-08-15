import Link from "next/link";
import { AuthControls } from "./AuthControls";
import { CreateReportButton } from "./CreateReportButton";
import { NavbarMenu, type NavLink } from "./NavbarMenu";
import { NavErrorBoundary } from "./NavErrorBoundary";
import { ValettiLogo } from "./brand/ValettiLogo";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import {
  NavDesktopAnonLeadLink,
  NavDesktopAuthLinks,
  NavCreditPill,
} from "./NavSession";
import { MyStyleMenu } from "./MyStyleMenu";

const primaryLinks: NavLink[] = [
  { href: "/shop-a-look", label: "Shop a look" },
  { href: "/catalog", label: "Catalog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#sample", label: "Sample" },
];

// Anon-only extras. Colours is listed first so the mobile menu can hoist it
// ahead of the product links; signed-in users reach Colours via My Style.
const secondaryLinks: NavLink[] = [
  ...(COLOURS_ENABLED
    ? [{ href: "/colours", label: "Colours", hideWhenAuthed: true } as NavLink]
    : []),
  { href: "/report/valetti-style-prospect-demo", label: "Demo", hideWhenAuthed: true },
];

const navLinkClass =
  "whitespace-nowrap text-xs xl:text-sm text-stone transition-colors hover:text-ink";

export function Navbar() {
  return (
    // translate="no" keeps browser translation extensions (DeepL, Google
    // Translate) from mutating the nav's text nodes, which otherwise breaks
    // React hydration and can blank the menu. The error boundary is a
    // belt-and-suspenders fallback for the same class of failure.
    <header
      translate="no"
      className="notranslate sticky top-0 z-50 border-b hairline bg-paper/80 backdrop-blur-md"
    >
      <nav className="container-luxe flex h-16 items-center gap-3 lg:gap-6">
        <ValettiLogo
          eyebrow="inline"
          monogramSize={24}
          wordmarkClass="text-lg xl:text-xl"
        />

        <NavErrorBoundary fallback={<NavbarFallback />}>
          <div className="hidden min-w-0 flex-1 items-center justify-end gap-4 lg:flex xl:gap-5">
            <div className="flex items-center gap-4 xl:gap-5">
              <NavDesktopAnonLeadLink />
              <MyStyleMenu />
              {primaryLinks.map((l) => (
                <Link key={l.href} href={l.href} className={navLinkClass}>
                  {l.label}
                </Link>
              ))}
              <NavDesktopAuthLinks />
            </div>
            <div className="flex items-center gap-3 xl:gap-4">
              <NavCreditPill />
              <AuthControls className="whitespace-nowrap text-xs text-stone transition-colors hover:text-ink xl:text-sm" />
              <CreateReportButton className="!px-3 !py-2 xl:!px-5" />
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2 lg:hidden">
            <CreateReportButton
              compact
              className="!px-2.5 !py-2 sm:!px-3 md:!px-4"
            />
            <NavbarMenu
              primaryLinks={primaryLinks}
              secondaryLinks={secondaryLinks}
            />
          </div>
        </NavErrorBoundary>
      </nav>
    </header>
  );
}

/**
 * Minimal, session-independent navigation shown if the interactive nav crashes
 * (e.g. a translation extension corrupted the DOM). Pure static links so it can
 * never throw for the same reason.
 */
function NavbarFallback() {
  return (
    <div className="ml-auto flex items-center gap-4">
      <div className="hidden items-center gap-4 sm:flex">
        {COLOURS_ENABLED ? (
          <Link href="/colours" className={navLinkClass}>
            Colours
          </Link>
        ) : null}
        {primaryLinks.map((l) => (
          <Link key={l.href} href={l.href} className={navLinkClass}>
            {l.label}
          </Link>
        ))}
      </div>
      <Link
        href="/start"
        className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-xs text-paper transition-colors hover:bg-ink-soft xl:text-sm"
      >
        Create report
      </Link>
    </div>
  );
}

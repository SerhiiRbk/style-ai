import Link from "next/link";
import { AuthControls } from "./AuthControls";
import { CreateReportButton } from "./CreateReportButton";
import { NavbarMenu, type NavLink } from "./NavbarMenu";
import { ValettiLogo } from "./brand/ValettiLogo";
import {
  NavDesktopAuthLinks,
  NavDesktopReportsLink,
  NavCreditPill,
} from "./NavSession";

const primaryLinks: NavLink[] = [
  { href: "/shop-a-look", label: "Shop a look" },
  { href: "/catalog", label: "Catalog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#sample", label: "Sample" },
];

const secondaryLinks: NavLink[] = [
  { href: "/report/valetti-style-prospect-demo", label: "View example", hideWhenAuthed: true },
];

const navLinkClass =
  "whitespace-nowrap text-xs xl:text-sm text-stone transition-colors hover:text-ink";

export function Navbar() {
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
            <NavDesktopReportsLink />
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
      </nav>
    </header>
  );
}

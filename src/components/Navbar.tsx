import Link from "next/link";
import { ButtonLink } from "./Button";
import { AuthControls } from "./AuthControls";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#sample", label: "Sample report" },
  { href: "/catalog", label: "Catalog" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#audience", label: "Who it's for" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b hairline bg-paper/80 backdrop-blur-md">
      <nav className="container-luxe flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-xl tracking-tight">StyleAI</span>
          <span className="eyebrow hidden sm:inline">Consultant</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-stone transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/report/demo"
            className="hidden text-sm text-stone transition-colors hover:text-ink sm:inline"
          >
            View example
          </Link>
          <AuthControls />
          <ButtonLink href="/start" className="!px-5 !py-2.5">
            Create my report
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

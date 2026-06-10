import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";

export function AdminShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  /** Highlight the active section, e.g. `/admin/catalog`. */
  currentPath?: string;
}) {
  return (
    <main className="min-h-screen bg-cream/20">
      <header className="border-b hairline bg-paper/80 px-6 py-4 backdrop-blur-sm">
        <div className="container-luxe flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-lg text-ink">
              {BRAND.name}
            </Link>
            <span className="hidden text-stone-soft sm:inline">·</span>
            <Link
              href="/admin"
              className="hidden text-sm text-stone-soft transition-colors hover:text-ink sm:inline"
            >
              Admin
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {ADMIN_SECTIONS.map((s) => {
              const active = currentPath === s.href;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={
                    active
                      ? "font-medium text-ink"
                      : "text-stone-soft transition-colors hover:text-ink"
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {s.title}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="container-luxe py-12">{children}</div>
    </main>
  );
}

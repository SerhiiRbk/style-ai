import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="mt-auto border-t hairline bg-cream/40">
      <div className="container-luxe grid gap-10 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <div className="font-display text-2xl">{BRAND.name}</div>
          <p className="mt-1 text-xs uppercase tracking-wider text-stone-soft">
            {BRAND.tagline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone">
            A personal style atelier led by {BRAND.stylist.name}. Explainable
            recommendations, photorealistic looks, and a precise shopping plan —
            built privacy-first.
          </p>
        </div>

        <FooterCol
          title="Product"
          items={[
            ["How it works", "/#how"],
            ["Sample", "/report/demo"],
            ["Catalog", "/catalog"],
            ["Pricing", "/#pricing"],
          ]}
        />
        <FooterCol
          title="For business"
          items={[
            ["Stylists & salons", "/#audience"],
            ["White-label", "/#audience"],
          ]}
        />
        <FooterCol
          title="Company"
          items={[
            ["Privacy", "/#"],
            ["Terms", "/#"],
            ["Contact", "/#"],
          ]}
        />
      </div>
      <div className="container-luxe flex flex-col items-start justify-between gap-3 border-t hairline py-6 text-xs text-stone-soft sm:flex-row sm:items-center">
        <span>© {new Date().getFullYear()} {BRAND.legalName}. All rights reserved.</span>
        <span>Made in the EU · GDPR-first · Affiliate links disclosed</span>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div>
      <div className="eyebrow mb-4">{title}</div>
      <ul className="space-y-2.5">
        {items.map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="text-sm text-stone transition-colors hover:text-ink"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

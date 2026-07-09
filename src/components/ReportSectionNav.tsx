"use client";

import Link from "next/link";
import { useCredits } from "@/components/CreditsContext";

const REPORT_NAV_ITEMS = [
  ["overview", "Overview"],
  ["start-here", "Start"],
  ["colours", "Colour"],
  ["grooming", "Hair"],
  ["fit", "Fit"],
  ["looks", "Looks"],
  ["capsule", "Capsule"],
  ["shopping", "Shopping"],
  ["details", "Details"],
  ["care", "Care"],
  ["dos-donts", "Do / Don't"],
] as const;

export function ReportSectionNav() {
  const { balance } = useCredits();

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-0 z-30 border-b hairline bg-paper/95 backdrop-blur-md"
    >
      <div className="container-luxe">
        <div className="flex items-center gap-3 py-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {REPORT_NAV_ITEMS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 rounded-full border border-line bg-cream/40 px-3.5 py-1.5 text-xs text-stone transition-colors hover:border-ink/30 hover:bg-paper hover:text-ink"
              >
                {label}
              </a>
            ))}
          </div>
          {balance !== null ? (
            <Link
              href="/pricing"
              title="Your credit balance — buy more"
              className="shrink-0 whitespace-nowrap rounded-full border border-brass/40 bg-brass/5 px-3 py-1.5 text-xs text-ink transition-colors hover:border-brass"
            >
              <span className="font-display">{balance}</span>
              <span className="text-stone"> credits</span>
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

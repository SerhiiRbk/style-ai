/**
 * Finishing-details guide: best patterns (rendered as SVG swatches),
 * recommended accessories, and a shoe guide. Pure presentational, server-safe.
 */

const NAVY = "#27324A";
const CREAM = "#EFE6D3";
const OLIVE = "#6B6B47";
const CAMEL = "#B08A5B";

type PatternKind = "solid" | "stripe" | "check" | "tartan";

const PATTERNS: { name: string; kind: PatternKind }[] = [
  { name: "Solid", kind: "solid" },
  { name: "Fine stripe", kind: "stripe" },
  { name: "Gingham check", kind: "check" },
  { name: "Tartan", kind: "tartan" },
];

function PatternSwatch({ kind }: { kind: PatternKind }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      {kind === "solid" && <rect width="100" height="100" fill={NAVY} />}

      {kind === "stripe" && (
        <>
          <rect width="100" height="100" fill={CREAM} />
          <g stroke={NAVY} strokeWidth="6">
            {[-40, -20, 0, 20, 40, 60, 80, 100, 120].map((x) => (
              <line key={x} x1={x} y1={0} x2={x + 60} y2={100} />
            ))}
          </g>
        </>
      )}

      {kind === "check" && (
        <>
          <rect width="100" height="100" fill={CREAM} />
          <g fill={OLIVE}>
            {[0, 25, 50, 75].map((x) => (
              <rect key={`v${x}`} x={x} y={0} width="12.5" height="100" opacity="0.55" />
            ))}
            {[0, 25, 50, 75].map((y) => (
              <rect key={`h${y}`} x={0} y={y} width="100" height="12.5" opacity="0.55" />
            ))}
          </g>
        </>
      )}

      {kind === "tartan" && (
        <>
          <rect width="100" height="100" fill="#7C2B25" />
          <g fill={NAVY} opacity="0.6">
            {[10, 55].map((x) => (
              <rect key={`v${x}`} x={x} y={0} width="22" height="100" />
            ))}
            {[10, 55].map((y) => (
              <rect key={`h${y}`} x={0} y={y} width="100" height="22" />
            ))}
          </g>
          <g stroke={CAMEL} strokeWidth="3" opacity="0.9">
            {[33, 78].map((x) => (
              <line key={`vl${x}`} x1={x} y1={0} x2={x} y2={100} />
            ))}
            {[33, 78].map((y) => (
              <line key={`hl${y}`} x1={0} y1={y} x2={100} y2={y} />
            ))}
          </g>
        </>
      )}
    </svg>
  );
}

const ACCESSORIES: { name: string; note: string; icon: React.ReactNode }[] = [
  {
    name: "Field watch",
    note: "Cream dial, leather strap",
    icon: (
      <>
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 9v3l2 1.5M9 4h6M9 20h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: "Leather belt",
    note: "Match to your shoes",
    icon: (
      <>
        <rect x="3" y="9" width="18" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="10" y="9" width="5" height="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </>
    ),
  },
  {
    name: "Sunglasses",
    note: "Warm tortoiseshell",
    icon: (
      <>
        <circle cx="7" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10.2 12.5h3.6M3.8 12l1.5-2.5M20.2 12l-1.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: "Leather holdall",
    note: "Cognac, soft-structured weekender",
    icon: (
      <>
        <rect x="3" y="9" width="18" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 9V7.5A3 3 0 0115 7.5V9M3 13h18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: "Wool scarf",
    note: "Tonal neutral, lightweight",
    icon: (
      <>
        <path d="M9 4c-1.5 4-1.5 8 0 12M15 4c1.5 4 1.5 8 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9 16v4M12 16v4M15 16v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: "Socks",
    note: "Tonal to the trouser, not the shoe",
    icon: (
      <>
        <path d="M10 4h4v7l3.5 3.5a3 3 0 01-4.5 4L9 15V4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </>
    ),
  },
  {
    name: "Minimal chain",
    note: "One piece, in your metal — never more",
    icon: (
      <>
        <path d="M12 4v9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="16" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </>
    ),
  },
];

const SHOES: { name: string; image: string }[] = [
  { name: "Cream sneakers", image: "/images/products/cream-sneakers.png" },
  { name: "Suede chelsea boots", image: "/images/products/chelsea-boots.png" },
  { name: "Derby shoes", image: "/images/products/brown-derbies.png" },
];

export function StyleDetails() {
  return (
    <div className="grid gap-12 lg:grid-cols-3">
      <div>
        <h3 className="text-sm uppercase tracking-wider text-stone-soft">
          Best patterns
        </h3>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {PATTERNS.map((p) => (
            <div key={p.name}>
              <div className="aspect-square overflow-hidden rounded-xl border hairline">
                <PatternSwatch kind={p.kind} />
              </div>
              <div className="mt-2 text-center text-sm text-stone">{p.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wider text-stone-soft">
          Accessories
        </h3>
        <div className="mt-5 space-y-3">
          {ACCESSORIES.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-3 rounded-xl border hairline bg-paper px-4 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  {a.icon}
                </svg>
              </span>
              <div>
                <div className="font-display text-base leading-tight">
                  {a.name}
                </div>
                <div className="text-xs text-stone-soft">{a.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wider text-stone-soft">
          Shoe guide
        </h3>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {SHOES.map((s) => (
            <div key={s.name}>
              <div className="aspect-square overflow-hidden rounded-xl border hairline bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-2 text-center text-xs text-stone">{s.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

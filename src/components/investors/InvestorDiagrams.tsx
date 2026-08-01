import type { ReactNode } from "react";
import {
  PRODUCT_LOOP,
  REVENUE_STREAMS,
  SRE_FLOW,
  unitEconomicsChartSeries,
} from "@/lib/investor-deck-en";

/** Horizontal product loop — Photos → … → Decide. */
export function ProductLoopDiagram() {
  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-[640px] items-stretch gap-0">
        {PRODUCT_LOOP.map((step, i) => (
          <li key={step.n} className="flex flex-1 items-stretch">
            <div className="flex flex-1 flex-col items-center px-2 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brass font-display text-sm text-paper shadow-[0_8px_20px_-10px_rgba(169,124,60,0.7)]">
                {step.n}
              </span>
              <span className="mt-3 text-sm font-medium text-ink">{step.label}</span>
              <span className="mt-0.5 text-xs text-stone-soft">{step.detail}</span>
            </div>
            {i < PRODUCT_LOOP.length - 1 ? (
              <span
                aria-hidden
                className="mt-5 hidden shrink-0 text-brass-soft sm:inline"
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Donut chart for target revenue mix. */
export function RevenueMixChart() {
  const total = REVENUE_STREAMS.reduce((s, r) => s + r.pct, 0);
  const r = 42;
  const c = 50;
  const stroke = 14;
  const circ = 2 * Math.PI * r;

  const arcs = REVENUE_STREAMS.map((stream, index) => {
    const offset = REVENUE_STREAMS.slice(0, index).reduce(
      (s, prev) => s + (prev.pct / total) * circ,
      0,
    );
    const len = (stream.pct / total) * circ;
    return {
      ...stream,
      dash: `${len} ${circ - len}`,
      rotate: (offset / circ) * 360 - 90,
    };
  });

  return (
    <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
      <svg
        viewBox="0 0 100 100"
        className="mx-auto h-44 w-44 shrink-0"
        role="img"
        aria-label="Target revenue mix Year 2"
      >
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-sand)"
          strokeWidth={stroke}
        />
        {arcs.map((a) => (
          <circle
            key={a.name}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={a.dash}
            strokeLinecap="butt"
            transform={`rotate(${a.rotate} ${c} ${c})`}
          />
        ))}
        <text
          x={c}
          y={c - 4}
          textAnchor="middle"
          className="fill-ink"
          style={{ fontSize: 9, fontFamily: "var(--font-display)" }}
        >
          Y2 mix
        </text>
        <text
          x={c}
          y={c + 8}
          textAnchor="middle"
          className="fill-stone"
          style={{ fontSize: 5.5 }}
        >
          illustrative
        </text>
      </svg>
      <ul className="space-y-3">
        {REVENUE_STREAMS.map((r) => (
          <li key={r.name} className="flex items-center gap-3 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: r.color }}
            />
            <span className="flex-1 text-stone">{r.name}</span>
            <span className="font-display text-ink">{r.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Price vs COGS bars for paid tiers. */
export function UnitEconomicsChart() {
  const series = unitEconomicsChartSeries();
  const max = Math.max(...series.map((s) => s.price));
  const chartH = 160;

  return (
    <div>
      <div
        className="flex items-end justify-around gap-6 border-b hairline pb-2"
        style={{ height: chartH + 8 }}
      >
        {series.map((s) => {
          const priceH = Math.max(8, (s.price / max) * chartH);
          const cogsH = Math.max(4, (s.cogs / max) * chartH);
          return (
            <div key={s.tier} className="flex flex-1 flex-col items-center">
              <div className="mb-2 text-xs font-medium tabular-nums text-ink">
                €{s.price}
              </div>
              <div className="relative flex w-full max-w-[4.5rem] items-end justify-center gap-1.5">
                <div
                  className="w-5 rounded-t-md bg-brass"
                  style={{ height: priceH }}
                  title={`Price €${s.price}`}
                />
                <div
                  className="w-5 rounded-t-md bg-sand"
                  style={{ height: cogsH }}
                  title={`COGS €${s.cogs}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-around gap-6">
        {series.map((s) => (
          <div key={s.tier} className="flex-1 text-center">
            <div className="text-sm font-medium text-ink">{s.tier}</div>
            <div className="mt-0.5 text-xs text-brass">{s.marginPct}% margin</div>
            <div className="mt-0.5 text-[11px] text-stone-soft">
              COGS €{s.cogs.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-xs text-stone">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brass" /> Price
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sand" /> COGS
        </span>
      </div>
    </div>
  );
}

/** SRE pipeline as connected stages. */
export function SreFlowDiagram() {
  return (
    <div className="overflow-x-auto rounded-2xl border hairline bg-ink px-4 py-6 text-paper sm:px-6">
      <div className="flex min-w-[720px] items-stretch gap-2">
        {SRE_FLOW.map((step, i) => (
          <div key={step} className="flex flex-1 items-stretch gap-2">
            <div className="flex flex-1 flex-col rounded-xl border border-paper/15 bg-ink-soft/60 px-3 py-3">
              <span className="font-display text-lg text-brass-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-2 text-xs leading-snug text-paper/85">
                {step}
              </span>
            </div>
            {i < SRE_FLOW.length - 1 ? (
              <span
                aria-hidden
                className="flex shrink-0 items-center text-brass-soft"
              >
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple architecture stack diagram. */
export function StackDiagram({
  layers,
}: {
  layers: readonly (readonly [string, string])[];
}) {
  return (
    <div className="space-y-2">
      {layers.map(([layer, detail], i) => (
        <div
          key={layer}
          className="grid grid-cols-[7.5rem_1fr] items-stretch gap-0 overflow-hidden rounded-xl border hairline sm:grid-cols-[9rem_1fr]"
        >
          <div
            className={`flex items-center px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              i === 0
                ? "bg-brass text-paper"
                : i === layers.length - 1
                  ? "bg-ink text-paper"
                  : "bg-cream text-ink"
            }`}
          >
            {layer}
          </div>
          <div className="bg-paper px-4 py-3 text-sm text-stone">{detail}</div>
        </div>
      ))}
    </div>
  );
}

export function DiagramFrame({
  title,
  children,
  footnote,
}: {
  title?: string;
  children: ReactNode;
  footnote?: string;
}) {
  return (
    <div className="rounded-2xl border hairline bg-cream/30 p-5 sm:p-6">
      {title ? (
        <p className="mb-4 text-xs uppercase tracking-wider text-stone-soft">
          {title}
        </p>
      ) : null}
      {children}
      {footnote ? (
        <p className="mt-4 text-xs text-stone-soft">{footnote}</p>
      ) : null}
    </div>
  );
}

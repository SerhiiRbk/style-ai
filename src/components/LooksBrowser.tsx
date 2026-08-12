"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { DeleteSetButton } from "@/components/DeleteSetButton";

export type LooksBrowserItem = {
  id: string;
  /** Display name (set name, falling back to the occasion label). */
  name: string;
  /** Occasion label, shown as a small tag. */
  occasion: string;
  /** Pre-formatted date string (formatted server-side for stable SSR). */
  date: string;
  /** Signed thumbnail URL, or null when the set has no rendered look yet. */
  thumbUrl: string | null;
};

type ViewMode = "grid" | "list";
const STORAGE_KEY = "looks-view-mode";

// The chosen view mode is external state (localStorage), read via
// useSyncExternalStore so it hydrates cleanly (server → "grid") without a
// setState-in-effect. A module-level cache + listener set lets a same-tab
// write re-render immediately (the "storage" DOM event only fires cross-tab).
let cachedView: ViewMode | null = null;
const viewListeners = new Set<() => void>();

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "grid";
  return window.localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "grid";
}

function subscribeView(cb: () => void) {
  viewListeners.add(cb);
  return () => {
    viewListeners.delete(cb);
  };
}

function getViewSnapshot(): ViewMode {
  if (cachedView === null) cachedView = readStoredView();
  return cachedView;
}

function getViewServerSnapshot(): ViewMode {
  return "grid";
}

function writeView(next: ViewMode) {
  cachedView = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  viewListeners.forEach((l) => l());
}

function GridIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3.5" y1="6" x2="3.5" y2="6" />
      <line x1="3.5" y1="12" x2="3.5" y2="12" />
      <line x1="3.5" y1="18" x2="3.5" y2="18" />
    </svg>
  );
}

export function LooksBrowser({ sets }: { sets: LooksBrowserItem[] }) {
  const view = useSyncExternalStore(
    subscribeView,
    getViewSnapshot,
    getViewServerSnapshot,
  );
  // Deleted sets are tracked as ids to hide, so the visible list is derived
  // from the server-provided `sets` prop (no state sync effect needed).
  const [removed, setRemoved] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const items = sets.filter((s) => !removed.has(s.id));

  function choose(next: ViewMode) {
    writeView(next);
  }

  function handleDeleted(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-brass">Your sets</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Create a Look</h1>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center gap-0.5 rounded-full border hairline bg-cream/40 p-1"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => choose("grid")}
              aria-pressed={view === "grid"}
              title="Large previews"
              className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
                view === "grid"
                  ? "bg-ink text-paper"
                  : "text-stone hover:text-ink"
              }`}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              onClick={() => choose("list")}
              aria-pressed={view === "list"}
              title="List view"
              className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
                view === "list"
                  ? "bg-ink text-paper"
                  : "text-stone hover:text-ink"
              }`}
            >
              <ListIcon />
            </button>
          </div>
          <Link
            href="/create-look"
            className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            New set
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border hairline bg-cream/40 p-10 text-center">
          <p className="text-stone">You haven&apos;t created any looks yet.</p>
          <Link
            href="/create-look"
            className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            Create your first set
          </Link>
        </div>
      ) : view === "grid" ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <div
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border hairline bg-paper transition-colors hover:border-ink/30"
            >
              <div className="absolute right-2 top-2 z-10 rounded-full bg-paper/85 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <DeleteSetButton
                  setId={s.id}
                  variant="compact"
                  onDeleted={handleDeleted}
                />
              </div>
              <Link href={`/looks/${s.id}`} className="block">
                <div className="aspect-[9/16] w-full bg-cream/40">
                  {s.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.thumbUrl}
                      alt={s.occasion}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="font-display text-lg text-ink">{s.name}</p>
                  <p className="mt-0.5 text-xs text-stone-soft">{s.date}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-8 divide-y hairline rounded-2xl border hairline bg-paper">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-cream/30 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
            >
              <Link
                href={`/looks/${s.id}`}
                className="relative hidden h-16 w-12 shrink-0 overflow-hidden rounded-lg border hairline bg-cream/40 sm:block"
              >
                {s.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.thumbUrl}
                    alt=""
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/looks/${s.id}`}
                  className="block truncate font-display text-lg text-ink transition-colors hover:text-ink-soft"
                >
                  {s.name}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-sm text-stone">
                  <span>{s.date}</span>
                  <span className="text-stone-soft/60" aria-hidden>
                    ·
                  </span>
                  <DeleteSetButton
                    setId={s.id}
                    variant="compact"
                    onDeleted={handleDeleted}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                <span className="rounded-full border hairline bg-cream/40 px-3 py-1 text-xs text-stone">
                  {s.occasion}
                </span>
                <Link
                  href={`/looks/${s.id}`}
                  className="group inline-flex items-center justify-center gap-1 rounded-full border border-brass/40 bg-brass/5 px-5 py-2 text-sm text-ink transition-colors hover:border-brass/60 hover:bg-brass/10"
                >
                  <span className="transition-colors group-hover:text-brass">
                    Open
                  </span>
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

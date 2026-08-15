"use client";

import { useSyncExternalStore } from "react";

export type ViewMode = "grid" | "list";

type Store = {
  cached: ViewMode | null;
  listeners: Set<() => void>;
};

const stores = new Map<string, Store>();

function storeFor(key: string): Store {
  let s = stores.get(key);
  if (!s) {
    s = { cached: null, listeners: new Set() };
    stores.set(key, s);
  }
  return s;
}

function readStored(key: string, fallback: ViewMode): ViewMode {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === "list" || raw === "grid") return raw;
  return fallback;
}

export function useViewMode(
  storageKey: string,
  fallback: ViewMode = "grid",
): ViewMode {
  const s = storeFor(storageKey);
  return useSyncExternalStore(
    (cb) => {
      s.listeners.add(cb);
      return () => {
        s.listeners.delete(cb);
      };
    },
    () => {
      if (s.cached === null) s.cached = readStored(storageKey, fallback);
      return s.cached;
    },
    () => fallback,
  );
}

export function writeViewMode(storageKey: string, next: ViewMode) {
  const s = storeFor(storageKey);
  s.cached = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, next);
  }
  s.listeners.forEach((l) => l());
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

export function ViewModeToggle({
  storageKey,
  fallback = "grid",
}: {
  storageKey: string;
  fallback?: ViewMode;
}) {
  const view = useViewMode(storageKey, fallback);

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border hairline bg-cream/40 p-1"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => writeViewMode(storageKey, "grid")}
        aria-pressed={view === "grid"}
        title="Large previews"
        className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
          view === "grid" ? "bg-ink text-paper" : "text-stone hover:text-ink"
        }`}
      >
        <GridIcon />
      </button>
      <button
        type="button"
        onClick={() => writeViewMode(storageKey, "list")}
        aria-pressed={view === "list"}
        title="List view"
        className={`inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
          view === "list" ? "bg-ink text-paper" : "text-stone hover:text-ink"
        }`}
      >
        <ListIcon />
      </button>
    </div>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const MAX_TRYON_ITEMS = 4;

export type TryOnSelectionItem = {
  productId: string;
  title: string;
  image?: string;
};

type TryOnSelectionCtx = {
  items: TryOnSelectionItem[];
  isSelected: (productId: string) => boolean;
  /** Selection is at the 4-item cap. */
  full: boolean;
  toggle: (item: TryOnSelectionItem) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const Ctx = createContext<TryOnSelectionCtx | null>(null);

/** Multi-select state for the combined "try up to 4 pieces together" flow. */
export function TryOnSelectionProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TryOnSelectionItem[]>([]);

  const toggle = useCallback((item: TryOnSelectionItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.productId === item.productId)) {
        return prev.filter((i) => i.productId !== item.productId);
      }
      if (prev.length >= MAX_TRYON_ITEMS) return prev;
      return [...prev, item];
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<TryOnSelectionCtx>(
    () => ({
      items,
      isSelected: (productId) => items.some((i) => i.productId === productId),
      full: items.length >= MAX_TRYON_ITEMS,
      toggle,
      remove,
      clear,
    }),
    [items, toggle, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Null outside a provider, so TryOnButton works standalone elsewhere. */
export function useTryOnSelection(): TryOnSelectionCtx | null {
  return useContext(Ctx);
}

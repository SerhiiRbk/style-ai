"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ShoppingItem } from "@/lib/report";
import {
  parseLookEstimateOpinion,
  type LookEstimateOpinion,
} from "@/lib/look-estimate";
import { lookItemKey } from "@/lib/look-item-alts";
import { MAX_COMPLETE_LOOK_ANCHORS } from "@/lib/complete-look";
import type { CatalogTryOnStyle } from "@/components/TryOnStyleToggle";
import { useCredits } from "@/components/CreditsContext";

export type CompleteLookResult = {
  runId: string;
  items: ShoppingItem[];
  title: string;
  description: string;
  palette: string[];
  occasionId: string;
  lockedProductIds: string[];
  estimate: LookEstimateOpinion | null;
  personalised: boolean;
  tryOnUrl: string | null;
  tryOnError: string | null;
  tryOnStyle: CatalogTryOnStyle;
};

type CompleteLookCtx = {
  occasionId: string;
  setOccasionId: (id: string) => void;
  result: CompleteLookResult | null;
  loading: boolean;
  estimateLoading: boolean;
  error: string | null;
  complete: (
    productIds: string[],
    opts?: { style?: CatalogTryOnStyle },
  ) => Promise<void>;
  clear: () => void;
  replaceItem: (fromId: string, next: ShoppingItem) => void;
};

const Ctx = createContext<CompleteLookCtx | null>(null);

export function CompleteLookProvider({ children }: { children: ReactNode }) {
  const [occasionId, setOccasionId] = useState("smart_casual");
  const [result, setResult] = useState<CompleteLookResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimateRunRef = useRef<string | null>(null);
  const credits = useCredits();

  const complete = useCallback(
    async (productIds: string[], opts?: { style?: CatalogTryOnStyle }) => {
      if (productIds.length < 1 || productIds.length > MAX_COMPLETE_LOOK_ANCHORS) {
        setError(
          `Pick 1–${MAX_COMPLETE_LOOK_ANCHORS} pieces to complete a look.`,
        );
        return;
      }
      const tryOnStyle = opts?.style === "photo" ? "photo" : "studio";
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/catalog/complete-look", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds, occasionId, style: tryOnStyle }),
        });
        const data = await res.json().catch(() => ({}));
        if (typeof data.balance === "number") credits?.setBalance(data.balance);
        if (!res.ok) {
          setError(
            typeof data.error === "string"
              ? data.error
              : "Could not complete the look",
          );
          if (!Array.isArray(data.items) || !data.items.length) return;
        }
        const next: CompleteLookResult = {
          runId: crypto.randomUUID(),
          items: Array.isArray(data.items) ? data.items : [],
          title: typeof data.title === "string" ? data.title : "Completed look",
          description:
            typeof data.description === "string" ? data.description : "",
          palette: Array.isArray(data.palette) ? data.palette : [],
          occasionId:
            typeof data.occasionId === "string" ? data.occasionId : occasionId,
          lockedProductIds: Array.isArray(data.lockedProductIds)
            ? data.lockedProductIds
            : productIds,
          estimate: parseLookEstimateOpinion(data.estimate),
          personalised: data.personalised === true,
          tryOnUrl: typeof data.tryOnUrl === "string" ? data.tryOnUrl : null,
          tryOnError:
            !res.ok && typeof data.error === "string" ? data.error : null,
          tryOnStyle,
        };
        setResult(next);
        estimateRunRef.current = next.runId;
        setEstimateLoading(true);
        void fetch("/api/catalog/complete-look/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: next.title,
            description: next.description,
            occasionId: next.occasionId,
            items: next.items,
          }),
        })
          .then(async (est) => {
            const payload = await est.json().catch(() => ({}));
            const opinion = parseLookEstimateOpinion(payload.estimate);
            if (opinion) {
              setResult((prev) =>
                prev?.runId === next.runId ? { ...prev, estimate: opinion } : prev,
              );
            }
          })
          .catch(() => {
            /* shop still shows without Carlo */
          })
          .finally(() => {
            if (estimateRunRef.current === next.runId) {
              setEstimateLoading(false);
            }
          });
      } catch {
        setError("Could not complete the look");
      } finally {
        setLoading(false);
      }
    },
    [occasionId, credits],
  );

  const clear = useCallback(() => {
    estimateRunRef.current = null;
    setResult(null);
    setEstimateLoading(false);
    setError(null);
  }, []);

  const replaceItem = useCallback((fromId: string, next: ShoppingItem) => {
    setResult((prev) => {
      if (!prev) return prev;
      if (prev.lockedProductIds.includes(fromId)) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          lookItemKey(item) === fromId
            ? { ...next, alternatives: item.alternatives }
            : item,
        ),
      };
    });
  }, []);

  const value = useMemo<CompleteLookCtx>(
    () => ({
      occasionId,
      setOccasionId,
      result,
      loading,
      estimateLoading,
      error,
      complete,
      clear,
      replaceItem,
    }),
    [occasionId, result, loading, estimateLoading, error, complete, clear, replaceItem],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompleteLook(): CompleteLookCtx | null {
  return useContext(Ctx);
}

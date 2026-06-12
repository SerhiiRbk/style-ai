"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCredits } from "./CreditsContext";

type Kind = "hair" | "facial_hair" | "eyewear" | "accessories";

/**
 * Small overlay control to re-generate a single report photo (hairstyle,
 * facial-hair, eyewear or accessory) on the owner's reference photo for 1
 * credit. Rendered on top of an image; stops click propagation so it never
 * triggers the zoom viewer. Refreshes the server-rendered grid on success.
 */
export function RegenPhotoButton({
  reportId,
  kind,
  index,
  group,
  angle,
  cost = 1,
}: {
  reportId: string;
  kind: Kind;
  index: number;
  group?: "recommend" | "avoid";
  angle?: "front" | "side";
  cost?: number;
}) {
  const router = useRouter();
  const { balance, setBalance } = useCredits();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const creditsApply = balance !== null;
  const insufficient = creditsApply && (balance ?? 0) < cost;

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state === "loading" || insufficient) return;
    setState("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/report-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, kind, index, group, angle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        if (typeof data.balance === "number") setBalance(data.balance);
        setMsg(data.error ?? "Could not regenerate");
        return;
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      // Swap the displayed photo in place for instant feedback — the same
      // container holds the <img> rendered by ReportZoomImage.
      if (typeof data.image === "string" && data.image) {
        const root = btnRef.current?.parentElement;
        const img = root?.querySelector("img");
        if (img) {
          img.src = data.image;
          img.removeAttribute("srcset");
        }
      }
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
      setMsg("Could not regenerate");
    }
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={run}
      disabled={state === "loading" || insufficient}
      title={
        insufficient
          ? `Not enough credits to regenerate (${cost} credit)`
          : msg ?? `Regenerate this photo · ${cost} credit`
      }
      className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full border border-line bg-paper/90 px-2.5 py-1 text-[11px] text-ink shadow-sm backdrop-blur transition-colors hover:bg-paper disabled:opacity-50"
    >
      <span aria-hidden className={state === "loading" ? "animate-spin" : ""}>
        ↻
      </span>
      {state === "loading" ? "…" : cost}
    </button>
  );
}

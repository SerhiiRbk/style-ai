"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { formatOfferPrice } from "@/lib/currency";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";
import { useNavSession } from "@/components/NavSession";
import { MAX_TRYON_ITEMS } from "@/components/TryOnContext";
import type { TryOnOpinion, TryOnVerdict } from "@/lib/ai/tryon-opinion";

const TRYON_COST = 1;

const VERDICT_STYLE: Record<TryOnVerdict, { dot: string; label: string }> = {
  great: { dot: "bg-emerald-500", label: "Strong match" },
  good: { dot: "bg-brass", label: "Works for you" },
  caution: { dot: "bg-amber-500", label: "Wearable, with a caveat" },
};

type Candidate = {
  category: string;
  title: string;
  why: string;
  priceEur: number;
  priceNative?: number;
  currency?: string;
  retailer: string;
  url: string;
  color: string;
  colorName?: string;
  image?: string;
  productId?: string;
  similarPick?: boolean;
};

type Slot = {
  slot: number;
  category: string;
  garment: string;
  color: string | null;
  candidates: Candidate[];
};

type Analysis = {
  ok: boolean;
  lookTitle: string;
  description: string;
  palette: string[];
  slots: Slot[];
  personalised: boolean;
  message?: string;
};

type Phase = "idle" | "analyzing" | "result" | "error";

const MAX_EDGE = 1024;

/** Downscale + re-encode client-side so uploads stay small and EXIF-rotated. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => createImageBitmap(file));
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ShopALookExperience() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { balance, setBalance } = useNavSession();

  // slot index -> chosen productId to render in the try-on (max MAX_TRYON_ITEMS).
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [tryState, setTryState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [tryUrl, setTryUrl] = useState<string | null>(null);
  const [tryMsg, setTryMsg] = useState<string | null>(null);
  const [opinion, setOpinion] = useState<TryOnOpinion | null>(null);
  const [opinionState, setOpinionState] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const [opinionNoProfile, setOpinionNoProfile] = useState(false);

  /** Pre-select the best match of each slot, capped at the try-on item limit. */
  function defaultSelection(slots: Slot[]): Record<number, string> {
    const sel: Record<number, string> = {};
    for (const s of slots) {
      if (Object.keys(sel).length >= MAX_TRYON_ITEMS) break;
      const best = s.candidates[0];
      if (best?.productId) sel[s.slot] = best.productId;
    }
    return sel;
  }

  const selectedIds = Object.values(selected);
  const selectedCount = selectedIds.length;

  function toggleCandidate(slot: number, productId: string) {
    setTryState("idle");
    setTryUrl(null);
    setTryMsg(null);
    setOpinion(null);
    setOpinionState("idle");
    setSelected((prev) => {
      const next = { ...prev };
      if (next[slot] === productId) {
        delete next[slot]; // tapping the chosen piece again removes the slot
      } else {
        if (!(slot in next) && Object.keys(next).length >= MAX_TRYON_ITEMS) {
          return prev; // at the cap and this is a new slot — ignore
        }
        next[slot] = productId;
      }
      return next;
    });
  }

  async function runTryOn() {
    if (!selectedCount || tryState === "loading") return;
    setTryState("loading");
    setTryMsg(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedIds, origin: "shop_a_look" }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.balance === "number") setBalance(data.balance);
      if (!res.ok) {
        setTryState(tryUrl ? "done" : "error");
        if (res.status === 402) {
          setTryMsg("Not enough credits — top up to render.");
        } else if (data.code === "needs_full_photo" || data.code === "no_photos") {
          setTryMsg(
            "Add a full-length photo in your account to try looks on yourself.",
          );
        } else {
          setTryMsg(data.error ?? "Try-on failed — please try again.");
        }
        return;
      }
      setTryUrl(data.url);
      setTryState("done");
      void fetchOpinion(
        [...selectedIds],
        typeof data.tryonId === "string" ? data.tryonId : undefined,
      );
    } catch {
      setTryState(tryUrl ? "done" : "error");
      setTryMsg("Try-on failed — please try again.");
    }
  }

  /** Carlo's read on the rendered look — best-effort, never blocks the image. */
  async function fetchOpinion(productIds: string[], tryonId?: string) {
    if (!productIds.length) return;
    setOpinion(null);
    setOpinionNoProfile(false);
    setOpinionState("loading");
    try {
      const res = await fetch("/api/tryon/opinion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, tryonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.opinion) {
        setOpinion(data.opinion as TryOnOpinion);
        setOpinionNoProfile(data.hasProfile === false);
      }
    } catch {
      /* opinion is best-effort — the render already succeeded */
    } finally {
      setOpinionState("done");
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setNeedsAuth(false);
    let dataUrl: string;
    try {
      dataUrl = await toDataUrl(file);
    } catch {
      setError("Could not read that image. Try a different photo.");
      setPhase("error");
      return;
    }
    setPreview(dataUrl);
    setPhase("analyzing");
    try {
      const res = await fetch("/api/shop-a-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (res.status === 401) {
        setNeedsAuth(true);
        setPhase("error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Analysis failed");
      if (!data.ok) {
        setError(
          data.message ??
            "We couldn't read an outfit in that photo. Try a clearer shot.",
        );
        setPhase("error");
        return;
      }
      const analysis = data as Analysis;
      setResult(analysis);
      setSelected(defaultSelection(analysis.slots));
      setTryState("idle");
      setTryUrl(null);
      setTryMsg(null);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setPreview(null);
    setResult(null);
    setError(null);
    setNeedsAuth(false);
    setSelected({});
    setTryState("idle");
    setTryUrl(null);
    setTryMsg(null);
    setOpinion(null);
    setOpinionState("idle");
    setOpinionNoProfile(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const totalMatches =
    result?.slots.reduce((n, s) => n + s.candidates.length, 0) ?? 0;

  return (
    <div>
      {phase === "idle" && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center transition-colors ${
            dragOver
              ? "border-brass bg-brass/5"
              : "border-line bg-cream/40 hover:border-ink/30 hover:bg-paper"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <span className="font-display text-xl text-ink">
            Drop an outfit photo
          </span>
          <span className="mt-2 max-w-sm text-sm leading-relaxed text-stone">
            A look you saved from Instagram, Pinterest, a friend or the street.
            We&apos;ll find the closest pieces from the catalogue — in your
            colours.
          </span>
          <span className="mt-5 inline-flex items-center rounded-full border border-brass/30 bg-brass/5 px-4 py-2 text-sm text-brass">
            Choose a photo
          </span>
          <span className="mt-4 text-[11px] text-stone-soft">
            Your photo is used only to read the clothes — we don&apos;t store it.
          </span>
        </label>
      )}

      {phase === "analyzing" && (
        <div className="flex flex-col items-center rounded-2xl border hairline bg-gradient-to-br from-cream/80 via-paper to-brass/5 px-6 py-16 text-center">
          {preview ? (
            <div className="mb-6 h-40 w-32 overflow-hidden rounded-xl border hairline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Your look"
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <LuxeSpinner size="lg" tone="brass" />
          <p className="mt-4 font-display text-lg text-ink">Reading the look…</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone">
            Carlo is breaking the outfit into pieces and searching your edit for
            the closest matches.
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-2xl border hairline bg-cream/40 px-6 py-14 text-center">
          {needsAuth ? (
            <>
              <p className="font-display text-xl text-ink">
                Sign in to shop a look
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-stone">
                Matches are tuned to your colours and fit, so you&apos;ll need an
                account. It&apos;s free to start.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-full border border-brass/30 bg-brass/5 px-4 py-2 text-sm text-brass hover:border-brass/50"
                >
                  Sign in
                </Link>
                <button
                  onClick={reset}
                  className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm text-stone hover:text-ink"
                >
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-lg text-ink">{error}</p>
              <button
                onClick={reset}
                className="mt-5 inline-flex items-center rounded-full border border-brass/30 bg-brass/5 px-4 py-2 text-sm text-brass hover:border-brass/50"
              >
                Try another photo
              </button>
            </>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {preview ? (
              <div className="h-48 w-36 shrink-0 overflow-hidden rounded-xl border hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Your look"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="eyebrow">The look</p>
              <h2 className="mt-2 font-display text-2xl text-ink">
                {result.lookTitle}
              </h2>
              {result.description ? (
                <p className="mt-2 text-sm leading-relaxed text-stone">
                  {result.description}
                </p>
              ) : null}
              {result.palette.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.palette.map((hex, i) => (
                    <span
                      key={`${hex}-${i}`}
                      className="h-7 w-7 rounded-md border border-ink/10"
                      style={{ background: hex }}
                      title={hex}
                    />
                  ))}
                </div>
              ) : null}
              {!result.personalised ? (
                <p className="mt-4 max-w-md text-[12px] leading-relaxed text-stone-soft">
                  Tip:{" "}
                  <Link href="/start" className="text-brass hover:text-ink">
                    create a style report
                  </Link>{" "}
                  and matches will be re-ranked for your palette and fit.
                </p>
              ) : null}
            </div>
          </div>

          {totalMatches === 0 ? (
            <p className="mt-10 rounded-xl border hairline bg-cream/40 px-5 py-8 text-center text-sm text-stone">
              We read the outfit but nothing in the catalogue was close enough in
              your palette yet. Try another look.
            </p>
          ) : (
            <div className="mt-10 space-y-10">
              {result.slots.map((slot) => (
                <div key={slot.slot}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-lg capitalize text-ink">
                      {slot.color ? `${slot.color} ` : ""}
                      {slot.garment}
                    </h3>
                    <span className="text-[11px] uppercase tracking-wide text-stone-soft">
                      {slot.category}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {slot.candidates.map((c, i) => (
                      <CandidateCard
                        key={c.productId ?? `${slot.slot}-${i}`}
                        c={c}
                        primary={i === 0}
                        selected={
                          Boolean(c.productId) &&
                          selected[slot.slot] === c.productId
                        }
                        onToggle={
                          c.productId
                            ? () => toggleCandidate(slot.slot, c.productId!)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalMatches > 0 ? (
            <div className="mt-12 rounded-2xl border hairline bg-cream/40 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-lg text-ink">
                    Try this look on you
                  </p>
                  <p className="mt-1 text-sm text-stone">
                    {selectedCount > 0
                      ? `${selectedCount} piece${
                          selectedCount === 1 ? "" : "s"
                        } selected${
                          selectedCount >= MAX_TRYON_ITEMS
                            ? ` (max ${MAX_TRYON_ITEMS})`
                            : ""
                        } · rendered on your default photo.`
                      : "Tap the circle on the pieces you want, then render them on your photo."}
                  </p>
                </div>
                <button
                  onClick={runTryOn}
                  disabled={selectedCount === 0 || tryState === "loading"}
                  className="inline-flex min-h-[2.5rem] shrink-0 items-center justify-center rounded-full border border-brass/40 bg-brass/10 px-5 py-2.5 text-sm text-brass transition-colors hover:border-brass hover:bg-brass/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tryState === "loading" ? (
                    "Rendering…"
                  ) : (
                    <>
                      Try it on me
                      <span className="text-stone-soft">
                        {" "}
                        · {TRYON_COST} credit →
                      </span>
                    </>
                  )}
                </button>
              </div>

              {balance !== null ? (
                <p className="mt-2 text-[11px] text-stone-soft">
                  Balance: {balance} credit{balance === 1 ? "" : "s"}
                </p>
              ) : null}
              {tryMsg ? (
                <p className="mt-2 text-xs text-stone-soft">
                  {tryMsg}{" "}
                  {tryMsg.includes("credits") ? (
                    <Link href="/pricing" className="text-brass hover:text-ink">
                      Buy credits
                    </Link>
                  ) : tryMsg.includes("account") ? (
                    <Link href="/account" className="text-brass hover:text-ink">
                      Go to account
                    </Link>
                  ) : null}
                </p>
              ) : null}

              {tryState === "loading" ? (
                <div className="mt-4 flex flex-col items-center rounded-xl border hairline bg-paper px-6 py-10 text-center">
                  <LuxeSpinner size="lg" tone="brass" />
                  <p className="mt-4 font-display text-lg text-ink">
                    Dressing your photo…
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone">
                    We&apos;re rendering the selected pieces on you. Usually
                    30–90 seconds — stay on this page.
                  </p>
                </div>
              ) : null}

              {tryUrl && tryState !== "loading" ? (
                <div className="mt-4 overflow-hidden rounded-xl border hairline">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tryUrl}
                    alt="This look on you"
                    className="w-full"
                  />
                </div>
              ) : null}

              {tryState === "done" && opinionState === "loading" ? (
                <p className="mt-3 text-xs text-stone-soft">
                  Carlo is taking a look…
                </p>
              ) : null}

              {tryState === "done" && opinion ? (
                <div className="mt-4 rounded-xl border hairline bg-paper p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${VERDICT_STYLE[opinion.verdict].dot}`}
                      aria-hidden
                    />
                    <span className="text-[10px] uppercase tracking-wider text-brass">
                      Carlo · {VERDICT_STYLE[opinion.verdict].label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-snug text-ink">
                    {opinion.headline}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-stone">
                    {opinion.body}
                  </p>
                  {opinion.pairWith.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-wider text-stone-soft">
                        Complete the look
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {opinion.pairWith.map((p, i) => (
                          <li
                            key={i}
                            className="text-[13px] leading-snug text-stone"
                          >
                            · {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {opinionNoProfile ? (
                    <p className="mt-3 border-t hairline pt-2 text-[11px] text-stone-soft">
                      General guidance —{" "}
                      <Link href="/start" className="text-brass hover:text-ink">
                        create a report
                      </Link>{" "}
                      for advice tuned to you.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-12 border-t hairline pt-6 text-center">
            <button
              onClick={reset}
              className="inline-flex items-center rounded-full border border-line px-5 py-2.5 text-sm text-stone transition-colors hover:border-ink/30 hover:text-ink"
            >
              Shop another look
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  c,
  primary,
  selected,
  onToggle,
}: {
  c: Candidate;
  primary: boolean;
  selected: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-xl border bg-paper transition-colors ${
        selected ? "border-brass ring-1 ring-brass/40" : "hairline hover:border-ink/20"
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-cream/40">
        {c.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.image}
            alt={c.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span
            className="absolute inset-0"
            style={{ background: c.color }}
            aria-hidden
          />
        )}
        {primary ? (
          <span className="absolute left-2 top-2 rounded-full bg-brass px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-paper">
            Best match
          </span>
        ) : c.similarPick ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-paper">
            Closest match
          </span>
        ) : null}
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            aria-label={selected ? "Remove from try-on" : "Add to try-on"}
            title={selected ? "Remove from try-on" : "Add to try-on"}
            className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-colors ${
              selected
                ? "border-brass bg-brass text-paper"
                : "border-white/70 bg-black/25 text-white hover:bg-black/40"
            }`}
          >
            {selected ? "✓" : "+"}
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm text-ink">{c.title}</p>
        {c.colorName ? (
          <span className="mt-1 flex items-center gap-1.5 text-[11px] capitalize text-stone-soft">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-ink/10"
              style={{ background: c.color }}
            />
            {c.colorName}
          </span>
        ) : null}
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-stone-soft">
          {c.why}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-sm text-ink">
            {formatOfferPrice({
              priceEur: c.priceEur,
              displayCurrency: "EUR",
              offerCurrency: c.currency,
              priceNative: c.priceNative,
            })}
          </span>
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="text-[11px] text-brass hover:text-ink"
          >
            Shop →
          </a>
        </div>
      </div>
    </div>
  );
}

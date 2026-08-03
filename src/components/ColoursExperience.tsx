"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ButtonLink } from "@/components/Button";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";
import { formatOfferPrice } from "@/lib/currency";
import { ITEM_BUDGET_BANDS } from "@/lib/budgets";
import {
  QUIZ_QUESTIONS,
  quizToResult,
  type QuizAnswers,
} from "@/lib/colour-quiz";
import type { ColourAnalysisResult } from "@/lib/colour-palette";

type Phase =
  | "idle"
  | "analyzing"
  | "result"
  | "error"
  | "capped"
  | "gate"
  | "quiz";

const MAX_EDGE = 768;

/** Occasion chips — mirrors LOOK_CONTEXTS (kept inline to stay out of the client bundle's server deps). */
const OCCASIONS: { id: string; label: string }[] = [
  { id: "smart_casual", label: "Smart casual" },
  { id: "work", label: "Work" },
  { id: "weekend", label: "Weekend" },
  { id: "dinner", label: "Dinner" },
  { id: "formal", label: "Formal" },
  { id: "travel", label: "Travel" },
];

const BUDGET_OPTIONS: { id: string; label: string }[] = [
  { id: "any", label: "Any price" },
  ...ITEM_BUDGET_BANDS.map((b) => ({ id: b.id, label: b.label })),
];

const DEFAULT_OCCASION = "smart_casual";
const DEFAULT_BUDGET = "50-150";

type RecCandidate = {
  title: string;
  priceEur: number;
  priceNative?: number;
  currency?: string;
  retailer: string;
  url: string;
  color: string;
  colorName?: string;
  image?: string;
  productId?: string;
  outsideBudget?: boolean;
  similarPick?: boolean;
};

type RecSlot = {
  slot: number;
  category: string;
  garment: string;
  color: string | null;
  candidates: RecCandidate[];
};

/** Fire-and-forget funnel event (uses sendBeacon so it survives navigation). */
function trackEvent(name: string, props?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ name, anonId: getAnonId(), props });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* analytics must never break the UI */
  }
}

// --- Local session persistence: survive a page refresh ----------------------
// Keep the palette, the uploaded photo preview and the matched products on the
// device so a reload shows exactly what the visitor saw. Best-effort: quota /
// private-mode failures degrade silently. Cleared by "Clear" / "Try another".
const COLOURS_SESSION_KEY = "valetti_colours_session";
const COLOURS_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type ColoursSession = {
  result: ColourAnalysisResult;
  preview: string | null;
  recs: RecSlot[] | null;
  occasion: string;
  budgetId: string;
  fetchedKey: string | null;
  preliminary: boolean;
  source: "photo" | "quiz";
  savedAt: number;
};

function loadColoursSession(): ColoursSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COLOURS_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ColoursSession;
    if (!s?.result || typeof s.savedAt !== "number") return null;
    if (Date.now() - s.savedAt > COLOURS_SESSION_TTL_MS) {
      localStorage.removeItem(COLOURS_SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveColoursSession(s: ColoursSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLOURS_SESSION_KEY, JSON.stringify(s));
  } catch {
    // Quota (large preview dataURL) or private mode — persistence is optional.
  }
}

function clearColoursSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COLOURS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** No-photo second entry (§5.2 п.9): one question per screen, computed locally. */
function ColourQuiz({
  onComplete,
  onCancel,
}: {
  onComplete: (a: QuizAnswers) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const q = QUIZ_QUESTIONS[step];

  function choose(value: string) {
    const next = { ...answers, [q.id]: value } as Partial<QuizAnswers>;
    setAnswers(next);
    if (step + 1 < QUIZ_QUESTIONS.length) setStep(step + 1);
    else onComplete(next as QuizAnswers);
  }

  return (
    <div className="rounded-2xl border hairline bg-paper p-6 sm:p-10">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-stone-soft">
          Question {step + 1} of {QUIZ_QUESTIONS.length}
        </p>
        <button
          type="button"
          onClick={step === 0 ? onCancel : () => setStep(step - 1)}
          className="text-sm text-stone underline transition-colors hover:text-ink"
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-cream">
        <div
          className="h-full bg-ink transition-all"
          style={{ width: `${((step + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
        />
      </div>

      <h2 className="mt-6 font-display text-2xl text-ink">{q.prompt}</h2>
      {q.help ? (
        <p className="mt-1 text-sm text-stone">{q.help}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {q.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            className="rounded-full border border-ink/25 px-4 py-2.5 text-sm text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Stable anonymous id for soft per-visitor limits + funnel stitching (A0/A1). */
function getAnonId(): string {
  try {
    const KEY = "valetti_anon";
    // Prefer the server-set cookie (proxy bootstrap) so client + server agree —
    // that shared id is what lets registration stitch the anon funnel (§5.2 п.7).
    const cookie = document.cookie.match(/(?:^|;\s*)valetti_anon=([^;]+)/);
    if (cookie) {
      const id = decodeURIComponent(cookie[1]);
      localStorage.setItem(KEY, id);
      return id;
    }
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    document.cookie = `valetti_anon=${id}; path=/; max-age=31536000; samesite=lax`;
    return id;
  } catch {
    return "";
  }
}

/**
 * Soft email capture — shown after a result ("email my palette") and behind the
 * A0 daily-cap lead magnet. Stores a lead; the email itself is A3.
 */
function LeadForm({
  source,
  subseason,
}: {
  source: "colours_result" | "colours_cap";
  subseason?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending" || state === "done") return;
    setState("sending");
    setErr(null);
    try {
      const res = await fetch("/api/colours/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, subseason, anonId: getAnonId() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="text-sm text-stone">
        Thanks — we&apos;ll send your palette to{" "}
        <span className="text-ink">{email}</span> shortly.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-sm flex-col gap-2 sm:flex-row"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="min-w-0 flex-1 rounded-full border border-ink/25 bg-paper px-4 py-2.5 text-sm text-ink outline-none placeholder:text-stone-soft focus:border-ink"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink/90 disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Email my palette"}
      </button>
      {err && <p className="text-sm text-red-700 sm:hidden">{err}</p>}
    </form>
  );
}

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

export function ColoursExperience() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ColourAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [recs, setRecs] = useState<RecSlot[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  // Cap / soft-gate message from the server (spend fuse) — shown instead of the
  // neutral empty state so visitors don't keep retrying a capped endpoint.
  const [recsNotice, setRecsNotice] = useState<string | null>(null);
  // The occasion|budget the currently-shown recs were fetched for, so we can
  // flag when the filters have drifted and offer an "Update matches" refresh.
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [occasion, setOccasion] = useState(DEFAULT_OCCASION);
  const [budgetId, setBudgetId] = useState(DEFAULT_BUDGET);
  const [preliminary, setPreliminary] = useState(false);
  const recsSource = useRef<"photo" | "quiz">("photo");
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchRecs(subseason: string, occ: string, budget: string) {
    setRecsLoading(true);
    try {
      const res = await fetch("/api/colours/looks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subseason,
          occasion: occ,
          budgetId: budget,
          source: recsSource.current,
          anonId: getAnonId(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setRecs(res.ok && Array.isArray(data.slots) ? data.slots : []);
      setRecsNotice(typeof data.message === "string" ? data.message : null);
      setFetchedKey(`${occ}|${budget}`);
    } catch {
      setRecs([]);
      setRecsNotice(null);
      setFetchedKey(`${occ}|${budget}`);
    } finally {
      setRecsLoading(false);
    }
  }

  /** Fetch recommendations on demand for the current palette + filters. */
  function runRecs() {
    if (!result || recsLoading) return;
    trackEvent("shop_colours_click", { occasion, budget: budgetId });
    void fetchRecs(result.subseason, occasion, budgetId);
  }

  // Filters only update the selection now — matching runs when the user asks.
  function changeOccasion(next: string) {
    if (next === occasion) return;
    setOccasion(next);
    trackEvent("filter_changed", { kind: "occasion", value: next });
  }

  function changeRecBudget(next: string) {
    if (next === budgetId) return;
    setBudgetId(next);
    trackEvent("filter_changed", { kind: "budget", value: next });
  }

  function startQuiz() {
    trackEvent("quiz_started");
    setPhase("quiz");
  }

  function finishQuiz(answers: QuizAnswers) {
    const computed = quizToResult(answers);
    recsSource.current = "quiz";
    setPreliminary(true);
    setResult(computed);
    setPhase("result");
    setOccasion(DEFAULT_OCCASION);
    setBudgetId(DEFAULT_BUDGET);
    setRecs(null);
    setFetchedKey(null);
  }

  async function handleFile(file: File) {
    setError(null);
    setShared(false);
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
    trackEvent("colours_started");
    try {
      const res = await fetch("/api/colours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, anonId: getAnonId() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      // Daily cap reached (A0): capture the visitor instead of losing them.
      if (data.capped) {
        setNotice(
          data.message ?? "We're at capacity for free readings today.",
        );
        setPhase("capped");
        return;
      }
      // Per-visitor soft gate: their palette is saved, nudge sign-up.
      if (data.softGate) {
        setNotice(
          data.message ?? "You've used your free readings for today.",
        );
        setPhase("gate");
        return;
      }
      const analysed = data.result as ColourAnalysisResult;
      setPreliminary(false);
      recsSource.current = "photo";
      setResult(analysed);
      setPhase("result");
      // Recommendations are now on-demand: the palette shows first, and the
      // visitor runs "Shop your colours" themselves via the button below.
      setOccasion(DEFAULT_OCCASION);
      setBudgetId(DEFAULT_BUDGET);
      setRecs(null);
      setFetchedKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("error");
    }
  }

  function reset() {
    clearColoursSession();
    setPhase("idle");
    setPreview(null);
    setResult(null);
    setError(null);
    setNotice(null);
    setRecs(null);
    setRecsLoading(false);
    setRecsNotice(null);
    setFetchedKey(null);
    setOccasion(DEFAULT_OCCASION);
    setBudgetId(DEFAULT_BUDGET);
    setPreliminary(false);
    recsSource.current = "photo";
    if (inputRef.current) inputRef.current.value = "";
  }

  /** Clear everything (incl. local storage) and open the file picker to re-upload. */
  function tryAnotherPhoto() {
    reset();
    setTimeout(() => inputRef.current?.click(), 0);
  }

  /** Restore a persisted session so a page refresh shows the same result. */
  function applySession(s: ColoursSession) {
    setResult(s.result);
    setPreview(s.preview ?? null);
    setRecs(s.recs ?? null);
    setRecsNotice(null);
    setOccasion(s.occasion ?? DEFAULT_OCCASION);
    setBudgetId(s.budgetId ?? DEFAULT_BUDGET);
    setFetchedKey(s.fetchedKey ?? null);
    setPreliminary(Boolean(s.preliminary));
    recsSource.current = s.source === "quiz" ? "quiz" : "photo";
    setPhase("result");
  }

  // Rehydrate a saved session on mount (survives refresh).
  useEffect(() => {
    const s = loadColoursSession();
    if (!s) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    applySession(s);
  }, []);

  // Persist the current result + photo + matches whenever they change.
  useEffect(() => {
    if (phase !== "result" || !result) return;
    saveColoursSession({
      result,
      preview,
      recs,
      occasion,
      budgetId,
      fetchedKey,
      preliminary,
      source: recsSource.current,
      savedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, preview, recs, occasion, budgetId, fetchedKey, preliminary]);

  async function share() {
    if (!result) return;
    // Keep the domain out of `text` so it isn't duplicated next to `url`.
    const text = `My colours are ${result.subseasonLabel} — find yours free with Valetti’s colour analysis for men.`;
    // Link to the specific palette so the shared card shows this result.
    const url = `https://www.valetti.fit/colours/${result.subseason}?u=${result.undertone}&c=${result.contrast}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My colours — Valetti", text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch {
      /* user dismissed the share sheet — ignore */
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {(phase === "idle" || phase === "error") && (
        <div className="rounded-2xl border hairline bg-paper p-6 text-center sm:p-10">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-dashed border-line px-6 py-10 transition-colors hover:border-ink/40"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream text-2xl text-ink">
              ↑
            </span>
            <span className="font-display text-xl text-ink">
              Upload a selfie
            </span>
            <span className="text-sm text-stone">
              A clear, front-on photo in natural light works best.
            </span>
          </button>
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
          <p className="mt-6 text-xs text-stone-soft">
            We analyse your photo to read your colours and don&apos;t keep it.
          </p>
          <p className="mt-4 text-sm text-stone">
            Prefer not to share a photo?{" "}
            <button
              type="button"
              onClick={startQuiz}
              className="text-ink underline underline-offset-2 transition-colors hover:text-stone"
            >
              Answer 5 quick questions
            </button>
          </p>
        </div>
      )}

      {phase === "quiz" && (
        <ColourQuiz onComplete={finishQuiz} onCancel={reset} />
      )}

      {phase === "analyzing" && (
        <div className="rounded-2xl border hairline bg-paper p-10 text-center">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="mx-auto h-28 w-28 rounded-full object-cover opacity-90"
            />
          )}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ink [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-stone [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-stone-soft [animation-delay:300ms]" />
          </div>
          <p className="mt-4 font-display text-lg italic text-stone">
            Carlo is reading your colouring…
          </p>
        </div>
      )}

      {phase === "capped" && (
        <div className="rounded-2xl border hairline bg-paper p-6 text-center sm:p-10">
          <h2 className="font-display text-2xl text-ink">
            We&apos;re at capacity today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-stone">{notice}</p>
          <div className="mt-6 flex justify-center">
            <LeadForm source="colours_cap" />
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-6 text-sm text-stone underline transition-colors hover:text-ink"
          >
            Try again later
          </button>
        </div>
      )}

      {phase === "gate" && (
        <div className="rounded-2xl border hairline bg-paper p-6 text-center sm:p-10">
          <h2 className="font-display text-2xl text-ink">
            Your palette is saved
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-stone">{notice}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/start">Create a free account →</ButtonLink>
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="overflow-hidden rounded-2xl border hairline bg-paper">
          <div className="border-b hairline bg-cream/50 px-6 py-4 sm:px-8">
            <p className="eyebrow">Your colours — free</p>
          </div>
          {preliminary && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline bg-brass/10 px-6 py-3 sm:px-8">
              <p className="text-sm text-ink">
                Preliminary result from your answers. A photo reads your
                undertone far more accurately.
              </p>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 text-sm text-ink underline underline-offset-2 transition-colors hover:text-stone"
              >
                Refine with a photo →
              </button>
            </div>
          )}
          <div className="px-6 py-8 sm:px-8">
            <div className="flex items-start gap-5">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="hidden h-20 w-20 shrink-0 rounded-xl object-cover sm:block"
                />
              )}
              <div>
                <h2 className="font-display text-4xl leading-none text-ink">
                  {result.subseasonLabel}
                </h2>
                <p className="mt-2 text-sm text-stone">
                  {result.undertone} undertone · {result.contrast} contrast ·{" "}
                  {result.skinTone}
                </p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-4 gap-3.5 sm:grid-cols-8 sm:gap-4">
              {result.palette.map((s) => (
                <div key={s.hex} className="flex flex-col items-center gap-2">
                  <span
                    className="relative h-14 w-14 overflow-hidden rounded-xl ring-1 ring-ink/10 sm:h-16 sm:w-16"
                    style={{ background: s.hex }}
                    title={s.name}
                  >
                    {/* Soft fabric sheen + weave grain */}
                    <span
                      className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-ink/20"
                      aria-hidden
                    />
                    <span
                      className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-multiply"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(21,18,13,0.06) 1px, rgba(21,18,13,0.06) 2px), repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(21,18,13,0.05) 1px, rgba(21,18,13,0.05) 2px)",
                        backgroundSize: "3px 3px",
                      }}
                      aria-hidden
                    />
                    <span
                      className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-6px_12px_rgba(21,18,13,0.12)]"
                      aria-hidden
                    />
                  </span>
                  <span className="text-[10px] leading-tight text-stone">
                    {s.name}
                  </span>
                </div>
              ))}
            </div>

            <blockquote className="relative mt-7 overflow-hidden rounded-2xl border hairline bg-gradient-to-br from-cream/90 via-cream/50 to-paper p-5 sm:p-6">
              <div
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brass/60 to-transparent"
                aria-hidden
              />
              <div className="flex gap-4 sm:gap-5">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-brass/30 sm:h-12 sm:w-12">
                  <Image
                    src="/images/carlo-avatar.png"
                    alt="Carlo Valetti"
                    fill
                    sizes="48px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-brass">
                    Carlo says
                  </p>
                  <p className="mt-1.5 font-display text-lg leading-relaxed text-ink-soft sm:text-xl">
                    {result.carloNote}
                  </p>
                </div>
              </div>
            </blockquote>

            {/* Shop your colours — anonymous palette-based recommendations (§5). */}
            <div className="mt-8 border-t hairline pt-7">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl text-ink">
                  Shop your colours
                </h3>
                <span className="text-xs text-stone-soft">
                  Real pieces in your palette
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => changeOccasion(o.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      occasion === o.id
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/20 text-ink hover:border-ink/50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => changeRecBudget(b.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                      budgetId === b.id
                        ? "border-brass bg-brass/10 text-ink"
                        : "border-ink/15 text-stone hover:border-ink/40"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runRecs}
                  disabled={recsLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
                >
                  {recs === null ? "Shop your colours →" : "Update matches"}
                </button>
                {recs !== null &&
                !recsLoading &&
                fetchedKey !== `${occasion}|${budgetId}` ? (
                  <span className="text-xs text-stone-soft">
                    Filters changed — update to refresh.
                  </span>
                ) : null}
              </div>

              <div className="mt-6">
                {recsLoading ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                    <LuxeSpinner size="lg" tone="brass" />
                    <p className="text-sm text-stone">
                      Matching pieces to your colour profile…
                    </p>
                  </div>
                ) : recsNotice ? (
                  <div className="rounded-xl border hairline bg-cream/40 p-5">
                    <p className="text-sm text-stone">{recsNotice}</p>
                    <div className="mt-3">
                      <ButtonLink
                        href="/start"
                        onClick={() => trackEvent("tryon_gate_click")}
                      >
                        Create a free account →
                      </ButtonLink>
                    </div>
                  </div>
                ) : recs === null ? (
                  <p className="text-sm text-stone">
                    Pick an occasion and budget, then tap “Shop your colours” to
                    see real pieces in your palette.
                  </p>
                ) : recs.length ? (
                  <div className="flex flex-col gap-7">
                    {recs.map((slot) => (
                      <div key={slot.slot}>
                        <p className="text-xs uppercase tracking-wide text-stone-soft">
                          {slot.color ? `${slot.color} ` : ""}
                          {slot.garment}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {slot.candidates.map((c, i) => (
                            <a
                              key={(c.productId ?? c.url) + i}
                              href={c.url}
                              target="_blank"
                              rel="nofollow sponsored noopener noreferrer"
                              onClick={() =>
                                trackEvent("affiliate_click", {
                                  productId: c.productId,
                                  retailer: c.retailer,
                                  category: slot.category,
                                })
                              }
                              className="group flex flex-col overflow-hidden rounded-xl border hairline bg-paper transition-colors hover:border-ink/40"
                            >
                              <span className="relative block aspect-[3/4] w-full overflow-hidden bg-cream">
                                {c.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={c.image}
                                    alt={c.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : null}
                                {c.outsideBudget ? (
                                  <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] text-paper">
                                    Outside budget
                                  </span>
                                ) : null}
                              </span>
                              <span className="flex flex-1 flex-col gap-1 p-2.5">
                                <span className="line-clamp-2 text-xs text-ink">
                                  {c.title}
                                </span>
                                <span className="mt-auto flex items-center justify-between gap-2">
                                  <span className="text-sm text-ink">
                                    {formatOfferPrice({
                                      priceEur: c.priceEur,
                                      displayCurrency: c.currency ?? "EUR",
                                      offerCurrency: c.currency,
                                      priceNative: c.priceNative,
                                    })}
                                  </span>
                                  <span className="truncate text-[11px] text-stone">
                                    {c.retailer}
                                  </span>
                                </span>
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone">
                    No pieces for this combination yet — try another occasion or
                    budget.
                  </p>
                )}
              </div>

              <div className="mt-7 rounded-xl border hairline bg-cream/40 p-4 sm:p-5">
                <p className="font-display text-lg text-ink">
                  See these on yourself
                </p>
                <p className="mt-1 text-sm text-stone">
                  Create a free account to try any of these on your own photo.
                </p>
                <div className="mt-3">
                  <ButtonLink
                    href="/start"
                    onClick={() => trackEvent("tryon_gate_click")}
                  >
                    Try it on yourself — free →
                  </ButtonLink>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/25 px-7 py-3 text-sm tracking-wide text-ink transition-all hover:border-ink hover:bg-ink hover:text-paper"
              >
                {shared ? "Copied — paste to share" : "Share my palette"}
              </button>
              <button
                type="button"
                onClick={tryAnotherPhoto}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/25 px-7 py-3 text-sm tracking-wide text-ink transition-all hover:border-ink hover:bg-ink hover:text-paper"
              >
                Try another photo
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-sm text-stone underline transition-colors hover:text-ink"
              >
                Clear
              </button>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-stone-soft">
                Save for social
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={`/api/og/colours/${result.subseason}?format=story&u=${result.undertone}&c=${result.contrast}`}
                  download={`valetti-colours-${result.subseason}-story.jpg`}
                  className="rounded-full border border-ink/25 px-4 py-2 text-sm text-ink transition-colors hover:border-ink"
                >
                  Stories · 9:16
                </a>
                <a
                  href={`/api/og/colours/${result.subseason}?format=pin&u=${result.undertone}&c=${result.contrast}`}
                  download={`valetti-colours-${result.subseason}-pin.jpg`}
                  className="rounded-full border border-ink/25 px-4 py-2 text-sm text-ink transition-colors hover:border-ink"
                >
                  Pinterest · 2:3
                </a>
              </div>
            </div>

            <div className="mt-6 rounded-xl border hairline bg-cream/40 p-4 sm:p-5">
              <p className="text-sm text-ink">
                Want your palette as a PDF? We&apos;ll email it.
              </p>
              <div className="mt-3">
                <LeadForm source="colours_result" subseason={result.subseason} />
              </div>
            </div>

            <p className="mt-6 text-xs text-stone-soft">
              We analysed your photo to read your colours and didn&apos;t keep
              it. The full report adds your wardrobe, shopping list,
              photorealistic looks, try-on and a PDF — new accounts get 6 free
              credits.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

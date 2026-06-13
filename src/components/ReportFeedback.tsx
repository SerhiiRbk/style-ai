"use client";

import { useEffect, useState } from "react";

type SavedFeedback = {
  rating: number;
  comment: string;
  updatedAt: string;
};

const STAR_LABELS = [
  "Poor",
  "Fair",
  "Good",
  "Very good",
  "Excellent",
] as const;

/** Private owner-only feedback — never render for shared / public viewers. */
export function ReportFeedback({
  reportId,
  isOwner,
}: {
  reportId: string;
  isOwner: boolean;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState<SavedFeedback | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "submitting" | "done">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/feedback`);
        if (!res.ok || cancelled) {
          if (!cancelled) setState("idle");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.feedback) {
          setSaved(data.feedback);
          setRating(data.feedback.rating);
          setComment(data.feedback.comment ?? "");
          setState("done");
        } else {
          setState("idle");
        }
      } catch {
        if (!cancelled) setState("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId, isOwner]);

  if (!isOwner) return null;

  async function submit() {
    if (rating === null) {
      setError("Please choose a star rating.");
      return;
    }
    setState("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState(saved ? "done" : "idle");
        setError(data.error ?? "Could not save feedback");
        return;
      }
      setSaved(data.feedback);
      setState("done");
    } catch {
      setState(saved ? "done" : "idle");
      setError("Could not save feedback");
    }
  }

  const displayRating = hoverRating ?? rating;
  const canSubmit = rating !== null && state !== "submitting";

  return (
    <section
      className="mt-16 rounded-2xl border hairline bg-gradient-to-br from-cream/70 via-paper to-brass/5 p-8 sm:p-10"
      aria-labelledby="report-feedback-heading"
    >
      <p className="eyebrow !text-brass">Your voice</p>
      <h2
        id="report-feedback-heading"
        className="mt-3 font-display text-2xl sm:text-3xl"
      >
        How was this report?
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone">
        We&apos;d be grateful if you shared your feedback — it helps us improve
        your AI stylist and make every report more useful.
      </p>

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-wider text-stone-soft">
          Overall rating
        </p>
        <div
          className="mt-3 flex items-center gap-1"
          role="radiogroup"
          aria-label="Report rating"
          onMouseLeave={() => setHoverRating(null)}
        >
          {[1, 2, 3, 4, 5].map((value) => {
            const active = displayRating !== null && value <= displayRating;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? "" : "s"} — ${STAR_LABELS[value - 1]}`}
                disabled={state === "submitting"}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                className="rounded-md p-1 transition-transform hover:scale-110 disabled:opacity-60"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-9 w-9 sm:h-10 sm:w-10 ${
                    active ? "text-brass" : "text-stone-soft/40"
                  }`}
                  fill={active ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={active ? 0 : 1.25}
                  aria-hidden
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            );
          })}
          {displayRating ? (
            <span className="ml-3 text-sm text-stone">
              {STAR_LABELS[displayRating - 1]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <label
          htmlFor="report-feedback-comment"
          className="text-[11px] uppercase tracking-wider text-stone-soft"
        >
          What worked well — or what could be better?
        </label>
        <textarea
          id="report-feedback-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={state === "submitting"}
          rows={4}
          maxLength={2000}
          placeholder="Colours, looks, shopping picks, try-on, anything at all…"
          className="mt-3 w-full resize-y rounded-xl border hairline bg-paper px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-stone-soft/70 focus:border-brass/40 focus:outline-none focus:ring-2 focus:ring-brass/15 disabled:opacity-60"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-stone">{error}</p> : null}

      {state === "done" && saved && !error ? (
        <p className="mt-4 text-sm text-stone">
          Thank you — your feedback has been saved. You can update it anytime.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex min-h-[2.5rem] items-center rounded-full bg-ink px-6 py-2.5 text-sm text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "submitting"
            ? "Saving…"
            : saved
              ? "Update feedback"
              : "Send feedback"}
        </button>
        {state === "loading" ? (
          <span className="text-xs text-stone-soft">Loading…</span>
        ) : null}
      </div>
    </section>
  );
}

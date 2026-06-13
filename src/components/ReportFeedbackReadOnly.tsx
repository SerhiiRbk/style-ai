import type { ReportOwnerFeedback } from "@/lib/data/report-feedback";

const STAR_LABELS = [
  "Poor",
  "Fair",
  "Good",
  "Very good",
  "Excellent",
] as const;

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <svg
          key={value}
          viewBox="0 0 24 24"
          className={`h-6 w-6 ${
            value <= rating ? "text-brass" : "text-stone-soft/35"
          }`}
          fill={value <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={value <= rating ? 0 : 1.25}
          aria-hidden
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
      <span className="ml-2 text-sm text-stone">
        {rating}/5 · {STAR_LABELS[rating - 1]}
      </span>
    </div>
  );
}

/** Compact stars for admin tables (no label). */
export function ReportFeedbackStars({
  rating,
}: {
  rating: number | null | undefined;
}) {
  if (rating == null) {
    return (
      <span className="text-xs text-stone-soft">No rating</span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 text-brass"
      title={`${rating}/5 — ${STAR_LABELS[rating - 1]}`}
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <span
          key={value}
          className={`text-sm leading-none ${
            value <= rating ? "opacity-100" : "opacity-25"
          }`}
          aria-hidden
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-xs text-stone">{rating}/5</span>
    </span>
  );
}

export function ReportFeedbackReadOnly({
  feedback,
  adminView = false,
}: {
  feedback: ReportOwnerFeedback | null;
  adminView?: boolean;
}) {
  return (
    <section
      className="mt-16 rounded-2xl border hairline bg-gradient-to-br from-cream/70 via-paper to-brass/5 p-8 sm:p-10"
      aria-labelledby="report-feedback-readonly-heading"
    >
      <p className="eyebrow !text-brass">
        {adminView ? "Admin" : "Feedback"}
      </p>
      <h2
        id="report-feedback-readonly-heading"
        className="mt-3 font-display text-2xl sm:text-3xl"
      >
        {adminView ? "Owner feedback" : "Your feedback"}
      </h2>
      {adminView ? (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone">
          Private rating and review from the report owner — not shown on shared
          links.
        </p>
      ) : null}

      {!feedback ? (
        <p className="mt-6 text-sm text-stone">No feedback submitted yet.</p>
      ) : (
        <div className="mt-6 space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-stone-soft">
              Rating
            </p>
            <div className="mt-2">
              <StarRow rating={feedback.rating} />
            </div>
          </div>
          {feedback.comment ? (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-stone-soft">
                Review
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {feedback.comment}
              </p>
            </div>
          ) : (
            <p className="text-sm text-stone-soft">No written review.</p>
          )}
          <p className="text-xs text-stone-soft">
            Updated{" "}
            {new Date(feedback.updatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}
    </section>
  );
}

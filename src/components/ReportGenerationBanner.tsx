"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReportGenerationState, ReportRecoveryInfo } from "@/lib/report";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";

const POLL_MS = 8_000;

function messageFor(phase: ReportGenerationState["phase"]): string {
  if (phase === "report") {
    return "We're analysing your photos and writing your personalised report.";
  }
  if (phase === "hair") {
    return "We're generating personalised hairstyle previews on your photo.";
  }
  if (phase === "grooming") {
    return "We're generating personalised facial hair and glasses previews on your photo.";
  }
  if (phase === "capsule") {
    return "We're generating your week-of-outfits lookbook photos.";
  }
  return "We're generating photorealistic images for your recommended looks.";
}

function savedItemsList(recovery: ReportRecoveryInfo): string[] {
  const items: string[] = [];
  if (recovery.saved.questionnaire) items.push("Your questionnaire answers");
  if (recovery.saved.photos) items.push("Uploaded photos on your account");
  if (recovery.saved.writtenGuidance) items.push("Written style guidance");
  if (recovery.saved.colors) items.push("Colour palette analysis");
  if (recovery.saved.looks > 0) {
    items.push(
      `${recovery.saved.looks} look outline${recovery.saved.looks === 1 ? "" : "s"}`,
    );
  }
  return items;
}

function creditMessage(recovery: ReportRecoveryInfo): string | null {
  if (recovery.creditCost <= 0) return null;
  if (recovery.creditsRefunded === true) {
    return `${recovery.creditCost} credits were returned to your balance.`;
  }
  if (recovery.creditsRefunded === false) {
    return `We're restoring your ${recovery.creditCost} credits — refresh this page in a moment. Contact support if your balance still looks wrong.`;
  }
  return null;
}

function FailedBanner({
  reportId,
  recovery,
  onRetry,
  retrying,
  retryError,
}: {
  reportId: string;
  recovery?: ReportRecoveryInfo;
  onRetry: () => void;
  retrying: boolean;
  retryError: string | null;
}) {
  const saved = recovery ? savedItemsList(recovery) : [];
  const credits = recovery ? creditMessage(recovery) : null;

  return (
    <div
      role="alert"
      className="border-b border-[#9E5C3C]/30 bg-[#9E5C3C]/10 text-ink"
    >
      <div className="container-luxe py-5 sm:py-6">
        <p className="font-display text-lg text-ink">Report generation failed</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone">
          Something interrupted the AI pipeline before your report finished. Nothing
          was lost from your account unless noted below.
        </p>

        {credits ? (
          <p className="mt-3 text-sm font-medium text-ink">{credits}</p>
        ) : null}

        {saved.length ? (
          <div className="mt-4 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-soft">
              Still saved
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone">
              {saved.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : recovery ? (
          <p className="mt-4 max-w-2xl text-sm text-stone">
            Your questionnaire is saved. Photos stay on your account for the next
            attempt.
          </p>
        ) : null}

        {retryError ? (
          <p className="mt-3 text-sm text-red-800">{retryError}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {recovery?.canRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-60"
            >
              {retrying ? "Retrying…" : "Retry with saved answers"}
            </button>
          ) : null}
          <Link
            href="/start"
            className="rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm text-stone transition-colors hover:text-ink"
          >
            Start a new report
          </Link>
          <Link
            href="/reports"
            className="text-sm text-stone underline underline-offset-2 hover:text-ink"
          >
            All reports
          </Link>
        </div>

        <p className="mt-4 text-xs text-stone-soft">
          Report ID {reportId.slice(0, 8)}… — useful if you contact support.
        </p>
      </div>
    </div>
  );
}

export function ReportGenerationBanner({
  reportId,
  initial,
}: {
  reportId: string;
  initial: ReportGenerationState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    setState(initial);
  }, [initial]);

  useEffect(() => {
    if (!state.pending) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/reports/${reportId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = (await res.json()) as ReportGenerationState;
        if (cancelled) return;
        setState(next);
        if (!next.pending) {
          router.refresh();
        }
      } catch {
        /* keep banner visible; user can refresh manually */
      }
    }

    const id = window.setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [reportId, router, state.pending]);

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/retry`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        balance?: number;
        needed?: number;
      };
      if (res.status === 402) {
        setRetryError(
          data.error ??
            `Not enough credits (${data.balance ?? "?"} available, ${data.needed ?? "?"} needed).`,
        );
        return;
      }
      if (!res.ok) {
        setRetryError(data.error ?? "Retry failed — try again in a moment.");
        return;
      }
      setState({
        status: "processing",
        pending: true,
        phase: "report",
      });
      router.refresh();
    } catch {
      setRetryError("Network error — check your connection and try again.");
    } finally {
      setRetrying(false);
    }
  }

  if (state.status === "failed") {
    return (
      <FailedBanner
        reportId={reportId}
        recovery={state.recovery}
        onRetry={handleRetry}
        retrying={retrying}
        retryError={retryError}
      />
    );
  }

  if (!state.pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b hairline bg-gradient-to-r from-cream/80 via-brass/10 to-cream/80 text-ink"
    >
      <div className="container-luxe flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <LuxeSpinner size="sm" tone="brass" className="mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-display text-lg text-ink">Atelier in progress</p>
            <p className="mt-1 text-stone">{messageFor(state.phase)}</p>
            <p className="mt-2 text-xs text-stone-soft">
              Stay on this page — we&apos;ll refresh when new images are ready.
              Your colours, shopping list, and written guidance are already
              saved below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="shrink-0 self-start rounded-full border hairline bg-paper px-4 py-2 text-xs text-stone transition-colors hover:text-ink sm:self-center"
        >
          Refresh now
        </button>
      </div>
    </div>
  );
}

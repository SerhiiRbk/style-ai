"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ButtonLink } from "@/components/Button";
import type { ColourAnalysisResult } from "@/lib/colour-palette";

type Phase = "idle" | "analyzing" | "result" | "error";

const MAX_EDGE = 768;

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
  const [shared, setShared] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    try {
      const res = await fetch("/api/colours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data.result as ColourAnalysisResult);
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
    if (inputRef.current) inputRef.current.value = "";
  }

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
        </div>
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

      {phase === "result" && result && (
        <div className="overflow-hidden rounded-2xl border hairline bg-paper">
          <div className="border-b hairline bg-cream/50 px-6 py-4 sm:px-8">
            <p className="eyebrow">Your colours — free</p>
          </div>
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

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink href="/start">Unlock my full look →</ButtonLink>
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/25 px-7 py-3 text-sm tracking-wide text-ink transition-all hover:border-ink hover:bg-ink hover:text-paper"
              >
                {shared ? "Copied — paste to share" : "Share my palette"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-sm text-stone underline transition-colors hover:text-ink"
              >
                Try another photo
              </button>
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

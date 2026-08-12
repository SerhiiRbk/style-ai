"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LOOK_CONTEXTS } from "@/lib/look-contexts";
import { LOOK_SET_BUNDLES, priceForBundle } from "@/lib/look-sets";
import type { LookBriefSeason } from "@/lib/ai/look-brief";
import { BodyTypePicker } from "@/components/BodyTypePicker";
import { PhotoQualityGuide } from "@/components/PhotoQualityGuide";
import { BRAND } from "@/lib/brand";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { LookShopAndTryOn } from "@/components/LookShopAndTryOn";
import { CreditsProvider } from "@/components/CreditsContext";
import type { ShoppingItem } from "@/lib/report";
import type { Currency } from "@/lib/currency";
import type { BodyTypeId } from "@/lib/style-profile";
import { checkPhotoGateClient } from "@/lib/client/photo-gate";
import { LEGAL } from "@/lib/legal";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";
import { LuxeBlockingWait } from "@/components/luxe/LuxeBlockingWait";

type Boldness = "conservative" | "moderate" | "experimental" | "statement";

const BOLDNESS: { id: Boldness; label: string; desc: string }[] = [
  { id: "conservative", label: "Conservative", desc: "Keep it safe and classic" },
  { id: "moderate", label: "Balanced", desc: "Modern, but not flashy" },
  { id: "experimental", label: "Adventurous", desc: "Open to trying new things" },
  { id: "statement", label: "Statement", desc: "I want to stand out" },
];

const SEASONS: { id: LookBriefSeason; label: string }[] = [
  { id: "spring", label: "Spring" },
  { id: "summer", label: "Summer" },
  { id: "autumn", label: "Autumn" },
  { id: "winter", label: "Winter" },
];

function defaultSeason(): LookBriefSeason {
  const m = new Date().getMonth(); // 0-11
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

type ResultLook = {
  context: string;
  title: string;
  description: string;
  palette: string[];
  image: string;
  items: ShoppingItem[];
};

type Result = {
  setId: string;
  shareSlug: string | null;
  carloNote: string | null;
  looks: ResultLook[];
  balance: number;
  currency: Currency;
};

/** A previously-uploaded reference photo the user can reuse. */
type ReusePhoto = { path: string; url: string | null };

function fireStarted(occasionId: string, looks: number) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "look_set_started",
      props: { occasion: occasionId, looks },
    }),
  }).catch(() => {});
}

export function CreateLookForm({
  userId,
  initialAge,
  initialBodyType,
  creditBalance,
  loyalty,
  hasReusableProfile,
}: {
  userId: string;
  initialAge: number | "";
  initialBodyType: BodyTypeId | "";
  creditBalance: number;
  loyalty: boolean;
  hasReusableProfile: boolean;
}) {
  const [age, setAge] = useState<string>(
    initialAge === "" ? "" : String(initialAge),
  );
  const [bodyType, setBodyType] = useState<BodyTypeId | "">(initialBodyType);
  const [occasionId, setOccasionId] = useState<string>(LOOK_CONTEXTS[0]!.id);
  const [boldness, setBoldness] = useState<Boldness>("moderate");
  const [season, setSeason] = useState<LookBriefSeason>(defaultSeason());
  const [looks, setLooks] = useState<number>(3);
  const [step, setStep] = useState<0 | 1>(0); // 0 = details, 1 = photo

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; buy?: boolean } | null>(
    null,
  );
  const [result, setResult] = useState<Result | null>(null);
  // Stable idempotency key per "generate" intent: held across failed retries
  // so a lost-response retry can't mint/charge a second set; cleared on success.
  const pendingKeyRef = useRef<string | null>(null);

  // Photo SELECTION (all users) + upload. Fresh users must pick/upload a face
  // (drives analysis) and consent; returning users may optionally pick which
  // photo the looks render on (server falls back to their default otherwise).
  const [facePhotos, setFacePhotos] = useState<ReusePhoto[]>([]);
  const [fullPhotos, setFullPhotos] = useState<ReusePhoto[]>([]);
  const [facePath, setFacePath] = useState<string>("");
  const [fullPath, setFullPath] = useState<string>("");
  const [uploadingRole, setUploadingRole] = useState<null | "face" | "full">(
    null,
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  async function loadPhotos() {
    try {
      const res = await fetch("/api/photos", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json().catch(() => null);
      if (!d) return;
      setFullPhotos(
        Array.isArray(d.photos)
          ? d.photos.map((p: { storagePath: string; url: string | null }) => ({
              path: p.storagePath,
              url: p.url,
            }))
          : [],
      );
      setFacePhotos(
        Array.isArray(d.face)
          ? d.face.map((p: { path: string; url: string | null }) => ({
              path: p.path,
              url: p.url,
            }))
          : [],
      );
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    // Fetch-on-mount: loadPhotos setStates only after an await, not
    // synchronously in the effect body, so the cascading-render concern
    // the rule guards against doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPhotos();
  }, []);

  const price = useMemo(
    () => priceForBundle(looks, loyalty) ?? 0,
    [looks, loyalty],
  );
  const ageNum = Number(age);
  const ageValid = Number.isInteger(ageNum) && ageNum >= 16 && ageNum <= 99;
  const canAfford = creditBalance >= price;
  // Returning users reuse their profile (photo optional). New users must select
  // or upload a face photo (that passed the gate) and give consent.
  const photosReady = hasReusableProfile || (!!facePath && consent);
  const canSubmit = ageValid && !submitting && canAfford && photosReady;

  async function onGenerate() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    fireStarted(occasionId, looks);
    if (!pendingKeyRef.current) pendingKeyRef.current = crypto.randomUUID();
    try {
      const res = await fetch("/api/look-set", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": pendingKeyRef.current,
        },
        body: JSON.stringify({
          looks,
          occasionId,
          boldness,
          season,
          intake: { age: ageNum, bodyType: bodyType || undefined },
          faceRefPath: facePath || undefined,
          fullRefPath: fullPath || undefined,
          // Fresh path only: returning users reuse their stored profile.
          ...(hasReusableProfile
            ? {}
            : {
                biometricConsent: consent,
                consentVersion: LEGAL.consentVersion,
              }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        pendingKeyRef.current = null; // consumed — a new intent gets a new key
        setResult(data as Result);
        return;
      }
      if (res.status === 402) {
        setError({ message: "You don't have enough credits for this set.", buy: true });
      } else if (res.status === 429) {
        setError({ message: "You've reached today's limit — please try again tomorrow." });
      } else if (res.status === 503) {
        setError({ message: "We're at capacity right now. Please try again a little later." });
      } else {
        setError({
          message:
            (data && (data.message || data.error)) ||
            "Something went wrong generating your looks. Please try again.",
        });
      }
    } catch {
      setError({ message: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Gate → upload to the private `photos` bucket → register the path → refresh
   * the list and auto-select the new photo. A gate reject never reaches Storage.
   */
  async function uploadPhoto(role: "face" | "full", file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setUploadingRole(role);
    try {
      const gate = await checkPhotoGateClient({
        file,
        purpose: role === "face" ? "report_face" : "report_full",
      });
      if (!gate.ok) {
        setPhotoError(gate.error);
        return;
      }
      const sb = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/create-look/${crypto.randomUUID()}/${role}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, storagePath: path }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not save photo");
      }
      await loadPhotos();
      if (role === "face") setFacePath(path);
      else setFullPath(path);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingRole(null);
    }
  }

  if (result) {
    return (
      <main className="bg-paper">
        <FlowHeader
          onBack={() => {
            setResult(null);
            setError(null);
          }}
        />
        <div className="container-luxe max-w-5xl py-12">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Your set</p>
              <h1 className="mt-2 font-display text-3xl">Your looks</h1>
              <p className="mt-1 text-sm text-stone-soft">
                Saved to{" "}
                <Link href="/looks" className="text-brass hover:text-ink">
                  your sets
                </Link>
                .
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/looks/${result.setId}`}
                className="rounded-full border hairline px-5 py-2 text-sm text-ink transition-colors hover:bg-cream/40"
              >
                Open set
              </Link>
              <button
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="rounded-full border hairline px-5 py-2 text-sm text-ink transition-colors hover:bg-cream/40"
              >
                Create another
              </button>
            </div>
          </div>

          {result.carloNote ? (
            <blockquote className="mt-8 rounded-2xl border hairline bg-cream/40 p-6">
              <p className="text-sm leading-relaxed text-stone">
                {result.carloNote}
              </p>
              <footer className="mt-3 text-[11px] uppercase tracking-[0.14em] text-brass">
                — Carlo
              </footer>
            </blockquote>
          ) : null}

          <CreditsProvider initialBalance={result.balance}>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {result.looks.map((look, i) => (
              <article key={i} className="flex flex-col">
                <ReportZoomImage
                  src={look.image}
                  alt={look.title}
                  wrapperClassName="relative block aspect-[9/16] w-full overflow-hidden rounded-2xl border hairline"
                  className="h-full w-full object-cover"
                />
                <h2 className="mt-4 font-display text-lg text-ink">
                  {look.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-stone">
                  {look.description}
                </p>
                {look.palette?.length ? (
                  <div className="mt-3 flex gap-1.5">
                    {look.palette.map((hex, k) => (
                      <span
                        key={k}
                        title={hex}
                        className="h-5 w-5 rounded-full border border-line"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                ) : null}
                <LookShopAndTryOn
                  items={look.items}
                  currency={result.currency}
                  canTryOn
                  setId={result.setId}
                  title={look.title}
                  description={look.description}
                  palette={look.palette}
                  lookIndex={i}
                />
              </article>
            ))}
          </div>
          </CreditsProvider>

          <p className="mt-10 text-sm text-stone">
            Credits remaining: {result.balance}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-paper">
      {submitting ? (
        <LuxeBlockingWait
          eyebrow="Creating your looks"
          title={`Styling ${looks} looks`}
          message="Carlo is building your set and rendering each look on you. This typically takes a minute or two."
        />
      ) : null}
      <FlowHeader onBack={step > 0 ? () => setStep(0) : undefined} />
      <div className="container-luxe max-w-3xl py-12">
        <p className="eyebrow">Create a Look</p>
        <h1 className="mt-3 font-display text-3xl">A new set of looks</h1>
        <p className="mt-2 max-w-xl text-stone">
          A set of outfit looks for one occasion, styled to your colour profile
          and rendered on you.
        </p>

        <div className="mt-8 flex items-center gap-3">
          {["Details", "Photo"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  i <= step ? "bg-ink text-paper" : "bg-sand text-stone"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm ${i === step ? "text-ink" : "text-stone-soft"}`}
              >
                {label}
              </span>
              {i === 0 ? (
                <span
                  className={`ml-1 h-px w-8 ${step > 0 ? "bg-ink" : "bg-line"}`}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-10">
          {step === 1 && (
            <>
          {/* Photos — selection + upload, shown to all users */}
          <Block
            eyebrow="Photos"
            title={hasReusableProfile ? "Choose your photo" : "Your photos"}
            subtitle={
              hasReusableProfile
                ? "Optional — pick which photo your looks are rendered on, or add a new one. If you skip this, we'll use your default."
                : "We read your colouring from a clear, front-facing photo and render the looks on you. A face photo is required; a full-length adds better full-body renders."
            }
          >
            <PhotoQualityGuide />
            <div className="mt-5 rounded-2xl border hairline bg-cream/40 p-5">
              <div className="space-y-5">
                <PhotoRolePicker
                  label={
                    hasReusableProfile ? "Face" : "Face — required"
                  }
                  photos={facePhotos}
                  selectedPath={facePath}
                  uploading={uploadingRole === "face"}
                  onSelect={(p) => setFacePath((cur) => (cur === p ? "" : p))}
                  onFile={(f) => uploadPhoto("face", f)}
                />
                <PhotoRolePicker
                  label="Full length — optional"
                  photos={fullPhotos}
                  selectedPath={fullPath}
                  uploading={uploadingRole === "full"}
                  onSelect={(p) => setFullPath((cur) => (cur === p ? "" : p))}
                  onFile={(f) => uploadPhoto("full", f)}
                />
              </div>
            </div>
            {photoError ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700"
              >
                {photoError}
              </p>
            ) : null}
            <div className="mt-5 rounded-xl border border-brass/25 bg-brass/5 p-4 text-sm leading-relaxed text-stone">
              <span className="font-medium text-ink">Photo not perfect?</span>{" "}
              A clear, front-facing photo in natural light gives the truest
              colour read and the most convincing render.
            </div>
            {!hasReusableProfile ? (
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border hairline bg-cream/40 p-4">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
                />
                <span className="text-xs leading-relaxed text-stone">
                  I explicitly consent to Valetti processing my uploaded photos
                  (which may reveal biometric characteristics) to analyse my
                  colouring and generate personalised looks on me, including
                  transfer to AI subprocessors listed in the{" "}
                  <Link href="/privacy" className="text-brass hover:text-ink">
                    Privacy Policy
                  </Link>
                  . I can withdraw consent by deleting my photos, reports, or
                  account.
                </span>
              </label>
            ) : null}
          </Block>
            </>
          )}

          {step === 0 && (
            <>
          {/* About you */}
          <Block
            eyebrow="About you"
            title="A little about you"
            subtitle="Age and frame help us calibrate fit and proportion."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-stone">Gender</span>
                <select
                  disabled
                  value="male"
                  className="mt-2 w-full cursor-not-allowed rounded-lg border border-line bg-cream/40 px-4 py-2.5 text-sm text-stone opacity-70 outline-none"
                >
                  <option value="male">Male</option>
                </select>
                <p className="mt-2 text-xs text-stone-soft">
                  Valetti is built for men&apos;s styling.
                </p>
              </label>
              <label className="block">
                <span className="text-sm text-stone">Age</span>
                <input
                  type="number"
                  min={16}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 34"
                  className="mt-2 w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
                />
              </label>
            </div>
            <div className="mt-6 text-sm text-stone">Body type — optional</div>
            <p className="mt-1 text-xs text-stone-soft">
              Pick the silhouette closest to you for more flattering fits.
            </p>
            <BodyTypePicker
              gender="male"
              value={bodyType}
              onChange={setBodyType}
            />
          </Block>

          {/* Occasion */}
          <Block
            eyebrow="Occasion"
            title="Where are you headed?"
            subtitle="Every look in the set is styled for this one occasion."
          >
            <div className="flex flex-wrap gap-2.5">
              {LOOK_CONTEXTS.map((c) => {
                const active = occasionId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setOccasionId(c.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      active
                        ? "border-ink bg-ink text-paper"
                        : "border-line text-stone hover:border-ink/40 hover:text-ink"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Block>

          {/* Strictness */}
          <Block eyebrow="Style" title="How bold?" subtitle="">
            <div className="grid gap-3 sm:grid-cols-2">
              {BOLDNESS.map((b) => {
                const active = boldness === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBoldness(b.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? "border-ink bg-cream/60"
                        : "border-line hover:border-ink/40"
                    }`}
                  >
                    <div className="text-sm text-ink">{b.label}</div>
                    <div className="text-xs text-stone-soft">{b.desc}</div>
                  </button>
                );
              })}
            </div>
          </Block>

          {/* Season */}
          <Block eyebrow="Season" title="Season" subtitle="">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SEASONS.map((s) => {
                const active = season === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSeason(s.id)}
                    className={`rounded-xl border p-3 text-center text-sm transition-colors ${
                      active
                        ? "border-ink bg-cream/60 text-ink"
                        : "border-line text-stone hover:border-ink/40 hover:text-ink"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Block>

          {/* Count + price */}
          <Block
            eyebrow="Set size"
            title="How many looks?"
            subtitle="More looks give more range for the same occasion."
          >
            <div className="grid grid-cols-3 gap-3">
              {LOOK_SET_BUNDLES.map((b) => {
                const p = priceForBundle(b.looks, loyalty) ?? b.credits;
                const active = looks === b.looks;
                return (
                  <button
                    key={b.looks}
                    type="button"
                    onClick={() => setLooks(b.looks)}
                    className={`rounded-2xl border p-4 text-center transition-colors ${
                      active
                        ? "border-ink bg-cream/60"
                        : "border-line bg-paper hover:border-ink/40"
                    }`}
                  >
                    <span className="block font-display text-2xl text-ink">
                      {b.looks}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-soft">
                      looks
                    </span>
                    <span className="mt-2 block text-xs text-stone">
                      {p} credits
                    </span>
                  </button>
                );
              })}
            </div>
            {loyalty ? (
              <p className="mt-3 text-xs text-brass">Loyalty pricing applied.</p>
            ) : null}
          </Block>
            </>
          )}

          {error ? (
            <div className="rounded-xl border border-[#9E5C3C]/30 bg-[#9E5C3C]/5 px-5 py-3 text-sm text-[#9E5C3C]">
              {error.message}
              {error.buy ? (
                <>
                  {" "}
                  <Link href="/account" className="font-medium underline">
                    Buy credits
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 border-t hairline pt-6">
            <div className="text-sm text-stone">
              {price} credits · balance {creditBalance}
            </div>
            {step === 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (ageValid) setStep(1);
                }}
                disabled={!ageValid}
                className="rounded-full bg-ink px-7 py-3 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-40"
              >
                {ageValid ? "Continue" : "Enter your age"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="rounded-full border hairline px-5 py-3 text-sm text-ink transition-colors hover:bg-cream/40"
                >
                  ← Back
                </button>
                <button
                  onClick={onGenerate}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <LuxeSpinner size="xs" tone="paper" />
                      Generating {looks} looks…
                    </>
                  ) : !photosReady ? (
                    !facePath ? (
                      "Add a face photo"
                    ) : (
                      "Accept the consent"
                    )
                  ) : !canAfford ? (
                    "Not enough credits"
                  ) : (
                    `Generate ${looks} looks`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- */

/** Report-style flow chrome: logo → home, an optional Back, and a Your-sets
 * exit. Mirrors the Style Report wizard header so the two flows feel the same. */
function FlowHeader({ onBack }: { onBack?: () => void }) {
  return (
    <div className="border-b hairline bg-paper/80 backdrop-blur-md">
      <div className="container-luxe flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl">
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-stone transition-colors hover:text-ink"
            >
              ← Back
            </button>
          ) : null}
          <Link href="/looks" className="text-sm text-stone hover:text-ink">
            Your sets
          </Link>
        </div>
      </div>
    </div>
  );
}

function Block({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-rise">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl">{title}</h2>
      {subtitle ? (
        <p className="mt-1.5 max-w-xl text-sm text-stone">{subtitle}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Per-role thumbnail picker: prior photos as selectable thumbnails plus an
 * upload tile. Mirrors StartForm's "Use a previous photo" strip.
 */
function PhotoRolePicker({
  label,
  photos,
  selectedPath,
  uploading,
  onSelect,
  onFile,
}: {
  label: string;
  photos: ReusePhoto[];
  selectedPath: string;
  uploading: boolean;
  onSelect: (path: string) => void;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-stone-soft">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        {photos.map((item) => {
          const selected = selectedPath === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onSelect(item.path)}
              aria-pressed={selected}
              className={`relative h-24 w-[4.5rem] overflow-hidden rounded-lg border bg-cream/40 transition-colors ${
                selected
                  ? "border-brass ring-2 ring-brass/40"
                  : "border-line hover:border-ink/30"
              }`}
            >
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={`${label} photo`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              ) : null}
              {selected ? (
                <span className="absolute inset-x-0 bottom-0 bg-brass/90 py-0.5 text-center text-[10px] text-paper">
                  Selected
                </span>
              ) : null}
            </button>
          );
        })}

        <label
          className={`flex h-24 w-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center transition-colors ${
            uploading
              ? "border-ink/40 bg-cream/40"
              : "border-line bg-cream/20 hover:border-ink/40"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <LuxeSpinner size="xs" tone="ink" />
          ) : (
            <span className="text-lg leading-none text-stone">＋</span>
          )}
          <span className="text-[10px] leading-tight text-stone-soft">
            {uploading ? "…" : "Add"}
          </span>
        </label>
      </div>
    </div>
  );
}

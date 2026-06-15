"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BodyTypePicker } from "@/components/BodyTypePicker";
import {
  inferBodyTypeFromMeasurements,
  HAIR_COLOR_LABELS,
  EYE_COLOR_LABELS,
  type BodyTypeId,
  type HairColorId,
  type EyeColorId,
} from "@/lib/style-profile";
import { COUNTRIES } from "@/lib/countries";
import { PROFILE_CURRENCIES, type Currency } from "@/lib/currency";
import { REPORT_COST, CREDIT_COSTS, SIGNUP_BONUS } from "@/lib/credit-costs";
import { lookCountForTier } from "@/lib/report";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { notifyReportGenerationStarted } from "@/components/CreateReportButton";
import { LuxeBlockingWait } from "@/components/luxe/LuxeBlockingWait";
import { LuxeWorkingLabel } from "@/components/luxe/LuxeWorkingLabel";
import { WORKING } from "@/components/luxe/messages";
import { LuxeSpinner } from "@/components/luxe/LuxeSpinner";

type Tier = "free" | "basic" | "lookbook" | "premium";

const PHOTO_ROLES: { role: string; label: string; desc: string }[] = [
  {
    role: "face",
    label: "Front portrait",
    desc: "Face, hairline and natural colouring. No sunglasses or heavy filter.",
  },
  {
    role: "full",
    label: "Full length",
    desc: "Head-to-toe proportions. A mirror photo is fine if the camera is level.",
  },
  {
    role: "profile",
    label: "Profile (optional)",
    desc: "Side angle for haircut, beard, glasses and posture recommendations.",
  },
];

const GOALS = [
  "Look more professional",
  "Look modern but natural",
  "Look younger / fresher",
  "Stand out a little",
  "Dating & social",
  "Fit into a new country",
  "Cultural events",
];
const LIFESTYLE = [
  "Office & remote",
  "Travels often",
  "Active / outdoors",
  "Public speaking",
  "Creator / blog",
  "Parenting",
];
const OCCUPATIONS = [
  "Software / IT",
  "Consulting",
  "Business / Founder",
  "Freelance",
  "Finance",
  "Creative",
  "Other",
];
const BOLDNESS: { id: string; label: string; desc: string }[] = [
  { id: "conservative", label: "Conservative", desc: "Keep it safe and classic" },
  { id: "moderate", label: "Moderate", desc: "Modern, but not flashy" },
  { id: "experimental", label: "Experimental", desc: "Open to trying new things" },
  { id: "statement", label: "Statement", desc: "I want to stand out" },
];
const BUDGETS: { label: string; min: number; max: number }[] = [
  { label: "€200–500", min: 200, max: 500 },
  { label: "€400–1200", min: 400, max: 1200 },
  { label: "€1000–3000", min: 1000, max: 3000 },
  { label: "€3000+", min: 3000, max: 8000 },
];
const TIERS: { id: Tier; name: string; note: string }[] = [
  {
    id: "free",
    name: "Starter Report",
    note: `1 look · 2 hair previews · try-on ${CREDIT_COSTS.tryon} cr · no share/PDF`,
  },
  { id: "basic", name: "Basic report", note: "3 looks · PDF · share link" },
  { id: "lookbook", name: "Lookbook", note: `${lookCountForTier("lookbook")} looks · capsule, try-on & dual-angle hair` },
  {
    id: "premium",
    name: "Premium",
    note: `${lookCountForTier("premium")} looks · 4 beard & 4 eyewear previews`,
  },
];

const STEPS = ["About you", "Photos", "Goals", "Package"];

const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

/** Representative hair swatches (CSS gradients — crisp at any DPI, no assets). */
const HAIR_SWATCH_CSS: Record<HairColorId, string> = {
  black: "linear-gradient(145deg,#2b2724,#141210)",
  "dark-brown": "linear-gradient(145deg,#4a2f1d,#2a1810)",
  brown: "linear-gradient(145deg,#7d5132,#553620)",
  blonde: "linear-gradient(145deg,#ead09a,#c39e5b)",
  red: "linear-gradient(145deg,#aa5630,#7a3318)",
  gray: "linear-gradient(145deg,#dcd9d3,#9b9893)",
  other: "linear-gradient(145deg,#bcb5a9,#8a8275)",
};

/** Iris swatches with a dark pupil centre, approximating each eye colour. */
const EYE_SWATCH_CSS: Record<EyeColorId, string> = {
  brown:
    "radial-gradient(circle at 50% 50%,#161210 20%,#5a3a22 24%,#7d5132 60%,#2e1c10 100%)",
  hazel:
    "radial-gradient(circle at 50% 50%,#161210 20%,#6e5a2b 24%,#7d8a4a 58%,#4a3a1f 100%)",
  amber:
    "radial-gradient(circle at 50% 50%,#161210 20%,#9a5e1c 24%,#c98a3a 60%,#6b3f10 100%)",
  green:
    "radial-gradient(circle at 50% 50%,#141310 20%,#3f6a3a 24%,#6b9a5a 58%,#2f4a2c 100%)",
  blue:
    "radial-gradient(circle at 50% 50%,#141310 20%,#3f6f9a 24%,#7aa6c9 58%,#2f4f72 100%)",
  gray:
    "radial-gradient(circle at 50% 50%,#141310 20%,#6a7176 24%,#9aa1a6 58%,#566066 100%)",
  other:
    "radial-gradient(circle at 50% 50%,#161210 20%,#8a8275 24%,#bcb5a9 60%,#6a6256 100%)",
};

type SwatchOption = { id: string; label: string; css?: string };

/** "From photo" detect chip first, then each labelled swatch. */
const HAIR_SWATCH_OPTIONS: SwatchOption[] = [
  { id: "", label: "From photo" },
  ...(Object.keys(HAIR_COLOR_LABELS) as HairColorId[]).map((id) => ({
    id,
    label: HAIR_COLOR_LABELS[id],
    css: HAIR_SWATCH_CSS[id],
  })),
];

const EYE_SWATCH_OPTIONS: SwatchOption[] = [
  { id: "", label: "From photo" },
  ...(Object.keys(EYE_COLOR_LABELS) as EyeColorId[]).map((id) => ({
    id,
    label: EYE_COLOR_LABELS[id],
    css: EYE_SWATCH_CSS[id],
  })),
];

export function StartForm({
  userId,
  showWelcome: initialWelcome = false,
  userEmail = null,
  creditBalance = null,
  initialGeo,
}: {
  userId: string | null;
  showWelcome?: boolean;
  userEmail?: string | null;
  creditBalance?: number | null;
  initialGeo?: {
    city?: string;
    countryName?: string;
    currency?: Currency;
  };
}) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(initialWelcome);
  const [cameFromWelcome, setCameFromWelcome] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => (LIVE ? createClient() : null), []);
  const sessionIdRef = useRef<string>("");
  // Stable idempotency key for the report request — reused across retries of the
  // same submission so a network retry / double-submit never double-charges.
  const reportIdRef = useRef<string>("");
  const [photoPaths, setPhotoPaths] = useState<{ role: string; path: string }[]>(
    [],
  );
  const [uploadingRole, setUploadingRole] = useState<string | null>(null);

  async function uploadPhoto(role: string, file: File) {
    if (!supabase || !userId) return;
    setUploadingRole(role);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
      const path = `${userId}/${sessionIdRef.current}/${role}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      setPhotoPaths((prev) => [
        ...prev.filter((p) => p.role !== role),
        { role, path },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingRole(null);
    }
  }

  const [photos, setPhotos] = useState<string[]>([]);
  const [age, setAge] = useState(40);
  const [gender, setGender] = useState("male");
  const [city, setCity] = useState(initialGeo?.city ?? "");
  const [country, setCountry] = useState(initialGeo?.countryName ?? "");
  const [currency, setCurrency] = useState<Currency>(initialGeo?.currency ?? "EUR");
  const [height, setHeight] = useState(180);
  const [weight, setWeight] = useState("");
  const [bodyType, setBodyType] = useState<BodyTypeId | "">("");
  const [bodyTypeManual, setBodyTypeManual] = useState(false);
  const [hairColor, setHairColor] = useState<HairColorId | "">("");
  const [eyeColor, setEyeColor] = useState<EyeColorId | "">("");
  const [shoulderCm, setShoulderCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [sleeveCm, setSleeveCm] = useState("");
  const [occupation, setOccupation] = useState(OCCUPATIONS[0]);
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [boldness, setBoldness] = useState("moderate");
  const [budget, setBudget] = useState(1);
  const [tier, setTier] = useState<Tier>("lookbook");
  const [biometricConsent, setBiometricConsent] = useState(false);

  // Credit gating for the Package step (balance is the server snapshot at load).
  const reportCost = REPORT_COST[tier];
  const knownBalance = creditBalance != null ? creditBalance : null;
  const insufficientCredits =
    knownBalance != null && reportCost > 0 && knownBalance < reportCost;

  const measurements = useMemo(
    () => ({
      shoulderCm: shoulderCm ? Number(shoulderCm) : undefined,
      chestCm: chestCm ? Number(chestCm) : undefined,
      waistCm: waistCm ? Number(waistCm) : undefined,
      hipCm: hipCm ? Number(hipCm) : undefined,
      sleeveCm: sleeveCm ? Number(sleeveCm) : undefined,
    }),
    [shoulderCm, chestCm, waistCm, hipCm, sleeveCm],
  );

  // Default body type derived from girths; a manual pick takes precedence.
  const derivedBodyType = inferBodyTypeFromMeasurements(measurements, gender);
  const effectiveBodyType: BodyTypeId | "" = bodyTypeManual
    ? bodyType
    : (derivedBodyType ?? bodyType);

  const toggle = (
    arr: string[],
    set: (v: string[]) => void,
    value: string,
  ) => {
    set(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  };

  const hasRequiredPhotos = LIVE
    ? photoPaths.some((p) => p.role === "face") &&
      photoPaths.some((p) => p.role === "full")
    : photos.length >= 2;

  const canNext = () => {
    if (step === 0) return city.trim() && country.trim();
    if (step === 1) return hasRequiredPhotos && biometricConsent;
    if (step === 2) return goals.length > 0;
    return true;
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
    // Generate once per submission; keep it across retries so a re-send maps to
    // the same report (server charges credits at most once for this key).
    if (!reportIdRef.current) reportIdRef.current = crypto.randomUUID();
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      4 * 60 * 1000,
    );
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          tier,
          reportId: reportIdRef.current,
          photoPaths,
          biometricConsent: photoPaths.length ? biometricConsent : undefined,
          consentVersion: photoPaths.length ? LEGAL.consentVersion : undefined,
          intake: {
            age,
            genderPresentation: gender,
            city,
            country,
            currency,
            heightCm: height,
            weightKg: weight ? Number(weight) : undefined,
            bodyType: effectiveBodyType || undefined,
            measurements: Object.values(measurements).some((v) => v != null)
              ? measurements
              : undefined,
            hairColor: hairColor || undefined,
            eyeColor: eyeColor || undefined,
            occupation,
            lifestyle,
            goals,
            boldness,
            budgetEur: { min: BUDGETS[budget].min, max: BUDGETS[budget].max },
          },
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        reportId?: string;
        refunded?: boolean;
        creditCost?: number;
      };
      if (!res.ok) {
        if (data.reportId) {
          notifyReportGenerationStarted(data.reportId);
          router.push(`/report/${data.reportId}`);
          return;
        }
        const refundNote =
          data.refunded && data.creditCost
            ? ` ${data.creditCost} credits were returned to your balance.`
            : "";
        throw new Error((data.error ?? "Could not generate report") + refundNote);
      }
      if (!data.id) throw new Error("Report created but no id returned");
      notifyReportGenerationStarted(data.id);
      router.push(`/report/${data.id}`);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError(
          "Generation is taking longer than expected. Check your connection and try again — or open Reports if one was already created.",
        );
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  function beginReport() {
    setCameFromWelcome(true);
    setShowWelcome(false);
    router.replace("/start", { scroll: false });
  }

  function backToWelcome() {
    setShowWelcome(true);
    router.replace("/start?welcome=1", { scroll: false });
  }

  function handleBack() {
    if (step > 0) {
      setStep((s) => s - 1);
      return;
    }
    if (cameFromWelcome) {
      backToWelcome();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  useEffect(() => {
    setShowWelcome(initialWelcome);
    if (!initialWelcome) setCameFromWelcome(false);
  }, [initialWelcome]);

  return (
    <main className="flex-1">
      {submitting ? (
        <LuxeBlockingWait
          eyebrow="Creating report"
          title="Crafting your report"
          message={`${BRAND.stylist.first} is analysing your photos and building your personalised style profile. This typically takes one to two minutes.`}
        />
      ) : null}
      <div className="border-b hairline bg-paper/80 backdrop-blur-md">
        <div className="container-luxe flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-xl">
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-4">
            {!showWelcome ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-sm text-stone transition-colors hover:text-ink"
              >
                ← Back
              </button>
            ) : null}
            <Link href="/" className="text-sm text-stone hover:text-ink">
              Save &amp; exit
            </Link>
          </div>
        </div>
      </div>

      <div className="container-luxe max-w-3xl py-12">
        {showWelcome ? (
          <WelcomeScreen
            email={userEmail}
            creditBalance={creditBalance}
            onStartReport={beginReport}
          />
        ) : (
          <>
        <Stepper step={step} />

        <div className="mt-10 min-h-[380px]">
          {step === 1 && (
            <Section
              eyebrow="Step 2"
              title="Upload your photos"
              subtitle="Better photos make the colour, haircut and fit analysis more accurate. They are processed privately and never sold or shared."
            >
              <PhotoQualityGuide />
              <div className="mb-6 mt-6 rounded-2xl border hairline bg-paper p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="font-display text-xl">What each photo is for</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone">
                      Upload at least portrait and full length. The profile shot
                      is optional, but improves hair, beard, eyewear and posture.
                    </p>
                  </div>
                  <span className="rounded-full bg-cream px-3 py-1.5 text-[11px] uppercase tracking-wide text-stone-soft">
                    JPG, PNG or HEIC
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {PHOTO_ROLES.map(({ role, label, desc }) => (
                    <PhotoRoleCard key={role} label={label} desc={desc} />
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {LIVE
                  ? PHOTO_ROLES.map(({ role, label, desc }) => (
                      <UploadTile
                        key={role}
                        label={label}
                        desc={desc}
                        filled={photoPaths.some((p) => p.role === role)}
                        uploading={uploadingRole === role}
                        onFile={(file) => uploadPhoto(role, file)}
                      />
                    ))
                  : PHOTO_ROLES.map(({ label, desc }) => (
                      <PhotoTile
                        key={label}
                        label={label}
                        desc={desc}
                        filled={photos.includes(label)}
                        onClick={() =>
                          setPhotos((p) =>
                            p.includes(label)
                              ? p.filter((x) => x !== label)
                              : [...p, label],
                          )
                        }
                      />
                    ))}
              </div>
              <div className="mt-5 rounded-xl border border-brass/25 bg-brass/5 p-4 text-sm leading-relaxed text-stone">
                <span className="font-medium text-ink">Photo not perfect?</span>{" "}
                Continue if your face and body are clear. If lighting is poor or
                the outfit hides your shape, upload the best available photos now
                and replace them before generating a final paid report.
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border hairline bg-cream/40 p-4">
                <input
                  type="checkbox"
                  checked={biometricConsent}
                  onChange={(e) => setBiometricConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
                />
                <span className="text-xs leading-relaxed text-stone">
                  I explicitly consent to Valetti processing my uploaded photos
                  (which may reveal biometric characteristics) to analyse my
                  appearance and generate personalised style visuals, including
                  transfer to AI subprocessors listed in the{" "}
                  <Link href="/privacy" className="text-brass hover:text-ink">
                    Privacy Policy
                  </Link>
                  . I understand I can withdraw consent by deleting my photos,
                  reports, or account.
                </span>
              </label>
              {!biometricConsent && hasRequiredPhotos ? (
                <p className="mt-2 text-xs text-stone-soft">
                  Required to continue with photo-based personalisation.
                </p>
              ) : null}
            </Section>
          )}

          {step === 0 && (
            <Section
              eyebrow="Step 1"
              title="A little about you"
              subtitle="Men's styling grounded in your real life — age, climate, profession and frame."
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label={`Age — ${age}`}>
                  <input
                    type="range"
                    min={18}
                    max={75}
                    value={age}
                    onChange={(e) => setAge(+e.target.value)}
                    className="w-full accent-[var(--color-ink)]"
                  />
                </Field>
                <Field label={`Height — ${height} cm`}>
                  <input
                    type="range"
                    min={150}
                    max={205}
                    value={height}
                    onChange={(e) => setHeight(+e.target.value)}
                    className="w-full accent-[var(--color-ink)]"
                  />
                </Field>
                <Field label="Weight (kg) — optional">
                  <Input
                    value={weight}
                    onChange={(v) => setWeight(v.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 82"
                  />
                </Field>
                <Field label="Gender">
                  <Select
                    value={gender}
                    onChange={setGender}
                    disabled
                    options={[["male", "Male"]]}
                  />
                  <p className="mt-2 text-xs text-stone-soft">
                    Valetti is built for men&apos;s styling — fit, tailoring and
                    grooming rules are calibrated for a male wardrobe.
                  </p>
                </Field>
                <Field label="Occupation">
                  <Select
                    value={occupation}
                    onChange={setOccupation}
                    options={OCCUPATIONS.map((o) => [o, o])}
                  />
                </Field>
                <Field label="City">
                  <Input value={city} onChange={setCity} placeholder="Berlin" />
                </Field>
                <Field label="Country">
                  <Select
                    value={country}
                    onChange={setCountry}
                    options={[
                      ["", "Select country"],
                      ...COUNTRIES.map(
                        (c) => [c.name, c.name] as [string, string],
                      ),
                    ]}
                  />
                </Field>
                <Field label="Preferred currency">
                  <Select
                    value={currency}
                    onChange={(v) => setCurrency(v as Currency)}
                    options={PROFILE_CURRENCIES.map((c) => [c, c])}
                  />
                </Field>
              </div>

              <Label className="mt-8">Colouring — optional</Label>
              <p className="mt-1 text-xs text-stone-soft">
                Hair and eye colour sharpen your seasonal colour analysis. Leave
                them on “From photo” to read them from your uploads.
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 sm:items-start">
                <div className="min-w-0">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-soft">
                    Hair
                  </div>
                  <ColourSwatchPicker
                    value={hairColor}
                    onChange={(v) => setHairColor(v as HairColorId | "")}
                    options={HAIR_SWATCH_OPTIONS}
                  />
                </div>
                <div className="min-w-0">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-soft">
                    Eyes
                  </div>
                  <ColourSwatchPicker
                    value={eyeColor}
                    onChange={(v) => setEyeColor(v as EyeColorId | "")}
                    options={EYE_SWATCH_OPTIONS}
                  />
                </div>
              </div>

              <Label className="mt-8">Measurements — optional</Label>
              <p className="mt-1 text-xs text-stone-soft">
                Girth in centimetres. Shoulder, waist and hip girth set your
                body type automatically — you can still adjust it below.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="Shoulders (cm)">
                  <Input
                    value={shoulderCm}
                    onChange={(v) => setShoulderCm(v.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 118"
                  />
                </Field>
                <Field label="Chest (cm)">
                  <Input
                    value={chestCm}
                    onChange={(v) => setChestCm(v.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 102"
                  />
                </Field>
                <Field label="Waist (cm)">
                  <Input
                    value={waistCm}
                    onChange={(v) => setWaistCm(v.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 90"
                  />
                </Field>
                <Field label="Hips (cm)">
                  <Input
                    value={hipCm}
                    onChange={(v) => setHipCm(v.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 100"
                  />
                </Field>
                <Field label="Sleeve: shoulder → thumb base (cm)">
                  <Input
                    value={sleeveCm}
                    onChange={(v) => setSleeveCm(v.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 86"
                  />
                </Field>
              </div>

              <Label className="mt-8">Body type — optional</Label>
              <p className="mt-1 text-xs text-stone-soft">
                {effectiveBodyType && !bodyTypeManual
                  ? "Pre-selected from your measurements — tap to change."
                  : "Pick the silhouette closest to you. It helps us recommend the most flattering fits — you can skip this."}
              </p>
              <BodyTypePicker
                gender={gender}
                value={effectiveBodyType}
                onChange={(v) => {
                  setBodyType(v);
                  setBodyTypeManual(true);
                }}
              />
            </Section>
          )}

          {step === 2 && (
            <Section
              eyebrow="Step 3"
              title="Goals & preferences"
              subtitle="Tell us what you're after and how bold you want to be — you stay in control."
            >
              <Label>Your goals</Label>
              <Chips
                options={GOALS}
                selected={goals}
                onToggle={(v) => toggle(goals, setGoals, v)}
              />
              <Label className="mt-7">Lifestyle</Label>
              <Chips
                options={LIFESTYLE}
                selected={lifestyle}
                onToggle={(v) => toggle(lifestyle, setLifestyle, v)}
              />
              <Label className="mt-7">How bold?</Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {BOLDNESS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBoldness(b.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      boldness === b.id
                        ? "border-ink bg-cream/60"
                        : "border-line hover:border-ink/40"
                    }`}
                  >
                    <div className="text-sm text-ink">{b.label}</div>
                    <div className="text-xs text-stone-soft">{b.desc}</div>
                  </button>
                ))}
              </div>
              <Label className="mt-7">Budget for a refresh</Label>
              <Chips
                options={BUDGETS.map((b) => b.label)}
                selected={[BUDGETS[budget].label]}
                onToggle={(v) =>
                  setBudget(BUDGETS.findIndex((b) => b.label === v))
                }
              />
            </Section>
          )}

          {step === 3 && (
            <Section
              eyebrow="Step 4"
              title="Choose your package"
              subtitle="Sign in required. New accounts get signup credits; the Starter Report uses credits like paid tiers."
            >
              {knownBalance != null && (
                <div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-cream/40 px-5 py-3">
                  <span className="text-sm text-stone">Your balance</span>
                  <span className="font-display text-lg text-ink">
                    {knownBalance} {knownBalance === 1 ? "credit" : "credits"}
                  </span>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {TIERS.map((t) => {
                  const tierCost = REPORT_COST[t.id];
                  const unaffordable =
                    knownBalance != null &&
                    tierCost > 0 &&
                    knownBalance < tierCost;
                  return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === "free" && LIVE && !userId) {
                        router.push("/login");
                        return;
                      }
                      setTier(t.id);
                    }}
                    className={`flex items-center justify-between rounded-xl border p-5 text-left transition-colors ${
                      tier === t.id
                        ? "border-ink bg-cream/60"
                        : "border-line hover:border-ink/40"
                    }`}
                  >
                    <div>
                      <div className="text-sm text-ink">{t.name}</div>
                      <div className="text-xs text-stone-soft">{t.note}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl">
                        {tierCost}
                      </div>
                      <div className="text-[11px] text-stone-soft">credits</div>
                      {unaffordable && (
                        <div className="mt-1 text-[11px] text-[#9E5C3C]">
                          need {tierCost - (knownBalance as number)} more
                        </div>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
              <p className="mt-5 text-xs text-stone-soft">
                Sign up for {SIGNUP_BONUS} free credits — your Starter Report is{" "}
                {REPORT_COST.free} credits, try-on is {CREDIT_COSTS.tryon}{" "}
                credit. Re-renders cost {CREDIT_COSTS.tryon} credit each.{" "}
                <Link href="/pricing" className="text-brass hover:text-ink">
                  See pricing
                </Link>
                .
              </p>
              {insufficientCredits && (
                <p className="mt-4 rounded-xl border border-[#9E5C3C]/30 bg-[#9E5C3C]/5 px-5 py-3 text-sm text-[#9E5C3C]">
                  You have {knownBalance}{" "}
                  {knownBalance === 1 ? "credit" : "credits"} — this package needs{" "}
                  {reportCost}. Pick a smaller package above or{" "}
                  <Link href="/pricing" className="underline hover:text-ink">
                    top up your credits
                  </Link>
                  .
                </p>
              )}
              {error && (
                <p className="mt-4 text-sm text-[#9E5C3C]">{error}</p>
              )}
            </Section>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between border-t hairline pt-6">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm text-stone transition-colors hover:text-ink disabled:opacity-30"
          >
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canNext() && setStep((s) => s + 1)}
              disabled={!canNext()}
              className="rounded-full bg-ink px-7 py-3 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || insufficientCredits}
              className="rounded-full bg-ink px-7 py-3 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              {submitting ? (
                <LuxeWorkingLabel message={WORKING.report} />
              ) : (
                "Generate my report"
              )}
            </button>
          )}
        </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- */

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                i <= step ? "bg-ink text-paper" : "bg-sand text-stone"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`hidden text-sm sm:inline ${
                i <= step ? "text-ink" : "text-stone-soft"
              }`}
            >
              {s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px flex-1 ${i < step ? "bg-ink" : "bg-line"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Section({
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
    <div className="animate-rise">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl">{title}</h1>
      <p className="mt-2 max-w-xl text-stone">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function PhotoQualityGuide() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PhotoExampleCard
        tone="good"
        title="Best result"
        imageSrc="/images/photo-example-good.png"
        imageAlt="Good portrait example — natural daylight, clear face and hair"
        items={[
          "Natural daylight, face turned to a window",
          "Clear view of face, hair and shoulders",
          "Full-length photo taken from chest height",
        ]}
      />
      <PhotoExampleCard
        tone="avoid"
        title="Hard to analyse"
        imageSrc="/images/photo-example-bad.png"
        imageAlt="Poor portrait example — sunglasses, hat, harsh flash, busy background"
        items={[
          "Sunglasses, hat, heavy filter or strong shadow",
          "Group photo, busy background or cropped body",
          "Low angle, dark room or mirror flash over the face",
        ]}
      />
    </div>
  );
}

function PhotoExampleCard({
  tone,
  title,
  imageSrc,
  imageAlt,
  items,
}: {
  tone: "good" | "avoid";
  title: string;
  imageSrc: string;
  imageAlt: string;
  items: string[];
}) {
  const good = tone === "good";
  return (
    <div
      className={`rounded-2xl border p-4 ${
        good ? "border-brass/30 bg-brass/5" : "border-line bg-paper"
      }`}
    >
      <div className="grid gap-4 sm:grid-cols-[108px_1fr] sm:items-start">
        <div
          className={`relative mx-auto aspect-[3/4] w-[108px] overflow-hidden rounded-xl border ${
            good ? "border-brass/30" : "border-line"
          }`}
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes="108px"
            className="object-cover object-top"
          />
          <span
            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-sm ${
              good ? "bg-brass text-paper" : "bg-stone-soft text-paper"
            }`}
          >
            {good ? "✓" : "×"}
          </span>
        </div>
        <div>
          <div className="font-display text-lg text-ink">{title}</div>
          <ul
            className={`mt-2 space-y-1.5 text-xs leading-relaxed ${
              good ? "text-stone" : "text-stone-soft"
            }`}
          >
            {items.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PhotoRoleCard({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-xl border hairline bg-cream/30 p-4">
      <div className="font-display text-base text-ink">{label}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-stone">{desc}</p>
    </div>
  );
}

function UploadTile({
  label,
  desc,
  filled,
  uploading,
  onFile,
}: {
  label: string;
  desc: string;
  filled: boolean;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={`flex min-h-[13rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
        filled ? "border-ink bg-cream/60" : "border-line bg-cream/20 hover:border-ink/40"
      }`}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
          filled ? "bg-ink text-paper" : "bg-sand text-stone"
        }`}
      >
        {uploading ? <LuxeSpinner size="xs" tone="ink" /> : filled ? "✓" : "+"}
      </span>
      <span className="mt-3 text-sm text-ink">{label}</span>
      <span className="mt-1 text-xs text-stone-soft">
        {uploading ? WORKING.upload : filled ? "Uploaded" : "Click to upload"}
      </span>
      <span className="mt-3 max-w-[13rem] text-xs leading-relaxed text-stone-soft">
        {desc}
      </span>
    </label>
  );
}

function PhotoTile({
  label,
  desc,
  filled,
  onClick,
}: {
  label: string;
  desc: string;
  filled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[13rem] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
        filled
          ? "border-ink bg-cream/60"
          : "border-line bg-cream/20 hover:border-ink/40"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
          filled ? "bg-ink text-paper" : "bg-sand text-stone"
        }`}
      >
        {filled ? "✓" : "+"}
      </span>
      <span className="mt-3 text-sm text-ink">{label}</span>
      <span className="mt-1 text-xs text-stone-soft">
        {filled ? "Added" : "Click to add"}
      </span>
      <span className="mt-3 max-w-[13rem] text-xs leading-relaxed text-stone-soft">
        {desc}
      </span>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-stone">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-sm text-stone ${className}`}>{children}</div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
    />
  );
}

function Select({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink ${
        disabled ? "cursor-not-allowed opacity-70" : ""
      }`}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Visual swatch picker for hair / eye colour. Empty id ("") = detect-from-photo. */
function ColourSwatchPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SwatchOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id || "detect"}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={selected}
            title={o.label}
            className={`flex min-w-[4.75rem] max-w-[5.5rem] flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-center transition-colors ${
              selected
                ? "border-ink bg-cream/60"
                : "border-line hover:border-ink/40"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                o.css
                  ? "ring-1 ring-black/10"
                  : "border border-dashed border-stone/50"
              } ${selected ? "ring-2 ring-ink ring-offset-1 ring-offset-paper" : ""}`}
              style={o.css ? { background: o.css } : undefined}
            >
              {!o.css && (
                <span className="text-[9px] uppercase tracking-wide text-stone-soft">
                  Auto
                </span>
              )}
            </span>
            <span className="text-[10px] leading-snug text-stone">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2.5">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              active
                ? "border-ink bg-ink text-paper"
                : "border-line text-stone hover:border-ink/40 hover:text-ink"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

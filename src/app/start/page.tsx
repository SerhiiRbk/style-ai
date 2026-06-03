"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BodyTypePicker } from "@/components/BodyTypePicker";
import {
  inferBodyTypeFromMeasurements,
  type BodyTypeId,
} from "@/lib/style-profile";
import { COUNTRIES, countryNameFromCode } from "@/lib/countries";
import { PROFILE_CURRENCIES, type Currency } from "@/lib/currency";
import { REPORT_COST, CREDIT_COSTS } from "@/lib/credit-costs";
import { BRAND } from "@/lib/brand";

type Tier = "free" | "basic" | "lookbook" | "premium";

const PHOTO_ROLES: { role: string; label: string }[] = [
  { role: "face", label: "Front portrait" },
  { role: "full", label: "Full length" },
  { role: "profile", label: "Profile (optional)" },
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
  { id: "free", name: "Free preview", note: "1 look · no try-on / PDF" },
  { id: "basic", name: "Basic report", note: "Full report · 3 looks · PDF" },
  { id: "lookbook", name: "Lookbook", note: "+ Capsule & virtual try-on" },
  { id: "premium", name: "Premium", note: "+ Facial hair & eyewear" },
];

const STEPS = ["About you", "Photos", "Goals", "Package"];

const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => (LIVE ? createClient() : null), []);
  const [userId, setUserId] = useState<string | null>(null);
  const sessionIdRef = useRef<string>("");
  const [photoPaths, setPhotoPaths] = useState<{ role: string; path: string }[]>(
    [],
  );
  const [uploadingRole, setUploadingRole] = useState<string | null>(null);

  // Live mode requires an authenticated user.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setUserId(data.user.id);
    });
  }, [supabase, router]);

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
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [height, setHeight] = useState(180);
  const [weight, setWeight] = useState("");
  const [bodyType, setBodyType] = useState<BodyTypeId | "">("");
  const [bodyTypeManual, setBodyTypeManual] = useState(false);
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

  // Prefill country/city/currency from Vercel geolocation (best-effort).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (cancelled || !g) return;
        const name = countryNameFromCode(g.country);
        if (name) setCountry((c) => c || name);
        if (g.city) setCity((c) => c || g.city);
        if (g.currency) setCurrency(g.currency);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const canNext = () => {
    if (step === 0) return city.trim() && country.trim();
    if (step === 2) return goals.length > 0;
    return true;
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
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
          photoPaths,
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
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not generate report");
      }
      if (!data.id) throw new Error("Report created but no id returned");
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

  return (
    <main className="flex-1">
      <div className="border-b hairline bg-paper/80 backdrop-blur-md">
        <div className="container-luxe flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-xl">
            {BRAND.name}
          </Link>
          <Link href="/" className="text-sm text-stone hover:text-ink">
            Save &amp; exit
          </Link>
        </div>
      </div>

      <div className="container-luxe max-w-3xl py-12">
        <Stepper step={step} />

        <div className="mt-10 min-h-[380px]">
          {step === 1 && (
            <Section
              eyebrow="Step 2"
              title="Upload your photos"
              subtitle="A clear front portrait and a full-length shot work best. Profile and a current outfit are optional. Photos are processed privately and never sold."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                {LIVE
                  ? PHOTO_ROLES.map(({ role, label }) => (
                      <UploadTile
                        key={role}
                        label={label}
                        filled={photoPaths.some((p) => p.role === role)}
                        uploading={uploadingRole === role}
                        onFile={(file) => uploadPhoto(role, file)}
                      />
                    ))
                  : PHOTO_ROLES.map(({ label }) => (
                      <PhotoTile
                        key={label}
                        label={label}
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
              <p className="mt-4 text-xs text-stone-soft">
                {LIVE
                  ? "Photos are uploaded to your private, GDPR-compliant storage and used only to generate your report. By continuing you consent to this processing."
                  : "Demo: click a tile to simulate an upload. By continuing you consent to processing of your photos for this report."}
              </p>
            </Section>
          )}

          {step === 0 && (
            <Section
              eyebrow="Step 1"
              title="A little about you"
              subtitle="This grounds every recommendation in your real life — age, climate, profession and frame."
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
                <Field label="Gender presentation">
                  <Select
                    value={gender}
                    onChange={setGender}
                    options={[
                      ["male", "Male"],
                      ["female", "Female"],
                      ["non-binary", "Non-binary"],
                    ]}
                  />
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
              subtitle="Start free, or go straight to a full lookbook. You can upgrade later."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTier(t.id)}
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
                        {REPORT_COST[t.id] === 0
                          ? "Free"
                          : REPORT_COST[t.id]}
                      </div>
                      {REPORT_COST[t.id] > 0 && (
                        <div className="text-[11px] text-stone-soft">
                          credits
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-5 text-xs text-stone-soft">
                Reports are paid in credits — new accounts start with free
                credits. Virtual try-on and re-renders cost{" "}
                {CREDIT_COSTS.tryon} credit each.{" "}
                <Link href="/pricing" className="text-brass hover:text-ink">
                  See pricing
                </Link>
                .
              </p>
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
              disabled={submitting}
              className="rounded-full bg-ink px-7 py-3 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              {submitting
                ? "Analysing photos & building your report… (1–2 min)"
                : "Generate my report"}
            </button>
          )}
        </div>
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

function UploadTile({
  label,
  filled,
  uploading,
  onFile,
}: {
  label: string;
  filled: boolean;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={`flex aspect-[3/4] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors ${
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
        {uploading ? "…" : filled ? "✓" : "+"}
      </span>
      <span className="mt-3 text-sm text-ink">{label}</span>
      <span className="mt-1 text-xs text-stone-soft">
        {uploading ? "Uploading…" : filled ? "Uploaded" : "Click to upload"}
      </span>
    </label>
  );
}

function PhotoTile({
  label,
  filled,
  onClick,
}: {
  label: string;
  filled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex aspect-[3/4] flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors ${
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
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
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

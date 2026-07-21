"use client";

import { useState } from "react";
import {
  normalizeHairColorId,
  type UserProfile,
  type BodyTypeId,
  type HairColorId,
  type EyeColorId,
} from "@/lib/style-profile";
import { REPORT_LANGUAGE_IDS, languageNativeLabel } from "@/lib/languages";
import { COUNTRIES } from "@/lib/countries";
import { OCCUPATIONS } from "@/lib/occupations";
import { BodyTypePicker } from "@/components/BodyTypePicker";
import {
  ColourSwatchPicker,
  HAIR_SWATCH_OPTIONS,
  EYE_SWATCH_OPTIONS,
} from "@/components/ColourSwatchPicker";
import type { Currency } from "@/lib/currency";

const CURRENCIES: Currency[] = ["EUR", "USD", "CZK", "PLN"];
const fieldClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none";
const labelClass = "block text-xs uppercase tracking-wide text-stone-soft";

export function AccountProfileForm({
  initialProfile,
  initialGeo,
  photoRead,
}: {
  initialProfile: UserProfile | null;
  initialGeo?: { city?: string; countryName?: string; currency?: Currency };
  photoRead: { season?: string; undertone?: string } | null;
}) {
  const p = initialProfile ?? {};
  const currentYear = new Date().getFullYear();

  const [age, setAge] = useState(p.birthYear ? currentYear - p.birthYear : 40);
  const [height, setHeight] = useState(p.heightCm ?? 180);
  const [weight, setWeight] = useState(p.weightKg ? String(p.weightKg) : "");
  const [country, setCountry] = useState(p.country ?? initialGeo?.countryName ?? "");
  const [city, setCity] = useState(p.city ?? initialGeo?.city ?? "");
  const [currency, setCurrency] = useState<Currency>(
    p.currency ?? initialGeo?.currency ?? "EUR",
  );
  const [language, setLanguage] = useState(p.language ?? "en");
  const [occupation, setOccupation] = useState(p.occupation ?? OCCUPATIONS[0]);
  const [bodyType, setBodyType] = useState<BodyTypeId | "">(p.bodyType ?? "");
  const [hairColor, setHairColor] = useState<HairColorId | "">(
    normalizeHairColorId(p.hairColor) ?? "",
  );
  const [eyeColor, setEyeColor] = useState<EyeColorId | "">(p.eyeColor ?? "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    // Age → birth_year so the stored value never goes stale. Situational defaults
    // (goals/boldness/budget/lifestyle) are preserved untouched — set per report.
    const profile: UserProfile = {
      country: country || undefined,
      city: city || undefined,
      currency,
      language,
      occupation: occupation || undefined,
      birthYear: currentYear - age,
      heightCm: height,
      weightKg: weight ? Number(weight) : undefined,
      bodyType: bodyType || undefined,
      hairColor: hairColor || undefined,
      eyeColor: eyeColor || undefined,
      measurements: p.measurements,
      goals: p.goals,
      boldness: p.boldness,
      budgetEur: p.budgetEur,
      lifestyle: p.lifestyle,
    };
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not save");
      }
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* About you — editable durable traits & preferences */}
      <div>
        <h3 className="font-display text-xl text-ink">About you</h3>
        <p className="mt-1 text-sm text-stone">
          Your defaults for new reports. Each report copies these and lets you
          tweak them for that report only.
        </p>
        <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Age — {age}</label>
            <input
              type="range"
              min={18}
              max={75}
              value={age}
              onChange={(e) => setAge(+e.target.value)}
              className="mt-3 w-full accent-[var(--color-ink)]"
            />
          </div>
          <div>
            <label className={labelClass}>Height — {height} cm</label>
            <input
              type="range"
              min={150}
              max={205}
              value={height}
              onChange={(e) => setHeight(+e.target.value)}
              className="mt-3 w-full accent-[var(--color-ink)]"
            />
          </div>
          <div>
            <label className={labelClass}>Weight (kg) — optional</label>
            <input
              inputMode="numeric"
              value={weight}
              onChange={(e) => setWeight(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 82"
              className={`mt-1 ${fieldClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Occupation</label>
            <select
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              {OCCUPATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Berlin"
              className={`mt-1 ${fieldClass}`}
            />
          </div>
          <div>
            <label className={labelClass}>Preferred currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className={`mt-1 ${fieldClass}`}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Report language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className={`mt-1 ${fieldClass}`}
            >
              {REPORT_LANGUAGE_IDS.map((l) => (
                <option key={l} value={l}>
                  {languageNativeLabel(l)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Colouring — swatch pickers, same as the report wizard. */}
        <p className={`mt-6 ${labelClass}`}>Colouring — optional</p>
        <p className="mt-1 text-xs text-stone-soft">
          Leave on “From photo” to read hair and eye colour from your uploads.
        </p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2 sm:items-start">
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

        {/* Body type — silhouette picker, same as the report wizard. */}
        <p className={`mt-6 ${labelClass}`}>Body type — optional</p>
        <div className="mt-3">
          <BodyTypePicker
            gender={p.genderPresentation ?? "male"}
            value={bodyType}
            onChange={(v) => setBodyType(v)}
          />
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-ink px-6 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {msg && <span className="text-sm text-stone">{msg}</span>}
        </div>
      </div>

      {/* Defaults for your next report — read-only hints, set per report */}
      <div className="rounded-xl border hairline bg-cream/30 p-4">
        <p className="text-[11px] uppercase tracking-wide text-stone-soft">
          Defaults for your next report
        </p>
        <p className="mt-1 text-xs text-stone">
          Starting points for your next report — you set these each time you
          create one, not here.
        </p>
        {p.goals?.length || p.boldness || p.budgetEur || p.lifestyle?.length ? (
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {p.goals?.length ? (
              <Row label="Goals" value={p.goals.join(", ")} />
            ) : null}
            {p.boldness ? <Row label="Boldness" value={p.boldness} /> : null}
            {p.budgetEur ? (
              <Row
                label="Budget"
                value={`€${p.budgetEur.min}–${p.budgetEur.max}`}
              />
            ) : null}
            {p.lifestyle?.length ? (
              <Row label="Lifestyle" value={p.lifestyle.join(", ")} />
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-stone">
            Nothing saved yet — these fill in the first time you create a report,
            or when you tick “Save these as my defaults” in the wizard.
          </p>
        )}
      </div>

      {/* How your last photo read — read-only, derived from the photo */}
      {photoRead && (photoRead.season || photoRead.undertone) && (
        <div className="rounded-xl border hairline bg-paper p-4">
          <p className="text-[11px] uppercase tracking-wide text-stone-soft">
            How your last photo read
          </p>
          <p className="mt-1 text-xs text-stone">
            Read from your photo, not a saved setting — it&apos;s re-analysed on
            every report.
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {photoRead.season && <Row label="Colour season" value={photoRead.season} />}
            {photoRead.undertone && (
              <Row label="Undertone" value={photoRead.undertone} />
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/50 py-1 last:border-0">
      <dt className="text-stone-soft">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LOOK_CONTEXTS } from "@/lib/look-contexts";
import { LOOK_SET_BUNDLES, priceForBundle } from "@/lib/look-sets";
import type { LookBriefSeason } from "@/lib/ai/look-brief";
import { BodyTypePicker } from "@/components/BodyTypePicker";
import type { BodyTypeId } from "@/lib/style-profile";

type Boldness = "conservative" | "moderate" | "experimental" | "statement";

const BOLDNESS: { id: Boldness; label: string }[] = [
  { id: "conservative", label: "Conservative" },
  { id: "moderate", label: "Balanced" },
  { id: "experimental", label: "Adventurous" },
  { id: "statement", label: "Statement" },
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

type ResultItem = {
  title?: string;
  name?: string;
  url?: string;
  price?: string | number | null;
  image?: string;
  imageUrl?: string;
};

type ResultLook = {
  context: string;
  title: string;
  description: string;
  palette: string[];
  image: string;
  items: ResultItem[];
};

type Result = {
  setId: string;
  shareSlug: string | null;
  carloNote: string | null;
  looks: ResultLook[];
  balance: number;
};

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
  initialAge,
  initialBodyType,
  creditBalance,
  loyalty,
  hasReusableProfile,
}: {
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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; buy?: boolean } | null>(
    null,
  );
  const [result, setResult] = useState<Result | null>(null);
  // Stable idempotency key per "generate" intent: held across failed retries
  // so a lost-response retry can't mint/charge a second set; cleared on success.
  const pendingKeyRef = useRef<string | null>(null);

  const price = useMemo(
    () => priceForBundle(looks, loyalty) ?? 0,
    [looks, loyalty],
  );
  const ageNum = Number(age);
  const ageValid = Number.isInteger(ageNum) && ageNum >= 16 && ageNum <= 99;
  const canAfford = creditBalance >= price;
  const canSubmit = ageValid && !submitting && canAfford;

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

  if (!hasReusableProfile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          Create a Look
        </h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-300">
          Create a Look styles new outfits on you using your saved colour
          profile. Generate your free style report first — then come back and
          spin up looks for any occasion on demand.
        </p>
        <Link
          href="/start"
          className="mt-6 inline-flex items-center rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Start your style report
        </Link>
      </main>
    );
  }

  if (result) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            Your looks
          </h1>
          <button
            onClick={() => {
              setResult(null);
              setError(null);
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Create another
          </button>
        </div>

        {result.carloNote ? (
          <blockquote className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            <p className="text-sm leading-relaxed">{result.carloNote}</p>
            <footer className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              — Carlo
            </footer>
          </blockquote>
        ) : null}

        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {result.looks.map((look, i) => (
            <article key={i} className="flex flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={look.image}
                alt={look.title}
                className="aspect-[9/16] w-full rounded-xl object-cover"
              />
              <h2 className="mt-3 font-medium text-neutral-900 dark:text-neutral-50">
                {look.title}
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {look.description}
              </p>
              {look.palette?.length ? (
                <div className="mt-3 flex gap-1.5">
                  {look.palette.map((hex, k) => (
                    <span
                      key={k}
                      title={hex}
                      className="h-5 w-5 rounded-full border border-black/10 dark:border-white/15"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              ) : null}
              {look.items?.length ? (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Shop the look
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {look.items.slice(0, 4).map((item, k) => (
                      <li key={k}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow sponsored"
                          className="text-sm text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-200"
                        >
                          {item.title || item.name || "View item"}
                          {item.price ? (
                            <span className="text-neutral-400"> · {item.price}</span>
                          ) : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-neutral-500">
          Credits remaining: {result.balance}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        Create a Look
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-300">
        A set of outfit looks for one occasion, styled to your colour profile
        and rendered on you.
      </p>

      <div className="mt-8 space-y-8">
        {/* Mini-intake */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            About you
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                Sex
              </span>
              <select
                disabled
                value="male"
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="male">Male</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600 dark:text-neutral-300">
                Age
              </span>
              <input
                type="number"
                min={16}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
              />
            </label>
          </div>
          <div className="mt-4">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              Body type
            </span>
            <div className="mt-2">
              <BodyTypePicker
                gender="male"
                value={bodyType}
                onChange={setBodyType}
              />
            </div>
          </div>
        </section>

        {/* Occasion */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            Occasion
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOOK_CONTEXTS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOccasionId(c.id)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  occasionId === c.id
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Strictness */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            How bold?
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BOLDNESS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBoldness(b.id)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  boldness === b.id
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </section>

        {/* Season */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            Season
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEASONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeason(s.id)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  season === s.id
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Count + price */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            How many looks?
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {LOOK_SET_BUNDLES.map((b) => {
              const p = priceForBundle(b.looks, loyalty) ?? b.credits;
              return (
                <button
                  key={b.looks}
                  type="button"
                  onClick={() => setLooks(b.looks)}
                  className={`rounded-lg border px-3 py-3 text-center transition ${
                    looks === b.looks
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200"
                  }`}
                >
                  <span className="block text-lg font-semibold">{b.looks}</span>
                  <span className="block text-xs opacity-80">{p} credits</span>
                </button>
              );
            })}
          </div>
          {loyalty ? (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              Loyalty pricing applied.
            </p>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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

        <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <div className="text-sm text-neutral-500">
            {price} credits · balance {creditBalance}
          </div>
          <button
            onClick={onGenerate}
            disabled={!canSubmit}
            className="rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {submitting
              ? `Generating ${looks} looks…`
              : !ageValid
                ? "Enter your age"
                : !canAfford
                  ? "Not enough credits"
                  : `Generate ${looks} looks`}
          </button>
        </div>
      </div>
    </main>
  );
}

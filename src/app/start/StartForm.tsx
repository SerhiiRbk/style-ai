"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BodyTypePicker } from "@/components/BodyTypePicker";
import {
  ColourSwatchPicker,
  HAIR_SWATCH_OPTIONS,
  EYE_SWATCH_OPTIONS,
} from "@/components/ColourSwatchPicker";
import {
  inferBodyTypeFromMeasurements,
  profileFromIntake,
  type BodyTypeId,
  type HairColorId,
  normalizeHairColorId,
  type EyeColorId,
  type Intake,
  type UserProfile,
} from "@/lib/style-profile";
import { COUNTRIES } from "@/lib/countries";
import { OUTFIT_BUDGET_BANDS } from "@/lib/budgets";
import { PROFILE_CURRENCIES, type Currency } from "@/lib/currency";
import { OCCUPATIONS } from "@/lib/occupations";
import {
  REPORT_LANGUAGES,
  DEFAULT_LANGUAGE,
  type ReportLanguage,
} from "@/lib/languages";
import { REPORT_COST, CREDIT_COSTS, SIGNUP_BONUS } from "@/lib/credit-costs";
import {
  type DraftAnswers,
  saveDraftAnswers,
  loadDraftAnswers,
  setDraftPending,
  isDraftPending,
  clearDraftPending,
  savePhotoBlob,
  loadPhotoBlobs,
  clearDraft,
} from "@/lib/draft-storage";
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
  "Old Money",
  "Socialite",
];
const BOLDNESS: { id: string; label: string; desc: string }[] = [
  { id: "conservative", label: "Conservative", desc: "Keep it safe and classic" },
  { id: "moderate", label: "Moderate", desc: "Modern, but not flashy" },
  { id: "experimental", label: "Experimental", desc: "Open to trying new things" },
  { id: "statement", label: "Statement", desc: "I want to stand out" },
];
const BUDGETS = OUTFIT_BUDGET_BANDS.map((b) => ({
  label: b.label,
  min: b.min,
  max: b.max,
}));
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

type ReusePhoto = { path: string; url: string | null; createdAt: string };

export function StartForm({
  userId,
  showWelcome: initialWelcome = false,
  userEmail = null,
  creditBalance = null,
  initialProfile = null,
  initialGeo,
}: {
  userId: string | null;
  showWelcome?: boolean;
  userEmail?: string | null;
  creditBalance?: number | null;
  initialProfile?: UserProfile | null;
  initialGeo?: {
    city?: string;
    countryName?: string;
    currency?: Currency;
  };
}) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const pf = initialProfile;
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

  // Deferred registration (§5.4): an anonymous visitor fills the wizard here;
  // answers persist to localStorage and photos to IndexedDB, and only reach our
  // servers after they register at "generate".
  const isAnon = LIVE && !userId;
  const [stagedRoles, setStagedRoles] = useState<string[]>([]);
  const [stagedPreviews, setStagedPreviews] = useState<Record<string, string>>(
    {},
  );
  const [reportId, setReportId] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [quotaWarn, setQuotaWarn] = useState(false);

  // Previously-uploaded photos the user can reuse instead of re-uploading,
  // grouped BY ROLE so a full-length is never offered for the face slot (or vice
  // versa). Fetched from /api/photos; empty for first-time users.
  const [reusePhotos, setReusePhotos] = useState<{
    full: ReusePhoto[];
    face: ReusePhoto[];
    profile: ReusePhoto[];
  }>({ full: [], face: [], profile: [] });

  useEffect(() => {
    if (!LIVE || !userId) return;
    let cancelled = false;
    fetch("/api/photos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setReusePhotos({
          full: Array.isArray(d.photos)
            ? d.photos.map((p: { storagePath: string; url: string | null; createdAt: string }) => ({
                path: p.storagePath,
                url: p.url,
                createdAt: p.createdAt,
              }))
            : [],
          face: Array.isArray(d.face) ? (d.face as ReusePhoto[]) : [],
          profile: Array.isArray(d.profile) ? (d.profile as ReusePhoto[]) : [],
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Reuse a prior photo for ONE role, replacing any current choice for it. */
  function applyReusePhoto(role: string, path: string) {
    setPhotoPaths((prev) => [
      ...prev.filter((p) => p.role !== role),
      { role, path },
    ]);
  }

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
  // Seed from the saved profile when present, else geo / sensible defaults.
  const budgetIndexFromProfile = () => {
    if (!pf?.budgetEur) return 1;
    const i = BUDGETS.findIndex(
      (b) => b.min === pf.budgetEur!.min && b.max === pf.budgetEur!.max,
    );
    return i >= 0 ? i : 1;
  };
  const m0 = pf?.measurements;
  const [age, setAge] = useState(pf?.birthYear ? currentYear - pf.birthYear : 40);
  const [gender, setGender] = useState<string>(pf?.genderPresentation ?? "male");
  const [city, setCity] = useState(pf?.city ?? initialGeo?.city ?? "");
  const [country, setCountry] = useState(pf?.country ?? initialGeo?.countryName ?? "");
  const [currency, setCurrency] = useState<Currency>(
    pf?.currency ?? initialGeo?.currency ?? "EUR",
  );
  const [language, setLanguage] = useState<ReportLanguage>(
    pf?.language ?? DEFAULT_LANGUAGE,
  );
  const [height, setHeight] = useState(pf?.heightCm ?? 180);
  const [weight, setWeight] = useState(pf?.weightKg ? String(pf.weightKg) : "");
  const [bodyType, setBodyType] = useState<BodyTypeId | "">(pf?.bodyType ?? "");
  const [bodyTypeManual, setBodyTypeManual] = useState(Boolean(pf?.bodyType));
  const [hairColor, setHairColor] = useState<HairColorId | "">(
    normalizeHairColorId(pf?.hairColor) ?? "",
  );
  const [eyeColor, setEyeColor] = useState<EyeColorId | "">(pf?.eyeColor ?? "");
  const [shoulderCm, setShoulderCm] = useState(m0?.shoulderCm ? String(m0.shoulderCm) : "");
  const [chestCm, setChestCm] = useState(m0?.chestCm ? String(m0.chestCm) : "");
  const [waistCm, setWaistCm] = useState(m0?.waistCm ? String(m0.waistCm) : "");
  const [hipCm, setHipCm] = useState(m0?.hipCm ? String(m0.hipCm) : "");
  const [sleeveCm, setSleeveCm] = useState(m0?.sleeveCm ? String(m0.sleeveCm) : "");
  const [occupation, setOccupation] = useState(pf?.occupation ?? OCCUPATIONS[0]);
  const [lifestyle, setLifestyle] = useState<string[]>(pf?.lifestyle ?? []);
  const [goals, setGoals] = useState<string[]>(pf?.goals ?? []);
  const [boldness, setBoldness] = useState<string>(pf?.boldness ?? "moderate");
  const [budget, setBudget] = useState(budgetIndexFromProfile());
  const [tier, setTier] = useState<Tier>(isAnon ? "free" : "lookbook");
  const [biometricConsent, setBiometricConsent] = useState(false);
  // Off by default — never silently overwrite the saved profile from a report.
  const [saveDefaults, setSaveDefaults] = useState(false);

  // Credit gating for the Package step (balance is the server snapshot at load).
  const reportCost = REPORT_COST[tier];
  const knownBalance = creditBalance != null ? creditBalance : null;
  // Anon sees the balance they'll HAVE after signup (§5.4 cond.4) so they can't
  // pick a tier that would strand them at a paywall right after registering.
  const effectiveBalance = isAnon ? SIGNUP_BONUS : knownBalance;
  const insufficientCredits =
    effectiveBalance != null && reportCost > 0 && effectiveBalance < reportCost;

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

  const hasRequiredPhotos = isAnon
    ? stagedRoles.includes("face") && stagedRoles.includes("full")
    : LIVE
      ? photoPaths.some((p) => p.role === "face") &&
        photoPaths.some((p) => p.role === "full")
      : photos.length >= 2;

  const canNext = () => {
    if (step === 0) return country.trim();
    if (step === 1) return hasRequiredPhotos && biometricConsent;
    if (step === 2) return goals.length > 0;
    return true;
  };

  /** Build the /api/reports intake payload from a set of raw answers. */
  function buildIntake(a: {
    age: number;
    gender: string;
    city: string;
    country: string;
    language: string;
    currency: string;
    height: number;
    weight: string;
    bodyType: string;
    bodyTypeManual: boolean;
    hairColor: string;
    eyeColor: string;
    shoulderCm: string;
    chestCm: string;
    waistCm: string;
    hipCm: string;
    sleeveCm: string;
    occupation: string;
    lifestyle: string[];
    goals: string[];
    boldness: string;
    budget: number;
  }) {
    const meas = {
      shoulderCm: a.shoulderCm ? Number(a.shoulderCm) : undefined,
      chestCm: a.chestCm ? Number(a.chestCm) : undefined,
      waistCm: a.waistCm ? Number(a.waistCm) : undefined,
      hipCm: a.hipCm ? Number(a.hipCm) : undefined,
      sleeveCm: a.sleeveCm ? Number(a.sleeveCm) : undefined,
    };
    const effective = a.bodyTypeManual
      ? a.bodyType
      : (inferBodyTypeFromMeasurements(meas, a.gender) ?? a.bodyType);
    return {
      age: a.age,
      genderPresentation: a.gender,
      city: a.city,
      country: a.country,
      language: a.language,
      currency: a.currency,
      heightCm: a.height,
      weightKg: a.weight ? Number(a.weight) : undefined,
      bodyType: effective || undefined,
      measurements: Object.values(meas).some((v) => v != null) ? meas : undefined,
      hairColor: a.hairColor || undefined,
      eyeColor: a.eyeColor || undefined,
      occupation: a.occupation,
      lifestyle: a.lifestyle,
      goals: a.goals,
      boldness: a.boldness,
      budgetEur: { min: BUDGETS[a.budget].min, max: BUDGETS[a.budget].max },
    };
  }

  /** Snapshot the current answers into a draft record (§5.4). */
  function currentDraft(id: string): DraftAnswers {
    return {
      step,
      age,
      gender,
      city,
      country,
      currency,
      language,
      height,
      weight,
      bodyType,
      bodyTypeManual,
      hairColor,
      eyeColor,
      shoulderCm,
      chestCm,
      waistCm,
      hipCm,
      sleeveCm,
      occupation,
      lifestyle,
      goals,
      boldness,
      budget,
      tier,
      biometricConsent,
      reportId: id,
    };
  }

  /**
   * POST /api/reports and handle navigation/errors. Shared by the logged-in
   * submit and the post-registration resume. Clears the client draft on success.
   */
  async function postReport(args: {
    intake: ReturnType<typeof buildIntake>;
    tier: string;
    photoPaths: { role: string; path: string }[];
    biometricConsent: boolean;
    reportId: string;
    saveAsDefault: boolean;
  }): Promise<void> {
    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4 * 60 * 1000);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          tier: args.tier,
          reportId: args.reportId,
          photoPaths: args.photoPaths,
          biometricConsent: args.photoPaths.length
            ? args.biometricConsent
            : undefined,
          consentVersion: args.photoPaths.length
            ? LEGAL.consentVersion
            : undefined,
          intake: args.intake,
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
          await clearDraft();
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
      // Persist these answers as the user's defaults only when they opted in.
      if (args.saveAsDefault && userId) {
        void fetch("/api/account/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: profileFromIntake(args.intake as Intake, currentYear),
          }),
        }).catch(() => {});
      }
      await clearDraft();
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
      setResuming(false);
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  /** Logged-in submit — build intake from live state and post immediately. */
  async function submit() {
    // Generate once per submission; keep it across retries so a re-send maps to
    // the same report (server charges credits at most once for this key).
    if (!reportIdRef.current) reportIdRef.current = crypto.randomUUID();
    await postReport({
      intake: buildIntake({
        age,
        gender,
        city,
        country,
        language,
        currency,
        height,
        weight,
        bodyType: effectiveBodyType || "",
        bodyTypeManual: true,
        hairColor,
        eyeColor,
        shoulderCm,
        chestCm,
        waistCm,
        hipCm,
        sleeveCm,
        occupation,
        lifestyle,
        goals,
        boldness,
        budget,
      }),
      tier,
      photoPaths,
      biometricConsent,
      reportId: reportIdRef.current,
      saveAsDefault: saveDefaults,
    });
  }

  /** Stage a photo on-device for an anonymous visitor (IndexedDB, no upload). */
  async function stagePhoto(role: string, file: File) {
    setUploadingRole(role);
    const ok = await savePhotoBlob(role, file);
    setUploadingRole(null);
    if (!ok) {
      setQuotaWarn(true);
      return;
    }
    setStagedPreviews((prev) => {
      if (prev[role]) URL.revokeObjectURL(prev[role]);
      return { ...prev, [role]: URL.createObjectURL(file) };
    });
    setStagedRoles((prev) => (prev.includes(role) ? prev : [...prev, role]));
  }

  /** Anon "generate": snapshot the draft, mark it pending, send to registration. */
  function onAnonGenerate() {
    const id = reportId || crypto.randomUUID();
    if (!reportId) setReportId(id);
    if (!saveDraftAnswers(currentDraft(id))) {
      setQuotaWarn(true);
      return;
    }
    setDraftPending();
    router.push("/login");
  }

  /**
   * After registration: upload the staged photos under the now-authenticated
   * session, then post the report from the saved draft. Credits are spent only
   * here, once, keyed by the draft's reportId.
   */
  async function resume(draft: DraftAnswers) {
    setShowWelcome(false);
    setResuming(true);
    try {
      const staged = await loadPhotoBlobs();
      const paths: { role: string; path: string }[] = [];
      if (supabase && userId) {
        if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
        for (const p of staged) {
          const ext = p.name.split(".").pop() || "jpg";
          const path = `${userId}/${sessionIdRef.current}/${p.role}.${ext}`;
          const file = new File([p.blob], p.name, { type: p.type });
          const { error: upErr } = await supabase.storage
            .from("photos")
            .upload(path, file, { upsert: true, contentType: p.type });
          if (!upErr) paths.push({ role: p.role, path });
        }
      }
      await postReport({
        intake: buildIntake(draft),
        tier: draft.tier,
        photoPaths: paths,
        biometricConsent: draft.biometricConsent,
        reportId: draft.reportId,
        saveAsDefault: false,
      });
    } catch (e) {
      setResuming(false);
      setError(e instanceof Error ? e.message : "Could not finish your report.");
    }
  }

  // Hydrate the wizard from a saved draft (draft wins over profile — §5.4 cond.5).
  function hydrateDraft() {
    if (!isAnon) return;
    const d = loadDraftAnswers();
    if (d) {
      setStep(d.step ?? 0);
      setAge(d.age);
      setGender(d.gender);
      setCity(d.city);
      setCountry(d.country);
      setCurrency(d.currency as Currency);
      setLanguage(d.language as ReportLanguage);
      setHeight(d.height);
      setWeight(d.weight);
      setBodyType((d.bodyType as BodyTypeId) || "");
      setBodyTypeManual(d.bodyTypeManual);
      setHairColor((d.hairColor as HairColorId) || "");
      setEyeColor((d.eyeColor as EyeColorId) || "");
      setShoulderCm(d.shoulderCm);
      setChestCm(d.chestCm);
      setWaistCm(d.waistCm);
      setHipCm(d.hipCm);
      setSleeveCm(d.sleeveCm);
      setOccupation(d.occupation);
      setLifestyle(d.lifestyle);
      setGoals(d.goals);
      setBoldness(d.boldness);
      setBudget(d.budget);
      setTier(d.tier as Tier);
      setBiometricConsent(d.biometricConsent);
      setReportId(d.reportId || crypto.randomUUID());
      void loadPhotoBlobs().then((ps) => {
        setStagedRoles(ps.map((p) => p.role));
        setStagedPreviews(
          Object.fromEntries(ps.map((p) => [p.role, URL.createObjectURL(p.blob)])),
        );
      });
    } else {
      setReportId(crypto.randomUUID());
    }
    setDraftReady(true);
  }

  useEffect(() => {
    // Mount-time sync of on-device draft into React state (legit external sync).
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    hydrateDraft();
  }, []);

  // Persist answers as they change, once hydration is done (anon only).
  useEffect(() => {
    if (!isAnon || !draftReady || !reportId) return;
    saveDraftAnswers(currentDraft(reportId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAnon,
    draftReady,
    reportId,
    step,
    age,
    gender,
    city,
    country,
    currency,
    language,
    height,
    weight,
    bodyType,
    bodyTypeManual,
    hairColor,
    eyeColor,
    shoulderCm,
    chestCm,
    waistCm,
    hipCm,
    sleeveCm,
    occupation,
    lifestyle,
    goals,
    boldness,
    budget,
    tier,
    biometricConsent,
  ]);

  // After registration, resume a pending draft: upload photos, then generate.
  useEffect(() => {
    if (!LIVE || !userId || !isDraftPending()) return;
    const d = loadDraftAnswers();
    if (!d) {
      clearDraftPending();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void resume(d);
  }, [userId]);

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
      {submitting || resuming ? (
        <LuxeBlockingWait
          eyebrow={resuming && !submitting ? "Finishing up" : "Creating report"}
          title={
            resuming && !submitting
              ? "Picking up where you left off"
              : "Crafting your report"
          }
          message={
            resuming && !submitting
              ? "Securely uploading your photos and preparing your report — this only takes a moment."
              : `${BRAND.stylist.first} is analysing your photos and building your personalised style profile. This typically takes one to two minutes.`
          }
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
              {LIVE &&
                reusePhotos.full.length +
                  reusePhotos.face.length +
                  reusePhotos.profile.length >
                  0 && (
                  <div className="mb-6 mt-6 rounded-2xl border hairline bg-cream/40 p-5">
                    <h3 className="font-display text-xl">Use a previous photo</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone">
                      Reuse photos from an earlier report, or upload new ones
                      below. Each type is chosen separately.
                    </p>
                    <div className="mt-4 space-y-4">
                      {(
                        [
                          { role: "face", label: "Front portrait", items: reusePhotos.face },
                          { role: "full", label: "Full length", items: reusePhotos.full },
                          { role: "profile", label: "Profile", items: reusePhotos.profile },
                        ] as const
                      ).map(({ role, label, items }) =>
                        items.length ? (
                          <div key={role}>
                            <p className="text-[11px] uppercase tracking-wide text-stone-soft">
                              {label}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3">
                              {items.map((item) => {
                                const selected = photoPaths.some(
                                  (p) => p.role === role && p.path === item.path,
                                );
                                return (
                                  <button
                                    key={item.path}
                                    type="button"
                                    onClick={() => applyReusePhoto(role, item.path)}
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
                                        alt={`Previous ${label.toLowerCase()}`}
                                        className="h-full w-full object-contain"
                                        loading="lazy"
                                      />
                                    ) : null}
                                    {selected && (
                                      <span className="absolute inset-x-0 bottom-0 bg-brass/90 py-0.5 text-center text-[10px] text-paper">
                                        Selected
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
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
                        filled={
                          isAnon
                            ? stagedRoles.includes(role)
                            : photoPaths.some((p) => p.role === role)
                        }
                        uploading={uploadingRole === role}
                        preview={isAnon ? stagedPreviews[role] : undefined}
                        onFile={(file) =>
                          isAnon
                            ? stagePhoto(role, file)
                            : uploadPhoto(role, file)
                        }
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
                <Field label="City (optional)">
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
                <Field label="Report language">
                  <Select
                    value={language}
                    onChange={(v) => setLanguage(v as ReportLanguage)}
                    options={REPORT_LANGUAGES.map(
                      (l) => [l.id, l.native] as [string, string],
                    )}
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

              <Label className="mt-8">Body type — optional</Label>
              <p className="mt-1 text-xs text-stone-soft">
                Pick the silhouette closest to you. It helps us recommend the
                most flattering fits — you can skip this.
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
              <Label className="mt-7">Lifestyle (optional)</Label>
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
              subtitle={
                isAnon
                  ? `You'll create a free account to generate — it takes a moment and comes with ${SIGNUP_BONUS} credits. Nothing is charged until your report is generated.`
                  : "New accounts get signup credits; the Starter Report uses credits like paid tiers."
              }
            >
              {effectiveBalance != null && (
                <div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-cream/40 px-5 py-3">
                  <span className="text-sm text-stone">
                    {isAnon ? "Balance after signup" : "Your balance"}
                  </span>
                  <span className="font-display text-lg text-ink">
                    {effectiveBalance}{" "}
                    {effectiveBalance === 1 ? "credit" : "credits"}
                  </span>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {TIERS.map((t) => {
                  const tierCost = REPORT_COST[t.id];
                  const unaffordable =
                    effectiveBalance != null &&
                    tierCost > 0 &&
                    effectiveBalance < tierCost;
                  return (
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
                        {tierCost}
                      </div>
                      <div className="text-[11px] text-stone-soft">credits</div>
                      {unaffordable && (
                        <div className="mt-1 text-[11px] text-[#9E5C3C]">
                          need {tierCost - (effectiveBalance as number)} more
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
                  {isAnon ? (
                    <>
                      A new account comes with {effectiveBalance}{" "}
                      {effectiveBalance === 1 ? "credit" : "credits"} — this
                      package needs {reportCost}. Pick the Starter Report to begin
                      now, then top up any time for larger packages.
                    </>
                  ) : (
                    <>
                      You have {effectiveBalance}{" "}
                      {effectiveBalance === 1 ? "credit" : "credits"} — this
                      package needs {reportCost}. Pick a smaller package above or{" "}
                      <Link href="/pricing" className="underline hover:text-ink">
                        top up your credits
                      </Link>
                      .
                    </>
                  )}
                </p>
              )}
              {quotaWarn && (
                <p className="mt-4 rounded-xl border border-[#9E5C3C]/30 bg-[#9E5C3C]/5 px-5 py-3 text-sm text-[#9E5C3C]">
                  We couldn&apos;t save your draft on this device (storage may be
                  full or blocked). You can still create your account and generate
                  now without leaving this page.
                </p>
              )}
              {error && (
                <p className="mt-4 text-sm text-[#9E5C3C]">{error}</p>
              )}
              {userId && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-stone">
                  <input
                    type="checkbox"
                    checked={saveDefaults}
                    onChange={(e) => setSaveDefaults(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]"
                  />
                  <span>
                    Save these answers as my defaults, so my next report starts
                    pre-filled. You can change them any time in your account.
                  </span>
                </label>
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
              onClick={isAnon ? onAnonGenerate : submit}
              disabled={submitting || insufficientCredits}
              className="rounded-full bg-ink px-7 py-3 text-sm text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
            >
              {submitting ? (
                <LuxeWorkingLabel message={WORKING.report} />
              ) : isAnon ? (
                "Create account & generate"
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
  preview,
}: {
  label: string;
  desc: string;
  filled: boolean;
  uploading: boolean;
  onFile: (file: File) => void;
  /** Local object-URL thumbnail for a not-yet-uploaded (staged) photo. */
  preview?: string;
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
      {preview ? (
        <span className="mb-3 block h-24 w-[4.5rem] overflow-hidden rounded-lg border border-line bg-cream/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`${label} preview`}
            className="h-full w-full object-contain"
          />
        </span>
      ) : (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
            filled ? "bg-ink text-paper" : "bg-sand text-stone"
          }`}
        >
          {uploading ? <LuxeSpinner size="xs" tone="ink" /> : filled ? "✓" : "+"}
        </span>
      )}
      <span className="mt-3 text-sm text-ink">{label}</span>
      <span className="mt-1 text-xs text-stone-soft">
        {uploading
          ? WORKING.upload
          : filled
            ? preview
              ? "Ready · click to change"
              : "Uploaded"
            : "Click to upload"}
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

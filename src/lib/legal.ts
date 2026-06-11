import { BRAND } from "@/lib/brand";

/** Legal / policy metadata — keep consent `version` in sync when policies change. */
export const LEGAL = {
  lastUpdated: "11 June 2026",
  /** Stored on biometric consent rows — bump when Privacy Policy changes materially. */
  consentVersion: "2026-06-11",
  /** Stored on terms acceptance at registration — bump when Terms change materially. */
  termsVersion: "2026-06-11",
  contactEmail: BRAND.legalContactEmail,
  operatorName: BRAND.legalName,
  siteName: BRAND.name,
  /** EU Online Dispute Resolution platform (required for EU B2C online traders). */
  odrUrl: "https://ec.europa.eu/consumers/odr",
  dpoAppointed: false,
} as const;

/** GDPR Art. 13 controller identity — set LEGAL_* env vars in production. */
export function controllerIdentity(): {
  legalName: string;
  legalForm: string;
  registrationNumber: string | null;
  vatId: string | null;
  addressLines: string[];
} {
  const addressLines = [
    process.env.LEGAL_ADDRESS_LINE1,
    [process.env.LEGAL_POSTAL_CODE, process.env.LEGAL_CITY]
      .filter(Boolean)
      .join(" ")
      .trim() || null,
    process.env.LEGAL_COUNTRY,
  ].filter((line): line is string => Boolean(line?.trim()));

  return {
    legalName: process.env.LEGAL_ENTITY_NAME ?? BRAND.legalName,
    legalForm: process.env.LEGAL_FORM ?? "Operating company",
    registrationNumber: process.env.LEGAL_REGISTRATION_NUMBER ?? null,
    vatId: process.env.LEGAL_VAT_ID ?? null,
    addressLines:
      addressLines.length > 0
        ? addressLines
        : [`Contact ${BRAND.legalContactEmail} for our registered business address.`],
  };
}

export type Subprocessor = {
  name: string;
  purpose: string;
  location: string;
  safeguards: string;
};

/** Subprocessors that may process personal data on our behalf (Art. 13(1)(e), Art. 28). */
export const LEGAL_SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase, Inc.",
    purpose: "Authentication, Postgres database, private file storage for photos and generated assets",
    location: "EU region (project-configured); parent company in the United States",
    safeguards: "Data Processing Agreement (DPA) and EU Standard Contractual Clauses (SCCs)",
  },
  {
    name: "Stripe, Inc.",
    purpose: "Credit-pack payments and receipts",
    location: "EU / United States (Stripe entity depends on your country)",
    safeguards: "DPA and SCCs",
  },
  {
    name: "Vercel, Inc.",
    purpose: "Application hosting, edge routing, server logs",
    location: "EU / United States",
    safeguards: "DPA and SCCs",
  },
  {
    name: "AI providers (via Vercel AI Gateway)",
    purpose: "Automated analysis of photos and questionnaire answers; generation of report text and images",
    location: "United States / EU (model provider varies per request)",
    safeguards:
      "DPA and SCCs where applicable; processing limited to delivering your report, not public model training on your photos",
  },
  {
    name: "fal.ai (optional)",
    purpose: "Virtual try-on image rendering when the feature is enabled",
    location: "United States / EU",
    safeguards: "Contractual confidentiality and security obligations",
  },
];

export type LegalCookie = {
  name: string;
  purpose: string;
  duration: string;
  category: "Strictly necessary";
};

export const LEGAL_COOKIES: LegalCookie[] = [
  {
    name: "Supabase auth session cookies",
    purpose: "Keep you signed in securely",
    duration: "Session / refresh token lifetime",
    category: "Strictly necessary",
  },
  {
    name: "pending_promo",
    purpose: "Remember a promotional code from an invite link until you sign in",
    duration: "7 days",
    category: "Strictly necessary",
  },
];

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
};

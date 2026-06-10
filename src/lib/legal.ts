import { BRAND } from "@/lib/brand";

/** Legal / policy metadata — keep consent `version` in sync when policies change. */
export const LEGAL = {
  lastUpdated: "10 June 2026",
  /** Stored on biometric consent rows — bump when Privacy Policy changes materially. */
  consentVersion: "2026-06-10",
  contactEmail: BRAND.legalContactEmail,
  operatorName: BRAND.legalName,
  siteName: BRAND.name,
} as const;

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
};

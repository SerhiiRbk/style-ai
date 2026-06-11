import { BRAND } from "@/lib/brand";
import { LEGAL, controllerIdentity, type LegalSection } from "@/lib/legal";

const ctrl = controllerIdentity();

export const IMPRESSUM_INTRO =
  "Information pursuant to § 5 TMG (Germany), § 25 MedienG (Austria), and equivalent EU transparency requirements.";

export const IMPRESSUM_SECTIONS: LegalSection[] = [
  {
    id: "operator",
    title: "Service provider",
    paragraphs: [
      `${ctrl.legalName}${ctrl.legalForm ? ` (${ctrl.legalForm})` : ""}`,
      ...ctrl.addressLines,
      ...(ctrl.registrationNumber
        ? [`Registration number: ${ctrl.registrationNumber}`]
        : []),
      ...(ctrl.vatId ? [`VAT ID: ${ctrl.vatId}`] : []),
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      `Email: ${LEGAL.contactEmail}`,
      `Website: ${BRAND.name.toLowerCase()}.app`,
    ],
  },
  {
    id: "responsible",
    title: "Responsible for content (§ 18 Abs. 2 MStV)",
    paragraphs: [`${ctrl.legalName}`, ...ctrl.addressLines],
  },
  {
    id: "dispute",
    title: "Dispute resolution",
    paragraphs: [
      `The European Commission's Online Dispute Resolution platform is available at ${LEGAL.odrUrl}.`,
      "We are not willing or obliged to participate in dispute-resolution proceedings before a consumer arbitration board unless mandatory law requires it.",
    ],
  },
];

import { BRAND } from "@/lib/brand";
import {
  LEGAL,
  LEGAL_COOKIES,
  LEGAL_SUBPROCESSORS,
  controllerIdentity,
  type LegalSection,
} from "@/lib/legal";

const ctrl = controllerIdentity();
const addressBlock = ctrl.addressLines.join(", ");

export const PRIVACY_INTRO = `${LEGAL.siteName} ("we", "us") operates ${LEGAL.siteName.toLowerCase()}.app — an AI-assisted personal styling service. This Privacy Policy explains what personal data we collect, why we use it, who we share it with, and the rights you have under applicable law, including the EU General Data Protection Regulation (GDPR).`;

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "controller",
    title: "1. Who is responsible for your data?",
    paragraphs: [
      `The data controller is ${ctrl.legalName}${ctrl.legalForm ? ` (${ctrl.legalForm})` : ""}.`,
      `Registered address: ${addressBlock}.`,
      ...(ctrl.registrationNumber
        ? [`Company / registration number: ${ctrl.registrationNumber}.`]
        : []),
      ...(ctrl.vatId ? [`VAT ID: ${ctrl.vatId}.`] : []),
      `Privacy contact: ${LEGAL.contactEmail}. We aim to respond to data-subject requests within one month, as required by the GDPR.`,
      LEGAL.dpoAppointed
        ? `Data Protection Officer: ${LEGAL.contactEmail}.`
        : "We have not appointed a Data Protection Officer. For a service of our current scale this is not required under GDPR Art. 37; privacy enquiries go to the contact above.",
    ],
  },
  {
    id: "what-we-collect",
    title: "2. What data we collect",
    paragraphs: [
      "We collect only what we need to run the service, process payments, and improve quality. Depending on how you use Valetti, this may include:",
    ],
    list: [
      "Account data — email address and authentication identifiers when you sign in (via our identity provider).",
      "Profile and intake data — answers you provide in the style questionnaire (age range, city, lifestyle, goals, budget, style preferences, and similar non-biometric fields).",
      "Photographs — portraits and full-length images you upload so we can analyse colouring, proportions, and grooming, and generate personalised visuals. Photos may allow us to infer biometric characteristics and are treated as special-category data under GDPR Article 9.",
      "Generated content — style reports, colour palettes, look images, capsule plans, shopping lists, try-on renders, and related metadata linked to your account.",
      "Usage and technical data — IP address, browser type, device information, server logs used for security and debugging.",
      "Payment data — when you buy credits, payment is processed by Stripe. We receive transaction references and purchase amounts; we do not store full card numbers.",
      "Communications — if you email us, we keep the correspondence needed to handle your request.",
      "Consent records — timestamp, policy version, and type of consent you give (e.g. biometric photo processing).",
    ],
  },
  {
    id: "mandatory",
    title: "3. Is providing data mandatory?",
    paragraphs: [
      "You must create an account and provide intake answers to receive a personalised report (contractual necessity). Photographs are optional for some flows but required for photo-based personalisation, try-on, and re-renders — without them we cannot deliver those features. You may use the public sample report without an account.",
    ],
  },
  {
    id: "why-we-use",
    title: "4. Why we use your data and our legal bases",
    paragraphs: ["Under the GDPR we rely on the following legal bases:"],
    list: [
      "Contract (Art. 6(1)(b)) — to create and deliver your style report, manage credits, provide try-on and account features you request.",
      "Explicit consent (Art. 9(2)(a)) — for processing photographs and other biometric-related data used to personalise your report and generated images. You must tick a separate consent box before photos are processed; you may withdraw consent by deleting your photos, reports, or account.",
      "Legitimate interests (Art. 6(1)(f)) — specifically: (i) keeping the service secure and preventing fraud or abuse; (ii) maintaining server logs for incident response; (iii) understanding aggregated, non-identifying usage to improve reliability. We balance these interests against your rights and offer opt-out via account deletion where processing is not strictly necessary.",
      "Legal obligation (Art. 6(1)(c)) — where we must retain records for tax, accounting, or regulatory purposes.",
    ],
  },
  {
    id: "automated",
    title: "5. Automated processing and AI",
    paragraphs: [
      `${LEGAL.siteName} uses automated analysis and generative AI models to build style profiles, written recommendations, and images. Outputs are presented through ${BRAND.stylist.name}, our lead stylist persona — a brand voice, not a live human consultant.`,
      "Your photos and questionnaire answers may be sent to AI infrastructure providers (see Section 7) solely to provide the service. We do not use your photos to train public foundation models on your behalf without your knowledge; processing is scoped to delivering your report and related features.",
      "AI outputs may be imperfect. Recommendations are informational and not professional, medical, or dermatological advice.",
      "We do not make solely automated decisions that produce legal or similarly significant effects about you within the meaning of GDPR Article 22. Style suggestions are advisory; you choose whether to follow them.",
    ],
  },
  {
    id: "sharing",
    title: "6. When we share data",
    paragraphs: [
      "We do not sell your personal data. We share data only with the subprocessors listed below, or when required by law.",
    ],
  },
  {
    id: "subprocessors",
    title: "7. Subprocessors",
    paragraphs: [
      "The following categories of recipients process personal data on our behalf under written data-processing terms:",
    ],
    list: LEGAL_SUBPROCESSORS.map(
      (s) =>
        `${s.name} — ${s.purpose}. Location: ${s.location}. Safeguards: ${s.safeguards}.`,
    ),
  },
  {
    id: "transfers",
    title: "8. International transfers",
    paragraphs: [
      "We are built for users in Europe and aim to process data in the EU/EEA where possible. Some subprocessors (including AI and payment providers) may process data in the United States or other countries.",
      "Where required, we rely on appropriate safeguards such as the EU Standard Contractual Clauses and supplementary measures. You may request more information about transfers by contacting us.",
    ],
  },
  {
    id: "cookies",
    title: "9. Cookies and similar technologies",
    paragraphs: [
      "We use only strictly necessary cookies — no advertising or analytics cookies at this time:",
    ],
    list: LEGAL_COOKIES.map(
      (c) =>
        `${c.name} — ${c.purpose}. Duration: ${c.duration}. Category: ${c.category}.`,
    ),
  },
  {
    id: "retention",
    title: "10. How long we keep data",
    paragraphs: ["We keep personal data only as long as necessary:"],
    list: [
      "Account, reports, photos, and generated images — until you delete them or delete your account.",
      "Consent records — for as long as needed to demonstrate compliance, then archived or deleted.",
      "Payment records — as required by tax and accounting law (typically up to seven years).",
      "Server logs — for a limited period (generally up to 90 days) for security, then deleted or anonymised.",
    ],
  },
  {
    id: "rights",
    title: "11. Your rights",
    paragraphs: [
      "If you are in the EU/EEA (or another jurisdiction with similar rights), you may:",
    ],
    list: [
      "Access the personal data we hold about you.",
      "Rectify inaccurate data.",
      "Erase your data (“right to be forgotten”) — use Delete report or Delete account in the app, or email us.",
      "Restrict or object to certain processing.",
      "Data portability — download a structured copy from My reports → Export my data, or email us.",
      "Withdraw consent at any time for processing based on consent (without affecting prior lawful processing).",
      "Lodge a complaint with your local data-protection supervisory authority (e.g. your national DPA).",
    ],
  },
  {
    id: "security",
    title: "12. Security",
    paragraphs: [
      "We use encryption in transit, access controls, row-level security on user data, and private storage buckets for photos and generated assets. No method of transmission or storage is 100% secure; we work to apply reasonable technical and organisational measures appropriate to the sensitivity of your data.",
    ],
  },
  {
    id: "children",
    title: "13. Children",
    paragraphs: [
      `${LEGAL.siteName} is intended for adults. We do not knowingly collect data from anyone under 16. If you believe a child has provided us data, contact ${LEGAL.contactEmail} and we will delete it.`,
    ],
  },
  {
    id: "affiliate",
    title: "14. Affiliate links",
    paragraphs: [
      "Shopping recommendations may include affiliate deeplinks. Retailers may pay us a commission if you purchase. Links are disclosed in the product experience. Clicking a link is your choice; the retailer’s privacy policy applies to any purchase you make there.",
    ],
  },
  {
    id: "changes",
    title: "15. Changes to this policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. We will post the new version on this page and update the “Last updated” date. Material changes that affect biometric processing may require renewed consent.",
    ],
  },
  {
    id: "contact",
    title: "16. Contact",
    paragraphs: [
      `Questions about this policy or your data: ${LEGAL.contactEmail}.`,
      `Postal correspondence: ${addressBlock}.`,
    ],
  },
];

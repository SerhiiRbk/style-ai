import { BRAND } from "@/lib/brand";
import { LEGAL, type LegalSection } from "@/lib/legal";

export const PRIVACY_INTRO = `${LEGAL.siteName} ("we", "us") operates ${LEGAL.siteName.toLowerCase()}.app — an AI-assisted personal styling service. This Privacy Policy explains what personal data we collect, why we use it, who we share it with, and the rights you have under applicable law, including the EU General Data Protection Regulation (GDPR).`;

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "controller",
    title: "1. Who is responsible for your data?",
    paragraphs: [
      `The data controller for the ${LEGAL.siteName} service is ${LEGAL.operatorName} (the operator of the ${LEGAL.siteName} website and application).`,
      `For privacy enquiries, data-subject requests, or complaints, contact us at ${LEGAL.contactEmail}. We aim to respond within one month, as required by the GDPR.`,
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
      "Usage and technical data — IP address, browser type, device information, cookies strictly necessary for authentication, and server logs used for security and debugging.",
      "Payment data — when you buy credits, payment is processed by Stripe. We receive transaction references and purchase amounts; we do not store full card numbers.",
      "Communications — if you email us, we keep the correspondence needed to handle your request.",
    ],
  },
  {
    id: "why-we-use",
    title: "3. Why we use your data and our legal bases",
    paragraphs: [
      "Under the GDPR we rely on the following legal bases:",
    ],
    list: [
      "Contract (Art. 6(1)(b)) — to create and deliver your style report, manage credits, provide try-on and account features you request.",
      "Explicit consent (Art. 9(2)(a)) — for processing photographs and other biometric-related data used to personalise your report and generated images. You are asked to consent before photos are processed; you may withdraw consent by deleting your photos, reports, or account.",
      "Legitimate interests (Art. 6(1)(f)) — to keep the service secure, prevent abuse, improve quality, and understand aggregated usage, balanced against your rights.",
      "Legal obligation (Art. 6(1)(c)) — where we must retain records for tax, accounting, or regulatory purposes.",
    ],
  },
  {
    id: "ai",
    title: "4. AI-assisted processing",
    paragraphs: [
      `${LEGAL.siteName} uses automated analysis and generative AI models to build style profiles, written recommendations, and images. Outputs are presented through ${BRAND.stylist.name}, our lead stylist persona — a brand voice, not a live human consultant.`,
      "Your photos and questionnaire answers may be sent to AI infrastructure providers (see Section 6) solely to provide the service. We do not use your photos to train public foundation models on your behalf without your knowledge; processing is scoped to delivering your report and related features.",
      "AI outputs may be imperfect. Recommendations are informational and not professional, medical, or dermatological advice.",
    ],
  },
  {
    id: "sharing",
    title: "5. When we share data",
    paragraphs: [
      "We do not sell your personal data. We share data only with:",
    ],
    list: [
      "Infrastructure providers — hosting, database, authentication, and file storage (e.g. Supabase) under data-processing agreements.",
      "AI and image providers — to analyse photos and generate report content, under contractual confidentiality and security obligations.",
      "Stripe — to process credit purchases.",
      "Affiliate and catalogue partners — when you follow a shopping link, the retailer may receive standard referral parameters; we do not send your photos to retailers.",
      "Authorities — if required by law or to protect rights, safety, and security.",
    ],
  },
  {
    id: "transfers",
    title: "6. International transfers",
    paragraphs: [
      "We are built for users in Europe and aim to process data in the EU/EEA where possible. Some subprocessors (including AI and payment providers) may process data in the United States or other countries.",
      "Where required, we rely on appropriate safeguards such as the EU Standard Contractual Clauses and supplementary measures. You may request more information about transfers by contacting us.",
    ],
  },
  {
    id: "retention",
    title: "7. How long we keep data",
    paragraphs: [
      "We keep personal data only as long as necessary:",
    ],
    list: [
      "Account, reports, photos, and generated images — until you delete them or delete your account.",
      "Consent records — for as long as needed to demonstrate compliance, then archived or deleted.",
      "Payment records — as required by tax and accounting law (typically up to seven years).",
      "Server logs — for a limited period for security, then deleted or anonymised.",
    ],
  },
  {
    id: "rights",
    title: "8. Your rights",
    paragraphs: [
      "If you are in the EU/EEA (or another jurisdiction with similar rights), you may:",
    ],
    list: [
      "Access the personal data we hold about you.",
      "Rectify inaccurate data.",
      "Erase your data (“right to be forgotten”) — use Delete report or Delete account in the app, or email us.",
      "Restrict or object to certain processing.",
      "Data portability — receive a copy of data you provided in a structured format where technically feasible.",
      "Withdraw consent at any time for processing based on consent (without affecting prior lawful processing).",
      "Lodge a complaint with your local data-protection supervisory authority.",
    ],
  },
  {
    id: "security",
    title: "9. Security",
    paragraphs: [
      "We use encryption in transit, access controls, row-level security on user data, and private storage buckets for photos and generated assets. No method of transmission or storage is 100% secure; we work to apply reasonable technical and organisational measures appropriate to the sensitivity of your data.",
    ],
  },
  {
    id: "children",
    title: "10. Children",
    paragraphs: [
      `${LEGAL.siteName} is intended for adults. We do not knowingly collect data from anyone under 16. If you believe a child has provided us data, contact ${LEGAL.contactEmail} and we will delete it.`,
    ],
  },
  {
    id: "affiliate",
    title: "11. Affiliate links",
    paragraphs: [
      "Shopping recommendations may include affiliate deeplinks. Retailers may pay us a commission if you purchase. Links are disclosed in the product experience. Clicking a link is your choice; the retailer’s privacy policy applies to any purchase you make there.",
    ],
  },
  {
    id: "changes",
    title: "12. Changes to this policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. We will post the new version on this page and update the “Last updated” date. Material changes that affect biometric processing may require renewed consent.",
    ],
  },
  {
    id: "contact",
    title: "13. Contact",
    paragraphs: [
      `Questions about this policy or your data: ${LEGAL.contactEmail}.`,
      `Postal correspondence: if you need a physical address for regulatory correspondence, email us and we will provide the current registered contact details for ${LEGAL.operatorName}.`,
    ],
  },
];

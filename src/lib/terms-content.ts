import { BRAND } from "@/lib/brand";
import { LEGAL, controllerIdentity, type LegalSection } from "@/lib/legal";

const ctrl = controllerIdentity();

export const TERMS_INTRO = `These Terms of Service ("Terms") govern your access to and use of ${LEGAL.siteName} — the website, application, and related services operated by ${ctrl.legalName} ("we", "us"). By creating an account, purchasing credits, or using the service, you agree to these Terms and our Privacy Policy.`;

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "service",
    title: "1. The service",
    paragraphs: [
      `${LEGAL.siteName} provides AI-assisted personal styling: structured style reports, colour and grooming guidance, generated look images, shopping suggestions, and optional virtual try-on features.`,
      `Recommendations are delivered through ${BRAND.stylist.name}, our lead stylist persona — the brand's editorial voice. ${BRAND.stylist.name} is not a live human stylist employed to consult with you individually.`,
      "The service is for personal, non-commercial use unless we agree otherwise in writing (e.g. white-label arrangements).",
    ],
  },
  {
    id: "eligibility",
    title: "2. Eligibility and account",
    paragraphs: [
      "You must be at least 16 years old and able to form a binding contract in your jurisdiction. You are responsible for keeping your login credentials secure and for all activity under your account.",
      "You must provide accurate information and not impersonate others or create accounts by automated means without permission.",
    ],
  },
  {
    id: "credits",
    title: "3. Credits and pricing",
    paragraphs: [
      `${LEGAL.siteName} runs on credits, not a subscription. New accounts may receive promotional credits. Reports, try-ons, re-renders, and other features consume credits at the rates shown on the Pricing page at the time of use.`,
      "Credit packs are purchased in advance through Stripe. Prices may be shown in EUR, USD, or other supported currencies depending on your region. Taxes may apply where required by law.",
      "Credits do not expire while we operate the service, unless we announce a reasonable wind-down period with notice. Credits have no cash value, are non-transferable, and are not refundable except where required by mandatory consumer law.",
    ],
  },
  {
    id: "refunds",
    title: "4. Refunds and failed generations",
    paragraphs: [
      "Digital styling reports and generated images are delivered immediately or shortly after purchase of credits. Under EU consumer rules, statutory withdrawal rights may not apply once digital content delivery has begun with your prior express consent — you must confirm this at checkout before paying.",
      "If a report fails to generate due to a technical fault on our side, contact us at " +
        LEGAL.contactEmail +
        " — we will investigate and, where appropriate, restore credits or regenerate content.",
      "We do not guarantee that AI-generated images will match your expectations in every detail. Subjective dissatisfaction with style advice is not grounds for a refund unless otherwise required by law.",
    ],
  },
  {
    id: "your-content",
    title: "5. Your photos and inputs",
    paragraphs: [
      "You retain ownership of photographs and other content you upload. You grant us a limited licence to host, process, and display that content solely to provide the service for you — including sending it to subprocessors for analysis and image generation as described in our Privacy Policy.",
      "You confirm you have the right to upload the photos (they are of you, or you have permission) and that they do not infringe third-party rights or contain unlawful material.",
      "Processing of photos for personalisation requires your separate explicit consent on the photo-upload step, as described in our Privacy Policy.",
    ],
  },
  {
    id: "our-content",
    title: "6. Reports, images, and intellectual property",
    paragraphs: [
      `Style reports, generated images, text, and design elements produced by ${LEGAL.siteName} are protected by intellectual-property laws. Subject to these Terms, we grant you a personal, non-exclusive licence to use your own reports and downloads for private purposes.`,
      "You may not scrape, resell, or publicly redistribute the service, catalogue, or other users' content. Sharing a report via an optional share link is limited to tiers and features we make available in the product.",
      `${LEGAL.siteName}, the ${LEGAL.siteName} wordmark, and ${BRAND.stylist.name} persona elements are our brand assets. You may not use them without permission.`,
    ],
  },
  {
    id: "shopping",
    title: "7. Shopping links and affiliates",
    paragraphs: [
      "Product recommendations may link to third-party retailers via affiliate programmes. We may earn a commission on qualifying purchases. Availability, price, and quality of third-party goods are the retailer's responsibility.",
      "We do not guarantee stock, fit, or suitability of catalogue items. Always review retailer terms before buying.",
    ],
  },
  {
    id: "acceptable-use",
    title: "8. Acceptable use",
    paragraphs: ["You agree not to:"],
    list: [
      "Upload images of minors, non-consenting individuals, or explicit or illegal content.",
      "Attempt to bypass security, access other users' data, or abuse admin or API endpoints.",
      "Use the service to harass, discriminate, or generate misleading impersonations of real people.",
      "Reverse-engineer or overload the platform in a way that harms other users.",
    ],
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers",
    paragraphs: [
      "The service is provided for general style and appearance guidance only. It is not medical, dermatological, psychological, or professional fashion-industry advice.",
      "AI outputs may contain errors or outdated suggestions. You are responsible for decisions you make based on a report — including grooming, purchases, and how you present yourself professionally or socially.",
      'Except where mandatory law provides otherwise, the service is provided "as is" and "as available" without warranties of uninterrupted access or error-free operation.',
    ],
  },
  {
    id: "liability",
    title: "10. Limitation of liability",
    paragraphs: [
      "To the fullest extent permitted by applicable law, we are not liable for indirect, incidental, special, or consequential damages, or for loss of profits, data, or goodwill arising from your use of the service.",
      "Our total liability for any claim relating to the service is limited to the greater of (a) the amount you paid us for credits in the twelve months before the claim, or (b) EUR 50 — except where mandatory consumer protection law in your country does not allow such limitation.",
      "Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or other liability that cannot be excluded by law.",
    ],
  },
  {
    id: "termination",
    title: "11. Suspension and termination",
    paragraphs: [
      "You may delete individual reports or your entire account at any time from the app. We may suspend or terminate access if you breach these Terms, create risk for others, or where required by law.",
      "On termination, your right to use the service ends. Provisions that by nature should survive (intellectual property, disclaimers, liability limits, governing law) will continue to apply.",
    ],
  },
  {
    id: "changes",
    title: "12. Changes to the Terms",
    paragraphs: [
      "We may update these Terms. We will post the revised version on this page and update the date below. Continued use after changes take effect constitutes acceptance, except where further consent is required by law.",
    ],
  },
  {
    id: "law",
    title: "13. Governing law and disputes",
    paragraphs: [
      "These Terms are governed by the laws applicable to the operator of Valetti in the European Union, without regard to conflict-of-law rules.",
      "If you are a consumer in the EU/EEA, you benefit from mandatory protections of the laws of your country of residence. You may bring proceedings in your local courts where those rules allow.",
      "We encourage you to contact us first at " +
        LEGAL.contactEmail +
        " so we can try to resolve concerns informally.",
      `The European Commission provides an Online Dispute Resolution platform: ${LEGAL.odrUrl}. We are not obliged to participate in alternative dispute-resolution proceedings before a consumer-arbitration body, but we will consider doing so where appropriate.`,
    ],
  },
  {
    id: "contact",
    title: "14. Contact",
    paragraphs: [
      `Questions about these Terms: ${LEGAL.contactEmail}.`,
      `For privacy matters, see our Privacy Policy.`,
      `Registered operator: ${ctrl.legalName}. Address: ${ctrl.addressLines.join(", ")}.`,
    ],
  },
];

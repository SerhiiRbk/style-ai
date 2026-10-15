import { BRAND } from "@/lib/brand";

export const TRUST_TITLE = "How we treat your photos";

export const TRUST_INTRO =
  "Valetti reads a photo to recommend colours and clothes. We do not train models on your face, and you can delete every photo in one click.";

export const TRUST_SECTIONS: {
  id: string;
  title: string;
  body: string;
}[] = [
  {
    id: "what-we-do",
    title: "What we do with a photo",
    body: "A portrait and a full-length shot let us measure colouring, proportions and fit, then generate looks on you. Photos stay on your account so you can retry a look or delete them.",
  },
  {
    id: "what-we-dont",
    title: "What we do not do",
    body: "We do not sell photos. We do not use them to train public foundation models. We do not put your face in a gallery. A shared report shows looks you chose to publish — never your private uploads.",
  },
  {
    id: "gdpr",
    title: "Consent under GDPR Article 9",
    body: "A photo can reveal biometric characteristics. We only process it after you tick a separate consent box. Legal basis: GDPR Article 9 — explicit consent (Art. 9(2)(a)). Withdraw by deleting the photos, the report, or the account.",
  },
  {
    id: "delete",
    title: "Delete in one click",
    body: "Signed-in users can remove any reference photo from Account → Photos. That deletes the file and the database row. Deleting the account erases reports, generated images and the credit ledger.",
  },
];

export const TRUST_DELETE_HREF = "/account#photos";
export const TRUST_PRIVACY_HREF = "/privacy";
export const TRUST_CONTACT = BRAND.contactEmail;

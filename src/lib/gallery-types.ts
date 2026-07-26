import type { Tier } from "@/lib/report";
import type { TryOnOpinion } from "@/lib/ai/tryon-opinion";

export type GalleryItemKind =
  | "cover"
  | "look"
  | "capsule"
  | "hair"
  | "grooming"
  | "eyewear"
  | "accessories"
  | "headwear"
  | "tryon";

/** A catalogue piece used in a try-on, as captured on the tryon row. */
export type GalleryTryonGarment = {
  title: string;
  category: string;
  /** Retailer product image (external URL). */
  imageUrl?: string | null;
  /** Affiliate / retailer link, resolved from the catalogue when still present. */
  deeplink?: string | null;
};

export type GalleryItem = {
  /** Stable key `${reportId}:${kind}:${index}`. */
  id: string;
  kind: GalleryItemKind;
  /** Signed `/api/assets/...` proxy URL. */
  src: string;
  /** Short caption for alt text / hover. */
  label: string;
  /** Set for catalogue try-ons — enables user-initiated deletion. */
  tryonId?: string;
  /** Carlo's saved verdict for this try-on, when one was generated. */
  opinion?: TryOnOpinion | null;
  /** Catalogue pieces used in this try-on (from the tryon's garments jsonb). */
  garments?: GalleryTryonGarment[];
};

export type GalleryReportGroup = {
  id: string;
  headline: string | null;
  /** Report tier badge; null for non-report groups (e.g. catalogue try-ons). */
  tier: Tier | null;
  createdAt: string;
  /** True when the report is publicly shared on a shareable tier (per-look share links work). */
  canShare: boolean;
  /** Where the group's header link points. */
  href: string;
  /** Header link label (e.g. "Open report" / "Open catalog"). */
  linkLabel: string;
  items: GalleryItem[];
};

export const GALLERY_KIND_LABEL: Record<GalleryItemKind, string> = {
  cover: "Cover",
  look: "Look",
  capsule: "Capsule",
  hair: "Hair",
  grooming: "Grooming",
  eyewear: "Eyewear",
  accessories: "Accessories",
  headwear: "Headwear",
  tryon: "Try-on",
};

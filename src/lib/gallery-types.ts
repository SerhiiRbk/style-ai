import type { Tier } from "@/lib/report";

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

export type GalleryItem = {
  /** Stable key `${reportId}:${kind}:${index}`. */
  id: string;
  kind: GalleryItemKind;
  /** Signed `/api/assets/...` proxy URL. */
  src: string;
  /** Short caption for alt text / hover. */
  label: string;
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

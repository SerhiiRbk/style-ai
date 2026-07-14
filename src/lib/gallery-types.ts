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
  tier: Tier;
  createdAt: string;
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

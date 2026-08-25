import "server-only";
import { createHash } from "crypto";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import type { StyleProfile } from "@/lib/style-profile";

/** Bump when complete-look fill / clash logic should invalidate stored results. */
export const COMPLETE_LOOK_CACHE_VERSION = "3";

export function completeLookProfileKey(profile: StyleProfile): string {
  return [
    profile.colorSeason ?? "",
    profile.colorSubseason ?? "",
    profile.boldness ?? "",
    String(profile.budgetEur?.max ?? ""),
    profile.demographics?.genderPresentation ?? "",
    profile.demographics?.country ?? "",
    profile.currency ?? "",
  ].join("|");
}

export function completeLookCacheHash(
  productIds: string[],
  occasionId: string,
  profileKey: string,
): string {
  const ids = [...productIds].sort().join(",");
  return createHash("sha256")
    .update(`${ids}|${occasionId}|${profileKey}`)
    .digest("hex")
    .slice(0, 32);
}

export function completeLookCachePath(
  userId: string,
  hash: string,
  kind: "match" | "estimate",
): string {
  const suffix = kind === "estimate" ? "-estimate" : "";
  return `${userId}/complete-look/${COMPLETE_LOOK_CACHE_VERSION}/${hash}${suffix}.json`;
}

export async function readCompleteLookCache<T>(path: string): Promise<T | null> {
  if (!hasSupabaseAdmin) return null;
  const admin = createAdminSupabase();
  const { data: blob } = await admin.storage.from("assets").download(path);
  if (!blob) return null;
  try {
    return JSON.parse(await blob.text()) as T;
  } catch {
    return null;
  }
}

export async function writeCompleteLookCache(
  path: string,
  value: unknown,
): Promise<void> {
  if (!hasSupabaseAdmin) return;
  const admin = createAdminSupabase();
  const { error } = await admin.storage
    .from("assets")
    .upload(path, JSON.stringify(value), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) {
    console.error("[complete-look] cache write failed", path, error.message);
  }
}

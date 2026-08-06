/**
 * Photo-gate kill-switches (plan 2026-08-05). Pure parsing, no I/O — safe to
 * import from both server and client.
 *
 * Semantics: **default-on**. A flag is only off when explicitly set to
 * `false` / `0` / `no`. Unset or empty = on. The master `PHOTO_GATE_ENABLED`
 * disables every gate. Per the canary rollout in the plan, ship prod with the
 * master set to `false` and flip it on once the preview `photo_gate_failopen`
 * rate is acceptable.
 */

export function flagDefaultTrue(raw: string | undefined): boolean {
  if (raw == null || raw === "") return true;
  const v = raw.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

export type PhotoGateFlags = {
  master: boolean;
  colours: boolean;
  shopALook: boolean;
  reportPhotos: boolean;
  tryon: boolean;
};

export type PhotoGateKey = keyof Omit<PhotoGateFlags, "master">;

export function resolvePhotoGateFlags(
  envLike: Record<string, string | undefined>,
): PhotoGateFlags {
  // Client colours gate: prefer NEXT_PUBLIC_*; fall back to the server-named twin.
  const coloursRaw =
    envLike.NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED ??
    envLike.PHOTO_GATE_COLOURS_ENABLED;
  const masterRaw =
    envLike.PHOTO_GATE_ENABLED ?? envLike.NEXT_PUBLIC_PHOTO_GATE_ENABLED;
  return {
    master: flagDefaultTrue(masterRaw),
    colours: flagDefaultTrue(coloursRaw),
    shopALook: flagDefaultTrue(envLike.PHOTO_GATE_SHOP_A_LOOK_ENABLED),
    reportPhotos: flagDefaultTrue(envLike.PHOTO_GATE_REPORT_PHOTOS_ENABLED),
    tryon: flagDefaultTrue(envLike.PHOTO_GATE_TRYON_ENABLED),
  };
}

export function isPhotoGateActive(
  flags: PhotoGateFlags,
  key: PhotoGateKey,
): boolean {
  return flags.master && flags[key];
}

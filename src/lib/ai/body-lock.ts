import { isBodyType, type BodyTypeId } from "@/lib/style-profile";

const SHAPE: Record<
  BodyTypeId,
  { label: string; keep: string; avoid: string }
> = {
  rectangle: {
    label: "rectangle (straight)",
    keep: "shoulders and hips the same width, a soft almost-straight waist, an even torso",
    avoid:
      "do not invent a V-taper, broad lats, a cinched waist, or an athletic trapezoid / inverted-triangle physique",
  },
  trapezoid: {
    label: "athletic trapezoid",
    keep: "moderately broader shoulders than hips and a natural athletic waist",
    avoid: "do not slim to a fashion-sample V or add a bodybuilder chest",
  },
  triangle: {
    label: "triangle (hips wider than shoulders)",
    keep: "hips clearly wider than the shoulders and a softer lower torso",
    avoid: "do not widen the shoulders into a V-taper or hide the hip width",
  },
  "inverted-triangle": {
    label: "inverted triangle",
    keep: "shoulders clearly wider than the hips",
    avoid: "do not slim the shoulders or widen the hips into a rectangle",
  },
  hourglass: {
    label: "hourglass",
    keep: "shoulders and hips similar in width with a defined waist",
    avoid: "do not flatten the waist into a rectangle or add a masculine V-taper",
  },
  oval: {
    label: "oval",
    keep: "a fuller midsection, a softer waist, no sharp V",
    avoid: "do not cinch the waist or render an athletic tapered torso",
  },
};

/** Short clause for the subject line — named shape before the model sees clothes. */
export function bodyTypeSubjectClause(bodyType?: string | null): string {
  if (!isBodyType(bodyType)) {
    return bodyType ? `${bodyType} build. ` : "";
  }
  if (bodyType === "rectangle") {
    return `rectangle (straight) build — shoulders and hips the same width, not an athletic V-taper. `;
  }
  if (bodyType === "trapezoid") {
    return `athletic trapezoid build — moderate shoulder width, not a fashion-sample V. `;
  }
  return `${SHAPE[bodyType].label} build. `;
}

/**
 * Lock body proportions to the client's type and full-length photo.
 * Catalogue lifestyle shots are usually athletic models — without this the
 * renderer copies their V-taper onto a rectangle client.
 */
export function bodyTypeLock(
  bodyType?: string | null,
  physical?: { heightCm?: number | null; weightKg?: number | null },
): string {
  const shape = isBodyType(bodyType) ? SHAPE[bodyType] : null;
  const named = shape
    ? `This is a ${shape.label} build — keep ${shape.keep}. ${shape.avoid}. `
    : bodyType
      ? `Keep this person's ${bodyType} build. `
      : "";
  const size =
    physical?.heightCm && physical?.weightKg
      ? `The client is about ${physical.heightCm}cm and ${physical.weightKg}kg — render that real frame, not a gym-built or fashion-sample body. `
      : physical?.heightCm
        ? `The client is about ${physical.heightCm}cm tall — keep that stature; do not lengthen the legs into a runway proportion. `
        : "";
  return (
    named +
    size +
    `Keep the SAME body proportions as the full-length reference photo: the same ` +
    `shoulder width, waist, hip width, torso length, arm and leg thickness, and posture. ` +
    `Do not idealise, athleticise, or slim the body. ` +
    `Catalogue and outfit photos are clothing only — never copy the model's physique, ` +
    `shoulder-to-hip ratio, or muscle from a product shot. `
  );
}

/**
 * When the face portrait is not the last attached image (a full-length shot,
 * profile, outfit or catalogue swatches follow it), re-attach the same close-up
 * as the final visual token so the model does not lock identity to a tiny head
 * in a 9:16 frame.
 */
export function shouldReattachFacePortrait(
  hasFace: boolean,
  imagesAfterFace: number,
): boolean {
  return Boolean(hasFace && imagesAfterFace > 0);
}

export function faceReattachRole(ordinal: string): string {
  return (
    `The ${ordinal} image is the SAME close-up front portrait again — ` +
    `after the other references, lock the face, bone structure, skin tone, hairline ` +
    `and hairstyle to this photo. This is the person, not a fashion model. `
  );
}

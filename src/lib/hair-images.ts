/** Static hairstyle reference photos (live AI output has names only). */
const HAIR = {
  texturedCrop: "/images/hair/textured-crop.png",
  taperedSides: "/images/hair/tapered-sides.png",
  heavyFringe: "/images/hair/heavy-fringe.png",
} as const;

const RULES: { test: RegExp; src: string }[] = [
  {
    test: /\b(fringe|bangs|bowl|mushroom|helmet|flop|curtain|mullet|shag)\b/i,
    src: HAIR.heavyFringe,
  },
  {
    test: /\b(taper|fade|undercut|buzz|crew\s*cut|high\s*&?\s*tight|side\s*part|pompadour|slick)\b/i,
    src: HAIR.taperedSides,
  },
  {
    test: /\b(textur|crop|quiff|brush\s*up|messy|choppy|layer|caesar)\b/i,
    src: HAIR.texturedCrop,
  },
];

/** Map an AI or mock hairstyle label to the closest static reference image. */
export function resolveHairImage(name: string): string {
  const n = name.toLowerCase();
  for (const { test, src } of RULES) {
    if (test.test(n)) return src;
  }
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h + n.charCodeAt(i)) % 3;
  return [HAIR.texturedCrop, HAIR.taperedSides, HAIR.heavyFringe][h]!;
}

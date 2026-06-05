#!/usr/bin/env node
/**
 * Generate missing premium demo report assets and save to public/images/demo/.
 * Uses the same image model as live reports (AI_MODEL_IMAGE).
 *
 *   node --env-file=.env.local scripts/gen-demo-premium.mjs
 *   node --env-file=.env.local scripts/gen-demo-premium.mjs --force
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { generateText } from "ai";

const modelImage =
  process.env.AI_MODEL_IMAGE ?? "google/gemini-3.1-flash-image-preview";

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("Missing AI_GATEWAY_API_KEY");
  process.exit(1);
}

const force = process.argv.includes("--force");
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public/images/demo");
const referencePath = join(root, "public/images/hero-editorial.png");
const referenceImage = readFileSync(referencePath);

const profile = {
  demographics: {
    genderPresentation: "male",
    age: 42,
  },
  physical: {
    bodyType: "athletic",
    faceShape: "oval",
  },
};

const HAIR_AVOID = [
  {
    slug: "buzz-cut-avoid",
    name: "Buzz cut (too short)",
    why: "Strips away length and texture — reads harsh on an oval face and ages the overall look.",
  },
];

const HAIR_RECOMMEND = [
  {
    slug: "textured-crop",
    name: "Textured crop",
    why: "Adds structure that balances an oval face and reads contemporary.",
  },
  {
    slug: "tapered-sides",
    name: "Short tapered sides",
    why: "Clean, low-maintenance, and quietly sharpens the jawline.",
  },
  {
    slug: "side-part",
    name: "Side part with texture",
    why: "Classic proportion for an oval face — polished without feeling stiff.",
  },
  {
    slug: "soft-layered",
    name: "Soft layered medium",
    why: "Adds movement and depth when you want a slightly longer, relaxed look.",
  },
];

const FACIAL_HAIR = [
  {
    slug: "short-even-beard",
    name: "Short even beard",
    why: "A tidy, even line suits an oval face — natural cheek line, clean neckline.",
  },
  {
    slug: "refined-stubble",
    name: "Refined stubble",
    why: "Low-maintenance texture that reads modern without overpowering your features.",
  },
  {
    slug: "classic-full-beard",
    name: "Classic full beard",
    why: "Even growth with a defined neckline — versatile on an oval face.",
  },
  {
    slug: "van-dyke",
    name: "Van Dyke",
    why: "A neat mustache paired with a small chin patch adds character without bulk.",
  },
];

const EYEWEAR = [
  {
    slug: "wayfarer-optical",
    name: "Wayfarer",
    shape: "wayfarer",
    kind: "optical",
    why: "Classic balance for an oval face — versatile and modern.",
  },
  {
    slug: "rectangle-optical",
    name: "Rectangular",
    shape: "rectangle",
    kind: "optical",
    why: "Keeps proportions in check without elongating.",
  },
  {
    slug: "wayfarer-sun",
    name: "Wayfarer sunglasses",
    shape: "wayfarer",
    kind: "sun",
    why: "Classic balance for an oval face in sun.",
  },
  {
    slug: "aviator-sun",
    name: "Aviator sunglasses",
    shape: "aviator",
    kind: "sun",
    why: "Relaxed edge while keeping proportions balanced outdoors.",
  },
];

const SIXTH_LOOK = {
  slug: "look-evening",
  title: "Relaxed polish",
  description:
    "Rust merino polo, charcoal wool trousers, brown leather loafers, brass watch.",
  palette: ["#9E5C3C", "#3A3A3A", "#5A3D2B", "#B08A5B"],
};

const DELAY_MS = 500;

mkdirSync(outDir, { recursive: true });

async function saveImage(result, outPath) {
  const file = result.files.find((f) => f.mediaType.startsWith("image/"));
  if (!file) return false;
  writeFileSync(outPath, Buffer.from(file.uint8Array));
  return true;
}

async function generateLookImage({ look }) {
  const subject =
    `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
    `${profile.physical.bodyType} build. Soft natural light, neutral studio backdrop, ` +
    `confident relaxed pose, sharp focus, magazine quality. ` +
    `Vertical 9:16 framing, full body head to shoes visible. `;

  const prompt =
    `Editorial, full-length fashion photograph for a premium style report. ` +
    `Outfit: ${look.description}. ` +
    `Colour palette: ${look.palette.join(", ")}. ` +
    subject +
    `Preserve the face and identity of the person in the provided photo. `;

  return generateText({
    model: modelImage,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: referenceImage, mediaType: "image/png" },
        ],
      },
    ],
  });
}

async function generateHairAvoidImage({ hair, angle = "front" }) {
  const angleNote =
    angle === "front"
      ? "Face the camera directly, front-facing headshot."
      : "Head turned roughly 45° (three-quarter view), showing the hairstyle from the side while keeping most of the face visible.";

  const prompt =
    `Editorial beauty headshot for a premium grooming report. ` +
    `Hairstyle: ${hair.name}. Show this hairstyle as an example to avoid: ${hair.name}. ${hair.why} ` +
    `Camera angle: ${angleNote} ` +
    `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
    `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
    `natural soft light, sharp focus on hair and face, magazine quality, tasteful and respectful. ` +
    `Preserve the face, skin tone, and identity of the person in the provided photo — only change the hairstyle.`;

  return generateText({
    model: modelImage,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: referenceImage, mediaType: "image/png" },
        ],
      },
    ],
  });
}

async function generateHairImage({ hair, angle = "three_quarter" }) {
  const angleNote =
    angle === "front"
      ? "Face the camera directly, front-facing headshot."
      : "Head turned roughly 45° (three-quarter view), showing the hairstyle from the side while keeping most of the face visible.";

  const prompt =
    `Editorial beauty headshot for a premium grooming report. ` +
    `Hairstyle: ${hair.name}. Show this hairstyle as a flattering recommendation: ${hair.name}. ${hair.why} ` +
    `Camera angle: ${angleNote} ` +
    `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
    `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
    `natural soft light, sharp focus on hair and face, magazine quality, tasteful and respectful. ` +
    `Preserve the face, skin tone, and identity of the person in the provided photo — only change the hairstyle.`;

  return generateText({
    model: modelImage,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: referenceImage, mediaType: "image/png" },
        ],
      },
    ],
  });
}

async function generateFacialHairImage({ style }) {
  const prompt =
    `Editorial grooming headshot for a premium style report. ` +
    `Facial hair style: ${style.name}. ${style.why} ` +
    `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
    `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
    `natural soft light, sharp focus on face and facial hair, magazine quality, tasteful and respectful. ` +
    `Preserve the face, skin tone, and identity of the person in the provided photo — only change the facial hair style.`;

  return generateText({
    model: modelImage,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: referenceImage, mediaType: "image/png" },
        ],
      },
    ],
  });
}

async function generateEyewearImage({ frame }) {
  const isSun = frame.kind === "sun";
  const eyewearType = isSun
    ? "Fashion sunglasses with tinted lenses"
    : "Optical eyeglasses with clear lenses";
  const prompt =
    `Editorial eyewear headshot for a premium style report. ` +
    `${eyewearType}: ${frame.name}${frame.shape ? ` (${frame.shape} shape)` : ""}. ${frame.why} ` +
    `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
    `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
    `natural soft light, sharp focus on face and ${isSun ? "sunglasses" : "glasses"}, magazine quality, tasteful and respectful. ` +
    `Preserve the face, skin tone, and identity of the person in the provided photo — only add or change the eyewear.`;

  return generateText({
    model: modelImage,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: referenceImage, mediaType: "image/png" },
        ],
      },
    ],
  });
}

async function runJob(label, outPath, fn) {
  if (!force && existsSync(outPath)) {
    console.log(`  skip ${label} — exists`);
    return true;
  }
  console.log(`  generating ${label}…`);
  try {
    const result = await fn();
    const ok = await saveImage(result, outPath);
    if (ok) {
      console.log(`  ✓ ${outPath.replace(root, "")}`);
      return true;
    }
    console.warn(`  ✗ ${label} — no image in response`);
    return false;
  } catch (err) {
    console.error(`  ✗ ${label}:`, err?.message ?? err);
    return false;
  } finally {
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}

async function main() {
  console.log(`Model: ${modelImage}`);
  console.log(`Reference: ${referencePath}`);
  console.log(`Output: ${outDir}\n`);

  let ok = 0;
  let fail = 0;

  console.log("6th premium look");
  if (
    await runJob(
      SIXTH_LOOK.slug,
      join(outDir, `${SIXTH_LOOK.slug}.png`),
      () => generateLookImage({ look: SIXTH_LOOK }),
    )
  ) {
    ok++;
  } else {
    fail++;
  }

  console.log("\nHair avoid (1)");
  for (const hair of HAIR_AVOID) {
    const outPath = join(outDir, `hair-${hair.slug}.png`);
    if (await runJob(hair.slug, outPath, () => generateHairAvoidImage({ hair })))
      ok++;
    else fail++;
  }

  console.log("\nHair side angles (4)");
  for (const hair of HAIR_RECOMMEND) {
    const outPath = join(outDir, `hair-${hair.slug}-side.png`);
    if (await runJob(hair.slug, outPath, () => generateHairImage({ hair }))) ok++;
    else fail++;
  }

  console.log("\nFacial hair (4)");
  for (const style of FACIAL_HAIR) {
    const outPath = join(outDir, `facial-hair-${style.slug}.png`);
    if (await runJob(style.slug, outPath, () => generateFacialHairImage({ style })))
      ok++;
    else fail++;
  }

  console.log("\nEyewear (4)");
  for (const frame of EYEWEAR) {
    const outPath = join(outDir, `eyewear-${frame.slug}.png`);
    if (await runJob(frame.slug, outPath, () => generateEyewearImage({ frame })))
      ok++;
    else fail++;
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

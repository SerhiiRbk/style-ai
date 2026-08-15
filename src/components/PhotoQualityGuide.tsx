import Image from "next/image";

/**
 * Do's / don'ts photo guidance — the same guide shown in the Style Report
 * wizard's photo step, so Create a Look gives identical guidance. Static
 * presentational component (example images live in /public/images).
 */
export function PhotoQualityGuide() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PhotoExampleCard
        tone="good"
        title="Best result"
        imageSrc="/images/photo-example-good.png"
        imageAlt="Good portrait example — natural daylight, clear face and hair"
        items={[
          "Natural daylight, face turned to a window",
          "Clear view of face, hair and shoulders",
          "Full-length photo taken from chest height",
        ]}
      />
      <PhotoExampleCard
        tone="avoid"
        title="Hard to analyse"
        imageSrc="/images/photo-example-bad.png"
        imageAlt="Poor portrait example — sunglasses, hat, harsh flash, busy background"
        items={[
          "Sunglasses, hat, heavy filter or strong shadow",
          "Group photo, busy background or cropped body",
          "Low angle, dark room or mirror flash over the face",
        ]}
      />
    </div>
  );
}

function PhotoExampleCard({
  tone,
  title,
  imageSrc,
  imageAlt,
  items,
}: {
  tone: "good" | "avoid";
  title: string;
  imageSrc: string;
  imageAlt: string;
  items: string[];
}) {
  const good = tone === "good";
  return (
    <div
      className={`rounded-2xl border p-4 ${
        good ? "border-brass/30 bg-brass/5" : "border-line bg-paper"
      }`}
    >
      <div className="grid gap-4 sm:grid-cols-[108px_1fr] sm:items-start">
        <div
          className={`relative mx-auto aspect-[3/4] w-[108px] overflow-hidden rounded-xl border ${
            good ? "border-brass/30" : "border-line"
          }`}
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes="108px"
            className="object-cover object-top"
          />
          <span
            className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-sm ${
              good ? "bg-brass text-paper" : "bg-stone-soft text-paper"
            }`}
          >
            {good ? "✓" : "×"}
          </span>
        </div>
        <div>
          <div className="font-display text-lg text-ink">{title}</div>
          <ul
            className={`mt-2 space-y-1.5 text-xs leading-relaxed ${
              good ? "text-stone" : "text-stone-soft"
            }`}
          >
            {items.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

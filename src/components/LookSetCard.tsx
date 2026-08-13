"use client";

import { useState } from "react";
import { ReportZoomImage } from "@/components/ReportZoomImage";
import { LookShopAndTryOn } from "@/components/LookShopAndTryOn";
import { LookConstructor } from "@/components/LookConstructor";
import { ReportImageGenerating } from "@/components/luxe/ReportImageGenerating";
import type { ShoppingItem } from "@/lib/report";
import type { Currency } from "@/lib/currency";

/**
 * One look in a set: image, constructor (owner), shop + try-on. Keeps local
 * image/description/items in sync after an Apply so the card doesn't wait on
 * a full page refresh — and so a stale try-on for the previous outfit is cleared.
 */
export function LookSetCard({
  setId,
  lookIndex,
  title: initialTitle,
  description: initialDescription,
  palette: initialPalette,
  imageSrc: initialImage,
  items: initialItems,
  isOwner,
  currency = "EUR",
}: {
  setId: string;
  lookIndex: number;
  title: string;
  description: string;
  palette: string[];
  imageSrc: string;
  items: ShoppingItem[];
  isOwner: boolean;
  currency?: Currency;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [palette, setPalette] = useState(initialPalette);
  const [imageSrc, setImageSrc] = useState(initialImage);
  const [items, setItems] = useState(initialItems);
  const [applying, setApplying] = useState(false);
  const [tryOnReset, setTryOnReset] = useState<string | undefined>();

  return (
    <article className="flex flex-col">
      {applying ? (
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border hairline bg-cream/40">
          <ReportImageGenerating
            label={title || "Redrawing look"}
            detail="Applying the new pieces to this look"
          />
        </div>
      ) : (
        <ReportZoomImage
          src={imageSrc}
          alt={title || "Look"}
          wrapperClassName="relative block aspect-[9/16] w-full overflow-hidden rounded-2xl border hairline"
          className="h-full w-full object-cover"
        />
      )}
      {title ? (
        <h2 className="mt-3 font-display text-lg text-ink">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-1 text-sm text-stone">{description}</p>
      ) : null}
      {palette.length ? (
        <div className="mt-3 flex gap-1.5">
          {palette.map((hex, k) => (
            <span
              key={`${hex}-${k}`}
              title={hex}
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      ) : null}
      {isOwner ? (
        <LookConstructor
          key={description}
          setId={setId}
          lookIndex={lookIndex}
          title={title}
          description={description}
          disabled={applying}
          onApplyingChange={setApplying}
          onApplied={(look) => {
            setTitle(look.title);
            setDescription(look.description);
            setPalette(look.palette);
            setImageSrc(look.image);
            setItems(look.items);
            setTryOnReset(look.image);
          }}
        />
      ) : null}
      <LookShopAndTryOn
        key={`${lookIndex}-${description}`}
        items={items}
        currency={currency}
        canTryOn={isOwner}
        setId={isOwner ? setId : undefined}
        title={title}
        description={description}
        palette={palette}
        lookIndex={lookIndex}
        resetStoredTryOn={Boolean(tryOnReset)}
      />
    </article>
  );
}

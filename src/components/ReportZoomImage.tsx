"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  priority?: boolean;
  /** Extra classes on the clickable wrapper (e.g. aspect box). */
  wrapperClassName?: string;
};

/** Click-to-zoom overlay for report photos (looks, hair, moodboard, header). */
export function ReportZoomImage({
  src,
  alt,
  className = "object-cover",
  sizes,
  fill,
  priority,
  wrapperClassName = "relative block h-full w-full",
}: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const isRemote = src.startsWith("http");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${wrapperClassName} cursor-zoom-in text-left`}
        aria-label={`View full size: ${alt}`}
      >
        {fill ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            className={className}
            priority={priority}
            unoptimized={isRemote}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className={className} />
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/92 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={close}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-paper/30 px-3 py-1.5 text-sm text-paper"
            onClick={close}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

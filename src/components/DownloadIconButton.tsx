"use client";

/**
 * Premium glassy download icon button with a hover tooltip. Used on image
 * previews (gallery, catalogue try-on) to download the original full-res file.
 */
export function DownloadIconButton({
  href,
  label = "Download full resolution",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <span className={`group/tip relative inline-flex ${className ?? ""}`}>
      <a
        href={href}
        download
        onClick={(e) => e.stopPropagation()}
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/35 text-paper shadow-sm ring-1 ring-paper/25 backdrop-blur-md transition-colors hover:bg-ink/60"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M12 3v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </a>
      <span className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100">
        {label}
      </span>
    </span>
  );
}

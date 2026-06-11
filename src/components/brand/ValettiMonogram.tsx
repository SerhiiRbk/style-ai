/**
 * Serif “V” monogram — lapel fold at the inner vertex. Use `filled` on favicons
 * (ink tile + paper letter); default is ink on transparent for the navbar.
 */
export function ValettiMonogram({
  size = 28,
  filled = false,
  className,
}: {
  size?: number;
  /** Ink background + paper V — favicon / app icon. */
  filled?: boolean;
  className?: string;
}) {
  const letter = (
    <path
      d="M8.25 7.75 11.1 7.75 16.05 22.85 21 7.75 23.85 7.75 16.95 27.35 15.15 27.35 8.25 7.75Zm7.8-1.35-1.85 4.55h-1.6l-1.85-4.55h5.3Z"
      fill={filled ? "#faf6ee" : "currentColor"}
    />
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {filled && <rect width="32" height="32" rx="7" fill="#15120d" />}
      {letter}
    </svg>
  );
}

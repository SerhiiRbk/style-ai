const sizes = {
  xs: "h-3 w-3 border",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-9 w-9 border-2",
} as const;

export function LuxeSpinner({
  size = "sm",
  className = "",
  tone = "ink",
}: {
  size?: keyof typeof sizes;
  className?: string;
  tone?: "ink" | "brass" | "paper";
}) {
  const toneClass =
    tone === "brass"
      ? "border-brass/20 border-t-brass"
      : tone === "paper"
        ? "border-paper/25 border-t-paper"
        : "border-ink/15 border-t-ink";

  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-luxe-spin rounded-full ${sizes[size]} ${toneClass} ${className}`}
    />
  );
}

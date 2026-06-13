import { LuxeSpinner } from "./LuxeSpinner";

/** Inline status for buttons and compact async actions. */
export function LuxeWorkingLabel({
  message,
  tone = "ink",
}: {
  message: string;
  tone?: "ink" | "brass" | "paper";
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LuxeSpinner size="xs" tone={tone} />
      <span>{message}</span>
    </span>
  );
}

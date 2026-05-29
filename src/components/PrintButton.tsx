"use client";

export function PrintButton({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => window.print()}
      className={className}
      type="button"
    >
      {children}
    </button>
  );
}

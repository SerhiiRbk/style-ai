import { LuxePageLoader } from "@/components/luxe/LuxePageLoader";

export default function Loading() {
  return (
    <LuxePageLoader
      eyebrow="Your report"
      message="Opening your style report…"
      hint="Loading colours, looks, and your shopping list."
    />
  );
}

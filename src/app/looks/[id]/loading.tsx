import { LuxePageLoader } from "@/components/luxe/LuxePageLoader";

export default function Loading() {
  return (
    <LuxePageLoader
      eyebrow="Looks"
      message="Opening your look…"
      hint="Loading the looks, colours, and shopping list."
    />
  );
}

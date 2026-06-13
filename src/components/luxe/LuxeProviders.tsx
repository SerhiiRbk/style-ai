import { Suspense } from "react";
import { NavigationProgress } from "@/components/luxe/NavigationProgress";

export function LuxeProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {children}
    </>
  );
}

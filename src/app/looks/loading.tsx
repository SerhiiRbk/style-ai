import { Navbar } from "@/components/Navbar";
import { LuxePageLoader } from "@/components/luxe/LuxePageLoader";

export default function Loading() {
  return (
    <>
      <Navbar />
      <LuxePageLoader
        eyebrow="Looks"
        message="Gathering your looks…"
      />
    </>
  );
}

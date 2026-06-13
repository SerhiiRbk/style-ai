import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LuxePageLoader } from "@/components/luxe/LuxePageLoader";

export default function Loading() {
  return (
    <>
      <Navbar />
      <LuxePageLoader
        eyebrow="Catalog"
        message="Curating the collection…"
      />
      <Footer />
    </>
  );
}

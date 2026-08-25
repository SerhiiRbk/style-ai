import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CatalogTryOnShell } from "@/components/CatalogTryOnShell";
import { CREDIT_COSTS } from "@/lib/credit-costs";

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <CatalogTryOnShell tryOnCost={CREDIT_COSTS.tryon}>
          {children}
        </CatalogTryOnShell>
      </main>
      <Footer />
    </>
  );
}

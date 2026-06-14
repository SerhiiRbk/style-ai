import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  TestMainHero,
  TestMainProofStats,
  TestMainTrustBar,
} from "@/components/testmain/TestMainHero";
import { MethodologySection } from "@/components/testmain/MethodologySection";
import { ReportProofSection } from "@/components/testmain/ReportProofSection";
import { MeetStylistCredibility } from "@/components/testmain/MeetStylistCredibility";
import { WhyThisWorksSection } from "@/components/testmain/WhyThisWorksSection";
import { ImpactOfColourSection } from "@/components/testmain/ImpactOfColourSection";
import { TrustPipelineSection } from "@/components/testmain/TrustPipelineSection";
import { TestMainSampleReport } from "@/components/testmain/TestMainSampleReport";
import {
  TestMainFaq,
  TestMainFinalCta,
  TestMainHowItWorks,
  TestMainProblem,
} from "@/components/testmain/TestMainSections";

export const metadata: Metadata = {
  title: "Test landing — credibility concept · Valetti",
  description:
    "Internal test page for social proof, methodology, and Carlo credibility — not indexed.",
  robots: { index: false, follow: false },
};

export default function TestMainPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <TestMainHero />
        <TestMainTrustBar />
        <TestMainProofStats />
        <TestMainProblem />
        <MethodologySection />
        <ReportProofSection />
        <MeetStylistCredibility />
        <WhyThisWorksSection />
        <ImpactOfColourSection />
        <TrustPipelineSection />
        <TestMainHowItWorks />
        <TestMainSampleReport />
        <TestMainFaq />
        <TestMainFinalCta />
      </main>
      <Footer />
    </>
  );
}

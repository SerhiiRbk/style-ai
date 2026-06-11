import { redirect } from "next/navigation";
import { demoReportPath } from "@/lib/demo-report";

/** Legacy `/report/demo` URL → canonical prospect demo slug. */
export default function LegacyDemoReportRedirect() {
  redirect(demoReportPath());
}

import type { StyleReport } from "./report";
import { generateReport, demoIntake } from "./report";
import { DEMO_REPORT_SLUG, isDemoReportId } from "./demo-report";

// In-memory store for the demo. Swap for Postgres (Neon) + object storage in
// production — see the technical implementation canvas.
const globalForStore = globalThis as unknown as {
  __styleReports?: Map<string, StyleReport>;
};

const store: Map<string, StyleReport> =
  globalForStore.__styleReports ?? new Map();
globalForStore.__styleReports = store;

export function saveReport(report: StyleReport): void {
  store.set(report.id, report);
}

export function getReport(id: string): StyleReport | undefined {
  if (isDemoReportId(id)) return demoReport();
  return store.get(id);
}

let cachedDemo: StyleReport | undefined;
export function demoReport(): StyleReport {
  if (!cachedDemo) {
    cachedDemo = generateReport(demoIntake, "premium", DEMO_REPORT_SLUG);
  }
  return cachedDemo;
}

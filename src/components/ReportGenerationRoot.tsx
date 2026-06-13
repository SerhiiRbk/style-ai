import { ReportGenerationNavProvider } from "@/components/CreateReportButton";
import { getUserPendingReport } from "@/lib/data/user-pending-report";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ReactNode } from "react";

/** Tracks in-progress report generation site-wide (navbar button + ready toast). */
export async function ReportGenerationRoot({ children }: { children: ReactNode }) {
  let authed = false;
  let initialPending: { reportId: string; pending: boolean } | null = null;

  if (hasSupabase) {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    authed = Boolean(user);
    if (user) {
      const pending = await getUserPendingReport();
      if (pending?.state.pending) {
        initialPending = {
          reportId: pending.reportId,
          pending: true,
        };
      }
    }
  }

  return (
    <ReportGenerationNavProvider authed={authed} initialPending={initialPending}>
      {children}
    </ReportGenerationNavProvider>
  );
}

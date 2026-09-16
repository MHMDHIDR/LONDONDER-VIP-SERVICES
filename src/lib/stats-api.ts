import { supabase } from "@/integrations/supabase/client";
import type { DashboardStatsRaw, ResolvedRange, StatsWindow } from "@/lib/stats";

export type DashboardOverviewData = {
  current: DashboardStatsRaw;
  previous: DashboardStatsRaw;
  range: ResolvedRange;
};

export async function fetchDashboardStats(window: StatsWindow): Promise<DashboardStatsRaw> {
  const { data, error } = await supabase.rpc("dashboard_stats", {
    _from: window.from,
    _to: window.to,
  });
  if (error) throw new Error(error.message);
  return data as unknown as DashboardStatsRaw;
}

/** Current + previous window in parallel, so KPI deltas and charts share one load. */
export async function fetchDashboardOverview(range: ResolvedRange): Promise<DashboardOverviewData> {
  const [current, previous] = await Promise.all([
    fetchDashboardStats(range.current),
    fetchDashboardStats(range.previous),
  ]);
  return { current, previous, range };
}

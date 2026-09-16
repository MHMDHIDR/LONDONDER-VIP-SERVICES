import { supabase } from "@/integrations/supabase/client";
import {
  presetWindows,
  type DashboardStatsRaw,
  type Granularity,
  type RangePreset,
  type StatsWindow,
} from "@/lib/stats";

export type DashboardOverviewData = {
  current: DashboardStatsRaw;
  previous: DashboardStatsRaw;
  granularity: Granularity;
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
export async function fetchDashboardOverview(
  preset: RangePreset,
  todayISO: string,
): Promise<DashboardOverviewData> {
  const { current, previous, granularity } = presetWindows(preset, todayISO);
  const [cur, prev] = await Promise.all([
    fetchDashboardStats(current),
    fetchDashboardStats(previous),
  ]);
  return { current: cur, previous: prev, granularity };
}

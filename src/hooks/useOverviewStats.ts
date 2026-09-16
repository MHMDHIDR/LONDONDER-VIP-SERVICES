import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { todayLocalISO } from "@/lib/money";
import { fetchDashboardOverview } from "@/lib/stats-api";
import {
  bucketDays,
  groupTotals,
  pivotGroupDays,
  resolveRange,
  serviceGroupDays,
  topGroups,
  totals,
  workerGroupDays,
  type Bucket,
  type Granularity,
  type GroupSeries,
  type RangeSelection,
  type SeriesRow,
  type StatsWindow,
  type Totals,
} from "@/lib/stats";

export type GroupedChart = { series: GroupSeries[]; rows: SeriesRow[] };

export type OverviewModel = {
  granularity: Granularity;
  window: StatsWindow;
  current: Totals;
  previous: Totals;
  buckets: Bucket[];
  services: GroupedChart;
  workers: GroupedChart;
};

/**
 * Loads and shapes everything the overview needs for one range selection.
 * Shared by the Dashboard and Analytics pages so their numbers always agree.
 */
export function useOverviewStats(selection: RangeSelection) {
  const { i18n } = useTranslation();
  const today = todayLocalISO();
  const range = useMemo(() => resolveRange(selection, today), [selection, today]);

  const query = useQuery({
    // Keyed by the resolved dates, so a tab left open past midnight never serves yesterday's windows.
    queryKey: ["dashboard-stats", range.current.from, range.current.to],
    queryFn: () => fetchDashboardOverview(range),
    placeholderData: keepPreviousData,
  });

  const lang = i18n.language;
  const data = query.data;
  const model = useMemo<OverviewModel | null>(() => {
    if (!data) return null;
    const { granularity } = data.range;
    const days = data.current.days;
    const current = totals(days);
    const serviceSeries = topGroups(groupTotals(serviceGroupDays(data.current.service_days)));
    const workerSeries = topGroups(groupTotals(workerGroupDays(data.current.worker_days ?? [])));
    return {
      granularity,
      window: data.range.current,
      current,
      previous: totals(data.previous.days),
      buckets: bucketDays(days, granularity, lang),
      services: {
        series: serviceSeries,
        rows: pivotGroupDays(
          days,
          serviceGroupDays(data.current.service_days),
          serviceSeries,
          granularity,
          lang,
          (b) => b.invoiced,
        ),
      },
      workers: {
        series: workerSeries,
        rows: pivotGroupDays(
          days,
          workerGroupDays(data.current.worker_days ?? []),
          workerSeries,
          granularity,
          lang,
          (b) => b.paidOut,
        ),
      },
    };
  }, [data, lang]);

  return {
    model,
    range,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
  };
}

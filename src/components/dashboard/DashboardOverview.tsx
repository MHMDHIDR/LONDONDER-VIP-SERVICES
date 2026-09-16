import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { todayLocalISO } from "@/lib/money";
import { fetchDashboardOverview } from "@/lib/stats-api";
import {
  bucketDays,
  pivotServiceDays,
  serviceTotals,
  topServices,
  totals,
  type RangePreset,
} from "@/lib/stats";
import { cn } from "@/lib/utils";
import { KpiStrip } from "./KpiStrip";
import { MoneyFlowChart } from "./MoneyFlowChart";
import { RangeControl } from "./RangeControl";
import { RevenueByServiceChart } from "./RevenueByServiceChart";

export function DashboardOverview() {
  const { t, i18n } = useTranslation();
  const [preset, setPreset] = useState<RangePreset>("3m");
  const today = todayLocalISO();

  const { data, isPending, isError, error, isFetching, isPlaceholderData } = useQuery({
    // The date is part of the key so a tab left open past midnight never serves yesterday's windows.
    queryKey: ["dashboard-stats", preset, today],
    queryFn: () => fetchDashboardOverview(preset, today),
    placeholderData: keepPreviousData,
  });

  const lang = i18n.language;
  const model = useMemo(() => {
    if (!data) return null;
    const current = totals(data.current.days);
    const previous = totals(data.previous.days);
    const buckets = bucketDays(data.current.days, data.granularity, lang);
    const series = topServices(serviceTotals(data.current.service_days));
    const rows = pivotServiceDays(
      data.current.days,
      data.current.service_days,
      series,
      data.granularity,
      lang,
    );
    return { current, previous, buckets, series, rows, granularity: data.granularity };
  }, [data, lang]);

  return (
    <section aria-label={t("dashboard.overviewEyebrow")} className="mb-10 space-y-5">
      <RangeControl
        value={preset}
        onChange={setPreset}
        from={data?.current.from}
        to={data?.current.to}
      />

      {isError ? (
        <div
          role="alert"
          className="surface-card flex items-center gap-3 rounded-xl p-6 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          {t("dashboard.overview.error")} {(error as Error).message}
        </div>
      ) : null}

      {isPending ? (
        <div className="space-y-5" aria-busy="true" aria-label={t("dashboard.overview.loading")}>
          <Skeleton className="h-[8.5rem] w-full rounded-xl" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-[22rem] rounded-xl" />
            <Skeleton className="h-[22rem] rounded-xl" />
          </div>
        </div>
      ) : model ? (
        <div
          className={cn("space-y-5 transition-opacity", isPlaceholderData && "opacity-60")}
          aria-busy={isFetching}
        >
          <KpiStrip current={model.current} previous={model.previous} />
          <div className="grid gap-5 lg:grid-cols-2">
            <MoneyFlowChart
              buckets={model.buckets}
              granularity={model.granularity}
              totals={model.current}
            />
            <RevenueByServiceChart
              rows={model.rows}
              series={model.series}
              granularity={model.granularity}
              total={model.current.invoiced}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

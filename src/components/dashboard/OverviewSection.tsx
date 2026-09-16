import { AlertTriangle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverviewStats, type OverviewModel } from "@/hooks/useOverviewStats";
import type { RangeSelection } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { KpiStrip } from "./KpiStrip";
import { MoneyFlowChart } from "./MoneyFlowChart";
import { RangeControl } from "./RangeControl";
import { StackedSeriesChart } from "./StackedSeriesChart";

/**
 * Period controls + KPI strip + the two core charts, for one range selection.
 * Pages append their own charts through `extra`, which receives the same model.
 */
export function OverviewSection({
  extra,
  className,
}: {
  extra?: (model: OverviewModel) => ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<RangeSelection>({ kind: "preset", preset: "3m" });
  const { model, range, isPending, isError, error, isFetching, isPlaceholderData } =
    useOverviewStats(selection);

  return (
    <section aria-label={t("dashboard.overviewEyebrow")} className={cn("space-y-5", className)}>
      <RangeControl value={selection} onChange={setSelection} window={range.current} />

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
            <StackedSeriesChart
              title={t("dashboard.overview.byService")}
              description={t("dashboard.overview.byServiceDesc")}
              summaryLabel={t("dashboard.overview.invoiced")}
              total={model.current.invoiced}
              series={model.services.series}
              rows={model.services.rows}
              granularity={model.granularity}
              labels={{
                unnamed: t("dashboard.customLineItems"),
                other: t("dashboard.overview.other"),
              }}
            />
            {extra?.(model)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

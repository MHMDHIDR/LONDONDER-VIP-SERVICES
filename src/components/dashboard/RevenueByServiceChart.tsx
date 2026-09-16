import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { usePrefersReducedMotion } from "@/hooks/useCountUp";
import { formatPence } from "@/lib/money";
import {
  compactGBP,
  serviceLabel,
  type Granularity,
  type ServiceRow,
  type ServiceSeries,
  type ServiceSeriesKey,
} from "@/lib/stats";
import { ChartCard, ChartEmpty, SeriesValue } from "./ChartCard";

const SLOT_COLOR: Record<ServiceSeriesKey, string> = {
  s0: "var(--color-chart-1)",
  s1: "var(--color-chart-2)",
  s2: "var(--color-chart-3)",
  s3: "var(--color-chart-4)",
  s4: "var(--color-chart-5)",
  other: "var(--color-chart-other)",
};

export function RevenueByServiceChart({
  rows,
  series,
  granularity,
  total,
}: {
  rows: ServiceRow[];
  series: ServiceSeries[];
  granularity: Granularity;
  total: number;
}) {
  const { t, i18n } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const lang = i18n.language;
  const labels = {
    custom: t("dashboard.customLineItems"),
    other: t("dashboard.overview.other"),
  };
  const names = Object.fromEntries(series.map((s) => [s.key, serviceLabel(s, labels)])) as Record<
    string,
    string
  >;

  // Legend rows carry the period total so every value is readable without hovering.
  const config = Object.fromEntries(
    series.map((s) => [
      s.key,
      {
        color: SLOT_COLOR[s.key],
        label: (
          <span className="inline-flex items-baseline gap-1.5">
            <span className="max-w-40 truncate">{names[s.key]}</span>
            <span className="font-display text-sm text-foreground">{formatPence(s.invoiced)}</span>
          </span>
        ),
      },
    ]),
  ) satisfies ChartConfig;

  const periodLabel = (label: string) =>
    granularity === "week" ? t("dashboard.overview.weekCommencing", { date: label }) : label;

  return (
    <ChartCard
      eyebrow={t(
        granularity === "week" ? "dashboard.overview.perWeek" : "dashboard.overview.perDay",
      )}
      title={t("dashboard.overview.byService")}
      description={t("dashboard.overview.byServiceDesc")}
      summary={
        <div className="min-w-32">
          <p className="text-xs text-muted-foreground">{t("dashboard.overview.invoiced")}</p>
          <p className="font-display text-2xl leading-tight">{formatPence(total)}</p>
        </div>
      }
      table={
        <table className="sr-only">
          <caption>{t("dashboard.overview.tableCaption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("dashboard.overview.tablePeriod")}</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {names[s.key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{periodLabel(r.label)}</th>
                {series.map((s) => (
                  <td key={s.key}>{formatPence(r[s.key] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {total === 0 || series.length === 0 ? (
        <ChartEmpty message={t("dashboard.overview.empty")} className="h-64 sm:h-72" />
      ) : (
        <div dir="ltr">
          <ChartContainer config={config} className="aspect-auto h-64 w-full sm:h-72">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`${gradientId}-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.38} />
                    <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0.08} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={28}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={48}
                allowDecimals={false}
                tickFormatter={(v: number) => compactGBP(v, lang)}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--color-border)" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => periodLabel(String(label))}
                    formatter={(value, name, item) => (
                      <SeriesValue
                        color={item.color}
                        label={names[String(name)] ?? name}
                        value={formatPence(Number(value))}
                      />
                    )}
                  />
                }
              />
              <ChartLegend
                verticalAlign="bottom"
                content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1.5" />}
              />
              {series.map((s, index) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stackId="revenue"
                  stroke={`var(--color-${s.key})`}
                  strokeWidth={2}
                  fill={`url(#${gradientId}-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                  isAnimationActive={!reduced}
                  animationBegin={index * 120}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ChartContainer>
        </div>
      )}
    </ChartCard>
  );
}

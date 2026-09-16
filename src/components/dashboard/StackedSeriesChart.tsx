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
  seriesLabel,
  type Granularity,
  type GroupSeries,
  type SeriesRow,
} from "@/lib/stats";
import { ChartCard, ChartEmpty, SeriesValue } from "./ChartCard";
import {
  ANIMATION,
  CHART_HEIGHT,
  CHART_MARGIN,
  EMPTY_HEIGHT,
  GRANULARITY_KEY,
  SLOT_COLOR,
  periodLabel,
} from "./chart-utils";

/**
 * A stacked area of money over time split by a group (services, workers, ...).
 * The top groups take fixed colour slots; the rest is folded into a grey "Other".
 */
export function StackedSeriesChart({
  title,
  description,
  summaryLabel,
  total,
  series,
  rows,
  granularity,
  labels,
}: {
  title: string;
  description: string;
  /** Caption above the period total in the card header, e.g. "Invoiced". */
  summaryLabel: string;
  total: number;
  series: GroupSeries[];
  rows: SeriesRow[];
  granularity: Granularity;
  labels: { unnamed: string; other: string };
}) {
  const { t, i18n } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const lang = i18n.language;
  const names = Object.fromEntries(series.map((s) => [s.key, seriesLabel(s, labels)])) as Record<
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
            <span className="font-display text-sm text-foreground">{formatPence(s.pence)}</span>
          </span>
        ),
      },
    ]),
  ) satisfies ChartConfig;

  const label = (value: string) => periodLabel(value, granularity, t);

  return (
    <ChartCard
      eyebrow={t(GRANULARITY_KEY[granularity])}
      title={title}
      description={description}
      summary={
        <div className="min-w-32">
          <p className="text-xs text-muted-foreground">{summaryLabel}</p>
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
                <th scope="row">{label(r.label)}</th>
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
        <ChartEmpty message={t("dashboard.overview.empty")} className={EMPTY_HEIGHT} />
      ) : (
        <div dir="ltr">
          <ChartContainer config={config} className={CHART_HEIGHT}>
            <AreaChart data={rows} margin={CHART_MARGIN}>
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
                width={42}
                allowDecimals={false}
                tickFormatter={(v: number) => compactGBP(v, lang)}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--color-border)" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => label(String(value))}
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
                  stackId="stack"
                  stroke={`var(--color-${s.key})`}
                  strokeWidth={2}
                  fill={`url(#${gradientId}-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                  isAnimationActive={!reduced}
                  animationBegin={index * 120}
                  {...ANIMATION}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        </div>
      )}
    </ChartCard>
  );
}

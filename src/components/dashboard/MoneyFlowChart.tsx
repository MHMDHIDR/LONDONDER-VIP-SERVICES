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
import { compactGBP, type Bucket, type Granularity, type Totals } from "@/lib/stats";
import { ChartCard, ChartEmpty, SeriesValue } from "./ChartCard";
import {
  ANIMATION,
  CHART_HEIGHT,
  CHART_MARGIN,
  EMPTY_HEIGHT,
  GRANULARITY_KEY,
  periodLabel,
} from "./chart-utils";

const SERIES = [
  { key: "invoiced", color: "var(--color-chart-1)" },
  { key: "paidOut", color: "var(--color-chart-2)" },
] as const;

export function MoneyFlowChart({
  buckets,
  granularity,
  totals,
}: {
  buckets: Bucket[];
  granularity: Granularity;
  totals: Totals;
}) {
  const { t, i18n } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const lang = i18n.language;
  const empty = totals.invoiced === 0 && totals.paidOut === 0;

  const config = {
    invoiced: { label: t("dashboard.overview.invoiced"), color: SERIES[0].color },
    paidOut: { label: t("dashboard.overview.paidOut"), color: SERIES[1].color },
  } satisfies ChartConfig;

  const label = (value: string) => periodLabel(value, granularity, t);

  return (
    <ChartCard
      tourId="chart-money-flow"
      eyebrow={t(GRANULARITY_KEY[granularity])}
      title={t("dashboard.overview.moneyFlow")}
      description={t("dashboard.overview.moneyFlowDesc")}
      summary={
        <div className="flex min-w-40 flex-col gap-1">
          <SeriesValue
            color={SERIES[0].color}
            label={config.invoiced.label}
            value={formatPence(totals.invoiced)}
          />
          <SeriesValue
            color={SERIES[1].color}
            label={config.paidOut.label}
            value={formatPence(totals.paidOut)}
          />
        </div>
      }
      table={
        <table className="sr-only">
          <caption>{t("dashboard.overview.tableCaption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("dashboard.overview.tablePeriod")}</th>
              <th scope="col">{config.invoiced.label}</th>
              <th scope="col">{config.paidOut.label}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.key}>
                <th scope="row">{label(b.label)}</th>
                <td>{formatPence(b.invoiced)}</td>
                <td>{formatPence(b.paidOut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {empty ? (
        <ChartEmpty message={t("dashboard.overview.empty")} className={EMPTY_HEIGHT} />
      ) : (
        <div dir="ltr">
          <ChartContainer config={config} className={CHART_HEIGHT}>
            <AreaChart data={buckets} margin={CHART_MARGIN}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`${gradientId}-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0} />
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
                        label={config[name as keyof typeof config]?.label ?? name}
                        value={formatPence(Number(value))}
                      />
                    )}
                  />
                }
              />
              <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
              {SERIES.map((s, index) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
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

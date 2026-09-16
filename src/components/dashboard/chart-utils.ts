import type { TFunction } from "i18next";
import type { Granularity, SeriesKey } from "@/lib/stats";

/** Eyebrow key for a chart card, e.g. "Per week". */
export const GRANULARITY_KEY: Record<Granularity, string> = {
  day: "dashboard.overview.perDay",
  week: "dashboard.overview.perWeek",
  month: "dashboard.overview.perMonth",
};

/** Tooltip / table label for a bucket: weeks read "w/c 1 Sep", days and months use the axis label. */
export function periodLabel(label: string, granularity: Granularity, t: TFunction): string {
  return granularity === "week" ? t("dashboard.overview.weekCommencing", { date: label }) : label;
}

/** Fixed colour slot per series position; identity never changes with the data. */
export const SLOT_COLOR: Record<SeriesKey, string> = {
  s0: "var(--color-chart-1)",
  s1: "var(--color-chart-2)",
  s2: "var(--color-chart-3)",
  s3: "var(--color-chart-4)",
  s4: "var(--color-chart-5)",
  other: "var(--color-chart-other)",
};

export const CHART_MARGIN = { top: 8, right: 4, left: 0, bottom: 0 } as const;
export const CHART_HEIGHT = "aspect-auto h-64 w-full sm:h-72";
export const EMPTY_HEIGHT = "h-64 sm:h-72";
export const ANIMATION = { animationDuration: 900, animationEasing: "ease-out" } as const;

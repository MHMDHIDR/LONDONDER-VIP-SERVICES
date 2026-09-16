/**
 * Product tour registry: the single place a feature registers its walkthrough.
 *
 * How to add or update a tour
 *  1. Put `data-tour="<anchor>"` on the element to spotlight (ChartCard takes `tourId`).
 *  2. Add or edit the tour below; copy lives in i18n under `tours.<key>.steps.<stepKey>`.
 *  3. Bump `version` when the feature changes enough that people should see the tour again;
 *     everyone who completed the older version will get it once more.
 *  4. `bun run check:tours` verifies every anchor exists in the source.
 *
 * This file must stay free of React / app imports so the check script can load it in plain bun.
 */
export type TourSide = "top" | "right" | "bottom" | "left";
export type TourAlign = "start" | "center" | "end";

export type TourStep = {
  /** Matches a `data-tour="..."` attribute in the rendered page. */
  anchor: string;
  /** i18n leaf: `tours.<tour.key>.steps.<key>.title` / `.description`. */
  key: string;
  side?: TourSide;
  align?: TourAlign;
};

export type TourDefinition = {
  id: string;
  version: number;
  /** Route pathname the tour belongs to. */
  route: string;
  /** i18n namespace under `tours`. */
  key: string;
  steps: TourStep[];
};

export const TOURS: readonly TourDefinition[] = [
  {
    id: "dashboard-overview",
    version: 1,
    route: "/dashboard",
    key: "dashboardOverview",
    steps: [
      { anchor: "overview-period", key: "period", side: "bottom", align: "start" },
      { anchor: "overview-kpis", key: "kpis", side: "bottom", align: "center" },
      { anchor: "chart-money-flow", key: "moneyFlow", side: "top", align: "center" },
      { anchor: "chart-by-service", key: "byService", side: "top", align: "center" },
      { anchor: "invoice-library", key: "library", side: "bottom", align: "start" },
      { anchor: "nav-analytics", key: "analytics", side: "bottom", align: "center" },
    ],
  },
  {
    id: "analytics",
    version: 1,
    route: "/analytics",
    key: "analytics",
    steps: [
      { anchor: "range-custom", key: "custom", side: "bottom", align: "start" },
      { anchor: "chart-by-worker", key: "byWorker", side: "top", align: "center" },
      { anchor: "tour-help", key: "help", side: "bottom", align: "end" },
    ],
  },
];

export function tourForPath(pathname: string): TourDefinition | undefined {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return TOURS.find((tour) => clean === tour.route || clean.startsWith(`${tour.route}/`));
}

export const anchorSelector = (anchor: string) => `[data-tour="${anchor}"]`;

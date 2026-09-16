/**
 * Pure helpers for the dashboard / analytics overview: period windows,
 * bucketing, totals, deltas, grouping and compact formatting. No React, no IO.
 */
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { ar, enGB } from "date-fns/locale";

export type RangePreset = "1m" | "3m";
export const RANGE_PRESETS: readonly RangePreset[] = ["1m", "3m"] as const;

/** What the user picked: a quick preset or an explicit from/to (ISO dates, inclusive). */
export type RangeSelection =
  { kind: "preset"; preset: RangePreset } | { kind: "custom"; from: string; to: string };

export type Granularity = "day" | "week" | "month";
export type StatsWindow = { from: string; to: string };
export type ResolvedRange = {
  current: StatsWindow;
  previous: StatsWindow;
  granularity: Granularity;
  days: number;
};

/** Raw shapes returned by the `dashboard_stats` RPC. */
export type StatsDay = {
  day: string;
  invoiced_pence: number;
  invoice_count: number;
  paid_out_pence: number;
  payout_count: number;
};
export type StatsServiceDay = {
  day: string;
  service: string | null;
  invoiced_pence: number;
  invoice_count: number;
};
export type StatsWorkerDay = {
  day: string;
  worker_id: string | null;
  worker_name: string | null;
  paid_out_pence: number;
  payout_count: number;
};
export type DashboardStatsRaw = {
  from: string;
  to: string;
  days: StatsDay[];
  service_days: StatsServiceDay[];
  worker_days: StatsWorkerDay[];
};

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

export function dateLocale(lang: string) {
  return lang === "ar" ? ar : enGB;
}

/** Bucket size that keeps a chart readable: daily up to ~6 weeks, weekly up to ~6 months, then monthly. */
export function granularityForSpan(days: number): Granularity {
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
}

/**
 * Presets end today: "1m" = the last calendar month, "3m" = the last three.
 * The previous window is always the same number of days immediately before the current one,
 * so deltas compare like with like.
 */
export function resolveRange(selection: RangeSelection, todayISO: string): ResolvedRange {
  const today = parseISO(todayISO);
  let from: Date;
  let to: Date;
  if (selection.kind === "preset") {
    from = addDays(subMonths(today, selection.preset === "1m" ? 1 : 3), 1);
    to = today;
  } else {
    from = parseISO(selection.from);
    to = parseISO(selection.to);
    if (to < from) [from, to] = [to, from];
  }
  const days = differenceInCalendarDays(to, from) + 1;
  return {
    current: { from: toISO(from), to: toISO(to) },
    previous: { from: toISO(subDays(from, days)), to: toISO(subDays(from, 1)) },
    granularity: granularityForSpan(days),
    days,
  };
}

/** "18 Aug – 16 Sep 2026" (the year is shown once when both ends share it). */
export function formatSpan(from: string, to: string, lang: string): string {
  const locale = dateLocale(lang);
  const a = parseISO(from);
  const b = parseISO(to);
  const sameYear = a.getFullYear() === b.getFullYear();
  const start = format(a, sameYear ? "d MMM" : "d MMM yyyy", { locale });
  const end = format(b, "d MMM yyyy", { locale });
  return `${start} – ${end}`;
}

export type Totals = {
  invoiced: number;
  paidOut: number;
  net: number;
  invoices: number;
  payouts: number;
};

export function totals(days: StatsDay[]): Totals {
  const t = { invoiced: 0, paidOut: 0, net: 0, invoices: 0, payouts: 0 };
  for (const d of days) {
    t.invoiced += d.invoiced_pence;
    t.paidOut += d.paid_out_pence;
    t.invoices += d.invoice_count;
    t.payouts += d.payout_count;
  }
  t.net = t.invoiced - t.paidOut;
  return t;
}

/** Ratio change vs a baseline, or null when there is no positive baseline to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return (current - previous) / previous;
}

export function marginRatio(invoiced: number, net: number): number | null {
  return invoiced > 0 ? net / invoiced : null;
}

/** "+12.5%" (signed) or "62%" (unsigned). Big swings drop the decimal. */
export function formatPercent(ratio: number, signed: boolean): string {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    signDisplay: signed ? "exceptZero" : "auto",
    maximumFractionDigits: Math.abs(ratio) >= 1 ? 0 : 1,
  }).format(ratio);
}

/** Axis ticks: "£1.2k", "£12k", "£1.5M"; "1.2k£" in Arabic to mirror formatPence. */
export function compactGBP(pence: number, lang: string): string {
  const n = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 })
    .format(pence / 100)
    .replace("K", "k");
  return lang === "ar" ? `${n}£` : `£${n}`;
}

export type Bucket = {
  key: string;
  start: Date;
  label: string;
  invoiced: number;
  paidOut: number;
  invoices: number;
  payouts: number;
};

function bucketStart(day: Date, granularity: Granularity): Date {
  if (granularity === "day") return day;
  if (granularity === "week") return startOfWeek(day, { weekStartsOn: 1 });
  return startOfMonth(day);
}

function bucketLabel(start: Date, granularity: Granularity, lang: string): string {
  const locale = dateLocale(lang);
  return format(start, granularity === "month" ? "MMM yyyy" : "d MMM", { locale });
}

/** Zero-filled day rows → daily, Monday-start weekly or monthly buckets, in chronological order. */
export function bucketDays(days: StatsDay[], granularity: Granularity, lang: string): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const d of days) {
    const start = bucketStart(parseISO(d.day), granularity);
    const key = toISO(start);
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        start,
        label: bucketLabel(start, granularity, lang),
        invoiced: 0,
        paidOut: 0,
        invoices: 0,
        payouts: 0,
      };
      map.set(key, b);
    }
    b.invoiced += d.invoiced_pence;
    b.paidOut += d.paid_out_pence;
    b.invoices += d.invoice_count;
    b.payouts += d.payout_count;
  }
  return [...map.values()];
}

/* ---------- Grouped series (revenue by service, payouts by worker, ...) ---------- */

/** One day of one group: `id` is the stable identity, `name` what we show. */
export type GroupDay = {
  day: string;
  id: string | null;
  name: string | null;
  pence: number;
  count: number;
};
export type GroupTotal = { id: string | null; name: string | null; pence: number; count: number };

export const SERIES_SLOTS = ["s0", "s1", "s2", "s3", "s4"] as const;
export type SeriesSlot = (typeof SERIES_SLOTS)[number];
export type SeriesKey = SeriesSlot | "other";

export type GroupSeries = {
  key: SeriesKey;
  id: string | null;
  name: string | null;
  pence: number;
  count: number;
  isOther: boolean;
};

export type SeriesRow = { key: string; label: string } & Partial<Record<SeriesKey, number>>;

const UNNAMED_KEY = "::unnamed::";
const groupKey = (g: { id: string | null; name: string | null }) => g.id ?? g.name ?? UNNAMED_KEY;

export const serviceGroupDays = (rows: StatsServiceDay[]): GroupDay[] =>
  rows.map((r) => ({
    day: r.day,
    id: r.service,
    name: r.service,
    pence: r.invoiced_pence,
    count: r.invoice_count,
  }));

export const workerGroupDays = (rows: StatsWorkerDay[]): GroupDay[] =>
  rows.map((r) => ({
    day: r.day,
    id: r.worker_id,
    name: r.worker_name,
    pence: r.paid_out_pence,
    count: r.payout_count,
  }));

export function groupTotals(rows: GroupDay[]): GroupTotal[] {
  const map = new Map<string, GroupTotal>();
  for (const r of rows) {
    const k = groupKey(r);
    const g = map.get(k) ?? { id: r.id, name: r.name, pence: 0, count: 0 };
    g.pence += r.pence;
    g.count += r.count;
    map.set(k, g);
  }
  return [...map.values()].sort(
    (a, b) => b.pence - a.pence || (a.name ?? "").localeCompare(b.name ?? ""),
  );
}

/** Top N groups take fixed colour slots; everything else folds into "other" (omitted when empty). */
export function topGroups(sorted: GroupTotal[], n = SERIES_SLOTS.length): GroupSeries[] {
  const top: GroupSeries[] = sorted.slice(0, n).map((g, i) => ({
    key: SERIES_SLOTS[i],
    id: g.id,
    name: g.name,
    pence: g.pence,
    count: g.count,
    isOther: false,
  }));
  const rest = sorted.slice(n);
  if (rest.length === 0) return top;
  return [
    ...top,
    {
      key: "other",
      id: null,
      name: null,
      pence: rest.reduce((a, g) => a + g.pence, 0),
      count: rest.reduce((a, g) => a + g.count, 0),
      isOther: true,
    },
  ];
}

/**
 * Pivot per-group day rows into one row per bucket with a column per series (zero-filled).
 * "other" is derived from the bucket's overall total so it is exact even when groups are folded.
 */
export function pivotGroupDays(
  days: StatsDay[],
  rows: GroupDay[],
  series: GroupSeries[],
  granularity: Granularity,
  lang: string,
  bucketTotal: (bucket: Bucket) => number,
): SeriesRow[] {
  const buckets = bucketDays(days, granularity, lang);
  const slotFor = new Map<string, SeriesKey>();
  for (const s of series) if (!s.isOther) slotFor.set(groupKey(s), s.key);
  const hasOther = series.some((s) => s.isOther);

  const out = new Map<string, SeriesRow>();
  for (const b of buckets) {
    const row: SeriesRow = { key: b.key, label: b.label };
    for (const s of series) row[s.key] = 0;
    out.set(b.key, row);
  }
  for (const r of rows) {
    const key = toISO(bucketStart(parseISO(r.day), granularity));
    const row = out.get(key);
    const slot = slotFor.get(groupKey(r));
    if (!row || !slot) continue;
    row[slot] = (row[slot] ?? 0) + r.pence;
  }
  if (hasOther) {
    for (const b of buckets) {
      const row = out.get(b.key);
      if (!row) continue;
      const named = SERIES_SLOTS.reduce((a, k) => a + (row[k] ?? 0), 0);
      row.other = Math.max(0, bucketTotal(b) - named);
    }
  }
  return [...out.values()];
}

export function seriesLabel(
  s: { name: string | null; isOther: boolean },
  labels: { unnamed: string; other: string },
): string {
  if (s.isOther) return labels.other;
  return s.name ?? labels.unnamed;
}

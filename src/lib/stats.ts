/**
 * Pure helpers for the dashboard overview: period windows, bucketing,
 * totals, deltas and compact formatting. No React, no IO.
 */
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { ar, enGB } from "date-fns/locale";

export type RangePreset = "1m" | "3m";
export const RANGE_PRESETS: readonly RangePreset[] = ["1m", "3m"] as const;

export type Granularity = "day" | "week";
export type StatsWindow = { from: string; to: string };

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
export type DashboardStatsRaw = {
  from: string;
  to: string;
  days: StatsDay[];
  service_days: StatsServiceDay[];
};

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

export function dateLocale(lang: string) {
  return lang === "ar" ? ar : enGB;
}

export function granularityFor(preset: RangePreset): Granularity {
  return preset === "1m" ? "day" : "week";
}

/**
 * Current window = the last 1 or 3 calendar months ending today (inclusive).
 * Previous window = the same number of days immediately before it.
 */
export function presetWindows(
  preset: RangePreset,
  todayISO: string,
): { current: StatsWindow; previous: StatsWindow; granularity: Granularity } {
  const today = parseISO(todayISO);
  const from = addDays(subMonths(today, preset === "1m" ? 1 : 3), 1);
  const length = differenceInCalendarDays(today, from) + 1;
  return {
    current: { from: toISO(from), to: toISO(today) },
    previous: { from: toISO(subDays(from, length)), to: toISO(subDays(from, 1)) },
    granularity: granularityFor(preset),
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
  return granularity === "day" ? day : startOfWeek(day, { weekStartsOn: 1 });
}

/** Zero-filled day rows → daily or Monday-start weekly buckets, in chronological order. */
export function bucketDays(days: StatsDay[], granularity: Granularity, lang: string): Bucket[] {
  const locale = dateLocale(lang);
  const map = new Map<string, Bucket>();
  for (const d of days) {
    const start = bucketStart(parseISO(d.day), granularity);
    const key = toISO(start);
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        start,
        label: format(start, "d MMM", { locale }),
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

export type ServiceTotal = { service: string | null; invoiced: number; invoices: number };

/** Internal map key for receipts without a service (custom line items). */
const CUSTOM_KEY = "::custom-line-items::";
const serviceKey = (service: string | null) => service ?? CUSTOM_KEY;

export function serviceTotals(rows: StatsServiceDay[]): ServiceTotal[] {
  const map = new Map<string, ServiceTotal>();
  for (const r of rows) {
    const k = serviceKey(r.service);
    const s = map.get(k) ?? { service: r.service, invoiced: 0, invoices: 0 };
    s.invoiced += r.invoiced_pence;
    s.invoices += r.invoice_count;
    map.set(k, s);
  }
  return [...map.values()].sort(
    (a, b) => b.invoiced - a.invoiced || (a.service ?? "").localeCompare(b.service ?? ""),
  );
}

export const SERVICE_SLOTS = ["s0", "s1", "s2", "s3", "s4"] as const;
export type ServiceSlot = (typeof SERVICE_SLOTS)[number];
export type ServiceSeriesKey = ServiceSlot | "other";

export type ServiceSeries = {
  key: ServiceSeriesKey;
  service: string | null;
  invoiced: number;
  invoices: number;
  isOther: boolean;
};

/** Top N services take fixed slots; everything else folds into "other" (omitted when empty). */
export function topServices(sorted: ServiceTotal[], n = SERVICE_SLOTS.length): ServiceSeries[] {
  const top: ServiceSeries[] = sorted.slice(0, n).map((s, i) => ({
    key: SERVICE_SLOTS[i],
    service: s.service,
    invoiced: s.invoiced,
    invoices: s.invoices,
    isOther: false,
  }));
  const rest = sorted.slice(n);
  if (rest.length === 0) return top;
  return [
    ...top,
    {
      key: "other",
      service: null,
      invoiced: rest.reduce((a, s) => a + s.invoiced, 0),
      invoices: rest.reduce((a, s) => a + s.invoices, 0),
      isOther: true,
    },
  ];
}

export type ServiceRow = { key: string; label: string } & Partial<Record<ServiceSeriesKey, number>>;

/** Pivot per-service day rows into one row per bucket with a column per series (zero-filled). */
export function pivotServiceDays(
  days: StatsDay[],
  rows: StatsServiceDay[],
  series: ServiceSeries[],
  granularity: Granularity,
  lang: string,
): ServiceRow[] {
  const buckets = bucketDays(days, granularity, lang);
  const slotFor = new Map<string, ServiceSeriesKey>();
  for (const s of series) if (!s.isOther) slotFor.set(serviceKey(s.service), s.key);
  const hasOther = series.some((s) => s.isOther);

  const out = new Map<string, ServiceRow>();
  for (const b of buckets) {
    const row: ServiceRow = { key: b.key, label: b.label };
    for (const s of series) row[s.key] = 0;
    out.set(b.key, row);
  }
  for (const r of rows) {
    const key = toISO(bucketStart(parseISO(r.day), granularity));
    const row = out.get(key);
    const slot = slotFor.get(serviceKey(r.service));
    if (!row || !slot) continue;
    row[slot] = (row[slot] ?? 0) + r.invoiced_pence;
  }
  if (hasOther) {
    for (const b of buckets) {
      const row = out.get(b.key);
      if (!row) continue;
      const named = SERVICE_SLOTS.reduce((a, k) => a + (row[k] ?? 0), 0);
      row.other = Math.max(0, b.invoiced - named);
    }
  }
  return [...out.values()];
}

export function serviceLabel(
  s: { service: string | null; isOther: boolean },
  labels: { custom: string; other: string },
): string {
  if (s.isOther) return labels.other;
  return s.service ?? labels.custom;
}

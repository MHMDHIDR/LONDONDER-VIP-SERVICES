/** Decimal-safe GBP money helpers. All amounts are stored as integer pence. */

export const GBP = "GBP" as const;

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format integer pence as "£1,234.56". */
export function formatPence(pence: number | null | undefined): string {
  return gbpFormatter.format((pence ?? 0) / 100);
}

/** Plain "1234.56" for text inputs. */
export function penceToInput(pence: number | null | undefined): string {
  return ((pence ?? 0) / 100).toFixed(2);
}

/**
 * Parse a user-typed pounds string into integer pence without float drift.
 * Returns null when the value is not a valid non-negative amount.
 */
export function parsePoundsToPence(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  const pounds = whole === "" ? 0 : Number.parseInt(whole, 10);
  const pennies = Number.parseInt((frac + "00").slice(0, 2), 10);
  if (!Number.isFinite(pounds) || !Number.isFinite(pennies)) return null;
  return pounds * 100 + pennies;
}

/** Quantity may be fractional (e.g. 1.5 hours); line totals round half-up to pence. */
export function lineTotalPence(quantity: number, unitPricePence: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPricePence)) return 0;
  return Math.round(quantity * unitPricePence);
}

export function sumPence(values: number[]): number {
  return values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
}

/** Today's date as a local (not UTC) yyyy-mm-dd string. */
export function todayLocalISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

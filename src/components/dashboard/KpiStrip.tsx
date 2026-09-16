import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCountUp } from "@/hooks/useCountUp";
import { formatPence } from "@/lib/money";
import { formatPercent, marginRatio, percentChange, type Totals } from "@/lib/stats";
import { cn } from "@/lib/utils";

type Tone = "good" | "neutral";

function DeltaChip({ delta, tone }: { delta: number | null; tone: Tone }) {
  const { t } = useTranslation();
  if (delta === null) return null;
  const flat = Math.abs(delta) < 0.0005;
  const up = delta > 0;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  const classes =
    tone === "neutral" || flat
      ? "bg-muted text-muted-foreground"
      : up
        ? "bg-success/10 text-success"
        : "bg-destructive/10 text-destructive";
  return (
    <span
      dir="ltr"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
        classes,
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {formatPercent(delta, true)}
      <span className="sr-only"> {t("dashboard.overview.vsPrevious")}</span>
    </span>
  );
}

function Tile({
  label,
  amount,
  format,
  delta,
  tone,
  secondary,
}: {
  label: string;
  amount: number;
  format: (n: number) => string;
  delta: number | null;
  tone: Tone;
  secondary?: string;
}) {
  const shown = useCountUp(amount);
  return (
    <div className="bg-card p-4 sm:p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-3xl leading-none">{format(Math.round(shown))}</dd>
      <dd className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <DeltaChip delta={delta} tone={tone} />
        {secondary ? <span>{secondary}</span> : null}
      </dd>
    </div>
  );
}

export function KpiStrip({ current, previous }: { current: Totals; previous: Totals }) {
  const { t } = useTranslation();
  const margin = marginRatio(current.invoiced, current.net);
  const count = (n: number) => new Intl.NumberFormat("en-GB").format(n);

  return (
    <div className="surface-card overflow-hidden rounded-xl" data-tour="overview-kpis">
      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <Tile
          label={t("dashboard.overview.invoiced")}
          amount={current.invoiced}
          format={formatPence}
          delta={percentChange(current.invoiced, previous.invoiced)}
          tone="good"
        />
        <Tile
          label={t("dashboard.overview.paidOut")}
          amount={current.paidOut}
          format={formatPence}
          delta={percentChange(current.paidOut, previous.paidOut)}
          tone="neutral"
        />
        <Tile
          label={t("dashboard.overview.net")}
          amount={current.net}
          format={formatPence}
          delta={percentChange(current.net, previous.net)}
          tone="good"
          secondary={
            margin === null
              ? undefined
              : t("dashboard.overview.margin", { value: formatPercent(margin, false) })
          }
        />
        <Tile
          label={t("dashboard.overview.invoicesIssued")}
          amount={current.invoices}
          format={count}
          delta={percentChange(current.invoices, previous.invoices)}
          tone="good"
          secondary={t("dashboard.overview.payoutsCount", { count: current.payouts })}
        />
      </dl>
    </div>
  );
}

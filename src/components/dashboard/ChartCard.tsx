import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChartCardProps = {
  eyebrow: string;
  title: string;
  description?: string;
  /** Visible period totals; the relief channel for readers who cannot rely on colour or hover. */
  summary?: ReactNode;
  children: ReactNode;
  /** Screen-reader table twin of the plotted data. */
  table?: ReactNode;
  className?: string;
};

export function ChartCard({
  eyebrow,
  title,
  description,
  summary,
  children,
  table,
  className,
}: ChartCardProps) {
  return (
    <section className={cn("surface-card min-w-0 rounded-xl p-5", className)} aria-label={title}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-eyebrow">{eyebrow}</p>
          <h3 className="mt-1 font-display text-xl leading-tight">{title}</h3>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {summary ? <div className="text-end text-sm">{summary}</div> : null}
      </header>
      {children}
      {table}
    </section>
  );
}

/** One line of a chart's header summary or tooltip: swatch, label, value. */
export function SeriesValue({
  color,
  label,
  value,
  className,
}: {
  color?: string;
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="h-0.5 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto font-display text-sm text-foreground">{value}</span>
    </div>
  );
}

export function ChartEmpty({ message, className }: { message: string; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed border-input text-sm text-muted-foreground",
        className,
      )}
    >
      {message}
    </p>
  );
}

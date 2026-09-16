import { format, parseISO } from "date-fns";
import { CalendarDays, Check } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  RANGE_PRESETS,
  dateLocale,
  formatSpan,
  type RangePreset,
  type RangeSelection,
  type StatsWindow,
} from "@/lib/stats";
import { cn } from "@/lib/utils";

const PILL_BASE =
  "inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full border border-transparent bg-muted/70 px-3.5 text-xs font-medium text-muted-foreground transition-colors " +
  "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const PILL_ON = "border-gold/40 bg-gold-soft/40 text-gold-foreground hover:bg-gold-soft/40";
const TOGGLE_PILL = `${PILL_BASE} data-[state=on]:border-gold/40 data-[state=on]:bg-gold-soft/40 data-[state=on]:text-gold-foreground data-[state=on]:hover:bg-gold-soft/40`;

const LABEL_KEY: Record<RangePreset, string> = {
  "1m": "dashboard.overview.lastMonth",
  "3m": "dashboard.overview.last3Months",
};

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * One row of period controls: two quick presets plus a custom from/to picker,
 * all styled as the same pill so the active choice is obvious.
 */
export function RangeControl({
  value,
  onChange,
  window,
}: {
  value: RangeSelection;
  onChange: (selection: RangeSelection) => void;
  /** The resolved current window, shown as a caption and used to seed the picker. */
  window?: StatsWindow;
}) {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const lang = i18n.language;
  const isCustom = value.kind === "custom";
  const complete = Boolean(draft?.from && draft?.to);

  const handleOpenChange = (next: boolean) => {
    if (next)
      setDraft(window ? { from: parseISO(window.from), to: parseISO(window.to) } : undefined);
    setOpen(next);
  };

  const confirm = () => {
    if (!draft?.from || !draft?.to) return;
    onChange({ kind: "custom", from: toISO(draft.from), to: toISO(draft.to) });
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-tour="overview-period">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToggleGroup
          type="single"
          value={isCustom ? "" : value.preset}
          onValueChange={(next) => {
            if (next) onChange({ kind: "preset", preset: next as RangePreset });
          }}
          aria-label={t("dashboard.overview.period")}
          className="justify-start gap-1.5"
        >
          {RANGE_PRESETS.map((preset) => (
            <ToggleGroupItem key={preset} value={preset} className={TOGGLE_PILL}>
              {t(LABEL_KEY[preset])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-pressed={isCustom}
              data-tour="range-custom"
              className={cn(PILL_BASE, isCustom && PILL_ON)}
            >
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
              {isCustom && window
                ? formatSpan(window.from, window.to, lang)
                : t("dashboard.overview.customRange")}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-auto max-w-[calc(100vw-2rem)] rounded-xl p-0 shadow-[var(--shadow-lift)]"
          >
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={isMobile ? 1 : 2}
              defaultMonth={draft?.from}
              disabled={{ after: new Date() }}
              weekStartsOn={1}
              locale={dateLocale(lang)}
              className="bg-transparent p-3"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                {complete && draft?.from && draft?.to
                  ? formatSpan(toISO(draft.from), toISO(draft.to), lang)
                  : t("dashboard.overview.pickRange")}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="premium"
                  disabled={!complete}
                  onClick={confirm}
                >
                  <Check aria-hidden="true" className="h-4 w-4 ms-0 me-1" />
                  {t("dashboard.overview.confirm")}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!isCustom && window ? (
        <p className="text-sm text-muted-foreground">{formatSpan(window.from, window.to, lang)}</p>
      ) : null}
    </div>
  );
}

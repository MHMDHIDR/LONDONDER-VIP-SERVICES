import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RANGE_PRESETS, formatSpan, type RangePreset } from "@/lib/stats";

const PILL =
  "h-8 min-w-0 rounded-full border border-transparent bg-muted/70 px-3.5 text-xs font-medium text-muted-foreground " +
  "hover:bg-muted hover:text-foreground " +
  "data-[state=on]:border-gold/40 data-[state=on]:bg-gold-soft/40 data-[state=on]:text-gold-foreground data-[state=on]:hover:bg-gold-soft/40";

const LABEL_KEY: Record<RangePreset, string> = {
  "1m": "dashboard.overview.lastMonth",
  "3m": "dashboard.overview.last3Months",
};

export function RangeControl({
  value,
  onChange,
  from,
  to,
}: {
  value: RangePreset;
  onChange: (preset: RangePreset) => void;
  from?: string;
  to?: string;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as RangePreset);
        }}
        aria-label={t("dashboard.overview.period")}
        className="justify-start gap-1.5"
      >
        {RANGE_PRESETS.map((preset) => (
          <ToggleGroupItem key={preset} value={preset} className={PILL}>
            {t(LABEL_KEY[preset])}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {from && to ? (
        <p className="text-sm text-muted-foreground">{formatSpan(from, to, i18n.language)}</p>
      ) : null}
    </div>
  );
}

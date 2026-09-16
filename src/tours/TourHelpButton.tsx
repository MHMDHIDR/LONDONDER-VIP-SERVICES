import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useCurrentTour } from "./useTour";

/** Replays the current page's tour; shows a gold dot while there is a tour this user has not seen. */
export function TourHelpButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { def, unseen, start } = useCurrentTour();
  if (!def) return null;
  const label = unseen ? t("tours.helpNew") : t("tours.help");
  return (
    <button
      type="button"
      data-tour="tour-help"
      onClick={() => void start()}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-ink-foreground/80 transition-colors hover:bg-white/10 hover:text-ink-foreground",
        className,
      )}
    >
      <CircleHelp aria-hidden="true" className="h-4 w-4" />
      {unseen ? (
        <span
          aria-hidden="true"
          className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold ring-2 ring-ink"
        />
      ) : null}
    </button>
  );
}

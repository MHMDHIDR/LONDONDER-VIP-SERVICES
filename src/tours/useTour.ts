import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePrefersReducedMotion } from "@/hooks/useCountUp";
import { fetchTourProgress, markTourSeen, type TourProgressMap } from "@/lib/tours-api";
import { tourForPath, type TourDefinition } from "./registry";
import { runTour, waitForAnchor } from "./runner";

export const TOUR_PROGRESS_KEY = ["tour-progress"] as const;

export function isTourUnseen(progress: TourProgressMap | undefined, def: TourDefinition): boolean {
  const row = progress?.[def.id];
  return !row || row.version < def.version;
}

/**
 * The tour registered for the current route, whether this user still has to see it,
 * and a `start` function that waits for the page to render before spotlighting.
 */
export function useCurrentTour() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const queryClient = useQueryClient();

  const def = useMemo(() => tourForPath(pathname), [pathname]);

  const { data: progress, isSuccess } = useQuery({
    queryKey: TOUR_PROGRESS_KEY,
    queryFn: fetchTourProgress,
    staleTime: 5 * 60_000,
  });

  const { mutate: markSeen } = useMutation({
    mutationFn: markTourSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TOUR_PROGRESS_KEY }),
  });

  const start = useCallback(async () => {
    if (!def) return;
    const ready = await waitForAnchor(def.steps[0].anchor);
    if (!ready) return;
    await runTour(def, t, {
      reducedMotion: reduced,
      onEnd: ({ completed }) =>
        markSeen({ tourId: def.id, version: def.version, dismissed: !completed }),
    });
  }, [def, t, reduced, markSeen]);

  return {
    def,
    loaded: isSuccess,
    unseen: Boolean(def) && isSuccess && isTourUnseen(progress, def as TourDefinition),
    start,
  };
}

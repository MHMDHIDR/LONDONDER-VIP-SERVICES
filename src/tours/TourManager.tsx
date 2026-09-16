import { useEffect, useRef } from "react";
import { isTourActive } from "./runner";
import { useCurrentTour } from "./useTour";

/**
 * Auto-starts the current route's tour once per user (per tour version).
 * Renders nothing; mount it once inside the authenticated shell.
 */
export function TourManager() {
  const { def, unseen, start } = useCurrentTour();
  const startRef = useRef(start);
  startRef.current = start;
  const startedRef = useRef<string | null>(null);

  const tourId = def?.id ?? null;
  useEffect(() => {
    if (!tourId || !unseen || isTourActive()) return;
    if (startedRef.current === tourId) return;
    startedRef.current = tourId;
    // A short pause lets figures count up and charts draw before the spotlight lands.
    const timer = setTimeout(() => void startRef.current(), 700);
    return () => clearTimeout(timer);
  }, [tourId, unseen]);

  return null;
}

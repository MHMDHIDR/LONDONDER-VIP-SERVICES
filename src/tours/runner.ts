import type { TFunction } from "i18next";
import { anchorSelector, type TourDefinition } from "./registry";

const POPOVER_CLASS = "lvs-tour";

/** The first rendered, visible element carrying this anchor (hidden nav duplicates are skipped). */
export function findAnchor(anchor: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(anchorSelector(anchor));
  for (const node of nodes) if (node.getClientRects().length > 0) return node;
  return null;
}

/** Resolves once the anchor is on screen (data has rendered), or false after the timeout. */
export function waitForAnchor(anchor: string, timeoutMs = 8000): Promise<boolean> {
  const started = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      if (findAnchor(anchor)) return resolve(true);
      if (performance.now() - started > timeoutMs) return resolve(false);
      setTimeout(check, 200);
    };
    check();
  });
}

let active = false;
export const isTourActive = () => active;

export type TourOutcome = { completed: boolean };

/**
 * Runs a tour with driver.js (loaded on demand, so it never ships with the initial bundle).
 * Steps whose anchor is not visible right now are skipped rather than breaking the tour.
 */
export async function runTour(
  def: TourDefinition,
  t: TFunction,
  opts: { reducedMotion: boolean; onEnd: (outcome: TourOutcome) => void },
): Promise<void> {
  if (active) return;
  const [{ driver }] = await Promise.all([
    import("driver.js"),
    import("driver.js/dist/driver.css"),
  ]);

  const steps = def.steps.flatMap((step) => {
    const element = findAnchor(step.anchor);
    if (!element) return [];
    return [
      {
        element,
        popover: {
          title: t(`tours.${def.key}.steps.${step.key}.title`),
          description: t(`tours.${def.key}.steps.${step.key}.description`),
          side: step.side,
          align: step.align,
        },
      },
    ];
  });
  if (steps.length === 0) return;

  active = true;
  const instance = driver({
    steps,
    popoverClass: POPOVER_CLASS,
    showProgress: steps.length > 1,
    // driver.js fills {{current}} / {{total}} itself; pass them through i18n untouched.
    progressText: t("tours.progress", { current: "{{current}}", total: "{{total}}" }),
    nextBtnText: t("tours.next"),
    prevBtnText: t("tours.previous"),
    doneBtnText: t("tours.done"),
    animate: !opts.reducedMotion,
    smoothScroll: !opts.reducedMotion,
    stagePadding: 10,
    stageRadius: 14,
    overlayColor: "oklch(0.16 0.005 60)",
    overlayOpacity: 0.55,
    allowClose: true,
    onDestroyed: (_element, _step, { state }) => {
      active = false;
      opts.onEnd({ completed: state.activeIndex === steps.length - 1 });
    },
  });
  instance.drive();
}

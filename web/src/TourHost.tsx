import { useMemo } from "react";
import {
  TourOverlay,
  useTourContext,
  useTranslation,
  type TourLabels,
} from "@life-editor/shared";

/*
 * Tutorial tour host (#1122).
 *
 * The seam between the Provider (which knows WHERE the user is) and the
 * overlay (which knows how to draw it). It exists because the overlay is a
 * shared primitive and therefore must not call useTranslation (§6.4) — this
 * is the web-side component allowed to, so every string crosses the boundary
 * already resolved.
 *
 * Mounted beside CommandPalette and TagEditorHost at shell level, so the
 * bubble opens over whichever section the tour has navigated to.
 */
export function TourHost() {
  const { t } = useTranslation();
  const tour = useTourContext();
  const { activeStep, anchorElement, stepNumber, totalSteps } = tour;

  const labels = useMemo<TourLabels>(
    () => ({
      dialogLabel: t("tour.dialogLabel"),
      next: t("tour.next"),
      done: t("tour.done"),
      skip: t("tour.skip"),
      progress: t("tour.progress", { current: stepNumber, total: totalSteps }),
      waitingForAction: t("tour.waitingForAction"),
    }),
    [stepNumber, t, totalSteps],
  );

  // Both are set together or not at all — the Provider only calls a step
  // active once its anchor has actually been found.
  if (!activeStep || !anchorElement) return null;

  return (
    <TourOverlay
      anchorElement={anchorElement}
      copy={t(activeStep.copyKey)}
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      waitsForAction={activeStep.advanceOn.kind === "action"}
      onNext={tour.next}
      onSkip={tour.skip}
      onDismiss={tour.pause}
      labels={labels}
    />
  );
}

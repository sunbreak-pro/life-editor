/*
 * Already-translated copy for the tour overlay (§6.4).
 *
 * The primitive never calls useTranslation — the host resolves every string
 * and hands them over, the same contract `ConnectGraphLabels` and
 * `AppShellLabels` use. Each field names the catalog key it comes from so the
 * two sides can be checked against each other by reading.
 */
export interface TourLabels {
  /** Accessible name of the tour bubble — `tour.dialogLabel`. */
  dialogLabel: string;
  /** Advance button on any step but the last — `tour.next`. */
  next: string;
  /** Advance button on the LAST step — `tour.done`. */
  done: string;
  /** Dismiss-for-good button — `tour.skip`. */
  skip: string;
  /** Position readout, already interpolated (e.g. "2 / 5") — `tour.progress`. */
  progress: string;
  /**
   * Shown in place of the advance button while a step waits for the user to
   * actually do the thing — `tour.waitingForAction`.
   */
  waitingForAction: string;
}

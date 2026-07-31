/*
 * The order a series-wide edit has to be written in (#504).
 *
 * A repeat is two things at once: a TEMPLATE that future days are generated
 * from, and the OCCURRENCE rows already sitting on the calendar. An edit
 * applied to "this and future" / "all" has to reach both, and the order is not
 * a matter of taste:
 *
 *   - Occurrences first (the old order) puts the failure where nobody can see
 *     it. Every future row on screen carries the new values, so the screen is
 *     entirely right; only the template kept the old ones, and that shows up
 *     days later as freshly generated occurrences quietly reverting. A reload
 *     cannot reveal it either — the rows really are correct.
 *   - Template first makes that state unreachable. If the template write does
 *     not land, no occurrence has been touched, so "nothing was saved" is a
 *     promise the caller can actually keep (and its reload snaps any
 *     optimistic patch back to DB truth).
 *
 * `prepare` runs ahead of both. It exists for the "this and future" scope,
 * where the days BEFORE the anchor have to be materialised while the template
 * still holds the pre-edit values — they are the days the user did not select,
 * and they only exist on demand.
 *
 * Nothing here talks to a service: every step is injected, which is what lets
 * the ordering be tested rather than re-derived at each call site.
 */

export type SeriesEditOutcome =
  | "ok"
  /** `prepare` reported it did not fully land — nothing after it ran. */
  | "prepare-failed"
  /** The template write did not land — NO occurrence was touched. */
  | "template-failed";

export interface SeriesEditSteps {
  /**
   * Optional pre-step that must complete against the PRE-edit template.
   * Resolve `false` to abort (a thrown error propagates to the caller, which
   * is the existing behaviour for these writes).
   */
  prepare?: () => Promise<boolean>;
  /** Write the template. Resolve `false` when it did not land. */
  writeTemplate: () => Promise<boolean>;
  /** Push the same change onto the already-materialised occurrences. */
  propagate: () => Promise<void>;
}

export async function runSeriesEdit(
  steps: SeriesEditSteps,
): Promise<SeriesEditOutcome> {
  if (steps.prepare) {
    const prepared = await steps.prepare();
    if (!prepared) return "prepare-failed";
  }
  const landed = await steps.writeTemplate();
  if (!landed) return "template-failed";
  await steps.propagate();
  return "ok";
}

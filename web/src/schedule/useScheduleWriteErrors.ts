import { useCallback } from "react";
import { useTranslation, type TranslationKey } from "@life-editor/shared";

/*
 * The Calendar host's failure toasts (#1642 P2, extracted from CalendarTab).
 *
 * Three writes report their own failure through the host rather than through
 * the Provider: the note the creation panel attaches, the repeat writes, and
 * the duplicate. Each one lands after the surface that started it has closed,
 * so a toast is the only place left to say it. They live together because
 * they are one decision — which sentence a failure gets — and the host only
 * has to hand each writer the function that says it.
 */

/** Every way a repeat write can fail to land (see useRepeatMutations). */
export type RepeatFailureReason =
  | "attach"
  | "materialise"
  | "update"
  | "series"
  | "series-partial"
  | "delete"
  | "delete-future"
  | "detach";

/*
 * What each repeat-write failure says (#434 → #469 → #504). A table rather
 * than a nested ternary: the reasons only ever grow, and each new one has to
 * be given words deliberately — a chain quietly files the newcomer under
 * whatever sits in the final `else`, which is how a "nothing was saved" case
 * ends up telling the user their change went through.
 */
const REPEAT_FAILURE_COPY_KEY: Record<RepeatFailureReason, TranslationKey> = {
  attach: "scheduleScreen.repeatConvertFailed",
  materialise: "scheduleScreen.repeatMaterialiseFailed",
  update: "scheduleScreen.repeatUpdateFailed",
  series: "scheduleScreen.repeatSeriesUpdateFailed",
  // Deliberately NOT the same words as `series`: that one promises nothing
  // changed, and this one cannot — the rhythm from here on is already the new
  // one.
  "series-partial": "scheduleScreen.repeatSeriesPartialFailed",
  /*
   * #1642 P5 (N-02 / N-04): the series delete and the two splits. The
   * sidebar's delete already said "couldn't delete this repeat"; the scope
   * dialog's "all" said nothing, and neither split said anything at all. The
   * splits get their own words because they do not delete the same thing:
   * "this and following" drops days, the editor's "none" only stops the
   * repeat and keeps the event the user has open.
   */
  delete: "scheduleScreen.repeatDeleteFailed",
  "delete-future": "scheduleScreen.repeatDeleteFutureFailed",
  detach: "scheduleScreen.repeatDetachFailed",
};

export interface ScheduleWriteErrors {
  /** A note the creation panel could not attach (the row never landed). */
  handleAttachError: () => void;
  handleRepeatConvertError: (reason: RepeatFailureReason) => void;
  handleDuplicateError: () => void;
}

export function useScheduleWriteErrors(
  showToast: (kind: "danger", message: string) => void,
): ScheduleWriteErrors {
  const { t } = useTranslation();

  // #376: the link lands after the panel has closed, so a failure has to be
  // said out loud — there is nothing left on screen to show it.
  const handleAttachError = useCallback(
    () => showToast("danger", t("scheduleScreen.noteAttachFailed")),
    [showToast, t],
  );
  // #434: an Event→Repeats conversion that did not fully land. Without this
  // the editor just snaps back on the reload, which reads as the click having
  // been ignored. "materialise" is a partial success — the repeat is on, so
  // saying "couldn't turn on repeat" there would be a lie.
  // "update" (#469 小粒) is a THIRD outcome: the repeat was already on and
  // stays on — only the new rhythm failed to save — so neither of the other
  // two sentences fits.
  const handleRepeatConvertError = useCallback(
    (reason: RepeatFailureReason) =>
      showToast("danger", t(REPEAT_FAILURE_COPY_KEY[reason])),
    [showToast, t],
  );
  /*
   * #1642 W16 / K-10: a duplicate whose INSERT was refused. The mutation layer
   * has already taken the optimistic copy back off the grid by the time this
   * runs, so the sentence is about what did NOT happen, not about repairing
   * anything.
   */
  const handleDuplicateError = useCallback(
    () => showToast("danger", t("scheduleScreen.duplicateFailed")),
    [showToast, t],
  );

  return { handleAttachError, handleRepeatConvertError, handleDuplicateError };
}

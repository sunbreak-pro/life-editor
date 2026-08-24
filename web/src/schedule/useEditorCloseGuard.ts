import { useCallback, useRef } from "react";
import { useTranslation, type ConfirmRequest } from "@life-editor/shared";
import { decideUnsavedClose } from "./unsavedCloseGuard";

/*
 * The guard in front of every way OUT of the Calendar's event editor (#628 /
 * #998), extracted from CalendarTab by #889.
 *
 * #628: an unsaved draft must not disappear silently. The pane owns the draft,
 * so it reports the dirty flag here and the close affordances — Escape, the
 * backdrop, the sheet's close button — ask before they throw it away. A ref
 * rather than state: nothing on screen depends on it, and re-rendering the
 * whole calendar on every keystroke in the memo field would be a steep price
 * for a flag only event handlers read. The pane clears it on unmount, so a
 * closed editor can never leave a stale "dirty" behind.
 *
 * The DECISION itself stays in `decideUnsavedClose` (pinned in
 * web/tests/unsavedCloseGuard.test.ts, same arrangement as todoChipUndoWiring):
 * CalendarTab needs the whole Provider chain to render, so nothing reachable
 * only from inside it can be tested. What lives here is the half that could
 * not follow it out — the flag the decision reads, and the two different
 * things the two exits do with the answer.
 *
 * Those two exits are why this is a hook and not two call-site callbacks. They
 * ask the SAME question and treat the flag DIFFERENTLY (see
 * `requestDiscardKeepingFlag`), which is precisely the kind of near-miss that
 * survives review when the pair sits 50 lines apart in a 1,300-line host.
 *
 * A web host hook, not a shared one: it resolves its own copy with
 * `useTranslation()` (§6.4 allows the host side to; the "no useTranslation in
 * parts" rule is about `shared/src/components/`), the same line
 * `useScheduleCopy` already draws. `web/src/schedule/` is also where #675 /
 * #889 put every other piece pulled out of CalendarTab.
 *
 * Zero behaviour change (#889): the flag, the request literal and both
 * decisions are the code that stood inline in CalendarTab.
 */
export function useEditorCloseGuard(
  askConfirm: (request: ConfirmRequest) => Promise<boolean>,
) {
  const { t } = useTranslation();
  const dirtyRef = useRef(false);

  /** Wire to the pane's `onDirtyChange` — it is the only writer. */
  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  /*
   * The one question both exits ask. It was spelled out twice in CalendarTab,
   * character for character; one copy is what keeps a close and a convert from
   * ending up with two differently-worded discard dialogs about the same draft.
   */
  const askDiscard = useCallback(
    () =>
      askConfirm({
        message: t("common.unsavedCloseConfirm"),
        confirmLabel: t("common.discard"),
        cancelLabel: t("common.cancel"),
        // Throwing away typed-in work is the destructive answer here, even
        // though nothing is deleted from the database.
        danger: true,
      }),
    [askConfirm, t],
  );

  /*
   * #707: the answer is awaited now, so the surfaces cannot branch on a return
   * value any more — they hand in what closing MEANS for them (the overlay flag
   * on Desktop, the selection on narrow) and this runs it once the user has
   * agreed. Same guard, same two facts it protects (`decideUnsavedClose`); only
   * the question moved in-app.
   */
  const requestClose = useCallback(
    async (close: () => void) => {
      const decision = await decideUnsavedClose({
        dirty: dirtyRef.current,
        askDiscard,
      });
      if (decision.clearDirty) dirtyRef.current = false;
      if (decision.close) close();
    },
    [askDiscard],
  );

  /*
   * #998: the narrow sheet's convert entry runs the same unsaved-draft guard as
   * the close — with one difference that matters. The pending flag is NOT
   * cleared on an agreed discard: the conversion asks its OWN question next
   * (the routine refusal, or the confirm), and a refusal there leaves the draft
   * on screen. With the flag already wiped, the next exit would throw it away
   * without asking. Same reasoning as ScheduleTodoDetail's requestClose (#736).
   *
   * So `decision.clearDirty` is deliberately dropped on the floor here, and the
   * caller gets the go/no-go alone. Reading the flag is the whole reason this
   * cannot be assembled from `requestClose` at the call site.
   */
  const requestDiscardKeepingFlag = useCallback(async () => {
    const decision = await decideUnsavedClose({
      dirty: dirtyRef.current,
      askDiscard,
    });
    return decision.close;
  }, [askDiscard]);

  return { onDirtyChange, requestClose, requestDiscardKeepingFlag };
}

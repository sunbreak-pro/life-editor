import { useCallback, useEffect, useRef, useState } from "react";
import {
  ItemConversionError,
  logServiceError,
  todayCalendarKey,
  todoToEventBlock,
  todoToEventPlacement,
  useConfirmDialog,
  useInFlightGuard,
  useTranslation,
  useUnsavedDraft,
  type DataService,
  type TodoNode,
  type useTodoTreeContext,
} from "@life-editor/shared";
// Section-agnostic despite living under schedule/ (#628 → #707 → #736): the two
// facts it pins — never ask when nothing is pending, never treat a pending
// promise as a "yes" — hold for any editor whose only commit is a button.
import { decideUnsavedClose } from "../schedule/unsavedCloseGuard";
// The todo detail's delete question is one behaviour on two screens, and the
// count it names has to agree wherever it is asked. #790 moved it out of
// schedule/ (where #775 wrote it) into a host-neutral home, so this is no
// longer a reach across the section boundary.
import { confirmTodoDetailDelete } from "../shared/todoTrayDeleteGuard";
import { type useTodoDetailTarget } from "./useTodoDetailTarget";

interface UseTodoDetailActionsArgs {
  tree: ReturnType<typeof useTodoTreeContext>;
  /** Which todo's detail is open, and the sheet that shows it on narrow. */
  detail: ReturnType<typeof useTodoDetailTarget>;
  isWide: boolean;
  /** The Desktop shell around the detail — closed alongside it (#789). */
  rightSidebar: { close: () => void };
  /** Absent = link + convert features are off (§3.1). */
  dataService?: DataService;
}

/*
 * Everything the todo detail can DO from the Kanban host, and the questions
 * each act has to ask first (#736 / #625 / #786 / #789 / #753). Pulled out of
 * KanbanView in #896 — the board's own concerns are grouping and columns, and
 * these four exits kept over 200 lines of guard logic in the same function.
 *
 * They are one hook rather than four because they share the SAME confirm
 * dialog and the same pending-draft ref: a delete that asked through a second
 * dialog instance could end up stacked over the discard question, and a convert
 * that read its own copy of the dirty flag would drift from the one the panel
 * writes.
 */
export function useTodoDetailActions({
  tree,
  detail,
  isWide,
  rightSidebar,
  dataService,
}: UseTodoDetailActionsArgs) {
  const { t } = useTranslation();
  // The board's own failure surface: an alert banner rather than a toast. It
  // auto-dismisses on the same 4s timer, and it keeps the board renderable
  // without the shell's Toast Provider — which is how every test mounts it.
  const [moveError, setMoveError] = useState<string | null>(null);

  // Auto-dismiss the rejection alert so it doesn't linger past the next action.
  useEffect(() => {
    if (!moveError) return;
    const id = setTimeout(() => setMoveError(null), 4000);
    return () => clearTimeout(id);
  }, [moveError]);

  /*
   * #736: since the press became the only commit, walking away from the detail
   * is a DISCARD — so it has to be asked about. `onDirtyChange` had been on the
   * panel since #628's contract but no host read it, which is exactly how a
   * typed title could vanish without a word.
   *
   * The question is the in-app <ConfirmDialog> (#707), never the browser's own
   * confirm: the native one lands outside the theme and freezes the page hard
   * enough to stall Playwright. Its answer arrives a tick later, hence
   * `decideUnsavedClose` — a guard that read the pending promise as a truthy
   * "yes" would throw the draft away the moment the dialog opened.
   *
   * The flag is deliberately NOT cleared on an agreed discard: the panel owns
   * it and re-reports `false` as it unmounts, so clearing here could only ever
   * be wrong. The convert path below asks its own question afterwards, and a
   * refusal there leaves the draft on screen — with a flag already wiped, the
   * NEXT exit would discard it in silence, having just promised not to.
   */
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
  const detailDirtyRef = useRef(false);
  /*
   * #753: the same pending draft, declared to the SHELL. The exits below are
   * the ones this view can see; closing the right sidebar and switching
   * sections are not — both remove the container, and the panel just stops
   * existing. The probe is the same ref read live, so a refused discard leaves
   * it pending and the next attempt asks again (nothing is cached up there
   * either — the reason #745's hosts could not apply `clearDirty`).
   */
  useUnsavedDraft(useCallback(() => detailDirtyRef.current, []));
  const requestDetailClose = useCallback(
    async (proceed: () => void) => {
      const decision = await decideUnsavedClose({
        dirty: detailDirtyRef.current,
        askDiscard: () =>
          askConfirm({
            message: t("common.unsavedCloseConfirm"),
            confirmLabel: t("common.discard"),
            cancelLabel: t("common.cancel"),
            // Throwing away typed-in work is the destructive answer here, even
            // though nothing is deleted from the database.
            danger: true,
          }),
      });
      if (decision.close) proceed();
    },
    [askConfirm, t],
  );

  /*
   * #789: the panel's teardown, for the two exits that remove the row itself
   * (delete and convert). Clearing the selection empties the portal, but the
   * sidebar SHELL has its own open state and survives that — leaving a column
   * of "nothing selected" up to 560px wide next to a board the user just took
   * a row off. Narrow keeps its own path: there the detail is the BottomSheet,
   * and the shell is already held closed by the isWide effect in the view.
   *
   * One helper rather than the line twice: the two exits drifting apart is the
   * shape of this bug (delete gained the close, convert kept the empty shell),
   * and the only way for them to disagree now is for someone to stop calling
   * this.
   */
  const closeDetailShell = useCallback(() => {
    tree.setSelectedTodoId(null);
    if (isWide) rightSidebar.close();
  }, [tree, isWide, rightSidebar]);

  /*
   * #625: "予定に変換" — the board's half of the Event <-> Todo pair.
   *
   * The write re-roles the row (id kept), so the todo simply leaves this board
   * and appears on the calendar. `refetch` is what makes that visible here:
   * the conversion goes through the DataService, not through this provider's
   * own persist path, so nothing else tells the tree its row is gone.
   *
   * A todo WITH CHILDREN is refused (D-20260810-sched-4) — 0009's composite FK
   * (parent_item_id, parent_item_role='task') would reject the role change
   * anyway, and a sentence beats an FK error. The guard is per-id and claimed
   * synchronously the moment the answer arrives (#434): question + async write
   * is exactly the window a second click lands in.
   *
   * #781: both the refusal and the question are the in-app <ConfirmDialog> the
   * rest of this flow already uses — the same pair the Schedule side asks
   * through. The refusal carries no cancel label: a "no, and here is why" has
   * nothing for the user to decide, so a second button would invent a choice.
   * Their answers arrive a tick later, so what used to be straight-line code
   * continues in a `.then`.
   *
   * On narrow the sheet is closed before the banner is set, because the banner
   * sits UNDER it and a message the user cannot see is the same as no message.
   */
  const { begin: beginConvert, end: endConvert } = useInFlightGuard();
  const handleConvertToEvent = useCallback(
    (todo: TodoNode) => {
      if (!dataService) return;
      const blocked = todoToEventBlock(tree.nodes, todo.id);
      if (blocked) {
        void askConfirm({
          message: t("itemConvert.childrenBlocked", {
            title: blocked.title,
            count: blocked.childCount,
          }),
          confirmLabel: t("common.ok"),
        });
        return;
      }
      void askConfirm({
        // A child Todo loses its parent link (events have no hierarchy), and
        // the dialog is the only place that can say so before it happens.
        message: t(
          todo.parentId != null
            ? "itemConvert.toEventConfirmChild"
            : "itemConvert.toEventConfirm",
          { title: todo.title || t("common.untitled") },
        ),
        confirmLabel: t("itemConvert.toEvent"),
        cancelLabel: t("common.cancel"),
      }).then((ok) => {
        if (!ok) return;
        if (!beginConvert(todo.id)) return;
        void dataService
          .convertTodoToEvent(
            todo.id,
            todoToEventPlacement(todo, todayCalendarKey()),
          )
          .then(() => {
            // The detail panel is showing a row that is no longer a todo; the
            // refetch drops it from the tree and the selection resolves to
            // null, and the shell that framed it goes with them (#789).
            closeDetailShell();
            void tree.refetch();
          })
          .catch((err) => {
            logServiceError(
              "ItemConversion",
              `convertTodoToEvent (${todo.id})`,
              err,
            );
            // The DB sees children the live tree cannot (trashed ones still
            // hold the 0009 FK), so that refusal gets its own sentence —
            // "conversion failed" would send the user looking for a network
            // problem.
            detail.closeSheet();
            setMoveError(
              err instanceof ItemConversionError && err.reason === "children"
                ? t("itemConvert.childrenBlockedServer")
                : t("itemConvert.failed"),
            );
          })
          .finally(() => endConvert(todo.id));
      });
    },
    [
      dataService,
      tree,
      detail,
      t,
      askConfirm,
      beginConvert,
      endConvert,
      closeDetailShell,
    ],
  );

  /*
   * #736: the detail's own convert button, guarded. A separate callback rather
   * than an inline arrow in the detail's props because the guard reads a ref,
   * and a ref read reached from render is what react-hooks/refs rejects.
   */
  const handleConvertFromDetail = useCallback(
    (todo: TodoNode) => {
      void requestDetailClose(() => handleConvertToEvent(todo));
    },
    [requestDetailClose, handleConvertToEvent],
  );

  /*
   * #786: delete the todo the detail is showing — the board's missing exit.
   * Every other surface could remove a todo (the Schedule tray, the day-view
   * chip, and #775's detail panel next door); the Todos board could only ever
   * add one, on Desktop AND in the narrow sheet, which #775 left behind because
   * this host never passed `onDelete`.
   *
   * The question is the in-app <ConfirmDialog> (#707), never the browser's own
   * confirm, and it is asked whatever the row is: the sheet is reached by a
   * deliberate tap, but a phone has no hover to reveal what a control does and
   * no keyboard undo behind it. A parent row gets the cascade sentence
   * instead — the count is the one thing the user cannot see from here, and the
   * shared guard is what keeps that number identical to the Schedule side's.
   *
   * Closed BEFORE the write, and deliberately NOT through `requestDetailClose`:
   * a pending title on a row being deleted is not something to rescue, and
   * asking twice for one act reads as a bug. The selection is cleared here as
   * well as inside softDelete — the panel is the host's surface, so what makes
   * it disappear should be visible here, not in an internal of the tree hook;
   * the wide shell around it closes on the same beat (#789, via
   * closeDetailShell). Undo is the same one every other delete raises
   * (softDelete → persistWithHistory), with Trash as the route that outlives
   * the section.
   */
  const handleDeleteFromDetail = useCallback(
    (id: string) => {
      void confirmTodoDetailDelete(tree.nodes, id, askConfirm, {
        confirm: (name) => t("todoDetail.todoDeleteConfirm", { name }),
        cascadeConfirm: (name, count) =>
          t("todoDetail.todoDeleteCascadeConfirm", { name, count }),
        untitled: t("common.untitled"),
        confirmLabel: t("todoDetail.delete"),
        cancelLabel: t("common.cancel"),
      }).then((ok) => {
        if (!ok) return;
        detail.closeSheet();
        closeDetailShell();
        tree.softDelete(id);
      });
    },
    [tree, detail, askConfirm, t, closeDetailShell],
  );

  return {
    moveError,
    setMoveError,
    confirmRequest,
    resolveConfirm,
    detailDirtyRef,
    requestDetailClose,
    handleConvertFromDetail,
    handleDeleteFromDetail,
  };
}

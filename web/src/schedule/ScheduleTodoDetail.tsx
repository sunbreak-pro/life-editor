import { useCallback, useRef } from "react";
import {
  ItemRoleBadge,
  ResponsiveDetailFrame,
  STATUS_TEXT_KEY,
  TodoDetailPanel,
  TodoStatusChoices,
  todoScheduleSlot,
  useTranslation,
  type ConfirmRequest,
  type TodoNode,
  type TodoStatus,
  type UpdateNodeOptions,
} from "@life-editor/shared";
import { TagPicker } from "../wikitag/TagPicker";
import { LazyRichTextEditor } from "../notes/LazyRichTextEditor";
import { decideUnsavedClose } from "./unsavedCloseGuard";
import { formatTodoSchedule } from "./scheduleCopy";
import { useScheduleRoleLabels } from "./scheduleRoleLabels";
import { TodoBodyDraft } from "./TodoBodyDraft";
import { type useTodoLinking } from "./useTodoLinking";

/*
 * #626 / #761 / #889 — the Schedule section's own todo detail surface.
 *
 * Deliberately NOT EventEditorPane: that pane edits a schedule_item and a todo
 * has none (#564), so the todo counterpart is TodoDetailPanel + TagPicker.
 *
 * #1153 made it the ONLY todo detail in the app. The Todo tab it used to hand
 * off to ("open in Todos", the #564 escape hatch) is retired, so the two things
 * that lived only over there had to come here rather than be lost: the body
 * editor and its "[[" wiring. That is what the TodoBodyDraft wrapper and the
 * `linking` prop below are — lifted verbatim out of the board's
 * TodoDetailContent, which is gone with it.
 *
 * What that changes about this surface: the save press now carries title AND
 * body (#713 — one write, because two would race each other through the same
 * row), and the panel's dirty flag folds in the body's, so the unsaved guard
 * below covers typing in either half.
 *
 * One body, framed by width: the Desktop overlay and the Mobile sheet
 * (<ResponsiveDetailFrame>). #761 gave narrow the same panel because a todo row
 * in the Mobile day list had no detail surface at all — the tap was dropped
 * before it could ask for one (itemTapRoute) — so the row read as broken next
 * to an event that opens.
 *
 * Why the surface owns its own unsaved-changes guard (#736): the panel commits
 * on its own save button, and every way out of it tears the panel down with the
 * draft inside. Two of them now — the frame's onClose (Escape, the backdrop,
 * the close button) and the convert-to-event button; the third, the "open in
 * Todos" hand-off, retired with the board it handed off to (#1153). Both live
 * here, which is the reason the ref and the guard came along with the body
 * rather than staying in CalendarTab: a third exit added later has the guard
 * sitting next to it instead of a file away.
 *
 * i18n is resolved here rather than injected — this is a web host module that
 * arranges shared parts (§6.4), the same call `scheduleCopy.ts` makes next door.
 */

export interface ScheduleTodoDetailProps {
  /** null = closed. The id of a TODO, not of a calendar chip (#564). */
  todoId: string | null;
  /** Live tree — a todo deleted elsewhere while open simply closes the frame. */
  todoNodes: TodoNode[];
  isWide: boolean;
  /** Drops the selection without asking. Used once the guard has agreed. */
  onClose: () => void;
  writes: {
    updateNode: (
      id: string,
      updates: Partial<TodoNode>,
      options?: UpdateNodeOptions,
    ) => void;
    toggleStatus: (id: string) => void;
    /** Fires raw — the confirm, the cascade count and the close are its own. */
    onDelete: (id: string) => void;
    /**
     * Set an exact status (#1153). Narrow gets the two-choice touch row rather
     * than the Desktop cycle button, the same split #470 gave the board — and
     * a toggle cannot express "put it back to not-started" from a row whose
     * buttons each name one value.
     */
    setStatus: (id: string, status: TodoStatus) => void;
  };
  /** #625: the same convert the chip bubble offers. */
  onConvertToEvent: (id: string) => void;
  /** "[[" wiring for the body editor (#507), from useTodoLinking. */
  linking: ReturnType<typeof useTodoLinking>;
  /** Where a "[[" link in the body goes. Absent = clicks are inert. */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /** #707: asks in-app rather than through window.confirm. */
  askConfirm: (request: ConfirmRequest) => Promise<boolean>;
}

export function ScheduleTodoDetail({
  todoId,
  todoNodes,
  isWide,
  onClose,
  writes,
  onConvertToEvent,
  linking,
  onNavigateToItem,
  askConfirm,
}: ScheduleTodoDetailProps) {
  const { t, i18n } = useTranslation();
  const roleLabels = useScheduleRoleLabels();
  const todo =
    todoId != null ? (todoNodes.find((n) => n.id === todoId) ?? null) : null;

  /*
   * The flag is NOT cleared on an agreed discard (unlike the event editor):
   * the panel is its only owner and re-reports `false` the moment it unmounts,
   * so clearing here could only ever be wrong — the convert path asks its OWN
   * question afterwards, and a refusal there would leave the draft on screen
   * with the flag already wiped.
   */
  const dirtyRef = useRef(false);
  const requestClose = useCallback(
    async (proceed: () => void) => {
      const decision = await decideUnsavedClose({
        dirty: dirtyRef.current,
        askDiscard: () =>
          askConfirm({
            message: t("common.unsavedCloseConfirm"),
            confirmLabel: t("common.discard"),
            cancelLabel: t("common.cancel"),
            danger: true,
          }),
      });
      if (decision.close) proceed();
    },
    [askConfirm, t],
  );

  const body = todo && (
    <div className="flex flex-col gap-3">
      {/* Keyed on the todo: the draft belongs to the todo it was typed against,
          and to this opening of it. Closing without saving unmounts this, so
          reopening the same todo cannot find yesterday's typing still pending
          — which is the whole discard story, without a close path having to
          remember to clear anything. */}
      <TodoBodyDraft
        key={todo.id}
        onSave={(id, patch, content) => {
          const updates = {
            ...patch,
            ...(content !== undefined ? { content } : {}),
          };
          // The panel's contract allows an empty patch, and writing one would
          // raise a no-op undo entry.
          if (Object.keys(updates).length === 0) return;
          writes.updateNode(id, updates, { undoLabel: "todoTreeChange" });
          // #372: drop inline-origin edges whose "[[ ]]" left the text. The
          // press is where the body lands, so it rides that.
          if (content !== undefined) linking.handleBodySaved(id, content);
        }}
      >
        {(draft) => (
          <TodoDetailPanel
            // #995: narrow only — see the prop's doc on TodoDetailPanelProps.
            stickyFooter={!isWide}
            todoId={todo.id}
            title={todo.title}
            status={todo.status}
            onSave={draft.onSave}
            // #736: title AND body, folded in before the panel reports, so the
            // guard below covers typing in either half.
            contentDirty={draft.dirty}
            onToggleStatus={writes.toggleStatus}
            // #470: the touch row replaces the cycle button on narrow, where
            // this sheet is the only way into a todo.
            statusControl={
              isWide ? undefined : (
                <TodoStatusChoices
                  value={todo.status ?? "NOT_STARTED"}
                  onChange={(status) => writes.setStatus(todo.id, status)}
                  labels={{
                    statusNotStarted: t("todoDetail.statusNotStarted"),
                    statusDone: t("todoDetail.statusDone"),
                  }}
                  label={t("materials.todos.statusGroupLabel")}
                />
              )
            }
            // #775: the panel's own delete, so the sheet that is Mobile's only
            // way into a todo is not a one-way door.
            onDelete={writes.onDelete}
            titleLabel={t("todoDetail.titleLabel")}
            statusLabel={t("todoDetail.status")}
            statusText={t(STATUS_TEXT_KEY[todo.status ?? "NOT_STARTED"])}
            contentLabel={t("todoDetail.content")}
            saveLabel={t("todoDetail.save")}
            savedLabel={t("todoDetail.saved")}
            unsavedLabel={t("todoDetail.unsaved")}
            deleteLabel={t("todoDetail.todoDelete")}
            // #877: which day the todo is set for. This sheet names the title,
            // the status and the tags; without this it stayed silent about the
            // one field that decides where the row appears, so a todo pulled up
            // from a list could not answer "is this today's?". Read from the
            // same helper the chips are built from (todoScheduleSlot), so the
            // row and the chip cannot disagree.
            // #1040: folded unless this todo actually has one.
            scheduleSet={todoScheduleSlot(todo) != null}
            scheduleLabel={t("todoDetail.schedule")}
            scheduleText={formatTodoSchedule(
              i18n.language,
              todoScheduleSlot(todo),
              {
                allDay: t("scheduleScreen.allDay"),
                unscheduled: t("todoDetail.scheduleNone"),
              },
            )}
            // #736: the panel reports its pending state here; the exits below
            // read the flag before they tear the panel down. A ref rather than
            // state — nothing on screen depends on it, and re-rendering on
            // every keystroke would be a steep price.
            onDirtyChange={(dirty) => {
              dirtyRef.current = dirty;
            }}
            // #1044: the kind is named ONCE, by the glyph in the frame's
            // header, so the tag row goes back to captioning itself 「タグ」.
            tagsSlot={<TagPicker itemId={todo.id} showLabel size="sm" />}
            contentEditor={
              <LazyRichTextEditor
                noteId={todo.id}
                initialContent={todo.content || undefined}
                // #713: draft, not auto-save. `onDraftChange` (instead of
                // `onUpdate`) switches this ONE editor off its 800ms debounce
                // and its unmount flush — Notes and Daily keep both. The
                // content is parked in TodoBodyDraft and written by the press.
                onDraftChange={draft.onDraftChange}
                // "[[" autocomplete + click navigation (#507). No create-note
                // row — like Daily, a todo body links to EXISTING items.
                loadLinkTargets={linking.loadLinkTargets}
                onNavigateToItem={onNavigateToItem}
                onResolvedLinkInserted={(targetId) =>
                  linking.handleResolvedLinkInserted(todo.id, targetId)
                }
              />
            }
          />
        )}
      </TodoBodyDraft>
      {/* #625: the panel is the surface a user reaches for when the todo turns
          out to be an appointment, so the action has to be here too — and this
          one closes the frame itself, since the row it is showing changes role
          out from under it. #736: which is why a pending draft has to be asked
          about FIRST — the conversion unmounts the panel, and the typing would
          go with it without a word. */}
      <button
        type="button"
        onClick={() => {
          void requestClose(() => onConvertToEvent(todo.id));
        }}
        className="self-start rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {t("itemConvert.toEvent")}
      </button>
    </div>
  );

  return (
    <ResponsiveDetailFrame
      wide={isWide}
      open={!!todo}
      title={t("materials.todos.detailTitle")}
      // #1044: the kind, as a glyph, where the frame names the surface —
      // replacing the word the tag row used to caption itself with.
      titleIcon={<ItemRoleBadge role="task" labels={roleLabels} compact />}
      closeLabel={t("common.close")}
      // #736: every exit from the panel funnels through the one guard.
      onClose={() => {
        void requestClose(onClose);
      }}
    >
      {body}
    </ResponsiveDetailFrame>
  );
}

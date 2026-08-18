import { useCallback, useRef } from "react";
import {
  ItemRoleBadge,
  ResponsiveDetailFrame,
  STATUS_TEXT_KEY,
  TodoDetailPanel,
  todoScheduleSlot,
  useTranslation,
  type ConfirmRequest,
  type TodoNode,
  type UpdateNodeOptions,
} from "@life-editor/shared";
import { TagPicker } from "../wikitag/TagPicker";
import { decideUnsavedClose } from "./unsavedCloseGuard";
import { formatTodoSchedule } from "./scheduleCopy";
import { useScheduleRoleLabels } from "./scheduleRoleLabels";

/*
 * #626 / #761 / #889 — the Schedule section's own todo detail surface.
 *
 * Deliberately NOT EventEditorPane: that pane edits a schedule_item and a todo
 * has none (#564), so the todo counterpart is the panel the Todos section
 * already trusts (TodoDetailPanel + TagPicker, the same pair Kanban renders).
 * Tags are editable in place; the #564 hand-off survives as the button at the
 * bottom, for anything deeper.
 *
 * One body, framed by width: the Desktop overlay and the Mobile sheet
 * (<ResponsiveDetailFrame>). #761 gave narrow the same panel because a todo row
 * in the Mobile day list had no detail surface at all — the tap was dropped
 * before it could ask for one (itemTapRoute) — so the row read as broken next
 * to an event that opens.
 *
 * Why the surface owns its own unsaved-changes guard (#736): the panel commits
 * on its own save button, and there are THREE ways out of it — the frame's
 * onClose (Escape, the backdrop, the close button), the convert-to-event
 * button, and the "open in Todos" hand-off. Each tears the panel down and the
 * draft dies with it. All three live here, which is the reason the ref and the
 * guard came along with the body rather than staying in CalendarTab: a fourth
 * exit added later has the guard sitting next to it instead of a file away.
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
  };
  /** #625: the same convert the chip bubble offers. */
  onConvertToEvent: (id: string) => void;
  /** The #564 hand-off out of the section entirely. */
  onOpenTodos: () => void;
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
  onOpenTodos,
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
      <TodoDetailPanel
        todoId={todo.id}
        title={todo.title}
        status={todo.status}
        // #713: the same save button Todos now has. No content editor on this
        // surface (the body stays in Todos), so the press only ever carries the
        // title — but the panel's contract allows an empty patch, and writing
        // one would raise a no-op undo entry.
        onSave={(id, patch) => {
          if (patch.title === undefined) return;
          writes.updateNode(id, patch, { undoLabel: "todoTreeChange" });
        }}
        onToggleStatus={writes.toggleStatus}
        // #775: the panel's own delete, so the sheet that is Mobile's only way
        // into a todo is not a one-way door.
        onDelete={writes.onDelete}
        titleLabel={t("todoDetail.titleLabel")}
        statusLabel={t("todoDetail.status")}
        statusText={t(STATUS_TEXT_KEY[todo.status ?? "NOT_STARTED"])}
        saveLabel={t("todoDetail.save")}
        savedLabel={t("todoDetail.saved")}
        unsavedLabel={t("todoDetail.unsaved")}
        deleteLabel={t("todoDetail.todoDelete")}
        // #877: which day the todo is set for. On narrow this sheet is the only
        // way into a todo, and it named the title, the status and the tags
        // while staying silent about the one field that decides where the row
        // appears — so a todo pulled up from the day list could not answer "is
        // this today's?". Read from the same helper the chips are built from
        // (todoScheduleSlot), so the row and the chip cannot disagree.
        // #1040: folded unless this todo actually has one. Same helper the
        // text below is formatted from, so the fold and the row can't disagree
        // about whether there is a date.
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
        // #736: the panel reports its pending title here; the three exits below
        // read the flag before they tear the panel down. A ref rather than
        // state — nothing on screen depends on it, and re-rendering on every
        // keystroke would be a steep price.
        onDirtyChange={(dirty) => {
          dirtyRef.current = dirty;
        }}
        // #1044: the kind is named ONCE, by the glyph in the frame's header,
        // so the tag row goes back to captioning itself 「タグ」 — passing
        // `itemRole` here would print a second 「Todo」 two rows below the first.
        tagsSlot={<TagPicker itemId={todo.id} showLabel size="sm" />}
      />
      {/* #625: the panel is the surface a user reaches for when the todo turns
          out to be an appointment, so the action has to be here too — and this
          one closes the frame itself, since the row it is showing changes role
          out from under it. #736: which is why a pending title has to be asked
          about FIRST — the conversion unmounts the panel, and the draft would
          go with it without a word. */}
      <button
        type="button"
        onClick={() => {
          void requestClose(() => onConvertToEvent(todo.id));
        }}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {t("itemConvert.toEvent")}
      </button>
      {/* #736: the hand-off leaves the section entirely, so it is a close like
          any other as far as a pending title is concerned. */}
      <button
        type="button"
        onClick={() => {
          void requestClose(() => {
            onClose();
            onOpenTodos();
          });
        }}
        className="rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {t("scheduleScreen.todoOpenInTodos")}
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

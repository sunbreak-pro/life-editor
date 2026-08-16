import { type ReactNode, type RefObject } from "react";
import {
  STATUS_TEXT_KEY,
  TodoDetailPanel,
  type TodoDetailPatch,
  type TodoNode,
  useTranslation,
} from "@life-editor/shared";
import { TodoBodyDraft } from "./TodoBodyDraft";
import { type useTodoLinking } from "./hooks/useTodoLinking";
import { RichTextEditor } from "../notes/RichTextEditor";
import { TagPicker } from "../wikitag/TagPicker";

export interface TodoDetailContentProps {
  todo: TodoNode;
  /**
   * Narrow only (#470): the touch status row shown in place of the Desktop
   * cycle button. Absent on the wide board, where the panel's own button is
   * what the pointer has.
   */
  statusControl?: ReactNode;
  /** One press = title patch + whatever the body editor was holding (#713). */
  onSaveDetail: (id: string, patch: TodoDetailPatch, content?: string) => void;
  /**
   * #736: the host's live "is something pending" flag, written straight into a
   * ref. A ref rather than state — nothing on screen depends on it, and
   * re-rendering every column on each keystroke would be a steep price for a
   * flag only handlers read.
   */
  dirtyRef: RefObject<boolean>;
  onToggleStatus: (id: string) => void;
  /** #786: fires RAW — the confirm, the close and the write live in the host. */
  onDelete: (id: string) => void;
  /** #625 / #736: guarded convert. Absent = no DataService, so no convert row. */
  onConvert?: (todo: TodoNode) => void;
  /** "[[" wiring for the body editor (#507), from useTodoLinking. */
  loadLinkTargets: ReturnType<typeof useTodoLinking>["loadLinkTargets"];
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  onResolvedLinkInserted: (todoId: string, targetId: string) => void;
}

/*
 * One panel, two surfaces (#896 pulled it out of KanbanView, where it was a
 * render helper). Everything except the status control is identical between the
 * Desktop rightSidebar and the narrow bottom sheet, so building it once keeps a
 * field added to the todo detail from reaching only one width.
 *
 * Tag row (#412 Phase 1). Was a read-only chip list built by the host from
 * tagsByTodo; it is now the same <TagPicker> the note detail uses, so a todo
 * can gain and lose tags from the surface the user is already reading. The
 * picker owns its own row caption (the shared kind badge, itemRole="task"),
 * which is why no `tagsLabel` is passed: TodoDetailPanel's generic "TAGS"
 * caption plus the badge would say the same thing twice.
 *
 * Always rendered (not conditional on the todo having tags): an empty row is
 * the only place the "+ Tag" affordance can live, and without it a todo with
 * no tags would have no route to its first one.
 */
export function TodoDetailContent({
  todo,
  statusControl,
  onSaveDetail,
  dirtyRef,
  onToggleStatus,
  onDelete,
  onConvert,
  loadLinkTargets,
  onNavigateToItem,
  onResolvedLinkInserted,
}: TodoDetailContentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    // #625: the convert action sits BELOW the panel rather than inside it, so
    // TodoDetailPanel (shared, and rendered by Schedule too) keeps its current
    // shape. Same wrapper the Schedule todo overlay uses for its own button.
    <div className="flex flex-col gap-3">
      {/* Keyed on the todo: the body draft below belongs to the todo it was
          typed against, and to this opening of it. */}
      <TodoBodyDraft key={todo.id} onSave={onSaveDetail}>
        {(draft) => (
          <TodoDetailPanel
            todoId={todo.id}
            title={todo.title}
            status={todo.status}
            onSave={draft.onSave}
            contentDirty={draft.dirty}
            // #736: title AND body, since `contentDirty` is folded in before
            // the panel reports.
            onDirtyChange={(dirty) => {
              dirtyRef.current = dirty;
            }}
            onToggleStatus={onToggleStatus}
            // #786: paired with `deleteLabel` — the shared panel draws the row
            // only when both are present, so this is the one place either
            // surface gains a delete.
            onDelete={onDelete}
            deleteLabel={t("todoDetail.todoDelete")}
            statusControl={statusControl}
            titleLabel={t("todoDetail.titleLabel")}
            statusLabel={t("todoDetail.status")}
            statusText={t(STATUS_TEXT_KEY[todo.status ?? "NOT_STARTED"])}
            contentLabel={t("todoDetail.content")}
            saveLabel={t("todoDetail.save")}
            savedLabel={t("todoDetail.saved")}
            unsavedLabel={t("todoDetail.unsaved")}
            tagsSlot={
              <TagPicker itemId={todo.id} itemRole="task" showLabel size="sm" />
            }
            contentEditor={
              <RichTextEditor
                noteId={todo.id}
                initialContent={todo.content || undefined}
                // #713: draft, not auto-save. `onDraftChange` (instead of
                // `onUpdate`) switches this ONE editor off its 800ms debounce
                // and its unmount flush — Notes and Daily keep both. The
                // content is parked in TodoBodyDraft and written by the press.
                onDraftChange={draft.onDraftChange}
                // "[[" autocomplete + click navigation (#507). Same three props
                // the Notes and Daily editors take; this editor simply never
                // got them, so the menu never opened and a resolved link was
                // inert. No create-note row — like Daily, a todo body links to
                // EXISTING items.
                loadLinkTargets={loadLinkTargets}
                onNavigateToItem={onNavigateToItem}
                onResolvedLinkInserted={(targetId) =>
                  onResolvedLinkInserted(todo.id, targetId)
                }
              />
            }
          />
        )}
      </TodoBodyDraft>
      {onConvert && (
        // #736: the conversion clears the selection, which unmounts this whole
        // subtree — draft included. Before #713 the blur flush had already
        // written the new title, so it rode along; now it has to be asked about
        // first, or the user watches their typing disappear into an event.
        <button
          type="button"
          onClick={() => onConvert(todo)}
          className="self-start rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          {t("itemConvert.toEvent")}
        </button>
      )}
    </div>
  );
}

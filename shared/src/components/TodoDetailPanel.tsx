import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";
import type { TodoStatus } from "../types/todoTree";
import { isImeComposing } from "../utils/imeGuard";
import { cn } from "./cn";
import { FOCUS_RING } from "./styleTokens";

/*
 * Todo detail panel (W7). The selected todo's detail, which the Kanban host
 * pushes into the shared rightSidebar via <RightSidebarPortal> (the W6
 * MasterDetail two-pane part was retired in code-reduction #346) on Desktop,
 * and into the MobileTodoList bottom sheet on Mobile (#470) — one panel, two
 * surfaces, so a field added here reaches both. Schedule renders the same panel
 * for a todo chip (#626), which is why the save model below has to be the
 * panel's own rather than either host's.
 * Pure presentation, DataService-free (§3.1): every
 * mutation is a callback the host injects (onSave / onToggleStatus),
 * the rich-text editor is injected as `contentEditor` (TipTap is a web
 * dependency and must not be pulled into shared), and all copy arrives as
 * already-translated props (§6.4 — no useTranslation here). lumen-* tokens
 * only; the panel container is opaque (§5).
 *
 * SAVE BUTTON (#713, Epic #627 段階 1 — ユーザー裁定 D-20260810-sched-1 = A).
 * The title used to persist on a 300ms debounce with a blur and unmount flush,
 * and the injected body editor on an 800ms one. Both wrote while the user was
 * still typing, and Schedule's own detail pane had already moved to a button
 * (#628) — so the same panel confirmed one way and the pane beside it another.
 * Now the title is a draft, the host reports the body's pending state through
 * `contentDirty`, and ONE press commits both: the panel sends its title patch
 * and the host folds in whatever the editor is holding, so a title + body edit
 * is a single write rather than two racing ones.
 *
 * Closing without the button discards, and that is the point — nothing is
 * written behind the user's back any more. It is not thrown away in silence
 * either (#736): the panel reports its pending state through `onDirtyChange`,
 * and both hosts ask before any exit that tears the panel down.
 *
 * DELETE (#775). Optional, and off unless the host passes BOTH `onDelete` and
 * `deleteLabel`: the panel serves three hosts and only Schedule's todo detail
 * wires one today — which is the surface that needed it, since on Mobile the
 * detail sheet is the only way into a todo at all. The affordance copies
 * <EventEditorPane>'s delete (danger text + Trash2, its own row above the save
 * footer): the two panels open from the same day list, and a user who has
 * deleted an event should recognise the control on a todo.
 *
 * It is deliberately NOT a second button in the save footer. That row is right
 * aligned and holds the one accent-filled control; a destructive action of the
 * same shape parked beside it is the classic mis-tap, and on a phone the thumb
 * arrives at the bottom-right corner first. So: opposite edge, opposite
 * treatment (borderless danger text, no fill), and a divider between.
 *
 * The panel does not ask before firing — the confirm belongs to the host, which
 * is the only side that knows what the delete drags along (the subtree cascade)
 * and how to put the question on screen (#707's in-app <ConfirmDialog>).
 *
 * Minimal scope (W7): title edit, status toggle, content edit. Heavier todo
 * fields (priority / schedule / reminders / tags) are out of scope. The status
 * toggle is NOT drafted (#713 対象外): it is a discrete act, not a field that
 * can be half-typed.
 */

// Status cue glyph — symbols, not copy, so they stay in the component
// (mirrors web TodoTreeView's STATUS_GLYPH). The textual label is injected.
const STATUS_GLYPH: Record<TodoStatus, string> = {
  NOT_STARTED: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

/** What one press of the save button changes (#713). */
export interface TodoDetailPatch {
  title?: string;
}

export interface TodoDetailPanelProps {
  /** Selected node id — also keys the draft, so a todo switch re-seeds it. */
  todoId: string;
  /** Current title (the draft sits on top of it). */
  title: string;
  /** Current status. */
  status?: TodoStatus;
  /**
   * Commit the pending draft (#713). Fires only from the save button (or Enter
   * in the title), carrying the title when it changed. The host writes it
   * together with whatever the injected content editor is holding — one press,
   * one update.
   */
  onSave: (id: string, patch: TodoDetailPatch) => void;
  /**
   * The injected content editor holds unsaved changes. The body draft lives in
   * the host (the editor is a web dependency), so the panel cannot see it —
   * without this the button would sit disabled while the body was pending, and
   * the only edit the user could not save would be the long one.
   */
  contentDirty?: boolean;
  /**
   * Report whether anything is pending, for hosts whose close affordances need
   * to ask before discarding (same contract as EventEditorPane's #628 flag).
   * Fires with `false` on unmount — which is what lets a host leave its own
   * flag alone on an agreed discard and still not go stale (#736).
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Cycle the todo status (host injects the toggle). */
  onToggleStatus?: (id: string) => void;
  /**
   * Soft-delete the todo (#775). Fires RAW: the host owns the confirm, the
   * cascade count and the close that follows. Rendered only together with
   * `deleteLabel`, so a host cannot ship the button without a name for it.
   */
  onDelete?: (id: string) => void;
  /**
   * Replaces the built-in cycle button with a host-supplied status control —
   * the touch <TodoStatusChoices> row on Mobile (#470). The caption still comes
   * from `statusLabel`, and the row stacks (caption above) so three choices get
   * the full width. Omitting it keeps the Desktop cycle button unchanged.
   */
  statusControl?: ReactNode;
  /** Injected rich-text editor (host wires key={todoId} for remount). */
  contentEditor?: ReactNode;
  /** Already-translated aria-label for the title input (§6.4). */
  titleLabel: string;
  /** Already-translated caption preceding the status control. */
  statusLabel: string;
  /** Already-translated label for the current status value. */
  statusText?: string;
  /** Already-translated caption above the content editor. */
  contentLabel?: string;
  /** Primary action — "保存" (#713). */
  saveLabel: string;
  /** Shown beside the button while nothing is pending — "保存済み". */
  savedLabel: string;
  /** Shown beside the button while a draft is pending — "未保存". */
  unsavedLabel: string;
  /** Already-translated name for the delete button (#775). Pair with
   *  `onDelete`; when either is absent the delete row is omitted. */
  deleteLabel?: string;
  /** Already-translated caption preceding the tag row (§6.4). Paired with
   *  `tagsSlot`; when either is absent the tag row is omitted. */
  tagsLabel?: string;
  /** Host-injected tag chips (e.g. the todo's assigned WikiTags). Additive —
   *  existing callers that omit it keep the original title/status/content
   *  layout unchanged. Rendered between the status row and the content editor. */
  tagsSlot?: ReactNode;
  className?: string;
}

const SAVE_BTN = cn(
  "rounded-md bg-lumen-accent px-3 py-1.5 text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover",
  FOCUS_RING,
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-lumen-accent",
);

/** Inner fields, keyed by todoId from the panel so a todo switch drops the
 *  pending edits cleanly (same arrangement as EventEditorPane). */
function TodoDetailFields({
  todoId,
  title,
  status,
  onSave,
  contentDirty = false,
  onDirtyChange,
  onToggleStatus,
  onDelete,
  statusControl,
  contentEditor,
  titleLabel,
  statusLabel,
  statusText,
  contentLabel,
  saveLabel,
  savedLabel,
  unsavedLabel,
  deleteLabel,
  tagsLabel,
  tagsSlot,
}: Omit<TodoDetailPanelProps, "className">) {
  // `undefined` = untouched, so the field keeps following the live todo and a
  // rename made elsewhere still lands in front of the user instead of being
  // quietly pushed back by a stale draft (EventEditorEdits, same reasoning).
  const [titleEdit, setTitleEdit] = useState<string | undefined>(undefined);
  const draftTitle = titleEdit ?? title;
  const titleDirty = titleEdit !== undefined && titleEdit !== title;
  const dirty = titleDirty || contentDirty;
  const resolvedStatus = status ?? "NOT_STARTED";

  // Same ref dance as EventEditorPane: the unmount report must not pin a stale
  // callback, and refreshing it in an effect (not during render) is what
  // react-hooks/refs asks for.
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  });
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  const save = () => {
    if (!dirty) return;
    // The host is told even when only the BODY moved: it is the one holding
    // that draft, and the press is the only signal it gets.
    onSave(todoId, titleDirty ? { title: draftTitle } : {});
  };

  const saveOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME guard: the Enter that CONFIRMS a Japanese conversion is not a save.
    // `isComposing` alone misses exactly that keypress on WebKit (#737) — the
    // shared helper is what knows both halves of the answer.
    if (e.key === "Enter" && !isImeComposing(e)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <>
      <input
        value={draftTitle}
        onChange={(e) => setTitleEdit(e.target.value)}
        onKeyDown={saveOnEnter}
        aria-label={titleLabel}
        className={cn(
          "w-full rounded-md border border-lumen-border bg-lumen-bg px-2 py-1.5 text-sm font-medium text-lumen-text",
          FOCUS_RING,
        )}
      />

      <div
        className={cn(
          "flex",
          // Both branches name their own gap: cn is a plain joiner (no
          // tailwind-merge), so a base "gap-2" would survive alongside
          // "gap-1.5" and the CSS output order — not the class order — would
          // pick the winner.
          statusControl
            ? "flex-col items-stretch gap-1.5"
            : "items-center gap-2",
        )}
      >
        <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
          {statusLabel}
        </span>
        {statusControl ?? (
          <button
            type="button"
            onClick={() => onToggleStatus?.(todoId)}
            aria-label={statusLabel}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-lumen-border px-2 py-1 text-sm text-lumen-text hover:bg-lumen-hover",
              FOCUS_RING,
            )}
          >
            <span aria-hidden className="text-lumen-text-secondary">
              {STATUS_GLYPH[resolvedStatus]}
            </span>
            <span>{statusText}</span>
          </button>
        )}
      </div>

      {tagsSlot != null && (
        <div className="flex items-center gap-2">
          {tagsLabel && (
            <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
              {tagsLabel}
            </span>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {tagsSlot}
          </div>
        </div>
      )}

      {contentEditor && (
        <div className="space-y-1">
          {contentLabel && (
            <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
              {contentLabel}
            </span>
          )}
          {contentEditor}
        </div>
      )}

      {/* Delete (#775) — its own row, left aligned, above the divider the save
          footer draws. Same idiom as EventEditorPane's delete on the screen
          next door, and deliberately the opposite of the save button in both
          position and weight so the two are never mistaken for each other.
          `w-fit`, not `self-start`: the panel container is a space-y block, not
          a flex row, so a bare `flex` button would stretch the full width and
          land right under the save button after all.
          min-h-lumen-tap-min is the project's hit-area floor (tokens.css) —
          the CSS `:has()` rule that applies it for free only reaches icon-ONLY
          buttons, and this one carries a label too. */}
      {onDelete && deleteLabel && (
        <button
          type="button"
          onClick={() => onDelete(todoId)}
          className={cn(
            "flex w-fit min-h-lumen-tap-min items-center gap-1.5 rounded-sm text-sm font-medium text-lumen-danger",
            FOCUS_RING,
          )}
        >
          <Trash2 aria-hidden className="size-3.5" />
          {deleteLabel}
        </button>
      )}

      {/* Save footer (#713) — the only commit. Disabled while there is nothing
          to write (#434 S-1), with the state spelled out beside it so "why can
          I not press this" has an answer on screen. */}
      <div className="flex items-center justify-end gap-3 border-t border-lumen-border pt-3">
        <span
          aria-live="polite"
          className={cn(
            "text-xs",
            dirty ? "text-lumen-accent" : "text-lumen-text-secondary",
          )}
        >
          {dirty ? unsavedLabel : savedLabel}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className={SAVE_BTN}
        >
          {saveLabel}
        </button>
      </div>
    </>
  );
}

export function TodoDetailPanel({ className, ...rest }: TodoDetailPanelProps) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-md border border-lumen-border bg-lumen-bg-secondary p-3",
        className,
      )}
    >
      {/* Keyed on the id: pending edits belong to the todo they were typed
          against, so switching todos drops them via a remount. The fragment
          adds no element, so the container's space-y still spaces the fields. */}
      <TodoDetailFields key={rest.todoId} {...rest} />
    </div>
  );
}

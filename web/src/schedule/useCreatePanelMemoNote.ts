import { useMemo } from "react";
import {
  useTranslation,
  type DataService,
  type ItemCreateNoteDraft,
  type ToastVariant,
  type UndoRedoLike,
} from "@life-editor/shared";
import { foldNoteReversals, type MemoNoteAttach } from "./useCreatePanelNotes";

/*
 * useCreatePanelMemoNote (#2402) — what 新規作成 in the creation panel needs
 * from its host: the copy, the attach, the one report, the jump to Notes, and
 * the todo's own undo entry. The create flow stays free of contexts and i18n
 * (useScheduleCreateFlow's header), so all of that arrives there as this one
 * object, and null means the host does not offer the behaviour.
 *
 * THE JUMP COMES LAST, once the note exists. Leaving unmounts this section, and
 * the Notes list is read when it mounts, so a jump made sooner would select a
 * note that read cannot find yet.
 *
 * THE TODO'S UNDO NAMES ITS ROW. The tree's own create entry writes back a
 * snapshot, so it dies with the provider (#1727) — the moment the jump lands.
 * The todo is therefore created with `skipUndo`, and the entry here reverses it
 * by id through the service, the way an event conversion does (useItemConversion).
 */

/** The panel's item kinds, as far as the copy cares. */
export type MemoNoteItemKind = "event" | "task";

/** One undo step, as the note attach and the repeat both resolve. */
interface Reversal {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export interface CreateFlowMemoNote {
  /** The name an item gets when its title field is empty. */
  untitled: (kind: MemoNoteItemKind) => string;
  /** The writes, for a row that exists. Never throws and reports nothing. */
  attach: (
    itemId: string,
    itemTitle: string,
    input: {
      notes: readonly ItemCreateNoteDraft[];
      noteTagIds: readonly string[];
      itemTagIds: readonly string[];
    },
  ) => Promise<MemoNoteAttach>;
  /** Parts as one undo step (null parts did not land), last on first off. */
  fold: (parts: readonly (Reversal | null)[]) => Reversal | null;
  /** Records the todo path's one undo entry. `createdTodoId` also goes back. */
  pushTodoUndo: (attach: MemoNoteAttach, createdTodoId: string | null) => void;
  /** Goes to the note and says how the press ended, exactly once. */
  land: (
    kind: MemoNoteItemKind,
    itemTitle: string,
    attach: MemoNoteAttach,
  ) => void;
  /** The press failed before anything could be attached. */
  fail: () => void;
}

type AttachMemoNote = (
  itemId: string,
  input: {
    title: string;
    notes: readonly ItemCreateNoteDraft[];
    noteTagIds: readonly string[];
    itemTagIds: readonly string[];
  },
) => Promise<MemoNoteAttach>;

export function useCreatePanelMemoNote({
  dataService,
  attachMemoNote,
  refetchTodos,
  push,
  onOpenNote,
  showToast,
}: {
  dataService: DataService;
  attachMemoNote: AttachMemoNote;
  refetchTodos: () => Promise<unknown> | void;
  push?: UndoRedoLike["push"];
  /** The shell's jump. Omitted, the host does not offer the behaviour at all. */
  onOpenNote?: (target: { id: string; role: string }) => void;
  showToast: (variant: ToastVariant, message: string) => void;
}): CreateFlowMemoNote | null {
  const { t } = useTranslation();
  return useMemo(() => {
    if (!onOpenNote) return null;
    const fail = () => showToast("danger", t("scheduleScreen.memoNoteFailed"));
    return {
      untitled: (kind) =>
        kind === "event"
          ? t("scheduleScreen.memoNoteUntitledEvent")
          : t("scheduleScreen.memoNoteUntitledTodo"),
      attach: (itemId, itemTitle, input) =>
        attachMemoNote(itemId, {
          ...input,
          title: t("scheduleScreen.memoNoteTitle", { title: itemTitle }),
        }),
      fold: (parts) =>
        foldNoteReversals(parts.filter((p): p is Reversal => p !== null)),
      pushTodoUndo: (attach, createdTodoId) => {
        const todo: Reversal | null = createdTodoId
          ? {
              undo: async () => {
                await dataService.softDeleteTodo(createdTodoId);
                await refetchTodos();
              },
              redo: async () => {
                await dataService.restoreTodo(createdTodoId);
                await refetchTodos();
              },
            }
          : null;
        // The todo first, so it is the last thing to go on the way back: the
        // link hangs off its row.
        const parts = [todo, attach.reversal].filter(
          (p): p is Reversal => p !== null,
        );
        const whole = foldNoteReversals(parts);
        if (whole) {
          push?.("scheduleItem", { label: "todoTreeChange", ...whole });
        }
      },
      land: (kind, itemTitle, attach) => {
        let ok = attach.ok;
        if (attach.noteId) {
          try {
            onOpenNote({ id: attach.noteId, role: "note" });
          } catch (e) {
            console.error("[Schedule] opening the memo note failed", e);
            ok = false;
          }
        }
        if (!ok) {
          fail();
          return;
        }
        showToast(
          "success",
          t(
            kind === "event"
              ? "scheduleScreen.memoNoteCreatedEvent"
              : "scheduleScreen.memoNoteCreatedTodo",
            { title: itemTitle },
          ),
        );
      },
      fail,
    };
  }, [
    dataService,
    attachMemoNote,
    refetchTodos,
    push,
    onOpenNote,
    showToast,
    t,
  ]);
}

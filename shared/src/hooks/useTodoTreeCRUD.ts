import { useCallback } from "react";
import type { TodoNode, TodoNodeType, TodoStatus } from "../types/todoTree";
import type { PersistSettled, TodoHistoryLabel } from "./useTodoTreeHistory";

export interface AddNodeOptions {
  scheduledAt?: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
  skipUndo?: boolean;
  /**
   * Called once the write has settled: the new node when its row reached the
   * DB, `null` when the sync failed or the guard dropped it (#376). `addNode`
   * returns the optimistic node synchronously, and a caller that has to write
   * something referencing that row (an item link — `wiki_tag_connections`
   * carries an FK to `items_meta`) must wait for this instead.
   */
  onSaved?: (saved: TodoNode | null) => void;
}

export interface UpdateNodeOptions {
  /**
   * #569: make THIS write undoable, under the given label.
   *
   * Opt-in rather than always-on, and that is the whole design. `updateNode` is
   * also how the Todos board saves a title / body as the user types
   * (KanbanView.tsx:447 / :463) — pushing a command per keystroke would bury
   * every other action in the app under a stack of half-typed words, which is
   * exactly why this path was silent to begin with. The Schedule gestures are
   * the opposite shape: one deliberate drag or button press that MOVES
   * something, where "that was wrong, put it back" is the obvious next thought.
   *
   * Callers pass this only for such a gesture; everything else keeps the old
   * silent persist.
   */
  undoLabel?: TodoHistoryLabel;
}

export function useTodoTreeCRUD(
  nodes: TodoNode[],
  persistWithHistory: (
    currentNodes: TodoNode[],
    updated: TodoNode[],
    onSettled?: PersistSettled,
    label?: TodoHistoryLabel,
  ) => void,
  persistSilent: (updated: TodoNode[], onSettled?: PersistSettled) => void,
  generateId: (type: TodoNodeType) => string,
) {
  const addNode = useCallback(
    (
      type: TodoNodeType,
      parentId: string | null,
      title: string,
      options?: AddNodeOptions,
    ) => {
      // life-tags S1 retired the default-folder behaviour and S3 (#225)
      // removed the folder node type entirely — a new node is always a todo
      // and keeps the caller's parent verbatim (subtask nesting still works).
      const siblings = nodes.filter(
        (n) => !n.isDeleted && n.parentId === parentId,
      );

      // Insert the new todo at the top of the incomplete group (order: 0),
      // shifting the existing incomplete siblings down by one.
      const shiftIds = new Set(
        siblings.filter((n) => n.status !== "DONE").map((n) => n.id),
      );
      const updatedNodes = nodes.map((n) =>
        shiftIds.has(n.id) ? { ...n, order: n.order + 1 } : n,
      );

      const newNode: TodoNode = {
        id: generateId(type),
        type,
        title,
        parentId,
        order: 0,
        status: "NOT_STARTED",
        createdAt: new Date().toISOString(),
        scheduledAt: options?.scheduledAt,
        scheduledEndAt: options?.scheduledEndAt,
        isAllDay: options?.isAllDay,
      };
      const onSaved = options?.onSaved;
      const onSettled = onSaved
        ? (ok: boolean) => onSaved(ok ? newNode : null)
        : undefined;
      if (options?.skipUndo) {
        persistSilent([...updatedNodes, newNode], onSettled);
      } else {
        persistWithHistory(nodes, [...updatedNodes, newNode], onSettled);
      }
      return newNode;
    },
    [nodes, persistWithHistory, persistSilent, generateId],
  );

  const updateNode = useCallback(
    (id: string, updates: Partial<TodoNode>, options?: UpdateNodeOptions) => {
      const updated = nodes.map((n) =>
        n.id === id ? { ...n, ...updates } : n,
      );
      const target = nodes.find((n) => n.id === id);
      // A write that changes nothing stays silent even when the caller asked
      // for undo. A drag released back on the slot it started from still
      // commits (WeekTimeGrid only checks that the pointer MOVED), and an entry
      // whose undo restores identical values would answer Ctrl+Z with a "元に
      // 戻しました" toast and no visible change — while quietly consuming the
      // press that was meant for the user's previous, real action.
      //
      // `!==` assumes PRIMITIVE fields, which is all the undoable callers touch
      // (scheduledAt / scheduledEndAt / isAllDay — strings and a boolean). Give
      // an undoLabel to a write carrying an object or array value and it counts
      // as changed every time, since a fresh literal never equals the stored
      // one; the failure mode is a redundant undo entry, not a lost write, so
      // this stays a note rather than a deep compare nothing needs yet.
      const changed =
        target != null &&
        (Object.keys(updates) as Array<keyof TodoNode>).some(
          (key) => target[key] !== updates[key],
        );
      if (options?.undoLabel && changed) {
        // No onSettled: nothing is chained to these writes, and forwarding one
        // would re-fire it on every redo (the #376 rule persistWithHistory
        // already keeps for its own callers).
        persistWithHistory(nodes, updated, undefined, options.undoLabel);
        return;
      }
      persistSilent(updated);
    },
    [nodes, persistWithHistory, persistSilent],
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      persistSilent(
        nodes.map((n) =>
          n.id === id ? { ...n, isExpanded: !n.isExpanded } : n,
        ),
      );
    },
    [nodes, persistSilent],
  );

  /**
   * Apply a status change. Sets status + completedAt and re-sorts the todo's
   * siblings so DONE items sink below the incomplete ones. life-tags S1 retired
   * the Complete-folder auto-management (folders no longer group todos; status
   * = DONE is the successor) — the todo keeps its parent verbatim, so subtask
   * hierarchy is untouched.
   */
  const applyStatusChange = useCallback(
    (id: string, newStatus: TodoStatus) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.type !== "task") return;
      if (target.status === newStatus) return;

      const targetParentId = target.parentId;
      const updatedTarget: TodoNode = {
        ...target,
        status: newStatus,
        completedAt:
          newStatus === "DONE" ? new Date().toISOString() : undefined,
      };

      // --- Reorder siblings in the SAME parent (DONE sinks to the bottom) ---
      const siblings = nodes
        .filter(
          (n) => !n.isDeleted && n.parentId === targetParentId && n.id !== id,
        )
        .sort((a, b) => a.order - b.order);

      const incomplete = siblings.filter((n) => n.status !== "DONE");
      const complete = siblings.filter((n) => n.status === "DONE");

      const reordered =
        newStatus === "DONE"
          ? [...incomplete, ...complete, updatedTarget]
          : [...incomplete, updatedTarget, ...complete];

      const orderMap = new Map<string, number>();
      reordered.forEach((n, i) => orderMap.set(n.id, i));

      const finalNodes = nodes.map((n) => {
        if (n.id === id)
          return {
            ...updatedTarget,
            order: orderMap.get(id) ?? updatedTarget.order,
          };
        if (orderMap.has(n.id)) return { ...n, order: orderMap.get(n.id)! };
        return n;
      });

      persistWithHistory(nodes, finalNodes);
    },
    [nodes, persistWithHistory],
  );

  const toggleTodoStatus = useCallback(
    (id: string) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.type !== "task") return;

      const statusCycle: Record<string, TodoStatus> = {
        NOT_STARTED: "IN_PROGRESS",
        IN_PROGRESS: "DONE",
        DONE: "NOT_STARTED",
      };
      const currentStatus = target.status ?? "NOT_STARTED";
      const newStatus: TodoStatus = statusCycle[currentStatus] ?? "NOT_STARTED";
      applyStatusChange(id, newStatus);
    },
    [nodes, applyStatusChange],
  );

  const setTodoStatus = useCallback(
    (id: string, newStatus: TodoStatus) => {
      applyStatusChange(id, newStatus);
    },
    [applyStatusChange],
  );

  return {
    addNode,
    updateNode,
    toggleExpanded,
    toggleTodoStatus,
    setTodoStatus,
  };
}

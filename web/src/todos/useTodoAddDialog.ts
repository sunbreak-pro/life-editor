import { useCallback, useEffect, useState } from "react";
import { type TodoAddType, type useTodoTreeContext } from "@life-editor/shared";

/*
 * The board's create entry point (W-UX, #896 out of KanbanView): a small
 * centered overlay that creates a todo and opens it straight into the detail.
 *
 * The shell's global:new-task intent (`pendingNewTodo`) opens the same dialog
 * on the wide board — the app's own create-and-focus entry. Two entry timings:
 * a fresh mount already carrying the flag (the user came from another section)
 * → the lazy initializer; a flip while already on the Todos tab → the guarded
 * during-render tracker. Both derive state from the prop WITHOUT a synchronous
 * setState inside an effect (which would cascade —
 * react-hooks/set-state-in-effect); this is React's "adjust state while
 * rendering" pattern. Narrow relies on the MobileTodoList quick-add instead.
 */
export function useTodoAddDialog({
  tree,
  isWide,
  pendingNewTodo,
  onConsumeNewTodo,
}: {
  tree: ReturnType<typeof useTodoTreeContext>;
  isWide: boolean;
  pendingNewTodo: boolean;
  onConsumeNewTodo?: () => void;
}) {
  const [addOpen, setAddOpen] = useState(() => pendingNewTodo && isWide);
  const [prevPendingNewTodo, setPrevPendingNewTodo] = useState(pendingNewTodo);
  if (pendingNewTodo !== prevPendingNewTodo) {
    setPrevPendingNewTodo(pendingNewTodo);
    if (pendingNewTodo && isWide) setAddOpen(true);
  }

  // Clear the shell flag once it has been observed so returning to the Todos
  // tab later never re-opens the dialog. onConsumeNewTodo is an opaque parent
  // callback (not a local setState), so it is safe in an effect.
  useEffect(() => {
    if (pendingNewTodo) onConsumeNewTodo?.();
  }, [pendingNewTodo, onConsumeNewTodo]);

  const handleAddSubmit = useCallback(
    (input: { type: TodoAddType; title: string; parentId: string | null }) => {
      const node = tree.addNode(input.type, input.parentId, input.title);
      setAddOpen(false);
      tree.setSelectedTodoId(node.id);
    },
    [tree],
  );

  return {
    addOpen,
    openAdd: () => setAddOpen(true),
    setAddOpen,
    handleAddSubmit,
  };
}

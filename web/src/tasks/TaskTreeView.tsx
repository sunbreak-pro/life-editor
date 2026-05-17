import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useTaskTreeContext,
  type TaskNode,
  type TaskStatus,
} from "@life-editor/shared";

/*
 * Web TaskTree UI (S1). The heavy Tauri TaskTree (TipTap detail pane,
 * RightSidebar portal, i18n, full UndoRedo) is intentionally NOT ported
 * here — those are S3/S6 cross-cutting concerns. This is a functional,
 * notion-token-styled tree that exercises every shared tasks data path:
 * hierarchy render, expand/collapse, status cycle, add task/folder,
 * rename, soft-delete + restore, and @dnd-kit sibling reorder.
 */

const STATUS_GLYPH: Record<TaskStatus, string> = {
  NOT_STARTED: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

function StatusButton({
  node,
  onCycle,
}: {
  node: TaskNode;
  onCycle: (id: string) => void;
}) {
  if (node.type !== "task") return <span className="w-4" aria-hidden />;
  const status = node.status ?? "NOT_STARTED";
  return (
    <button
      type="button"
      onClick={() => onCycle(node.id)}
      aria-label={`Toggle status (currently ${status})`}
      className="w-4 text-notion-text-secondary hover:text-notion-accent"
    >
      {STATUS_GLYPH[status]}
    </button>
  );
}

function TreeRow({
  node,
  depth,
  hasChildren,
  expanded,
  onToggleExpand,
  onCycleStatus,
  onRename,
  onAddChild,
  onSoftDelete,
}: {
  node: TaskNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onRename: (id: string, current: string) => void;
  onAddChild: (parentId: string) => void;
  onSoftDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 20 + 8}px`,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-notion-border bg-notion-bg-secondary px-2 py-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab text-notion-text-secondary hover:text-notion-text"
      >
        ⠿
      </button>
      {node.type === "folder" ? (
        <button
          type="button"
          onClick={() => onToggleExpand(node.id)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="w-4 text-notion-text-secondary hover:text-notion-text"
        >
          {hasChildren ? (expanded ? "▾" : "▸") : "·"}
        </button>
      ) : (
        <StatusButton node={node} onCycle={onCycleStatus} />
      )}
      <span
        className={
          node.type === "folder"
            ? "flex-1 font-medium text-notion-text"
            : node.status === "DONE"
              ? "flex-1 text-notion-text-secondary line-through"
              : "flex-1 text-notion-text"
        }
      >
        {node.type === "folder" ? "📁 " : ""}
        {node.title || "(untitled)"}
      </span>
      <span className="flex gap-2 text-xs">
        {node.type === "folder" && (
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="text-notion-text-secondary hover:text-notion-accent"
          >
            + child
          </button>
        )}
        <button
          type="button"
          onClick={() => onRename(node.id, node.title)}
          className="text-notion-text-secondary hover:text-notion-accent"
        >
          rename
        </button>
        <button
          type="button"
          onClick={() => onSoftDelete(node.id)}
          className="text-notion-danger hover:opacity-80"
        >
          delete
        </button>
      </span>
    </li>
  );
}

export function TaskTreeView() {
  const tree = useTaskTreeContext();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Flatten the active tree depth-first, honouring local collapse state.
  const flat = useMemo(() => {
    const rows: Array<{ node: TaskNode; depth: number; hasChildren: boolean }> =
      [];
    const walk = (parentId: string | null, depth: number) => {
      const children = tree.getChildren(parentId);
      for (const node of children) {
        const grand = tree.getChildren(node.id);
        rows.push({ node, depth, hasChildren: grand.length > 0 });
        if (node.type === "folder" && !collapsed.has(node.id)) {
          walk(node.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return rows;
  }, [tree, collapsed]);

  const toggleExpand = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // Sibling reorder only (matches the shared moveNode contract); cross-
    // parent / into-folder moves are keyboard/explicit actions in the
    // full app and out of this minimal UI's scope.
    tree.moveNode(String(active.id), String(over.id), "below");
  };

  const addRoot = (type: "task" | "folder") => {
    const title = window.prompt(`New ${type} title`);
    if (title === null) return;
    tree.addNode(type, null, title.trim() || `New ${type}`);
  };

  const addChild = (parentId: string) => {
    const title = window.prompt("New task title");
    if (title === null) return;
    tree.addNode("task", parentId, title.trim() || "New task");
  };

  const rename = (id: string, current: string) => {
    const next = window.prompt("New title", current);
    if (next === null) return;
    const title = next.trim();
    if (title && title !== current) tree.updateNode(id, { title });
  };

  if (tree.isLoading) {
    return <p className="text-notion-text-secondary">Loading tasks…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addRoot("task")}
            className="rounded-md bg-notion-accent px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            + Task
          </button>
          <button
            type="button"
            onClick={() => addRoot("folder")}
            className="rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover"
          >
            + Folder
          </button>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            disabled={!tree.canUndo}
            onClick={tree.undo}
            className="text-notion-text-secondary disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!tree.canRedo}
            onClick={tree.redo}
            className="text-notion-text-secondary disabled:opacity-40"
          >
            Redo
          </button>
        </div>
      </div>

      {tree.error && (
        <p
          role="alert"
          className="rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
        >
          {tree.error}
        </p>
      )}
      {tree.persistError && (
        <p
          role="alert"
          className="rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
        >
          Save failed: {tree.persistError}
        </p>
      )}

      {flat.length === 0 ? (
        <p className="text-notion-text-secondary">
          No tasks yet. Add one above.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={flat.map((r) => r.node.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {flat.map((r) => (
                <TreeRow
                  key={r.node.id}
                  node={r.node}
                  depth={r.depth}
                  hasChildren={r.hasChildren}
                  expanded={!collapsed.has(r.node.id)}
                  onToggleExpand={toggleExpand}
                  onCycleStatus={tree.toggleTaskStatus}
                  onRename={rename}
                  onAddChild={addChild}
                  onSoftDelete={tree.softDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {tree.deletedNodes.length > 0 && (
        <details className="rounded-md border border-notion-border px-3 py-2">
          <summary className="cursor-pointer text-sm text-notion-text-secondary">
            Trash ({tree.deletedNodes.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {tree.deletedNodes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-notion-text-secondary line-through">
                  {n.title || "(untitled)"}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => tree.restoreNode(n.id)}
                    className="text-notion-accent hover:opacity-80"
                  >
                    restore
                  </button>
                  <button
                    type="button"
                    onClick={() => tree.permanentDelete(n.id)}
                    className="text-notion-danger hover:opacity-80"
                  >
                    purge
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

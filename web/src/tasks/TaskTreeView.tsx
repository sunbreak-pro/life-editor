import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  Folder,
  Link2,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  useTaskTreeContext,
  useTranslation,
  MasterDetail,
  TaskDetailPanel,
  type TaskNode,
  type TaskStatus,
} from "@life-editor/shared";
import { TagPicker, LinkPanel } from "../wikitag";
import { useTaskTreeDnd } from "./useTaskTreeDnd";
import { RichTextEditor } from "../notes/RichTextEditor";
import { TreeNodeIndent } from "../components/TreeNodeIndent";
import { treeCollisionDetection } from "../components/treeCollision";
import { TreeDragGhost } from "../components/TreeDragGhost";

/*
 * Web TaskTree UI (S1, redesigned in DU-G to match the Desktop TaskTree and
 * the web Notes tree). The heavy Tauri TaskTree (TipTap detail pane,
 * RightSidebar portal, i18n, full UndoRedo) is intentionally NOT ported
 * here — those are S3/S6 cross-cutting concerns. This is a functional,
 * ink-token-styled tree that exercises every shared tasks data path:
 * hierarchy render, expand/collapse, status cycle, add task/folder, rename,
 * soft-delete + restore, and @dnd-kit reorder + into-folder.
 *
 * DnD is now identical to the Notes tree: shared pointer→intent zones
 * (computeNoteDropIntent via useTaskTreeDnd), shared collision detection, a
 * static list (no per-row shift transform), a faint floating ghost, accent
 * insertion lines + an inside-folder wash. See useTaskTreeDnd.ts.
 */

const STATUS_GLYPH: Record<TaskStatus, string> = {
  NOT_STARTED: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

// i18n keys for the detail panel's current-status label (host resolves
// these with t() and injects the string — shared leaf components never
// call useTranslation, §6.4).
const STATUS_TEXT_KEY: Record<TaskStatus, string> = {
  NOT_STARTED: "taskDetail.statusNotStarted",
  IN_PROGRESS: "taskDetail.statusInProgress",
  DONE: "taskDetail.statusDone",
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
      className="w-4 shrink-0 text-ink-text-secondary hover:text-ink-accent"
    >
      {STATUS_GLYPH[status]}
    </button>
  );
}

interface TaskFlatRow {
  node: TaskNode;
  depth: number;
  hasChildren: boolean;
  isLastChild: boolean;
}

function TreeRow({
  row,
  expanded,
  selected,
  linkOpen,
  // Drop indicator for THIS row while a drag is over it. null when this row
  // is not the current drop target (or no drag is active).
  dropPosition,
  onToggleExpand,
  onSelect,
  onToggleLinks,
  onCycleStatus,
  onRename,
  onAddChild,
  onSoftDelete,
  resolveTitle,
  linkableItems,
}: {
  row: TaskFlatRow;
  expanded: boolean;
  selected: boolean;
  linkOpen: boolean;
  dropPosition: "above" | "below" | "inside" | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onToggleLinks: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onRename: (id: string, current: string) => void;
  onAddChild: (parentId: string) => void;
  onSoftDelete: (id: string) => void;
  resolveTitle: (id: string) => string | undefined;
  linkableItems: Array<{ id: string; label: string }>;
}) {
  const { node, depth, hasChildren, isLastChild } = row;
  // Static list: only attributes/listeners/setNodeRef are used — the
  // sortable transform/transition are deliberately NOT applied (no reflow),
  // matching the Notes tree. The "what am I dragging" cue is the floating
  // ghost; the accent line / inside wash shows where it lands.
  const { attributes, listeners, setNodeRef } = useSortable({ id: node.id });

  const isFolder = node.type === "folder";
  const showInside = dropPosition === "inside";

  return (
    <li
      ref={setNodeRef}
      className={`group relative rounded-md border px-2 py-1.5 ${
        showInside
          ? "border-ink-accent bg-ink-accent-subtle"
          : selected
            ? "border-ink-accent bg-ink-hover"
            : "border-ink-border bg-ink-bg-secondary"
      }`}
    >
      {/* Reorder insertion line — accent bar pinned to the row's top or
          bottom edge. aria-hidden (@dnd-kit announces moves itself). */}
      {dropPosition === "above" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded-full bg-ink-accent"
        />
      )}
      {dropPosition === "below" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-ink-accent"
        />
      )}
      <div className="flex items-center gap-1">
        {/* Grip — hover-revealed (TaskTree parity). */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder or move"
          className="shrink-0 cursor-grab text-ink-text-secondary opacity-0 transition-opacity hover:text-ink-text focus-visible:opacity-100 group-hover:opacity-100"
        >
          <GripVertical size={14} aria-hidden />
        </button>

        <TreeNodeIndent depth={depth} isLastChild={isLastChild} />

        {/* Leading control: folders swap Folder icon → twisty on hover
            (one click target); tasks keep the status glyph (no toggle). */}
        {isFolder ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
            className="relative inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center text-ink-text-secondary hover:text-ink-text"
          >
            <Folder
              size={14}
              aria-hidden
              className="absolute opacity-100 transition-opacity group-hover:opacity-0"
            />
            {hasChildren ? (
              expanded ? (
                <ChevronDown
                  size={14}
                  aria-hidden
                  className="absolute opacity-0 transition-opacity group-hover:opacity-100"
                />
              ) : (
                <ChevronRight
                  size={14}
                  aria-hidden
                  className="absolute opacity-0 transition-opacity group-hover:opacity-100"
                />
              )
            ) : (
              <Folder
                size={14}
                aria-hidden
                className="absolute opacity-0 transition-opacity group-hover:opacity-100"
              />
            )}
          </button>
        ) : (
          <StatusButton node={node} onCycle={onCycleStatus} />
        )}

        {/* Title: folders toggle expand on click; tasks select (drive the
            detail pane). Mirrors the Notes tree's folder-vs-leaf split. */}
        <button
          type="button"
          onClick={() =>
            isFolder ? onToggleExpand(node.id) : onSelect(node.id)
          }
          className={
            isFolder
              ? "min-w-0 flex-1 truncate text-left font-medium text-ink-text"
              : node.status === "DONE"
                ? "min-w-0 flex-1 truncate text-left text-ink-text-secondary line-through"
                : "min-w-0 flex-1 truncate text-left text-ink-text"
          }
        >
          {node.title || "(untitled)"}
        </button>
        <TagPicker itemId={node.id} />
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onToggleLinks(node.id)}
            aria-expanded={linkOpen}
            aria-label={linkOpen ? "Hide links" : "Show links"}
            title="Links"
            className={`rounded p-1 hover:bg-ink-hover ${
              linkOpen
                ? "text-ink-accent"
                : "text-ink-text-secondary hover:text-ink-accent"
            }`}
          >
            <Link2 size={14} aria-hidden />
          </button>
          {isFolder && (
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              aria-label="Add child task"
              title="Add child task"
              className="rounded p-1 text-ink-text-secondary hover:bg-ink-hover hover:text-ink-accent"
            >
              <Plus size={14} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRename(node.id, node.title)}
            aria-label="Rename"
            title="Rename"
            className="rounded p-1 text-ink-text-secondary hover:bg-ink-hover hover:text-ink-accent"
          >
            <Pencil size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onSoftDelete(node.id)}
            aria-label="Delete"
            title="Delete"
            className="rounded p-1 text-ink-text-secondary hover:bg-ink-hover hover:text-ink-danger"
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </span>
      </div>
      {linkOpen && (
        <div className="mt-2">
          <LinkPanel
            itemId={node.id}
            resolveTitle={resolveTitle}
            linkableItems={linkableItems}
          />
        </div>
      )}
    </li>
  );
}

export function TaskTreeView() {
  const tree = useTaskTreeContext();
  const { t } = useTranslation();
  // View-local expand/collapse: a folder id IN the set = collapsed
  // (children hidden). DU-G keeps this view-local (not on the context) and
  // threads collapse/expand into the DnD hook for Rule 1.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Per-row Links toggle. Local Set rather than a useExpanded hook —
  // this is single-section state (DU-F Step 8).
  const [linksOpen, setLinksOpen] = useState<Set<string>>(new Set());
  const [moveError, setMoveError] = useState<string | null>(null);
  const toggleLinks = (id: string) =>
    setLinksOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Linkable candidates pool: the full task tree (active nodes). Cross-
  // role links (task → note / event / daily) need raw id paste in the
  // input — DU-G unifies the resolver into items_meta and removes this.
  const linkableItems = useMemo(
    () =>
      tree.nodes.map((n) => ({
        id: n.id,
        label: `[${n.type}] ${n.title || "(untitled)"}`,
      })),
    [tree.nodes],
  );
  const resolveTitle = (id: string): string | undefined => {
    const n = tree.nodeMap.get(id);
    if (!n) return undefined;
    return `[${n.type}] ${n.title || "(untitled)"}`;
  };

  const collapse = (id: string) =>
    setCollapsed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  const expand = (id: string) =>
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  const toggleExpand = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dnd = useTaskTreeDnd({
    nodes: tree.nodes,
    collapsedIds: collapsed,
    collapse,
    expand,
    moveNode: tree.moveNode,
    moveNodeInto: tree.moveNodeInto,
    moveToRoot: tree.moveToRoot,
    onMoveRejected: (reason) =>
      setMoveError(`Move rejected: ${reason.replace(/_/g, " ")}`),
  });

  // Flatten the active tree depth-first, honouring local collapse state.
  const flat = useMemo<TaskFlatRow[]>(() => {
    const rows: TaskFlatRow[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = tree.getChildren(parentId);
      children.forEach((node, index) => {
        const grand = tree.getChildren(node.id);
        rows.push({
          node,
          depth,
          hasChildren: grand.length > 0,
          isLastChild: index === children.length - 1,
        });
        if (node.type === "folder" && !collapsed.has(node.id)) {
          walk(node.id, depth + 1);
        }
      });
    };
    walk(null, 0);
    return rows;
  }, [tree, collapsed]);

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

  const ids: UniqueIdentifier[] = flat.map((r) => r.node.id);

  if (tree.isLoading) {
    return <p className="text-ink-text-secondary">Loading tasks…</p>;
  }

  const selected = tree.selectedTask;

  // Master pane — the task tree, create controls, undo/redo, errors and the
  // trash drawer. Selection stays owned by the Tasks API (tree.selectedTask);
  // MasterDetail is a pure layout shell that only takes detailOpen +
  // onCloseDetail (§3.1).
  const master = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addRoot("task")}
            className="rounded-md bg-ink-accent px-3 py-1.5 text-sm text-ink-on-accent hover:opacity-90"
          >
            + Task
          </button>
          <button
            type="button"
            onClick={() => addRoot("folder")}
            className="rounded-md border border-ink-border px-3 py-1.5 text-sm text-ink-text hover:bg-ink-hover"
          >
            + Folder
          </button>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            disabled={!tree.canUndo}
            onClick={tree.undo}
            className="text-ink-text-secondary disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!tree.canRedo}
            onClick={tree.redo}
            className="text-ink-text-secondary disabled:opacity-40"
          >
            Redo
          </button>
        </div>
      </div>

      {tree.error && (
        <p
          role="alert"
          className="rounded-md border border-ink-danger px-3 py-2 text-sm text-ink-danger"
        >
          {tree.error}
        </p>
      )}
      {tree.persistError && (
        <p
          role="alert"
          className="rounded-md border border-ink-danger px-3 py-2 text-sm text-ink-danger"
        >
          Save failed: {tree.persistError}
        </p>
      )}
      {moveError && (
        <p
          role="alert"
          className="rounded-md border border-ink-danger px-3 py-2 text-sm text-ink-danger"
        >
          {moveError}
        </p>
      )}

      {flat.length === 0 ? (
        <p className="text-ink-text-secondary">
          No tasks yet. Add one above.
        </p>
      ) : (
        <DndContext
          sensors={dnd.sensors}
          collisionDetection={treeCollisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={dnd.handleDragStart}
          onDragMove={dnd.handleDragMove}
          onDragEnd={dnd.handleDragEnd}
          onDragCancel={dnd.handleDragCancel}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {flat.map((r) => (
                <TreeRow
                  key={r.node.id}
                  row={r}
                  expanded={!collapsed.has(r.node.id)}
                  selected={tree.selectedTaskId === r.node.id}
                  linkOpen={linksOpen.has(r.node.id)}
                  dropPosition={
                    // Only the current over-target row (and never the row
                    // being dragged) shows an indicator.
                    dnd.overInfo?.overId === r.node.id &&
                    dnd.activeId !== r.node.id
                      ? dnd.overInfo.position
                      : null
                  }
                  onToggleExpand={toggleExpand}
                  onSelect={tree.setSelectedTaskId}
                  onToggleLinks={toggleLinks}
                  onCycleStatus={tree.toggleTaskStatus}
                  onRename={rename}
                  onAddChild={addChild}
                  onSoftDelete={tree.softDelete}
                  resolveTitle={resolveTitle}
                  linkableItems={linkableItems}
                />
              ))}
            </ul>
          </SortableContext>
          {/* Faint drag ghost — trails the cursor for orientation; the list
              block itself never moves (source row stays in place). */}
          <DragOverlay>
            {dnd.activeNode ? (
              <TreeDragGhost title={dnd.activeNode.title} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {tree.deletedNodes.length > 0 && (
        <details className="rounded-md border border-ink-border px-3 py-2">
          <summary className="cursor-pointer text-sm text-ink-text-secondary">
            Trash ({tree.deletedNodes.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {tree.deletedNodes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-ink-text-secondary line-through">
                  {n.title || "(untitled)"}
                </span>
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => tree.restoreNode(n.id)}
                    aria-label="Restore"
                    title="Restore"
                    className="rounded p-1 text-ink-text-secondary hover:bg-ink-hover hover:text-ink-accent"
                  >
                    <RotateCcw size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => tree.permanentDelete(n.id)}
                    aria-label="Delete permanently"
                    title="Delete permanently"
                    className="rounded p-1 text-ink-text-secondary hover:bg-ink-hover hover:text-ink-danger"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  // Detail pane — the selected task's title / status / content editor.
  // Rendered only when a task is selected; MasterDetail shows emptyDetail
  // otherwise (wide) or keeps the sheet closed (narrow). RichTextEditor
  // keeps its key={selected.id} remount strategy (content swaps cleanly on a
  // task switch and never drops mid-typing); the title field is NOT keyed on
  // its text (TaskDetailPanel keys its TaskTitleInput by id internally).
  const isFolder = selected?.type === "folder";
  const detail = selected ? (
    <TaskDetailPanel
      taskId={selected.id}
      title={selected.title}
      status={selected.status}
      isFolder={isFolder}
      onTitleCommit={(id, title) => tree.updateNode(id, { title })}
      onToggleStatus={tree.toggleTaskStatus}
      titleLabel={t("taskDetail.titleLabel")}
      statusLabel={t("taskDetail.status")}
      statusText={t(STATUS_TEXT_KEY[selected.status ?? "NOT_STARTED"])}
      contentLabel={t("taskDetail.content")}
      contentEditor={
        isFolder ? undefined : (
          <RichTextEditor
            key={selected.id}
            noteId={selected.id}
            initialContent={selected.content || undefined}
            onUpdate={(content) => tree.updateNode(selected.id, { content })}
          />
        )
      }
    />
  ) : null;

  return (
    <MasterDetail
      master={master}
      detail={detail}
      detailOpen={selected != null}
      onCloseDetail={() => tree.setSelectedTaskId(null)}
      emptyDetail={t("taskDetail.detailEmpty")}
      detailTitle={selected?.title || t("taskDetail.detailTitle")}
      closeLabel={t("taskDetail.closeDetail")}
    />
  );
}

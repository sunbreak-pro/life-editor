import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCorners,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import {
  KanbanBoard,
  KanbanCard,
  buildFolderColumns,
  buildStatusColumns,
  buildTagColumns,
  TaskDetailModal,
  TaskDetailPanel,
  TaskAddDialog,
  useTaskTreeContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  readKanbanViewMode,
  persistKanbanViewMode,
  type KanbanCardModel,
  type KanbanCardTag,
  type KanbanColumnModel,
  type KanbanLabels,
  type KanbanViewMode,
  type TaskAddType,
  type TaskStatus,
} from "@life-editor/shared";
import { useKanbanDnd } from "./useKanbanDnd";
import { KanbanColumnDroppable } from "./KanbanColumnDroppable";
import { RichTextEditor } from "../notes/RichTextEditor";

/*
 * Web Tasks Kanban host (K1 + K-DnD + K2 + K3). Replaces the tree in the
 * Tasks section. Owns the data + i18n wiring; the shared <KanbanBoard> and
 * its children stay pure (§6.4):
 *
 *   - data: useTaskTreeContext() → nodes / status + folder mutations;
 *     useWikiTagsUnifiedContext() → tag master + assignments + tag color.
 *     Columns are built by the pure shared builders, keyed off the active
 *     view mode.
 *   - i18n: useTranslation() here → a KanbanLabels object injected as props.
 *
 * K-DnD (folder/status views): drag a card between columns to mutate it.
 *   - status view: cross-column drop SETS the task status (setTaskStatus).
 *   - folder view: cross-column drop MOVES the task into the target folder
 *     (moveNodeInto); same-column drop onto another card reorders siblings.
 *   - tag view: NOT draggable (reassigning a multi-tag card by drag is
 *     ambiguous) — the host renders the plain board there.
 *
 * K2: tag-by view (one column per tag + an "untagged" bucket) and
 * folder/tag color editing. The host resolves each task's tags from the
 * WikiTags context (getTagsForItem) and persists color changes via
 * updateNode (folder) / setTagColor (tag).
 *
 * K3: clicking a card opens the selected task in a full-screen animated
 * <TaskDetailModal> hosting the shared <TaskDetailPanel> + the web TipTap
 * editor. The card's pointer position seeds the modal's grow-from origin.
 *
 * @dnd-kit lives only in web/ (useKanbanDnd + KanbanColumnDroppable +
 * KanbanCardDraggable); the shared Kanban package never imports it.
 */

const STATUS_TEXT_KEY: Record<TaskStatus, string> = {
  NOT_STARTED: "taskDetail.statusNotStarted",
  IN_PROGRESS: "taskDetail.statusInProgress",
  DONE: "taskDetail.statusDone",
};

export function KanbanView(): React.JSX.Element {
  const tree = useTaskTreeContext();
  const wikiTags = useWikiTagsUnifiedContext();
  const { allTags, getTagsForItem, setTagColor } = wikiTags;
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<KanbanViewMode>(() =>
    readKanbanViewMode("folder"),
  );
  const [moveError, setMoveError] = useState<string | null>(null);

  // Open the detail modal for the clicked card (the modal is a centered
  // overlay now, so no grow-from-pointer origin is needed — W-UX).
  const handleSelectCard = useCallback(
    (id: string) => tree.setSelectedTaskId(id),
    [tree],
  );

  // Add-task / folder dialog (W-UX). The board had no create entry point; this
  // small centered overlay creates a task (optionally inside a folder) or a
  // root folder, then opens a new task straight into the detail modal.
  const [addOpen, setAddOpen] = useState(false);
  const folderOptions = useMemo(
    () =>
      tree.nodes
        .filter((n) => n.type === "folder" && !n.isDeleted)
        .map((n) => ({ id: n.id, name: n.title || "(untitled)" })),
    [tree.nodes],
  );
  const handleAddSubmit = useCallback(
    (input: { type: TaskAddType; title: string; parentId: string | null }) => {
      const node = tree.addNode(input.type, input.parentId, input.title);
      setAddOpen(false);
      if (input.type === "task") tree.setSelectedTaskId(node.id);
    },
    [tree],
  );

  // The host owns viewMode (it drives column building), so the board runs
  // controlled and its own persistence is inert. Persist here instead, sharing
  // one storage key with the board via the shared helper — the chosen view
  // then survives reloads.
  const handleViewModeChange = useCallback((mode: KanbanViewMode) => {
    setViewMode(mode);
    persistKanbanViewMode(mode);
  }, []);

  // Auto-dismiss the rejection alert so it doesn't linger past the next action.
  useEffect(() => {
    if (!moveError) return;
    const id = setTimeout(() => setMoveError(null), 4000);
    return () => clearTimeout(id);
  }, [moveError]);

  const labels = useMemo<KanbanLabels>(
    () => ({
      viewFolder: t("kanban.viewFolder"),
      viewStatus: t("kanban.viewStatus"),
      viewTag: t("kanban.viewTag"),
      segmentedGroupLabel: t("kanban.segmentedGroupLabel"),
      statusNotStarted: t("taskDetail.statusNotStarted"),
      statusInProgress: t("taskDetail.statusInProgress"),
      statusDone: t("taskDetail.statusDone"),
      cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
      emptyColumn: t("kanban.emptyColumn"),
      placeholderHint: t("kanban.placeholderHint"),
      countAriaLabel: (n) => `${n}`,
      untagged: t("kanban.untagged"),
      colorPickerLabel: t("kanban.colorPickerLabel"),
      colorClearLabel: t("kanban.colorClearLabel"),
      colorCustomLabel: t("kanban.colorCustomLabel"),
    }),
    [t],
  );

  // Resolve each active task's tags (taskId → tags) + the ordered tag list,
  // from the WikiTags master + cached assignments. Pure shapes for the
  // builders (the shared package never reaches the tag context).
  const { tags, tagsByTask } = useMemo(() => {
    const tagById = new Map<string, KanbanCardTag>();
    const list: KanbanCardTag[] = allTags.map((tag) => {
      const model: KanbanCardTag = {
        id: tag.id,
        name: tag.name,
        color: tag.color ?? undefined,
      };
      tagById.set(tag.id, model);
      return model;
    });
    const byTask = new Map<string, KanbanCardTag[]>();
    for (const node of tree.nodes) {
      if (node.type !== "task" || node.isDeleted) continue;
      const resolved: KanbanCardTag[] = [];
      for (const a of getTagsForItem(node.id)) {
        if (a.isDeleted) continue;
        const tag = tagById.get(a.tagId);
        if (tag) resolved.push(tag);
      }
      if (resolved.length > 0) byTask.set(node.id, resolved);
    }
    return { tags: list, tagsByTask: byTask };
  }, [tree.nodes, allTags, getTagsForItem]);

  // Build only the active view's columns.
  const columns = useMemo<KanbanColumnModel[]>(() => {
    switch (viewMode) {
      case "folder":
        return buildFolderColumns(tree.nodes, tagsByTask);
      case "status":
        return buildStatusColumns(tree.nodes, labels, tagsByTask);
      case "tag":
        return buildTagColumns(tree.nodes, tags, tagsByTask, labels);
    }
  }, [viewMode, tree.nodes, labels, tags, tagsByTask]);

  // Persist a folder / tag color change. The shared column reports its id;
  // the host maps it back to a folder node (folder view) or a tag (tag view).
  const handleColorChange = useCallback(
    (columnId: string, color: string | null) => {
      if (viewMode === "folder") {
        tree.updateNode(columnId, { color: color ?? undefined });
      } else if (viewMode === "tag") {
        if (columnId === "tag-__none__") return;
        const tagId = columnId.startsWith("tag-")
          ? columnId.slice(4)
          : columnId;
        void setTagColor(tagId, color).catch(() => {
          setMoveError("Failed to update tag color");
        });
      }
    },
    [viewMode, tree, setTagColor],
  );

  const dnd = useKanbanDnd({
    viewMode,
    columns,
    setTaskStatus: tree.setTaskStatus,
    moveNodeInto: tree.moveNodeInto,
    moveNode: tree.moveNode,
    onMoveRejected: (reason) =>
      setMoveError(`Move rejected: ${reason.replace(/_/g, " ")}`),
  });

  // The card currently being dragged, for the DragOverlay ghost.
  const activeCard = useMemo<KanbanCardModel | null>(() => {
    if (!dnd.activeCardId) return null;
    for (const col of columns) {
      const found = col.cards.find((c) => c.id === dnd.activeCardId);
      if (found) return found;
    }
    return null;
  }, [dnd.activeCardId, columns]);

  if (tree.isLoading) {
    return <p className="text-notion-text-secondary">Loading tasks…</p>;
  }

  // "+ Add" entry point in the board toolbar — opens the add dialog.
  const addButton = (
    <button
      type="button"
      onClick={() => setAddOpen(true)}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-notion-accent px-3 py-1.5 text-sm font-semibold text-notion-on-accent transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent"
    >
      <Plus size={15} aria-hidden />
      {t("kanban.addTask")}
    </button>
  );

  // Tag view (read-only DnD) → plain board; folder/status → DnD board.
  const board = !dnd.enabled ? (
    <KanbanBoard
      columns={columns}
      labels={labels}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      onSelectCard={handleSelectCard}
      onColorChange={handleColorChange}
      headerActions={addButton}
    />
  ) : (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={dnd.handleDragStart}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
    >
      <KanbanBoard
        columns={columns}
        labels={labels}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onSelectCard={handleSelectCard}
        onColorChange={handleColorChange}
        headerActions={addButton}
        renderColumn={({
          column,
          showFolderPill,
          showTags,
          showFolderAccent,
        }) => (
          <KanbanColumnDroppable
            column={column}
            labels={labels}
            showFolderPill={showFolderPill}
            showTags={showTags}
            showFolderAccent={showFolderAccent}
            onSelectCard={handleSelectCard}
            onColorChange={handleColorChange}
          />
        )}
        overlay={
          <DragOverlay>
            {activeCard ? (
              <div className="w-[316px] px-2.5">
                <KanbanCard
                  card={activeCard}
                  labels={labels}
                  showFolderPill={viewMode !== "folder"}
                  showTags={viewMode !== "tag"}
                  onSelect={() => undefined}
                />
              </div>
            ) : null}
          </DragOverlay>
        }
      />
    </DndContext>
  );

  // K3 — centered detail overlay for the selected card (W-UX).
  const selected = tree.selectedTask;
  const isFolder = selected?.type === "folder";
  const parentFolder = selected?.parentId
    ? tree.nodes.find((n) => n.id === selected.parentId)
    : undefined;

  return (
    <div className="flex h-full flex-col px-2 pt-4">
      {moveError && (
        <p
          role="alert"
          className="mb-2 rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
        >
          {moveError}
        </p>
      )}
      {board}
      {selected && (
        <TaskDetailModal
          open
          onClose={() => tree.setSelectedTaskId(null)}
          status={selected.status}
          folderName={parentFolder?.title}
          folderColor={parentFolder?.color}
          breadcrumbTaskLabel={t("kanban.breadcrumbTask")}
          closeLabel={t("kanban.modalClose")}
        >
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
                  onUpdate={(content) =>
                    tree.updateNode(selected.id, { content })
                  }
                />
              )
            }
          />
        </TaskDetailModal>
      )}
      <TaskAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddSubmit}
        folders={folderOptions}
        labels={{
          title: t("kanban.addDialogTitle"),
          typeTask: t("kanban.addTypeTask"),
          typeFolder: t("kanban.addTypeFolder"),
          titleLabel: t("kanban.addTitleLabel"),
          titlePlaceholder: t("kanban.addTitlePlaceholder"),
          folderLabel: t("kanban.addFolderLabel"),
          rootOption: t("kanban.addFolderRoot"),
          submit: t("kanban.addSubmit"),
          cancel: t("kanban.addCancel"),
        }}
      />
    </div>
  );
}

import { useMemo } from "react";
import {
  buildStatusColumns,
  buildTagColumns,
  useTranslation,
  useWikiTagsUnifiedContext,
  type KanbanCardTag,
  type KanbanColumnModel,
  type KanbanLabels,
  type KanbanViewMode,
  type TodoNode,
} from "@life-editor/shared";

/*
 * What the board draws (#896, out of KanbanView): the i18n label bag and the
 * three column models built from it.
 *
 * The host resolves each todo's tags from the WikiTags context and hands the
 * pure builders plain shapes — the shared Kanban package never reaches a
 * context of its own (§6.4). K2's tag-by view (one column per tag plus an
 * "untagged" bucket) is built by the same pass.
 */
export function useKanbanColumns({
  nodes,
  viewMode,
}: {
  nodes: TodoNode[];
  viewMode: KanbanViewMode;
}): {
  labels: KanbanLabels;
  columns: KanbanColumnModel[];
  statusColumns: KanbanColumnModel[];
} {
  const { t } = useTranslation();
  const { allTags, getTagsForItem } = useWikiTagsUnifiedContext();

  const labels = useMemo<KanbanLabels>(
    () => ({
      viewStatus: t("kanban.viewStatus"),
      viewTag: t("kanban.viewTag"),
      segmentedGroupLabel: t("kanban.segmentedGroupLabel"),
      statusNotStarted: t("todoDetail.statusNotStarted"),
      statusDone: t("todoDetail.statusDone"),
      cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
      emptyColumn: t("kanban.emptyColumn"),
      placeholderHint: t("kanban.placeholderHint"),
      countAriaLabel: (n) => t("materials.todos.todoCount", { count: n }),
      untagged: t("kanban.untagged"),
      colorPickerLabel: t("kanban.colorPickerLabel"),
      colorClearLabel: t("kanban.colorClearLabel"),
      colorCustomLabel: t("kanban.colorCustomLabel"),
    }),
    [t],
  );

  // Resolve each active todo's tags (todoId → tags) + the ordered tag list,
  // from the WikiTags master + cached assignments. Pure shapes for the
  // builders (the shared package never reaches the tag context).
  const { tags, tagsByTodo } = useMemo(() => {
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
    const byTodo = new Map<string, KanbanCardTag[]>();
    for (const node of nodes) {
      if (node.type !== "task" || node.isDeleted) continue;
      const resolved: KanbanCardTag[] = [];
      for (const a of getTagsForItem(node.id)) {
        if (a.isDeleted) continue;
        const tag = tagById.get(a.tagId);
        if (tag) resolved.push(tag);
      }
      if (resolved.length > 0) byTodo.set(node.id, resolved);
    }
    return { tags: list, tagsByTodo: byTodo };
  }, [nodes, allTags, getTagsForItem]);

  // Build only the active view's columns.
  const columns = useMemo<KanbanColumnModel[]>(() => {
    switch (viewMode) {
      case "status":
        return buildStatusColumns(nodes, labels, tagsByTodo);
      case "tag":
        return buildTagColumns(nodes, tags, tagsByTodo, labels);
    }
  }, [viewMode, nodes, labels, tags, tagsByTodo]);

  // The status columns for the Mobile list (cards already carry the tag chips
  // via the pure builder). Built regardless of the desktop viewMode so
  // switching wide↔narrow needs no extra plumbing.
  const statusColumns = useMemo<KanbanColumnModel[]>(
    () => buildStatusColumns(nodes, labels, tagsByTodo),
    [nodes, labels, tagsByTodo],
  );

  return { labels, columns, statusColumns };
}

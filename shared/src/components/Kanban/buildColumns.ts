/*
 * Column builders. Pure functions that turn the active TodoNode set into
 * KanbanColumnModel[] for each view mode. No React, no DataService — the host
 * calls these with the data it already has from useTodoTreeContext /
 * useWikiTagsUnifiedContext and injects the resolved status labels.
 *
 * Status view: three fixed columns keyed by status, cards = every active todo
 * (regardless of any parent folder). Tag view: one column per tag (tag's own
 * color), cards = every todo carrying that tag, plus a trailing "untagged"
 * bucket. Folders are never cards and never group the board (life-tags S1
 * retired the folder view) — every active todo surfaces on both views even if
 * it still sits under a legacy folder node.
 *
 * Tag data is passed in as `tagsByTodo` (todoId → its tags) so the builders
 * stay pure; the host resolves assignments → tags from the WikiTags context.
 */

import type { TodoNode, TodoStatus } from "../../types/todoTree";
import { STATUS_ORDER, statusLabel } from "../todoStatusVisuals";
import type {
  KanbanCardModel,
  KanbanCardTag,
  KanbanColumnModel,
  KanbanLabels,
} from "./types";

/** todoId → the tags assigned to it. Empty/absent = untagged. */
export type TagsByTodo = ReadonlyMap<string, KanbanCardTag[]>;

/** Fixed status column order + their accent CSS vars (status-encoding hue). */
const STATUS_BAND_VAR: Record<TodoStatus, string> = {
  NOT_STARTED: "var(--color-status-todo-band)",
  IN_PROGRESS: "var(--color-status-progress-band)",
  DONE: "var(--color-status-done-band)",
};

/** Neutral accent for the "untagged" bucket column (tag view). */
const UNTAGGED_ACCENT = "var(--color-border-strong)";

function normalizeStatus(node: TodoNode): TodoStatus {
  return node.status ?? "NOT_STARTED";
}

function isActiveTodo(node: TodoNode): boolean {
  return node.type === "task" && !node.isDeleted;
}

const EMPTY_TAGS: KanbanCardTag[] = [];

function tagsFor(todoId: string, tagsByTodo?: TagsByTodo): KanbanCardTag[] {
  return tagsByTodo?.get(todoId) ?? EMPTY_TAGS;
}

/**
 * Build a card model from a todo node. `tags` is filled on the status view
 * (the tag view conveys the tag via the column, so it omits per-card chips).
 */
function toCard(
  node: TodoNode,
  extras?: {
    tags?: KanbanCardTag[];
  },
): KanbanCardModel {
  return {
    id: node.id,
    title: node.title,
    status: normalizeStatus(node),
    tags: extras?.tags && extras.tags.length > 0 ? extras.tags : undefined,
  };
}

/**
 * Status view: three fixed columns (未着手 / 進行中 / 完了). Cards are every
 * active todo, grouped by status, each carrying its tags. Status colors are
 * fixed (not editable). Legacy folder nodes are ignored — the todo surfaces by
 * its status regardless of any parent folder.
 */
export function buildStatusColumns(
  nodes: TodoNode[],
  labels: KanbanLabels,
  tagsByTodo?: TagsByTodo,
): KanbanColumnModel[] {
  const byStatus = new Map<TodoStatus, TodoNode[]>();
  for (const status of STATUS_ORDER) byStatus.set(status, []);
  for (const node of nodes) {
    if (!isActiveTodo(node)) continue;
    byStatus.get(normalizeStatus(node))?.push(node);
  }

  return STATUS_ORDER.map((status) => {
    const todos = [...(byStatus.get(status) ?? [])].sort(
      (a, b) => a.order - b.order,
    );
    return {
      id: `status-${status}`,
      title: statusLabel(status, labels),
      statusKind: status,
      accentColor: STATUS_BAND_VAR[status],
      cards: todos.map((todo) =>
        toCard(todo, { tags: tagsFor(todo.id, tagsByTodo) }),
      ),
    };
  });
}

/**
 * Tag view: one column per tag (in the order `tags` is given), cards = active
 * todos carrying that tag. A trailing "untagged" bucket collects active todos
 * with no tags. Tag columns are colorEditable (the "untagged" bucket is not).
 * The tag view omits per-card tag chips (the column already conveys the tag).
 */
export function buildTagColumns(
  nodes: TodoNode[],
  tags: KanbanCardTag[],
  tagsByTodo: TagsByTodo,
  labels: KanbanLabels,
): KanbanColumnModel[] {
  const activeTodos = nodes
    .filter(isActiveTodo)
    .sort((a, b) => a.order - b.order);

  const cardFor = (todo: TodoNode): KanbanCardModel => toCard(todo);

  const columns: KanbanColumnModel[] = tags.map((tag) => ({
    id: `tag-${tag.id}`,
    title: tag.name || "(untitled)",
    accentColor: tag.color,
    colorEditable: true,
    roundDot: true,
    cards: activeTodos
      .filter((todo) =>
        (tagsByTodo.get(todo.id) ?? EMPTY_TAGS).some((t) => t.id === tag.id),
      )
      .map(cardFor),
  }));

  const untagged = activeTodos.filter(
    (todo) => (tagsByTodo.get(todo.id) ?? EMPTY_TAGS).length === 0,
  );
  columns.push({
    id: "tag-__none__",
    title: labels.untagged,
    accentColor: UNTAGGED_ACCENT,
    roundDot: true,
    cards: untagged.map(cardFor),
  });

  return columns;
}

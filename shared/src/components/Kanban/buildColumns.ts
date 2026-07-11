/*
 * Column builders. Pure functions that turn the active TaskNode set into
 * KanbanColumnModel[] for each view mode. No React, no DataService — the host
 * calls these with the data it already has from useTaskTreeContext /
 * useWikiTagsUnifiedContext and injects the resolved status labels.
 *
 * Status view: three fixed columns keyed by status, cards = every active task
 * (regardless of any parent folder). Tag view: one column per tag (tag's own
 * color), cards = every task carrying that tag, plus a trailing "untagged"
 * bucket. Folders are never cards and never group the board (life-tags S1
 * retired the folder view) — every active task surfaces on both views even if
 * it still sits under a legacy folder node.
 *
 * Tag data is passed in as `tagsByTask` (taskId → its tags) so the builders
 * stay pure; the host resolves assignments → tags from the WikiTags context.
 */

import type { TaskNode, TaskStatus } from "../../types/taskTree";
import type {
  KanbanCardModel,
  KanbanCardTag,
  KanbanColumnModel,
  KanbanLabels,
} from "./types";

/** taskId → the tags assigned to it. Empty/absent = untagged. */
export type TagsByTask = ReadonlyMap<string, KanbanCardTag[]>;

/** Fixed status column order + their accent CSS vars (status-encoding hue). */
const STATUS_ORDER: readonly TaskStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
];

const STATUS_BAND_VAR: Record<TaskStatus, string> = {
  NOT_STARTED: "var(--color-status-todo-band)",
  IN_PROGRESS: "var(--color-status-progress-band)",
  DONE: "var(--color-status-done-band)",
};

/** Neutral accent for the "untagged" bucket column (tag view). */
const UNTAGGED_ACCENT = "var(--color-border-strong)";

function statusLabel(status: TaskStatus, labels: KanbanLabels): string {
  switch (status) {
    case "NOT_STARTED":
      return labels.statusNotStarted;
    case "IN_PROGRESS":
      return labels.statusInProgress;
    case "DONE":
      return labels.statusDone;
  }
}

function normalizeStatus(node: TaskNode): TaskStatus {
  return node.status ?? "NOT_STARTED";
}

function isActiveTask(node: TaskNode): boolean {
  return node.type === "task" && !node.isDeleted;
}

const EMPTY_TAGS: KanbanCardTag[] = [];

function tagsFor(taskId: string, tagsByTask?: TagsByTask): KanbanCardTag[] {
  return tagsByTask?.get(taskId) ?? EMPTY_TAGS;
}

/**
 * Build a card model from a task node. `tags` is filled on the status view
 * (the tag view conveys the tag via the column, so it omits per-card chips).
 */
function toCard(
  node: TaskNode,
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
 * active task, grouped by status, each carrying its tags. Status colors are
 * fixed (not editable). Legacy folder nodes are ignored — the task surfaces by
 * its status regardless of any parent folder.
 */
export function buildStatusColumns(
  nodes: TaskNode[],
  labels: KanbanLabels,
  tagsByTask?: TagsByTask,
): KanbanColumnModel[] {
  const byStatus = new Map<TaskStatus, TaskNode[]>();
  for (const status of STATUS_ORDER) byStatus.set(status, []);
  for (const node of nodes) {
    if (!isActiveTask(node)) continue;
    byStatus.get(normalizeStatus(node))?.push(node);
  }

  return STATUS_ORDER.map((status) => {
    const tasks = [...(byStatus.get(status) ?? [])].sort(
      (a, b) => a.order - b.order,
    );
    return {
      id: `status-${status}`,
      title: statusLabel(status, labels),
      statusKind: status,
      accentColor: STATUS_BAND_VAR[status],
      cards: tasks.map((task) =>
        toCard(task, { tags: tagsFor(task.id, tagsByTask) }),
      ),
    };
  });
}

/**
 * Tag view: one column per tag (in the order `tags` is given), cards = active
 * tasks carrying that tag. A trailing "untagged" bucket collects active tasks
 * with no tags. Tag columns are colorEditable (the "untagged" bucket is not).
 * The tag view omits per-card tag chips (the column already conveys the tag).
 */
export function buildTagColumns(
  nodes: TaskNode[],
  tags: KanbanCardTag[],
  tagsByTask: TagsByTask,
  labels: KanbanLabels,
): KanbanColumnModel[] {
  const activeTasks = nodes
    .filter(isActiveTask)
    .sort((a, b) => a.order - b.order);

  const cardFor = (task: TaskNode): KanbanCardModel => toCard(task);

  const columns: KanbanColumnModel[] = tags.map((tag) => ({
    id: `tag-${tag.id}`,
    title: tag.name || "(untitled)",
    accentColor: tag.color,
    colorEditable: true,
    roundDot: true,
    cards: activeTasks
      .filter((task) =>
        (tagsByTask.get(task.id) ?? EMPTY_TAGS).some((t) => t.id === tag.id),
      )
      .map(cardFor),
  }));

  const untagged = activeTasks.filter(
    (task) => (tagsByTask.get(task.id) ?? EMPTY_TAGS).length === 0,
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

/*
 * Column builders (K1 + K2). Pure functions that turn the active TaskNode set
 * into KanbanColumnModel[] for each view mode. No React, no DataService —
 * the host calls these with the data it already has from useTaskTreeContext /
 * useWikiTagsUnifiedContext and injects the resolved status labels.
 *
 * Folder view: one column per folder (root + nested), cards = the folder's
 * DIRECT task children. Status view: three fixed columns keyed by status,
 * cards = every task regardless of folder. Tag view (K2): one column per tag
 * (tag's own color), cards = every task carrying that tag, plus a trailing
 * "untagged" bucket. Folders themselves are never cards (they are containers,
 * mirroring the HTML mock).
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

/**
 * Column id for the synthetic "unfiled" bucket in the folder view: active tasks
 * that sit directly at the tree root (no parent folder). Mirrors the internal
 * childrenByParent grouping key below so root tasks map straight into it. Kept
 * in sync with the web DnD glue (useKanbanDnd), which routes a drop onto this
 * column to moveToRoot rather than moveNodeInto a (non-existent) folder.
 */
export const FOLDER_ROOT_BUCKET_ID = "__root__";

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

function isActiveFolder(node: TaskNode): boolean {
  return node.type === "folder" && !node.isDeleted;
}

const EMPTY_TAGS: KanbanCardTag[] = [];

function tagsFor(taskId: string, tagsByTask?: TagsByTask): KanbanCardTag[] {
  return tagsByTask?.get(taskId) ?? EMPTY_TAGS;
}

/**
 * Build a card model from a task node. `folderName`/`folderColor` are filled
 * by the caller for views where the column does not already convey the
 * folder (status / tag view). `tags` is filled for folder / status views.
 */
function toCard(
  node: TaskNode,
  extras?: {
    folderName?: string;
    folderColor?: string;
    tags?: KanbanCardTag[];
  },
): KanbanCardModel {
  return {
    id: node.id,
    title: node.title,
    status: normalizeStatus(node),
    folderName: extras?.folderName,
    folderColor: extras?.folderColor,
    tags: extras?.tags && extras.tags.length > 0 ? extras.tags : undefined,
  };
}

/**
 * Folder view: a column per active folder. Cards are the folder's direct
 * active task children, each carrying its tags. Folders with no tasks still
 * render (empty column). Folder columns are colorEditable.
 */
export function buildFolderColumns(
  nodes: TaskNode[],
  tagsByTask?: TagsByTask,
  rootLabel?: string,
): KanbanColumnModel[] {
  const folders = nodes.filter(isActiveFolder);
  const childrenByParent = new Map<string, TaskNode[]>();
  for (const node of nodes) {
    if (!isActiveTask(node)) continue;
    const key = node.parentId ?? FOLDER_ROOT_BUCKET_ID;
    const list = childrenByParent.get(key);
    if (list) list.push(node);
    else childrenByParent.set(key, [node]);
  }
  const sortByOrder = (list: TaskNode[]) =>
    [...list].sort((a, b) => a.order - b.order);

  const columns: KanbanColumnModel[] = sortByOrder(folders).map((folder) => ({
    id: folder.id,
    title: folder.title || "(untitled)",
    accentColor: folder.color,
    colorEditable: true,
    cards: sortByOrder(childrenByParent.get(folder.id) ?? []).map((task) =>
      // Folder-view cards omit folderColor: the COLUMN already conveys the
      // folder (its accentColor tints the panel — see KanbanColumn), so the
      // card needs no folder pill/wash here.
      toCard(task, { tags: tagsFor(task.id, tagsByTask) }),
    ),
  }));

  // Trailing "unfiled" bucket: active tasks that sit at the tree root with no
  // parent folder. Before this, the folder view only carded folder CHILDREN, so
  // a root-level task was unreachable — a root-only tree rendered as an empty
  // board even though the tab badge still counted it. Additive + guarded: only
  // appended when such tasks exist AND the host injects a label, so existing
  // folder-only boards keep their exact look. Neutral accent + not
  // color-editable (it is a synthetic bucket, not a real folder node).
  const rootTasks = childrenByParent.get(FOLDER_ROOT_BUCKET_ID);
  if (rootLabel !== undefined && rootTasks && rootTasks.length > 0) {
    columns.push({
      id: FOLDER_ROOT_BUCKET_ID,
      title: rootLabel,
      accentColor: UNTAGGED_ACCENT,
      cards: sortByOrder(rootTasks).map((task) =>
        toCard(task, { tags: tagsFor(task.id, tagsByTask) }),
      ),
    });
  }

  return columns;
}

/**
 * Status view: three fixed columns (未着手 / 進行中 / 完了). Cards are every
 * active task, grouped by status, with a folder pill resolved from the
 * task's parent folder (if any) + its tags. Status colors are fixed (not
 * editable).
 */
export function buildStatusColumns(
  nodes: TaskNode[],
  labels: KanbanLabels,
  tagsByTask?: TagsByTask,
): KanbanColumnModel[] {
  const folderById = new Map<string, TaskNode>();
  for (const node of nodes) {
    if (isActiveFolder(node)) folderById.set(node.id, node);
  }

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
      cards: tasks.map((task) => {
        const folder = task.parentId
          ? folderById.get(task.parentId)
          : undefined;
        return toCard(task, {
          folderName: folder?.title,
          folderColor: folder?.color,
          tags: tagsFor(task.id, tagsByTask),
        });
      }),
    };
  });
}

/**
 * Tag view (K2): one column per tag (in the order `tags` is given), cards =
 * active tasks carrying that tag, each with a folder pill. A trailing
 * "untagged" bucket collects active tasks with no tags. Tag columns are
 * colorEditable (the "untagged" bucket is not). The tag view omits per-card
 * tag chips (the column already conveys the tag).
 */
export function buildTagColumns(
  nodes: TaskNode[],
  tags: KanbanCardTag[],
  tagsByTask: TagsByTask,
  labels: KanbanLabels,
): KanbanColumnModel[] {
  const folderById = new Map<string, TaskNode>();
  for (const node of nodes) {
    if (isActiveFolder(node)) folderById.set(node.id, node);
  }

  const activeTasks = nodes
    .filter(isActiveTask)
    .sort((a, b) => a.order - b.order);

  const cardFor = (task: TaskNode): KanbanCardModel => {
    const folder = task.parentId ? folderById.get(task.parentId) : undefined;
    return toCard(task, {
      folderName: folder?.title,
      folderColor: folder?.color,
    });
  };

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

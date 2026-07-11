/*
 * Kanban view models + labels (K1). Pure data shapes consumed by the
 * Kanban primitives (KanbanCard / KanbanColumn / KanbanBoard). The host
 * (web/electron/capacitor) maps its TaskNode[] into these models and
 * injects i18n copy — the primitives never call useTranslation /
 * getDataService (CLAUDE.md §6.4).
 */

import type { TaskStatus } from "../../types/taskTree";

/**
 * Which axis the board groups cards by.
 * - status: three fixed columns (未着手 / 進行中 / 完了)
 * - tag:    one column per tag (+ a trailing "untagged" bucket)
 *
 * The legacy "folder" axis was retired (life-tags unification S1) — folders no
 * longer group the board; tags are the organizing concept, status the progress
 * axis.
 */
export type KanbanViewMode = "status" | "tag";

/**
 * A tag rendered as a chip on a card / a column header (K2). Color is the
 * tag's own tint (user-data driven); undefined → a neutral fallback.
 */
export interface KanbanCardTag {
  id: string;
  name: string;
  color?: string;
}

/**
 * A single task rendered as a card. `status` is normalized to a non-null
 * TaskStatus by the column builder (folders are excluded from cards).
 */
export interface KanbanCardModel {
  id: string;
  title: string;
  status: TaskStatus;
  /** Tags assigned to this task. Rendered as chips on the status view;
   *  omitted on the tag view (the column already conveys the tag). */
  tags?: KanbanCardTag[];
}

/**
 * One column on the board. The accent (`accentColor`) drives the 4px top
 * band, the dot, and the count badge. `kind` distinguishes a real data
 * column from the K2 placeholder so the board can render an empty
 * "準備中" state without special-casing in the host.
 */
export interface KanbanColumnModel {
  id: string;
  title: string;
  cards: KanbanCardModel[];
  /** CSS color for the column accent (fixed status color / tag color). Passed
   *  through inline style as a CSS var (user-data driven, §6 allows inline CSS
   *  vars for user colors). */
  accentColor?: string;
  /** Status columns render a round/solid status icon in the header instead
   *  of a plain dot; tag columns use the dot. */
  statusKind?: TaskStatus;
  /** Tag columns render a round (vs squared) header dot. */
  roundDot?: boolean;
  /** When true the header shows a color-picker control that calls
   *  onColorChange (tag columns — not status, not the "untagged" bucket). The
   *  host maps the column id back to a tag and persists the chosen color. */
  colorEditable?: boolean;
  /** A placeholder column renders its emptyHint, not cards. (Unused once the
   *  tag view is wired; kept for forward-compat.) */
  isPlaceholder?: boolean;
}

/**
 * DnD adapter for a single card. The host (which owns @dnd-kit) injects the
 * raw setNodeRef + attributes/listeners so the shared card can be made
 * draggable WITHOUT the shared package importing @dnd-kit. `isDragging` lets
 * the card dim its source while the DragOverlay ghost trails the cursor.
 *
 * `attributes` / `listeners` are intentionally typed loosely (the exact
 * @dnd-kit shapes live in the host); the shared leaf just spreads them onto
 * the button.
 */
export interface KanbanCardDndAdapter {
  setNodeRef: (element: HTMLElement | null) => void;
  attributes?: Record<string, unknown>;
  listeners?: Record<string, unknown>;
  isDragging?: boolean;
}

/**
 * DnD adapter for a column (a drop zone). The host injects the droppable
 * setNodeRef and an `isOver` flag so the column can highlight while a card
 * hovers over it. Columns are never draggable, only droppable.
 */
export interface KanbanColumnDndAdapter {
  setNodeRef: (element: HTMLElement | null) => void;
  isOver?: boolean;
}

/** All copy the board + its children need, resolved by the host via t(). */
export interface KanbanLabels {
  /** Segmented control: view-mode labels. */
  viewStatus: string;
  viewTag: string;
  segmentedGroupLabel: string;
  /** Status chip / column labels per status. */
  statusNotStarted: string;
  statusInProgress: string;
  statusDone: string;
  /** Card / column a11y + empty states. */
  cardAriaLabel: (title: string, statusText: string) => string;
  emptyColumn: string;
  placeholderHint: string;
  countAriaLabel: (n: number) => string;
  /** Tag view: the "untagged" bucket column title (K2). */
  untagged: string;
  /** Color picker control (K2): the trigger label + the "clear/default"
   *  option label + the custom (free-form hex) input label. */
  colorPickerLabel: string;
  colorClearLabel: string;
  colorCustomLabel: string;
}

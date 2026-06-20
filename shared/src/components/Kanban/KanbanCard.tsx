/*
 * KanbanCard (K1) — a single task card. Pure presentation: the host maps a
 * TaskNode → KanbanCardModel and injects copy; this component never reaches
 * data or i18n directly (§6.4). Faithful port of the HTML mock's card:
 *   - 4px left status band (color-encoded, but never the SOLE signal)
 *   - status chip = icon + label (color-independent state, a11y)
 *   - folder pill (status/tag views only)
 *
 * Status hue is fixed (todo=blue / progress=amber / done=green) via the
 * notion status-band + chip tokens (bg-notion-status-*-band / -chip-*).
 */

import {
  Circle,
  CircleDashed,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "../cn";
import type { TaskStatus } from "../../types/taskTree";
import type {
  KanbanCardDndAdapter,
  KanbanCardModel,
  KanbanLabels,
} from "./types";

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  NOT_STARTED: Circle,
  IN_PROGRESS: CircleDashed,
  DONE: CheckCircle2,
};

// Left 4px band per status (notion tokens — no hardcoded color, §6).
const STATUS_BAND_CLASS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-notion-status-todo-band",
  IN_PROGRESS: "bg-notion-status-progress-band",
  DONE: "bg-notion-status-done-band",
};

// Chip face classes per status (notion tokens — no hardcoded color, §6).
const STATUS_CHIP_CLASS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-notion-chip-task-bg text-notion-chip-task-fg",
  IN_PROGRESS: "bg-notion-chip-progress-bg text-notion-chip-progress-fg",
  DONE: "bg-notion-chip-completed-bg text-notion-chip-completed-fg",
};

function statusText(status: TaskStatus, labels: KanbanLabels): string {
  switch (status) {
    case "NOT_STARTED":
      return labels.statusNotStarted;
    case "IN_PROGRESS":
      return labels.statusInProgress;
    case "DONE":
      return labels.statusDone;
  }
}

/** Max tag chips shown on a card before collapsing the rest into "+N". */
const MAX_TAG_CHIPS = 3;

/** Tinted tag-chip style from the tag's own color (K2). color-mix keeps the
 *  fill subtle + theme-aware (mirrors the HTML mock's .tag-chip). */
function tagChipStyle(color: string): CSSProperties {
  return {
    borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} 13%, var(--color-bg-primary))`,
    color: `color-mix(in srgb, ${color} 78%, var(--color-text-primary))`,
  };
}

export interface KanbanCardProps {
  card: KanbanCardModel;
  labels: KanbanLabels;
  /** Show the folder pill (status / tag views). Folder view omits it. */
  showFolderPill?: boolean;
  /** Show tag chips (folder / status views). Tag view omits them (the column
   *  already conveys the tag). */
  showTags?: boolean;
  onSelect: (id: string) => void;
  /** DnD wiring injected by the host (optional — omitted on read-only views).
   *  When present the card becomes draggable. */
  dnd?: KanbanCardDndAdapter;
}

export function KanbanCard({
  card,
  labels,
  showFolderPill = false,
  showTags = false,
  onSelect,
  dnd,
}: KanbanCardProps): React.JSX.Element {
  const Icon = STATUS_ICON[card.status];
  const text = statusText(card.status, labels);
  const isDone = card.status === "DONE";
  const folderDotStyle = card.folderColor
    ? ({ backgroundColor: card.folderColor } as CSSProperties)
    : undefined;
  const tags = showTags ? (card.tags ?? []) : [];
  const visibleTags = tags.slice(0, MAX_TAG_CHIPS);
  const overflowCount = tags.length - visibleTags.length;
  const hasFolderPill = showFolderPill && !!card.folderName;
  const hasMeta = hasFolderPill || tags.length > 0;

  return (
    <button
      type="button"
      ref={dnd?.setNodeRef}
      onClick={() => onSelect(card.id)}
      aria-label={labels.cardAriaLabel(card.title || "(untitled)", text)}
      {...dnd?.attributes}
      {...dnd?.listeners}
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg border border-notion-border",
        "bg-notion-bg pl-[15px] pr-3 py-[11px] text-left shadow-notion-sm",
        "transition-[box-shadow,transform,border-color] duration-150",
        "hover:-translate-y-0.5 hover:border-notion-border-strong hover:shadow-notion-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent",
        // Source row dims while its DragOverlay ghost trails the cursor. The
        // overlay (not this primary container) carries the moving visual, so
        // dimming the source here is exempt from the §6.4 opacity rule.
        dnd?.isDragging && "opacity-40",
        dnd && "touch-none",
      )}
    >
      {/* 4px left status band — color-encoded, paired with the chip's
          icon+label so status never depends on color alone. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l",
          STATUS_BAND_CLASS[card.status],
        )}
      />

      <div className="mb-2 flex items-start gap-2">
        <span
          className={cn(
            "min-w-0 flex-1 text-sm font-semibold leading-snug",
            isDone
              ? "text-notion-text-secondary line-through"
              : "text-notion-text",
          )}
        >
          {card.title || "(untitled)"}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2",
            "text-[0.6875rem] font-bold",
            STATUS_CHIP_CLASS[card.status],
          )}
        >
          <Icon size={13} aria-hidden className="shrink-0" />
          {text}
        </span>
      </div>

      {hasMeta && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {hasFolderPill && (
            <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-notion-text-secondary">
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 shrink-0 rounded-[3px]",
                  folderDotStyle ? "" : "bg-notion-border-strong",
                )}
                style={folderDotStyle}
              />
              {card.folderName}
            </span>
          )}

          {visibleTags.map((tag) =>
            tag.color ? (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold"
                style={tagChipStyle(tag.color)}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </span>
            ) : (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full border border-notion-border px-2 py-0.5 text-[0.6875rem] font-semibold text-notion-text-secondary"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-notion-border-strong"
                />
                {tag.name}
              </span>
            ),
          )}

          {overflowCount > 0 && (
            <span className="inline-flex items-center rounded-full border border-notion-border px-1.5 py-0.5 text-[0.6875rem] font-semibold text-notion-text-secondary">
              +{overflowCount}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

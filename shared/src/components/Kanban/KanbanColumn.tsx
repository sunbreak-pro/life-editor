/*
 * KanbanColumn (K1) — one board column. Pure presentation. Renders the
 * mock's column header (4px top accent band + dot/status-icon + name + count
 * badge) and a scrollable card stack. The accent color (folder / status /
 * tag hue) rides on the `--kanban-col-accent` inline CSS var so the band,
 * dot and count badge all pick it up (user-data driven color — §6 permits
 * inline CSS vars for user colors).
 *
 * Status columns swap the dot for a lucide status icon; folder/tag columns
 * keep the rounded dot. The K2 tag placeholder renders an empty hint.
 */

import {
  Circle,
  CircleDashed,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type CSSProperties } from "react";
import { cn } from "../cn";
import type { TaskStatus } from "../../types/taskTree";
import { KanbanCard } from "./KanbanCard";
import { ColorPicker } from "../ColorPicker";
import type {
  KanbanColumnDndAdapter,
  KanbanColumnModel,
  KanbanLabels,
} from "./types";

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  NOT_STARTED: Circle,
  IN_PROGRESS: CircleDashed,
  DONE: CheckCircle2,
};

export interface KanbanColumnProps {
  column: KanbanColumnModel;
  labels: KanbanLabels;
  /** Show folder pills on cards (status / tag views). */
  showFolderPill?: boolean;
  /** Show tag chips on cards (folder / status views). */
  showTags?: boolean;
  /** Tint the column PANEL background with its folder color (folder view). */
  showFolderAccent?: boolean;
  onSelectCard: (id: string) => void;
  /** Set this column's color (folder / tag columns). The host maps the
   *  column id back to a folder node / a tag and persists. null = clear. */
  onColorChange?: (columnId: string, color: string | null) => void;
  /** Drop-zone wiring for THIS column, injected by the host (optional —
   *  omitted on read-only views). When present the column is a drop target. */
  dnd?: KanbanColumnDndAdapter;
  /**
   * Optional per-card renderer override. The host uses this to wrap each card
   * in its own @dnd-kit sortable host component (so the shared package never
   * imports @dnd-kit). When omitted the column renders the plain (non-DnD)
   * KanbanCard. Used by read-only views.
   */
  renderCard?: (card: KanbanColumnModel["cards"][number]) => React.ReactNode;
}

export function KanbanColumn({
  column,
  labels,
  showFolderPill = false,
  showTags = false,
  showFolderAccent = false,
  onSelectCard,
  onColorChange,
  dnd,
  renderCard,
}: KanbanColumnProps): React.JSX.Element {
  const accent = column.accentColor;
  // Folder view tints the whole column PANEL with the folder's color (the
  // user-requested "the folder panel's background is the folder color") — NOT
  // the cards inside it. A theme-aware color-mix wash: a soft body tint + a
  // slightly stronger header, while the cards stay opaque (bg-lumen-bg) so
  // they read clearly on top. color-mix against --color-bg-primary keeps it
  // subtle + dark-mode aware. accent here is the folder color (user data — §6
  // permits inline styles / CSS vars for user colors).
  const folderTint = showFolderAccent && accent ? accent : null;
  const sectionStyle = {
    // Default to the lumen accent token when the column has no explicit color
    // (e.g. a folder with no color set).
    "--kanban-col-accent": accent ?? "var(--color-accent)",
    ...(folderTint
      ? {
          backgroundColor: `color-mix(in srgb, ${folderTint} 10%, var(--color-bg-primary))`,
        }
      : {}),
  } as CSSProperties;
  const headerStyle: CSSProperties | undefined = folderTint
    ? {
        backgroundColor: `color-mix(in srgb, ${folderTint} 18%, var(--color-bg-primary))`,
      }
    : undefined;
  const StatusIcon = column.statusKind ? STATUS_ICON[column.statusKind] : null;
  const showColorControl = column.colorEditable && !!onColorChange;

  return (
    <section
      ref={dnd?.setNodeRef}
      role="listitem"
      aria-label={column.title}
      style={sectionStyle}
      className={cn(
        "flex max-h-[560px] w-[316px] shrink-0 flex-col overflow-hidden",
        "rounded-2xl border bg-lumen-bg shadow-lumen-md transition-[box-shadow,border-color]",
        // Highlight the drop target while a card hovers over it. Ring +
        // accent border only (bg stays opaque — §6.4).
        dnd?.isOver
          ? "border-lumen-accent ring-2 ring-lumen-accent"
          : "border-lumen-border",
      )}
    >
      {/* Column header — top 4px accent band + dot/status-icon + name + count */}
      <div
        style={headerStyle}
        className="relative border-b border-lumen-border bg-lumen-bg-secondary px-3.5 pb-2.5 pt-3.5"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: "var(--kanban-col-accent)" }}
        />
        <div className="flex items-center gap-2.5">
          {StatusIcon ? (
            <StatusIcon
              size={16}
              aria-hidden
              className="shrink-0"
              style={{ color: "var(--kanban-col-accent)" }}
            />
          ) : (
            <span
              aria-hidden
              className={cn(
                "h-3 w-3 shrink-0",
                column.roundDot ? "rounded-full" : "rounded-[4px]",
              )}
              style={{ backgroundColor: "var(--kanban-col-accent)" }}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold text-lumen-text">
            {column.title}
          </span>
          {!column.isPlaceholder && (
            <span
              aria-label={labels.countAriaLabel(column.cards.length)}
              className={cn(
                "min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold",
                "bg-lumen-bg text-lumen-text-secondary",
              )}
              style={{ color: "var(--kanban-col-accent)" }}
            >
              {column.cards.length}
            </span>
          )}
        </div>
        {showColorControl && (
          <div className="mt-2 flex items-center">
            <ColorPicker
              current={column.accentColor}
              label={labels.colorPickerLabel}
              clearLabel={labels.colorClearLabel}
              customLabel={labels.colorCustomLabel}
              onPick={(color) => onColorChange?.(column.id, color)}
            />
          </div>
        )}
      </div>

      {/* Column body — scrollable card stack */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {column.isPlaceholder ? (
          <div className="px-3 py-7 text-center text-sm leading-relaxed text-lumen-text-secondary">
            {labels.placeholderHint}
          </div>
        ) : column.cards.length === 0 ? (
          <div className="px-3 py-7 text-center text-sm leading-relaxed text-lumen-text-secondary">
            {labels.emptyColumn}
          </div>
        ) : (
          column.cards.map((card) =>
            renderCard ? (
              <Fragment key={card.id}>{renderCard(card)}</Fragment>
            ) : (
              <KanbanCard
                key={card.id}
                card={card}
                labels={labels}
                showFolderPill={showFolderPill}
                showTags={showTags}
                onSelect={onSelectCard}
              />
            ),
          )
        )}
      </div>
    </section>
  );
}

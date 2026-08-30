import type { ReactNode } from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  EmptyState,
  SidebarListControls,
  StatusFilterChips,
  NoticePanel,
  tagGroupKey as groupKey,
  cn,
  type NoteNode,
  type NoteTagGroup,
  FOCUS_RING,
  tourAnchor,
} from "@life-editor/shared";
import { noteDraggableId, type NoteTagDnd } from "./useNoteTagDnd";
import { DesktopNoteRow, DesktopTagHeading } from "./NoteListRows";
import { TreeDragGhost } from "../components/TreeDragGhost";

/*
 * The Desktop side list (extracted from NotesView.tsx — #588 split, zero
 * behavior change): search + sort + tag filter, the tag-grouped note rows, and
 * the Links / Trash disclosures under the divider.
 *
 * The host pushes this into the shared rightSidebar (wide-only) — the panel
 * well supplies padding + scroll, so this is frameless natural-flow content.
 *
 * Everything arrives as props, i18n included (§6.4): the derived list pipeline
 * is shared with the Mobile surface, so it has to stay in the host — computing
 * it here would give the two breakpoints separate copies of the same state.
 *
 * DnD: drag a note onto a tag heading = assign that tag. The untagged bucket is
 * NOT a drop target (dropping there would mean "remove all tags" — destructive,
 * so a no-op). No reorder / move-into: sort_order carries no meaning across the
 * many-to-many tag model.
 */

export interface NotesSidebarListLabels {
  searchPlaceholder: string;
  sort: string;
  toggleDirection: string;
  tagFilter: string;
  empty: string;
  addCta: string;
  collapseGroup: string;
  expandGroup: string;
  deleteNote: string;
  assignTagHint: string;
  trash: string;
  /** Stands in for an empty title, on screen and in the two labels below. */
  untitled: string;
  /*
   * The trash row actions carry the note's title, so they arrive as builders
   * rather than strings — the title's position inside the sentence is the
   * translator's call (#680: these were hardcoded English until the catalog
   * took them over).
   */
  restoreNote: (title: string) => string;
  permanentDeleteNote: (title: string) => string;
}

export interface NotesSidebarListProps {
  labels: NotesSidebarListLabels;

  // Search + sort + tag filter (host-owned, shared with the Mobile surface).
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortModes: { id: string; label: string }[];
  sortMode: string;
  onSortModeChange: (id: string) => void;
  sortDirection: "asc" | "desc";
  onToggleDirection: () => void;
  directionLabel: string;
  showTagFilter: boolean;
  tagFilterChips: {
    id: string;
    label: string;
    count: number;
    icon: ReactNode;
  }[];
  tagFilter: string | null;
  onTagFilterChange: (id: string | null) => void;

  // The list itself.
  error: string | null;
  hasNotes: boolean;
  visibleGroups: NoteTagGroup[];
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateNote: () => void;
  dnd: NoteTagDnd;

  /**
   * The saved-templates disclosure (#1180), built by the host because it owns
   * the DataService the templates are read and written through. Rendered above
   * Trash — both are collections this tab keeps out of the main list.
   */
  templatesSlot?: ReactNode;

  // Trash disclosure.
  trashOpen: boolean;
  onToggleTrash: () => void;
  deletedNotes: NoteNode[];
  onRestoreNote: (id: string) => void;
  onPermanentDeleteNote: (id: string) => void;
}

export function NotesSidebarList({
  labels,
  searchQuery,
  onSearchChange,
  sortModes,
  sortMode,
  onSortModeChange,
  sortDirection,
  onToggleDirection,
  directionLabel,
  showTagFilter,
  tagFilterChips,
  tagFilter,
  onTagFilterChange,
  error,
  hasNotes,
  visibleGroups,
  collapsedGroups,
  onToggleGroup,
  selectedNoteId,
  onSelectNote,
  onDeleteNote,
  onCreateNote,
  dnd,
  templatesSlot,
  trashOpen,
  onToggleTrash,
  deletedNotes,
  onRestoreNote,
  onPermanentDeleteNote,
}: NotesSidebarListProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Search only. Create moved to the main-content top-right (#302); folder-
          create is gone — organization is tags now. */}
      <div className="flex flex-col gap-2">
        <div className="flex h-8 items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-surface-sunken px-2.5">
          <Search
            size={13}
            aria-hidden
            className="shrink-0 text-lumen-text-tertiary"
          />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none"
          />
        </div>
      </div>

      {/* Sort controls (#283) — mode picker + direction toggle above the list.
          No filter row: title search already exists via the search box above. */}
      <SidebarListControls
        modes={sortModes}
        activeModeId={sortMode}
        onModeChange={onSortModeChange}
        sortLabel={labels.sort}
        direction={sortDirection}
        onToggleDirection={onToggleDirection}
        directionLabel={directionLabel}
        directionToggleLabel={labels.toggleDirection}
      />

      {/* Tag filter (#369) — solo one tag group; the active chip clears it. */}
      {showTagFilter && (
        // #1125 anchors the tour's "follow a tag" step here. CONDITIONAL by
        // nature: the row only renders with more than one group to choose
        // between, so a user with a single tag has no anchor and the tour
        // skips that step rather than waiting on a control that will not
        // appear (anchor.ts).
        <div {...tourAnchor("materials-tag-filter")}>
          <StatusFilterChips
            chips={tagFilterChips}
            value={tagFilter}
            onChange={onTagFilterChange}
            label={labels.tagFilter}
            size="sm"
          />
        </div>
      )}

      {error && (
        // No glyph: this band sits in a dense sidebar column where the
        // extra 16px pushes the first tag heading off the fold.
        <NoticePanel message={error} tone="danger" icon={null} />
      )}

      {/* Tag groups. */}
      {!hasNotes ? (
        <EmptyState
          icon={<FileText aria-hidden />}
          message={labels.empty}
          cta={{ label: labels.addCta, onClick: onCreateNote }}
        />
      ) : (
        <DndContext
          sensors={dnd.sensors}
          collisionDetection={pointerWithin}
          onDragStart={dnd.handleDragStart}
          onDragOver={dnd.handleDragOver}
          onDragEnd={dnd.handleDragEnd}
          onDragCancel={dnd.handleDragCancel}
        >
          <ul className="flex flex-col gap-1.5">
            {visibleGroups.map((group) => {
              const key = groupKey(group);
              const collapsed = collapsedGroups.has(key);
              return (
                <li key={key} className="flex flex-col gap-px">
                  <DesktopTagHeading
                    group={group}
                    collapsed={collapsed}
                    onToggle={onToggleGroup}
                    collapseLabel={labels.collapseGroup}
                    expandLabel={labels.expandGroup}
                  />
                  {!collapsed && (
                    <ul className="flex flex-col gap-0.5">
                      {group.notes.map((node) => (
                        <DesktopNoteRow
                          key={`${key}-${node.id}`}
                          node={node}
                          dragId={noteDraggableId(key, node.id)}
                          selected={selectedNoteId === node.id}
                          onSelect={onSelectNote}
                          onDelete={onDeleteNote}
                          deleteLabel={labels.deleteNote}
                          dragHintLabel={labels.assignTagHint}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <DragOverlay>
            {dnd.activeNote ? (
              <TreeDragGhost title={dnd.activeNote.title} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {templatesSlot}

      {/* Trash section. (The Links disclosure that used to sit above it moved
          into the note detail header, beside the tags — #884.) */}
      <div className="border-t border-lumen-border pt-1">
        <button
          type="button"
          onClick={onToggleTrash}
          aria-expanded={trashOpen}
          className={cn(
            "flex w-full items-center gap-2 rounded-lumen-md px-1 py-2 text-[12.5px] text-lumen-text-secondary hover:bg-lumen-hover",
            FOCUS_RING,
          )}
        >
          {trashOpen ? (
            <ChevronDown size={13} aria-hidden className="shrink-0" />
          ) : (
            <ChevronRight size={13} aria-hidden className="shrink-0" />
          )}
          <Trash2 size={14} aria-hidden className="shrink-0" />
          <span className="truncate">
            {labels.trash}（{deletedNotes.length}）
          </span>
        </button>
        {trashOpen && deletedNotes.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto pb-2">
            {deletedNotes.map((n) => {
              const title = n.title || labels.untitled;
              return (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-2 px-1 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-lumen-text-secondary line-through">
                    {title}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onRestoreNote(n.id)}
                      aria-label={labels.restoreNote(title)}
                      className={cn(
                        "text-lumen-accent hover:opacity-80",
                        FOCUS_RING,
                      )}
                    >
                      <RotateCcw size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onPermanentDeleteNote(n.id)}
                      aria-label={labels.permanentDeleteNote(title)}
                      className={cn(
                        "text-lumen-danger hover:opacity-80",
                        FOCUS_RING,
                      )}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/*
       * The Notes-local tag edit entry (#310) was removed in #409: the tag
       * master now lives in the app shell's left sidebar (above ⌘K), reachable
       * from every section including this one. Two doors to the same panel is
       * one too many, and the panel's scope outgrew this sidebar anyway — it
       * lists items of every kind (todos / events / notes / dailies), so
       * presenting it as a Notes feature misdescribed it.
       */}
    </div>
  );
}

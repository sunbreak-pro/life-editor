import { useState, type ReactNode } from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { FileText, Search } from "lucide-react";
import {
  EmptyState,
  SidebarListControls,
  NoticePanel,
  tagGroupKey as groupKey,
  cn,
  type NoteTagGroup,
  FOCUS_RING,
  tourAnchor,
} from "@life-editor/shared";
import { noteDraggableId, type NoteTagDnd } from "./useNoteTagDnd";
import { NoteTagFilterChips } from "./NoteTagFilterChips";
import { DesktopNoteRow, DesktopTagHeading } from "./NoteListRows";
import { TreeDragGhost } from "../components/TreeDragGhost";

/*
 * The Desktop side list (extracted from NotesView.tsx — #588 split, zero
 * behavior change): search + sort + tag filter and the tag-grouped note rows.
 *
 * #1286 removed the trash disclosure that used to sit under the divider. It
 * listed soft-deleted notes with restore / purge buttons — the same two actions
 * the Trash SECTION offers for every domain, so the app asked the user to learn
 * one recovery surface per place instead of one for the whole app. Recovery is
 * now Trash's job alone; the note list only lists live notes. (The Links
 * disclosure that used to sit above it moved to the note detail header in #884,
 * so the divider itself has nothing left to separate.)
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
  /** Shown instead of `empty` when a query matched nothing (#1470). */
  searchEmpty: string;
  addCta: string;
  collapseGroup: string;
  expandGroup: string;
  deleteNote: string;
  assignTagHint: string;
  /** Drop every tag-filter chip at once (#1288). */
  clearTagFilter: string;
  /** "+N" for the chips the capped filter row is not drawing (#1288). */
  moreTagFilters: (count: number) => string;
  /** Collapse the filter row back to its cap (#1288). */
  fewerTagFilters: string;
  /** "Show the remaining N notes in this group" (#1288). */
  moreRows: (count: number) => string;
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
  /** Selected tag-group keys; empty = no filter (#1288). */
  tagFilters: readonly string[];
  onToggleTagFilter: (id: string) => void;
  onClearTagFilters: () => void;
  /**
   * Rows drawn per group before the "show the rest" button, or null for no cap
   * (#1288 — the host caps only while no tag is selected).
   */
  rowCap: number | null;

  // The list itself.
  error: string | null;
  /** Whether the VAULT holds any note — not whether the query matched (#1470). */
  hasNotes: boolean;
  /** A query is on and nothing matched it (#1470). */
  searchEmpty: boolean;
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
  tagFilters,
  onToggleTagFilter,
  onClearTagFilters,
  rowCap,
  error,
  hasNotes,
  searchEmpty,
  visibleGroups,
  collapsedGroups,
  onToggleGroup,
  selectedNoteId,
  onSelectNote,
  onDeleteNote,
  onCreateNote,
  dnd,
  templatesSlot,
}: NotesSidebarListProps) {
  /*
   * Which groups the user has opened past `rowCap` (#1288). Local UI state, not
   * host state and not persisted: it answers "I am looking at this group right
   * now", and a cap that stayed open forever would undo the tidying the next
   * time the list is opened. Collapse (the chevron) is the persisted one — that
   * is a lasting statement about a tag, this is not.
   */
  const [openedGroups, setOpenedGroups] = useState<Set<string>>(new Set());
  const openGroup = (key: string) =>
    setOpenedGroups((prev) => new Set(prev).add(key));

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

      {/* Tag filter (#369, multi-select since #1288) — each chip is a heading
          to show; the row caps itself and offers a clear. */}
      {showTagFilter && (
        // #1125 anchors the tour's "follow a tag" step here. CONDITIONAL by
        // nature: the row only renders with more than one group to choose
        // between, so a user with a single tag has no anchor and the tour
        // skips that step rather than waiting on a control that will not
        // appear (anchor.ts).
        <div {...tourAnchor("materials-tag-filter")}>
          <NoteTagFilterChips
            chips={tagFilterChips}
            value={tagFilters}
            onToggle={onToggleTagFilter}
            onClear={onClearTagFilters}
            labels={{
              group: labels.tagFilter,
              clear: labels.clearTagFilter,
              more: labels.moreTagFilters,
              less: labels.fewerTagFilters,
            }}
          />
        </div>
      )}

      {error && (
        // No glyph: this band sits in a dense sidebar column where the
        // extra 16px pushes the first tag heading off the fold.
        <NoticePanel message={error} tone="danger" icon={null} />
      )}

      {/* Tag groups. */}
      {searchEmpty ? (
        /*
         * #1470: a query nobody's notes match is not an empty vault. This used
         * to fall through to the branch below, so the list answered a typo
         * with "No notes yet" and an accent CREATE button — an offer to make a
         * note out of the search term while the term was still in the box, and
         * the wrong statement about a vault that is full. No CTA of its own:
         * the answer to "nothing matched" is another word, and the toolbar
         * pill above is still there for anyone who did mean to create.
         */
        <EmptyState icon={<Search aria-hidden />} message={labels.searchEmpty} />
      ) : !hasNotes ? (
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
              // #1288: cap the rows unless this group was opened by hand (or
              // the host lifted the cap because a tag filter is on).
              const capped =
                rowCap !== null && !openedGroups.has(key) ? rowCap : null;
              const shownNotes =
                capped === null ? group.notes : group.notes.slice(0, capped);
              const hiddenRows = group.notes.length - shownNotes.length;
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
                    <>
                      <ul className="flex flex-col gap-0.5">
                        {shownNotes.map((node) => (
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
                      {/* One-way on purpose: the button says how many are
                          hidden, and once they are out there is nothing left
                          for it to say. Folding the group again is what the
                          heading's chevron is for. */}
                      {hiddenRows > 0 && (
                        <button
                          type="button"
                          onClick={() => openGroup(key)}
                          className={cn(
                            "self-start rounded-lumen-md px-2 py-1 text-[11.5px] text-lumen-text-tertiary hover:bg-lumen-hover hover:text-lumen-text-secondary",
                            FOCUS_RING,
                          )}
                        >
                          {labels.moreRows(hiddenRows)}
                        </button>
                      )}
                    </>
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

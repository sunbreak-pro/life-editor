import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import {
  EmptyState,
  SidebarListControls,
  NoticePanel,
  tagGroupKey as groupKey,
  UNTAGGED_GROUP_KEY,
  BUSY_STALE,
  cn,
  type NoteNode,
  type NoteTagGroup,
  FOCUS_RING,
  tourAnchor,
} from "@life-editor/shared";
import { noteDraggableId, type NoteTagDnd } from "./useNoteTagDnd";
import { NoteTagFilterPanel } from "./NoteTagFilterPanel";
import { DesktopNoteRow, DesktopTagHeading } from "./NoteListRows";
import { OtherNotesFlyout, OtherNotesList } from "./OtherNotesPanel";
import { TreeDragGhost } from "../components/TreeDragGhost";

/*
 * The Desktop side list (extracted from NotesView.tsx — #588 split, zero
 * behavior change): search + sort + tag filter and the note rows.
 *
 * TWO LISTS since #2061. With no tag selected it draws the DEFAULT list: one
 * flat column, pinned notes first and then the current sort, 15 rows, and an
 * "Other items (N)" entry under the 15th that opens the rest — as a flyout on
 * the sidebar's left edge on wide, as a view inside the drawer on narrow
 * (OtherNotesPanel). Selecting a tag in the filter (#2059) switches it to the
 * tag-grouped list that used to be the default; clearing it switches back.
 * The host decides which (`listMode`) and computes both.
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
 * DnD: drag a note onto a tag heading = MOVE it there (#1687) — the tag of the
 * heading it came from goes, the tag it landed on arrives. The untagged bucket
 * is a target too, and dropping there removes only that one tag rather than
 * every tag the note has. No reorder / move-into: sort_order carries no meaning
 * across the many-to-many tag model. Only the tag-grouped list has headings to
 * drop on, so only its rows drag (#2061); the default list's rows do not.
 */

export interface NotesSidebarListLabels {
  searchPlaceholder: string;
  sort: string;
  toggleDirection: string;
  tagFilter: string;
  empty: string;
  /** Shown instead of `empty` when a query matched nothing (#1470). */
  searchEmpty: string;
  /** The body search failed; only title matches are shown (#1972). */
  bodySearchFailed: string;
  addCta: string;
  collapseGroup: string;
  expandGroup: string;
  deleteNote: string;
  /** The pencil left of a row's bin on narrow (#2032). */
  editNote: string;
  assignTagHint: string;
  /** Drop every tag-filter selection at once (#1288). */
  clearTagFilter: string;
  /** The filter button's accessible name while N tags are selected (#2059). */
  tagFilterSelected: (count: number) => string;
  /** Accessible name for the panel of tag options (#2059). */
  tagFilterPanel: string;
  /** "Other items (N)" — the entry under the default list's 15th row (#2061). */
  otherItems: (count: number) => string;
  /** Closes the wide "Other items" flyout (#2061). */
  closeOtherItems: string;
  /** Leaves the narrow "Other items" view for the list (#2061). */
  backToList: string;
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
  tagFilterOptions: {
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
   * Which list to draw (#2061): the flat default list, or the tag groups
   * (while a tag is selected).
   */
  listMode: "flat" | "grouped";
  /** The default list's rows — the first 15, or every match while searching. */
  defaultNotes: NoteNode[];
  /** What the default list leaves past its 15th row ("Other items"). */
  otherNotes: NoteNode[];
  /**
   * How "Other items" opens (#2061): a flyout on the sidebar's left edge
   * (wide), or a view that replaces the list inside the drawer (narrow).
   */
  othersPresentation: "flyout" | "inline";

  // The list itself.
  error: string | null;
  /** Whether the VAULT holds any note — not whether the query matched (#1470). */
  hasNotes: boolean;
  /** A query is on and nothing matched it (#1470). */
  searchEmpty: boolean;
  /** The body half of the query is still in flight (#1837). */
  searchBusy?: boolean;
  /** The body half of the query failed — only title matches below (#1972). */
  searchFailed?: boolean;
  visibleGroups: NoteTagGroup[];
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  /**
   * Right-click on a tag row — a filter option or a group heading (#1677). The
   * id handed back is the TAG id: an option carries a group key, which is the
   * tag id for every group but the untagged bucket, and that bucket is
   * filtered out here rather than at the host. Undefined on narrow, where no
   * row attaches a contextmenu listener at all.
   */
  onTagContextMenu?: (tagId: string, event: ReactMouseEvent) => void;
  /** Right-click on a note row (#1677). Undefined on narrow. */
  onNoteContextMenu?: (noteId: string, event: ReactMouseEvent) => void;
  /** Long-press on a tag heading (#2008) — narrow only, undefined on Desktop. */
  onTagLongPress?: (tagId: string) => void;
  /**
   * The pencil on a note row (#2032) — narrow only, undefined on Desktop. When
   * it is set the rows are touch rows: they do not drag and a hold on them
   * answers nothing.
   */
  onEditNote?: (noteId: string) => void;
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
  tagFilterOptions,
  tagFilters,
  onToggleTagFilter,
  onClearTagFilters,
  listMode,
  defaultNotes,
  otherNotes,
  othersPresentation,
  error,
  hasNotes,
  searchEmpty,
  searchBusy = false,
  searchFailed = false,
  visibleGroups,
  collapsedGroups,
  onToggleGroup,
  selectedNoteId,
  onSelectNote,
  onDeleteNote,
  onTagContextMenu,
  onNoteContextMenu,
  onTagLongPress,
  onEditNote,
  onCreateNote,
  dnd,
  templatesSlot,
}: NotesSidebarListProps) {
  /*
   * Whether "Other items" is open (#2061). Local UI state, not persisted: it
   * answers "I am looking past the 15th row right now". It can only SHOW while
   * there is something past the 15th row of the default list — a search lifts
   * the cap and a tag switches to the grouped list, and either takes the
   * others away — and the handlers that cause those two also close it, so it
   * does not come back by itself when the query or the tag is cleared.
   */
  const [othersOpen, setOthersOpen] = useState(false);
  const othersId = useId();
  // The trigger as STATE (a callback ref), not a ref object: the flyout is
  // anchored off it during render, and refs are not read during render.
  const [othersTrigger, setOthersTrigger] = useState<HTMLButtonElement | null>(
    null,
  );
  const othersShown =
    othersOpen && listMode === "flat" && otherNotes.length > 0;

  /*
   * Closing by its own way out (close / back / Esc) puts the focus back on the
   * trigger. Through an effect rather than inline, because on narrow the
   * trigger is not in the tree while the others view is — it comes back with
   * the list on the next commit.
   */
  const refocusTrigger = useRef(false);
  useEffect(() => {
    // Waits for the trigger element too: on narrow it re-registers through
    // its callback ref one render after the view closes.
    if (othersShown || !refocusTrigger.current || !othersTrigger) return;
    refocusTrigger.current = false;
    othersTrigger.focus();
  }, [othersShown, othersTrigger]);
  const dismissOthers = () => {
    refocusTrigger.current = true;
    setOthersOpen(false);
  };
  const closeOthersQuietly = () => setOthersOpen(false);

  const handleSearchChange = (value: string) => {
    closeOthersQuietly();
    onSearchChange(value);
  };
  const handleToggleTagFilter = (id: string) => {
    closeOthersQuietly();
    onToggleTagFilter(id);
  };

  /*
   * A filter option's id is a GROUP KEY (useNoteListState), which is the tag's
   * own id for every group except the untagged bucket's sentinel. So the tag
   * menu gets the id as-is, and the bucket — which has no tag to rename or
   * delete — falls through to the browser's own menu, exactly as the Connect
   * rail lets its untagged row do.
   */
  const optionContextMenu = onTagContextMenu
    ? (id: string, event: ReactMouseEvent) => {
        if (id === UNTAGGED_GROUP_KEY) return;
        onTagContextMenu(id, event);
      }
    : undefined;

  /** A row of the default list or of "Other items" — never a drag source. */
  const flatRow = (node: NoteNode, onSelect: (id: string) => void) => (
    <DesktopNoteRow
      key={node.id}
      node={node}
      dragId={`flat-${node.id}`}
      draggable={false}
      selected={selectedNoteId === node.id}
      onSelect={onSelect}
      onDelete={onDeleteNote}
      onContextMenu={onNoteContextMenu}
      onEdit={onEditNote}
      editLabel={labels.editNote}
      deleteLabel={labels.deleteNote}
      dragHintLabel={labels.assignTagHint}
    />
  );

  // Picking a note out of "Other items" opens it, and the list it came from
  // gets out of the way of the note — the flyout lies over the main area.
  const selectFromOthers = (id: string) => {
    closeOthersQuietly();
    onSelectNote(id);
  };
  const othersTitle = labels.otherItems(otherNotes.length);
  const othersRows = otherNotes.map((node) => flatRow(node, selectFromOthers));
  const othersInline = othersShown && othersPresentation === "inline";

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
            onChange={(e) => handleSearchChange(e.target.value)}
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

      {/* Tag filter (#369, multi-select since #1288). Since #2059 a button
          that opens the tag panel in place, where it used to be a chip row
          drawn at all times; each option is still a heading to show. */}
      {showTagFilter && (
        // #1125 anchors the tour's "follow a tag" step here. CONDITIONAL by
        // nature: the filter only renders with more than one group to choose
        // between, so a user with a single tag has no anchor and the tour
        // skips that step rather than waiting on a control that will not
        // appear (anchor.ts).
        <div {...tourAnchor("materials-tag-filter")}>
          <NoteTagFilterPanel
            options={tagFilterOptions}
            value={tagFilters}
            onToggle={handleToggleTagFilter}
            onClear={onClearTagFilters}
            onOptionContextMenu={optionContextMenu}
            labels={{
              button: labels.tagFilter,
              buttonSelected: labels.tagFilterSelected,
              panel: labels.tagFilterPanel,
              clear: labels.clearTagFilter,
            }}
          />
        </div>
      )}

      {searchFailed && (
        // #1972: a failed body search used to look exactly like "no body
        // matched". Warning, not danger: the list below is still right about
        // titles. `status`, because it follows typing, and an alert per
        // debounced keystroke would talk over the user.
        <NoticePanel
          message={labels.bodySearchFailed}
          tone="warning"
          role="status"
          icon={null}
        />
      )}

      {error && (
        // No glyph: this band sits in a dense sidebar column where the
        // extra 16px pushes the first tag heading off the fold.
        <NoticePanel message={error} tone="danger" icon={null} />
      )}

      {/*
       * The list. While the body half of a search is still in flight the
       * rows below are the title matches — right as far as they go, and one
       * query behind. They are dimmed rather than replaced, and `aria-busy`
       * says the same thing to anything not looking at the dimming. Never
       * `aria-busy` on its own (#1804): a state nobody can see is not one.
       */}
      <div
        // A real box, not `display: contents`: opacity needs one to apply to.
        className={cn(searchBusy && BUSY_STALE)}
        aria-busy={searchBusy || undefined}
      >
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
          <EmptyState
            icon={<Search aria-hidden />}
            message={labels.searchEmpty}
          />
        ) : !hasNotes ? (
          <EmptyState
            icon={<FileText aria-hidden />}
            message={labels.empty}
            cta={{ label: labels.addCta, onClick: onCreateNote }}
          />
        ) : othersInline ? (
          /* #2061, narrow: "Other items" replaces the list inside the drawer,
             with a back button to return to it. */
          <OtherNotesList
            id={othersId}
            variant="inline"
            title={othersTitle}
            dismissLabel={labels.backToList}
            onDismiss={dismissOthers}
          >
            {othersRows}
          </OtherNotesList>
        ) : listMode === "flat" ? (
          /* #2061 — the default list: pinned → current sort, 15 rows. */
          <div className="flex flex-col gap-1">
            <ul className="flex flex-col gap-0.5">
              {defaultNotes.map((node) => flatRow(node, onSelectNote))}
            </ul>
            {otherNotes.length > 0 && (
              <button
                ref={setOthersTrigger}
                type="button"
                onClick={() => setOthersOpen((v) => !v)}
                aria-expanded={othersShown}
                aria-controls={othersId}
                className={cn(
                  "flex h-8 w-full items-center justify-between gap-2 rounded-lumen-md px-2 text-left text-xs text-lumen-text-secondary hover:bg-lumen-hover max-md:min-h-11",
                  othersShown && "bg-lumen-hover text-lumen-text",
                  FOCUS_RING,
                )}
              >
                <span className="min-w-0 truncate">{othersTitle}</span>
                {/* Points where the list will appear: left of the sidebar on
                    wide, onward inside the drawer on narrow. */}
                {othersPresentation === "flyout" ? (
                  <ChevronLeft size={14} aria-hidden className="shrink-0" />
                ) : (
                  <ChevronRight size={14} aria-hidden className="shrink-0" />
                )}
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={dnd.sensors}
            collisionDetection={pointerWithin}
            onDragStart={dnd.handleDragStart}
            onDragOver={dnd.handleDragOver}
            onDragEnd={dnd.handleDragEnd}
            onDragCancel={dnd.handleDragCancel}
          >
            {/* The tag-grouped list — only with a tag selected since #2061, so
                every group here is one the user asked to see and is drawn
                whole (#1288's per-group cap went with the unfiltered state it
                was for). */}
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
                      onContextMenu={onTagContextMenu}
                      onLongPress={onTagLongPress}
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
                            onContextMenu={onNoteContextMenu}
                            onEdit={onEditNote}
                            editLabel={labels.editNote}
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
      </div>

      {/* #2061, wide: "Other items" opens on the sidebar's left edge, over the
          main area. Anchored to the sidebar the trigger sits in. */}
      {othersShown && othersPresentation === "flyout" && (
        <OtherNotesFlyout
          id={othersId}
          title={othersTitle}
          dismissLabel={labels.closeOtherItems}
          anchor={othersTrigger?.closest("aside") ?? null}
          ignoreOutside={othersTrigger}
          onDismiss={dismissOthers}
          onOutsidePress={closeOthersQuietly}
        >
          {othersRows}
        </OtherNotesFlyout>
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

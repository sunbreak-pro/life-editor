import type { ReactNode } from "react";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Lock,
  Pin,
  Search,
} from "lucide-react";
import {
  EmptyState,
  ExcerptListItem,
  SidebarListControls,
  StatusFilterChips,
  TagHeadingIcon,
  tagGroupKey as groupKey,
  cn,
  MobileFab,
  type NoteTagGroup,
  FOCUS_RING,
} from "@life-editor/shared";

/*
 * The Mobile note list (extracted from NotesView.tsx — #588 split, zero
 * behavior change): a fixed sort + search + tag-filter header above the
 * scrolling tag groups, and the floating "+" quick-add.
 *
 * #369 placement answer: mobile has no rightSidebar, so the controls sit
 * OUTSIDE the scroller and stay reachable at any scroll position. The chip row
 * only appears with more than one bucket.
 *
 * Mobile gets its own sort picker rather than inheriting the desktop choice:
 * `sortMode` lives in localStorage, which a real phone build (Capacitor) does
 * not share with the desktop app — without the picker the phone would be pinned
 * to the default order forever.
 *
 * It renders the SAME derived groups the Desktop side list does (the host owns
 * that pipeline), so the two breakpoints never disagree.
 */

export interface NotesMobileListLabels {
  searchPlaceholder: string;
  sort: string;
  toggleDirection: string;
  tagFilter: string;
  empty: string;
  addCta: string;
  collapseGroup: string;
  expandGroup: string;
  quickAdd: string;
}

export interface NotesMobileListProps {
  labels: NotesMobileListLabels;

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

  hasNotes: boolean;
  /** A query is active, so the header must survive an emptied list. */
  searchActive: boolean;
  visibleGroups: NoteTagGroup[];
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  /** Open a note's detail sheet. */
  onOpenNote: (id: string) => void;
  /** Open the quick-add sheet (the FAB and the empty-state CTA share it). */
  onQuickAdd: () => void;
}

export function NotesMobileList({
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
  hasNotes,
  searchActive,
  visibleGroups,
  collapsedGroups,
  onToggleGroup,
  onOpenNote,
  onQuickAdd,
}: NotesMobileListProps) {
  return (
    <div className="flex h-full flex-col px-4 pt-2">
      {(hasNotes || searchActive) && (
        <div className="flex flex-col gap-2 pb-2">
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
          <div className="flex h-9 items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-surface-sunken px-2.5">
            <Search
              size={14}
              aria-hidden
              className="shrink-0 text-lumen-text-tertiary"
            />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none"
            />
          </div>
          {showTagFilter && (
            <StatusFilterChips
              chips={tagFilterChips}
              value={tagFilter}
              onChange={onTagFilterChange}
              label={labels.tagFilter}
              size="sm"
            />
          )}
        </div>
      )}

      {!hasNotes ? (
        <EmptyState
          icon={<FileText aria-hidden />}
          message={labels.empty}
          cta={{ label: labels.addCta, onClick: onQuickAdd }}
        />
      ) : (
        /*
         * #509: the scroller's own bottom padding IS the FAB clearance — the
         * button floats over this box (56px tall at a 24px offset = 80px of
         * occluded strip, per the shared MobileFab), so anything less lets the
         * last row's right end sit under it and a "open this note" tap creates
         * a new one instead. pb-24 (96px) is the same clearance the Schedule
         * mobile list uses under the same FAB; keep new hosts on that number.
         */
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-24">
          {visibleGroups.map((group) => {
            const key = groupKey(group);
            const collapsed = collapsedGroups.has(key);
            // Divider-style heading (#311), mobile twin of DesktopTagHeading.
            const color = group.tagColor;
            const bandStyle = color
              ? { backgroundColor: `${color}22`, borderColor: `${color}66` }
              : undefined;
            return (
              <div key={key} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onToggleGroup(key)}
                  aria-expanded={!collapsed}
                  aria-label={
                    collapsed ? labels.expandGroup : labels.collapseGroup
                  }
                  className={cn(
                    "flex w-full items-center gap-2 px-1 py-1.5 text-left",
                    FOCUS_RING,
                  )}
                >
                  <TagHeadingIcon icon={group.tagIcon} color={color} />
                  <span
                    className={cn(
                      "min-w-0 shrink truncate rounded-full border px-2.5 py-0.5 text-sm font-semibold text-lumen-text",
                      color ? "" : "border-lumen-border bg-lumen-bg-secondary",
                    )}
                    style={bandStyle}
                  >
                    {group.tagName}
                  </span>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-lumen-text-tertiary">
                    {group.notes.length}
                  </span>
                  <span
                    aria-hidden
                    className="h-px min-w-4 flex-1 bg-lumen-border"
                  />
                  {collapsed ? (
                    <ChevronRight
                      size={14}
                      aria-hidden
                      className="shrink-0 text-lumen-text-tertiary"
                    />
                  ) : (
                    <ChevronDown
                      size={14}
                      aria-hidden
                      className="shrink-0 text-lumen-text-tertiary"
                    />
                  )}
                </button>
                {!collapsed &&
                  group.notes.map((node) => (
                    <div key={`${key}-${node.id}`}>
                      <ExcerptListItem
                        title={node.title || "(untitled)"}
                        leading={<FileText size={14} aria-hidden />}
                        meta={
                          node.hasPassword ? (
                            <Lock
                              size={13}
                              aria-label="Password protected"
                              className="text-lumen-text-tertiary"
                            />
                          ) : node.isPinned ? (
                            <Pin
                              size={13}
                              aria-label="Pinned"
                              className="text-lumen-accent"
                            />
                          ) : undefined
                        }
                        onClick={() => onOpenNote(node.id)}
                      />
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/*
       * Floating "+" quick-add. Size and offsets come from the shared MobileFab
       * (#632), but NOT the anchoring: Materials renders through PageContainer
       * `width="wide"`, so the `relative` ancestor this lands in is
       * content-height and sits inside the page gutter. The button therefore
       * still parks at the end of the list (40px in, vs Schedule's 24px)
       * instead of holding the corner of the section box. Fixing that is a
       * scroll-ownership change in MainScreen — see MobileFab's HOST CONTRACT
       * and D-20260810-mobile-3.
       */}
      <MobileFab onClick={onQuickAdd} label={labels.quickAdd} />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Link2,
  Lock,
  Pin,
  Plus,
  Search,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  useNotesUnifiedContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  useMediaQuery,
  useRightSidebarContext,
  RightSidebarPortal,
  NoteDetailPanel,
  LockedBodyGate,
  EmptyState,
  SkeletonList,
  ExcerptListItem,
  QuickAddSheet,
  BottomSheet,
  MobileFab,
  SidebarListControls,
  StatusFilterChips,
  TagHeadingIcon,
  tagGroupKey as groupKey,
  cn,
  type NoteSortMode,
  type DataService,
  FOCUS_RING,
} from "@life-editor/shared";
import { useNoteTagDnd, noteDraggableId } from "./useNoteTagDnd";
import { RichTextEditor } from "./RichTextEditor";
import {
  NotePasswordDialog,
  type NotePasswordMode,
} from "./NotePasswordDialog";
import { TagPicker, LinkPanel } from "../wikitag";
import { TreeDragGhost } from "../components/TreeDragGhost";
import { DesktopNoteRow, DesktopTagHeading } from "./NoteListRows";
import { useNoteListState } from "./hooks/useNoteListState";
import { useNoteLinking } from "./hooks/useNoteLinking";
import { useNoteSheetTarget } from "./hooks/useNoteSheetTarget";

/*
 * Web Notes tab (life-tags unification S1). The former folder tree is gone:
 * the side list now GROUPS active notes under a heading per life-tag (name-
 * sorted, color dot) plus a trailing "untagged" bucket. Grouping keys off tag
 * assignments only (buildTagGroups, shared) — NOT the tree position — so a
 * nested note stays fully visible. #375 retired the folder note type itself;
 * legacy folder rows are dropped at fetch time and never reach this view.
 *
 *   - Desktop (isWide): the MAIN content is the selected note's editor — the
 *     shared <NoteDetailPanel variant="main"> in a centered surface. Nothing
 *     selected → the shared <EmptyState>. The grouped side list (search + "+
 *     note", collapsible tag headings, draggable note rows, a "Trash (N)" row)
 *     is PUSHED INTO THE SHARED rightSidebar via RightSidebarPortal.
 *   - Mobile (narrow): a sort + search + tag-filter header (#369), then the
 *     same tag groups as collapsible headings + ExcerptListItem rows, a
 *     92%-height detail sheet (the SAME <NoteDetailPanel> as the Desktop main,
 *     fully editable since #471 — mobile-scope #7), and a "+" QuickAddSheet.
 *
 * Both halves render the SAME derived list (search → tag groups → sort → tag
 * filter) off the same state, so the two breakpoints never disagree (#369).
 *
 * DnD: drag a note onto a tag heading = assign that tag (useNoteTagDnd). The
 * untagged bucket is NOT a drop target (dropping there would mean "remove all
 * tags" — destructive, so a no-op). No reorder / move-into: sort_order carries
 * no meaning across the many-to-many tag model.
 *
 * DnD ∩ tag filter (#369): the drop targets ARE the rendered headings, so
 * soloing one tag leaves only that tag droppable — i.e. nothing left to assign
 * (the dragged note already carries it), and soloing "untagged" leaves none at
 * all. That is inherent to hiding rows, not a defect to route around: the
 * filter is transient view state (never persisted), so tagging by drag means
 * clearing it first. The chips sit directly above the list, one click away.
 *
 * Data stays context-side (useNotesUnifiedContext / useWikiTagsUnifiedContext);
 * this view is DataService-free (§3.1) and takes copy from useTranslation →
 * props.
 *
 * Hooks split (phase B, zero behavior change): the derived list pipeline +
 * sort/filter/collapse state live in hooks/useNoteListState, the "[[" link
 * plumbing + cross-tab selection handoff in hooks/useNoteLinking, and the
 * desktop row/heading components in NoteListRows.tsx. This file is the host
 * shell: dialog/sheet state, DnD wiring and the breakpoint JSX.
 */

// Password dialog copy. Kept as local constants (the Notes i18n追い付き is
// scoped to Daily/Tags in this plan); promoting these to catalog keys is a
// follow-up.
const DIALOG_LABELS = {
  setTitle: "Set note password",
  removeTitle: "Remove note password",
  verifyTitle: "Unlock note",
  passwordLabel: "Password",
  currentPasswordLabel: "Current password",
  confirmPasswordLabel: "Confirm password",
  submit: "Confirm",
  cancel: "Cancel",
  mismatch: "Passwords do not match.",
  wrongPassword: "Incorrect password.",
  required: "Password is required.",
  saveFailed: "Could not save. Please try again.",
} as const;

interface NotesViewProps {
  /**
   * Injected for the "[[" link-target pool (notes + dailies fetched cross-
   * domain — the Notes tab has no DailiesUnifiedProvider). Everything else in
   * this view stays context-side; link features are off when it is absent.
   */
  dataService?: DataService;
  /** Navigate to a link target (MainScreen owns section + tab switching). */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /** A pending note id to select (arrived via a link click from another tab). */
  pendingSelectNoteId?: string | null;
  /** Clear the pending selection once consumed. */
  onConsumePendingSelect?: () => void;
}

export function NotesView({
  dataService,
  onNavigateToItem,
  pendingSelectNoteId,
  onConsumePendingSelect,
}: NotesViewProps = {}) {
  const notes = useNotesUnifiedContext();
  // #409 moved tag MUTATION (create / rename / delete / color / icon) out of
  // this view and into the shell-level tag editor, so only the read side and
  // the per-note assign/link calls are needed here now.
  const { getTagsForItem, assignTagToItem } = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const isWide = useMediaQuery("(min-width: 768px)", true);
  const rightSidebar = useRightSidebarContext();

  // On wide entry, open the shared rightSidebar so the note list (now the
  // panel's content = this tab's nav) is visible. isOpen is non-persisted and
  // starts false, so without this the list would be hidden on mount.
  useEffect(() => {
    if (isWide) rightSidebar.open();
    else rightSidebar.close();
    // rightSidebar.open/close are stable for the panel's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWide]);

  const [pwDialog, setPwDialog] = useState<{
    mode: NotePasswordMode;
    noteId: string;
  } | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [trashOpen, setTrashOpen] = useState(false);
  // Sidebar Links panel (F-3 #260) — collapsed by default; the links moved
  // here from the note body so reading/writing stays unobstructed.
  const [linksOpen, setLinksOpen] = useState(false);
  // Mobile-only: the note whose detail sheet is open + the quick-add sheet.
  const sheet = useNoteSheetTarget({
    isWide,
    notes: notes.notes,
    onSelect: notes.setSelectedNoteId,
    isContentLoaded: notes.isContentLoaded,
  });
  const [addOpen, setAddOpen] = useState(false);

  // Derived side-list pipeline + sort/filter/collapse state (hooks split).
  const {
    collapsedGroups,
    toggleGroup,
    sortModes,
    directionLabel,
    tagFilter,
    setTagFilter,
    tagFilterChips,
    visibleGroups,
    showTagFilter,
    handleSearchChange,
    hasNotes,
    searchActive,
  } = useNoteListState();

  // "[[" link plumbing + cross-tab pending-selection handoff (hooks split).
  const {
    linkableItems,
    resolveTitle,
    loadLinkTargets,
    handleResolvedLinkInserted,
    handleBodySaved,
    handleCreateNoteForLink,
  } = useNoteLinking({
    dataService,
    pendingSelectNoteId,
    onConsumePendingSelect,
    // The mobile sheet keys on its OWN note id, and its body is gated on
    // selectedNote.id matching it — so a `[[link]]` tapped inside the sheet
    // would move the selection while the sheet kept the old note's title and a
    // skeleton body that never resolves (#475). Follow it across, but only
    // while the sheet is open (Desktop leaves the id null).
    onPendingSelected: sheet.followPending,
  });

  const handleAssignTag = useCallback(
    (noteId: string, tagId: string) => {
      const already = getTagsForItem(noteId).some(
        (a) => !a.isDeleted && a.tagId === tagId,
      );
      if (already) return;
      void assignTagToItem(noteId, tagId);
    },
    [getTagsForItem, assignTagToItem],
  );

  const dnd = useNoteTagDnd({ notes: notes.notes, onAssign: handleAssignTag });

  const selected = notes.selectedNote;

  // Selecting from the side list fills the MAIN editor; the list stays open.
  const handleSelectDesktop = (id: string) => {
    notes.setSelectedNoteId(id);
  };

  const handlePwSubmit = async (password: string) => {
    if (!pwDialog) return;
    const { mode, noteId } = pwDialog;
    if (mode === "set") {
      await notes.setNotePassword(noteId, password);
    } else if (mode === "remove") {
      await notes.removeNotePassword(noteId, password);
    } else {
      const ok = await notes.verifyNotePassword(noteId, password);
      if (!ok) throw new Error("wrong-password");
      setUnlocked((prev) => {
        const next = new Set(prev);
        next.add(noteId);
        return next;
      });
    }
  };

  if (notes.isLoading) {
    return (
      <div className="px-4 pt-4">
        <SkeletonList rows={6} rowHeight={34} gap={4} />
      </div>
    );
  }

  // ---- Desktop side list ----------------------------------------------
  //
  // The tag-grouped note list, pushed into the shared rightSidebar (wide-
  // only). The panel well supplies padding + scroll, so this is frameless
  // natural-flow content: search + create, the groups, then the Trash section.

  const sidebarList = (
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
            value={notes.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("materials.notes.searchPlaceholder")}
            aria-label={t("materials.notes.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none"
          />
        </div>
      </div>

      {/* Sort controls (#283) — mode picker + direction toggle above the list.
          No filter row: title search already exists via the search box above. */}
      <SidebarListControls
        modes={sortModes}
        activeModeId={notes.sortMode}
        onModeChange={(id) => notes.setSortMode(id as NoteSortMode)}
        sortLabel={t("materials.sidebar.sort")}
        direction={notes.sortDirection}
        onToggleDirection={() =>
          notes.setSortDirection(notes.sortDirection === "asc" ? "desc" : "asc")
        }
        directionLabel={directionLabel}
        directionToggleLabel={t("materials.sidebar.toggleDirection")}
      />

      {/* Tag filter (#369) — solo one tag group; the active chip clears it. */}
      {showTagFilter && (
        <StatusFilterChips
          chips={tagFilterChips}
          value={tagFilter}
          onChange={setTagFilter}
          label={t("materials.notes.tagFilterLabel")}
          size="sm"
        />
      )}

      {notes.error && (
        <p
          role="alert"
          className="rounded-lumen-md border border-lumen-danger px-3 py-2 text-sm text-lumen-danger"
        >
          {notes.error}
        </p>
      )}

      {/* Tag groups. */}
      {!hasNotes ? (
        <EmptyState
          icon={<FileText aria-hidden />}
          message={t("materials.notes.empty")}
          cta={{
            label: t("materials.notes.addCta"),
            onClick: () => notes.createNote(),
          }}
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
                    onToggle={toggleGroup}
                    collapseLabel={t("materials.notes.collapseGroup")}
                    expandLabel={t("materials.notes.expandGroup")}
                  />
                  {!collapsed && (
                    <ul className="flex flex-col gap-0.5">
                      {group.notes.map((node) => (
                        <DesktopNoteRow
                          key={`${key}-${node.id}`}
                          node={node}
                          dragId={noteDraggableId(key, node.id)}
                          selected={selected?.id === node.id}
                          onSelect={handleSelectDesktop}
                          onDelete={notes.softDeleteNote}
                          deleteLabel={t("materials.notes.deleteNote")}
                          dragHintLabel={t("materials.notes.assignTagHint")}
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

      {/* Links panel — the selected note's item↔item links, moved out of the
          note body (F-3 #260). Same divider + disclosure structure as the
          Trash section below (layout-standard v2 "panel under the divider"). */}
      <div className="border-t border-lumen-border pt-1">
        <button
          type="button"
          onClick={() => setLinksOpen((v) => !v)}
          aria-expanded={linksOpen}
          className={cn(
            "flex w-full items-center gap-2 rounded-lumen-md px-1 py-2 text-[12.5px] text-lumen-text-secondary hover:bg-lumen-hover",
            FOCUS_RING,
          )}
        >
          {linksOpen ? (
            <ChevronDown size={13} aria-hidden className="shrink-0" />
          ) : (
            <ChevronRight size={13} aria-hidden className="shrink-0" />
          )}
          <Link2 size={14} aria-hidden className="shrink-0" />
          <span className="truncate">{t("materials.notes.links")}</span>
        </button>
        {linksOpen &&
          (selected ? (
            <div className="pb-2">
              <LinkPanel
                itemId={selected.id}
                resolveTitle={resolveTitle}
                linkableItems={linkableItems}
              />
            </div>
          ) : (
            <p className="px-1 pb-2 text-xs text-lumen-text-tertiary">
              {t("materials.notes.mainEmpty")}
            </p>
          ))}
      </div>

      {/* Trash section. */}
      <div className="border-t border-lumen-border pt-1">
        <button
          type="button"
          onClick={() => setTrashOpen((v) => !v)}
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
            {t("materials.notes.trash")}（{notes.deletedNotes.length}）
          </span>
        </button>
        {trashOpen && notes.deletedNotes.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto pb-2">
            {notes.deletedNotes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-2 px-1 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-lumen-text-secondary line-through">
                  {n.title || "(untitled)"}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => notes.restoreNote(n.id)}
                    aria-label={`Restore ${n.title || "untitled"}`}
                    className={cn(
                      "text-lumen-accent hover:opacity-80",
                      FOCUS_RING,
                    )}
                  >
                    <RotateCcw size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => notes.permanentDeleteNote(n.id)}
                    aria-label={`Permanently delete ${n.title || "untitled"}`}
                    className={cn(
                      "text-lumen-danger hover:opacity-80",
                      FOCUS_RING,
                    )}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
       * The Notes-local tag edit entry (#310) was removed in #409: the tag
       * master now lives in the app shell's left sidebar (above ⌘K), reachable
       * from every section including this one. Two doors to the same panel is
       * one too many, and the panel's scope outgrew this sidebar anyway — it
       * lists items of every kind (tasks / events / notes / dailies), so
       * presenting it as a Notes feature misdescribed it.
       */}
    </div>
  );

  // ---- Mobile body ----------------------------------------------------

  const mobileBody = (
    <div className="flex h-full flex-col px-4 pt-2">
      {/*
       * #369 mobile list controls. Mobile has no rightSidebar, so the placement
       * answer is "a fixed header above the scrolling group list": sort, search,
       * then tag chips — all OUTSIDE the scroller so they stay reachable at any
       * scroll position. The chip row only appears with more than one bucket.
       *
       * Mobile gets its own sort picker rather than inheriting the desktop
       * choice: `sortMode` lives in localStorage, which a real phone build
       * (Capacitor) does not share with the desktop app — without the picker the
       * phone would be pinned to the default order forever. Before #369 the
       * mobile list ignored the preference entirely (it read the raw `groups`),
       * so its order does change: title A→Z becomes the chosen sort.
       */}
      {(hasNotes || searchActive) && (
        <div className="flex flex-col gap-2 pb-2">
          <SidebarListControls
            modes={sortModes}
            activeModeId={notes.sortMode}
            onModeChange={(id) => notes.setSortMode(id as NoteSortMode)}
            sortLabel={t("materials.sidebar.sort")}
            direction={notes.sortDirection}
            onToggleDirection={() =>
              notes.setSortDirection(
                notes.sortDirection === "asc" ? "desc" : "asc",
              )
            }
            directionLabel={directionLabel}
            directionToggleLabel={t("materials.sidebar.toggleDirection")}
          />
          <div className="flex h-9 items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-surface-sunken px-2.5">
            <Search
              size={14}
              aria-hidden
              className="shrink-0 text-lumen-text-tertiary"
            />
            <input
              value={notes.searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("materials.notes.searchPlaceholder")}
              aria-label={t("materials.notes.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none"
            />
          </div>
          {showTagFilter && (
            <StatusFilterChips
              chips={tagFilterChips}
              value={tagFilter}
              onChange={setTagFilter}
              label={t("materials.notes.tagFilterLabel")}
              size="sm"
            />
          )}
        </div>
      )}

      {!hasNotes ? (
        <EmptyState
          icon={<FileText aria-hidden />}
          message={t("materials.notes.empty")}
          cta={{
            label: t("materials.notes.addCta"),
            onClick: () => setAddOpen(true),
          }}
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
                  onClick={() => toggleGroup(key)}
                  aria-expanded={!collapsed}
                  aria-label={
                    collapsed
                      ? t("materials.notes.expandGroup")
                      : t("materials.notes.collapseGroup")
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
                        onClick={() => sheet.openSheet(node.id)}
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
       * `width="wide"`, so the `relative` root below is content-height and sits
       * inside the page gutter. The button therefore still parks at the end of
       * the list (40px in, vs Schedule's 24px) instead of holding the corner of
       * the section box. Fixing that is a scroll-ownership change in
       * MainScreen — see MobileFab's HOST CONTRACT and D-20260810-mobile-3.
       */}
      <MobileFab
        onClick={() => setAddOpen(true)}
        label={t("materials.notes.quickAddTitle")}
      />
    </div>
  );

  // ---- Mobile detail sheet --------------------------------------------

  const sheetNote = sheet.sheetNote ?? null;
  const sheetGated =
    !!sheetNote?.hasPassword && !unlocked.has(sheetNote?.id ?? "");
  // The LIST omits note bodies (content=""); the body arrives only after the
  // async hydrate driven by openSheet, and RichTextEditor ignores
  // initialContent changes once mounted under a stable key — so the mount is
  // gated on the body being HERE (isContentLoaded), not on the selection having
  // moved. The selection outlives both the sheet and a list reload, so "the id
  // matches" was true in a window where the body had been dropped and not yet
  // re-fetched: the editor opened empty over a note that had text, and the
  // first keystroke saved the empty version.
  const sheetReady = sheet.sheetReady;

  // ---- Password gate (both surfaces) ----------------------------------
  //
  // #526: the lock covers the BODY ONLY — title / tags / pin / delete stay
  // usable without the password. Desktop always worked this way; the mobile
  // sheet (#471) swapped the whole panel for the unlock CTA, so the same locked
  // note behaved differently depending on the window width. Both surfaces now
  // wrap their editor in the same <LockedBodyGate>, which is what keeps them
  // from drifting apart again.
  const gatedContentEditor = (
    noteId: string,
    gated: boolean,
    editor: ReactNode,
  ): ReactNode => (
    <LockedBodyGate
      locked={gated}
      hint={t("materials.notes.lockedHint")}
      onUnlock={() => setPwDialog({ mode: "verify", noteId })}
    >
      {editor}
    </LockedBodyGate>
  );

  // ---- Desktop rightSidebar detail ------------------------------------

  const detailGated =
    !!selected?.hasPassword && !unlocked.has(selected?.id ?? "");

  const detailContentEditor = selected
    ? gatedContentEditor(
        selected.id,
        detailGated,
        <RichTextEditor
          key={selected.id}
          noteId={selected.id}
          initialContent={selected.content || undefined}
          editable={!selected.isEditLocked}
          onUpdate={(content) => {
            notes.updateNote(selected.id, { content });
            // #372: drop inline-origin edges whose "[[ ]]" left the text.
            handleBodySaved(selected.id, content);
          }}
          // "[[" wiki-link autocomplete + click navigation (Issue #285).
          loadLinkTargets={loadLinkTargets}
          onNavigateToItem={onNavigateToItem}
          onResolvedLinkInserted={(targetId) =>
            handleResolvedLinkInserted(selected.id, targetId)
          }
          onCreateNoteForLink={handleCreateNoteForLink}
          // Borderless — sit flush inside the NoteDetailPanel card so the note
          // body reads as a single clean surface, matching the Daily editor
          // card (2026-07-18: align Notes main formatting to Daily).
          className="pt-1"
        />,
      )
    : undefined;

  // ---- Desktop main editor --------------------------------------------
  //
  // The selected note's detail (meta row + tags + TipTap body) as the tab's
  // MAIN content — a centered surface (links live in the sidebar Links panel
  // — F-3 #260). Nothing selected → the select-or-create empty state. #375:
  // the folder guards on the tags / editor slots are gone with the folder type
  // — every selectable row is a note with a body.

  // Main-content toolbar (#302): "+ Add Note" now lives at the main-content
  // top-right — same accent pill + position sense as the Tasks board toolbar —
  // and the sidebar create entry was removed. Always present so a new note can
  // be made with nothing selected.
  const desktopMain = (
    <>
      <div className="flex items-center justify-end px-1 pb-3">
        <button
          type="button"
          onClick={() => notes.createNote()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lumen-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          <Plus size={14} aria-hidden />
          {t("materials.notes.addCta")}
        </button>
      </div>
      {selected ? (
        <NoteDetailPanel
          variant="main"
          noteId={selected.id}
          title={selected.title}
          isPinned={selected.isPinned}
          onTitleCommit={(id, title) => notes.updateNote(id, { title })}
          onTogglePin={notes.togglePin}
          onDelete={(id) => notes.softDeleteNote(id)}
          titleLabel={t("notesView.detailTitle")}
          pinLabel={t("notesView.unpin")}
          unpinLabel={t("notesView.pin")}
          deleteLabel={t("materials.notes.deleteNote")}
          moreActionsLabel={t("notesView.moreActions")}
          tagsSlot={
            // itemRole (#412): the note detail adopts the same kind badge the
            // task detail now uses, so the two tag rows stay one design.
            <TagPicker
              itemId={selected.id}
              itemRole="note"
              showLabel
              size="sm"
            />
          }
          contentLabel={t("materials.notes.content")}
          contentEditor={detailContentEditor}
        />
      ) : (
        <div className="flex min-h-[50vh] items-center justify-center">
          <EmptyState
            icon={<FileText aria-hidden />}
            message={
              hasNotes
                ? t("materials.notes.mainEmpty")
                : t("materials.notes.empty")
            }
            cta={{
              label: t("materials.notes.addCta"),
              onClick: () => notes.createNote(),
            }}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {isWide ? desktopMain : mobileBody}

      {/* Note list — pushed into the shared rightSidebar as always-present nav
          content (wide-only, so narrow never fills the MobileDrawer). */}
      {isWide && <RightSidebarPortal>{sidebarList}</RightSidebarPortal>}

      {/*
       * Mobile detail sheet — 92% height, FULL edit (#471, mobile-scope #7).
       * It hosts the same <NoteDetailPanel> the Desktop main content uses, so
       * title / tags / pin / delete / body are one implementation on both
       * surfaces: anything added to the note detail later reaches the phone for
       * free. The sheet's own header carries a generic label rather than the
       * note's title, which the panel's first field already shows (and can now
       * edit) — same call as the Todo sheet in #470.
       *
       * The password gate is body-only, exactly as on Desktop (#526 — the
       * shared builder above). #471 shipped it all-or-nothing here: a locked
       * note showed the unlock CTA INSTEAD of the panel, so the phone could not
       * even rename or retag it. That made the same note behave differently
       * depending on the window width, which is the one thing this sheet exists
       * to avoid.
       */}
      {!isWide && (
        <BottomSheet
          open={sheetNote != null}
          onClose={sheet.closeSheet}
          title={t("materials.notes.detailTitle")}
          closeLabel={t("common.close")}
          className="flex max-h-[92vh] min-h-[70vh] flex-col overflow-hidden"
        >
          {sheetNote && (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <NoteDetailPanel
                noteId={sheetNote.id}
                title={sheetNote.title}
                isPinned={sheetNote.isPinned}
                onTitleCommit={(id, title) => notes.updateNote(id, { title })}
                onTogglePin={notes.togglePin}
                // Deleting closes the sheet on its own: the note leaves the
                // active pool, so useNoteSheetTarget drops the id.
                onDelete={(id) => notes.softDeleteNote(id)}
                titleLabel={t("notesView.detailTitle")}
                pinLabel={t("notesView.unpin")}
                unpinLabel={t("notesView.pin")}
                deleteLabel={t("materials.notes.deleteNote")}
                moreActionsLabel={t("notesView.moreActions")}
                tagsSlot={
                  <TagPicker
                    itemId={sheetNote.id}
                    itemRole="note"
                    showLabel
                    size="sm"
                  />
                }
                contentLabel={t("materials.notes.content")}
                contentEditor={gatedContentEditor(
                  sheetNote.id,
                  sheetGated,
                  sheetReady ? (
                    <RichTextEditor
                      key={sheetNote.id}
                      noteId={sheetNote.id}
                      // The sheet's OWN note object, not selectedNote: they
                      // are the same row in the same array, and reading the
                      // sheet's removes any dependence on the selection
                      // having caught up with it.
                      initialContent={sheetNote.content || undefined}
                      editable={!sheetNote.isEditLocked}
                      onUpdate={(content) => {
                        notes.updateNote(sheetNote.id, { content });
                        // #372: same delete-sync as the Desktop editor.
                        handleBodySaved(sheetNote.id, content);
                      }}
                      // Same "[[" wiring as Desktop. loadLinkTargets is a
                      // LOADER, so handing it over costs nothing until the
                      // user actually types "[[" (#430 — typing prose must
                      // not fetch the pool).
                      loadLinkTargets={loadLinkTargets}
                      onNavigateToItem={onNavigateToItem}
                      onResolvedLinkInserted={(targetId) =>
                        handleResolvedLinkInserted(sheetNote.id, targetId)
                      }
                      onCreateNoteForLink={handleCreateNoteForLink}
                    />
                  ) : (
                    <SkeletonList rows={4} rowHeight={20} gap={8} />
                  ),
                )}
              />
            </div>
          )}
        </BottomSheet>
      )}

      {/* Mobile quick-add. */}
      {!isWide && (
        <QuickAddSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title={t("materials.notes.quickAddTitle")}
          closeLabel={t("common.close")}
          placeholder={t("materials.notes.quickAddPlaceholder")}
          submitLabel={t("materials.notes.quickAddSubmit")}
          onSubmit={(title) => notes.createNote(title)}
        />
      )}

      {pwDialog && (
        <NotePasswordDialog
          mode={pwDialog.mode}
          labels={DIALOG_LABELS}
          onSubmit={handlePwSubmit}
          onClose={() => setPwDialog(null)}
        />
      )}
    </div>
  );
}

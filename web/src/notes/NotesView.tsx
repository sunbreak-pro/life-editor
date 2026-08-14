import { useCallback, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import {
  useNotesUnifiedContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  useMediaQuery,
  useRightSidebarContext,
  RightSidebarPortal,
  EmptyState,
  SkeletonList,
  QuickAddSheet,
  BottomSheet,
  type NoteSortMode,
  type DataService,
  WIDE_QUERY,
} from "@life-editor/shared";
import { useNoteTagDnd } from "./useNoteTagDnd";
import { NoteBodyEditor } from "./NoteBodyEditor";
import { NotePasswordDialog } from "./NotePasswordDialog";
import { LinkPanel } from "../wikitag";
import { NotesSidebarList } from "./NotesSidebarList";
import { NotesMobileList } from "./NotesMobileList";
import { NoteDetailSurface } from "./NoteDetailSurface";
import { useNoteListState } from "./hooks/useNoteListState";
import { useNoteLinking } from "./hooks/useNoteLinking";
import { useNoteSheetTarget } from "./hooks/useNoteSheetTarget";
import { useNotePassword } from "./hooks/useNotePassword";

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
 *     selected → the shared <EmptyState>. The grouped side list (search + sort,
 *     collapsible tag headings, draggable note rows, a "Trash (N)" row) is
 *     PUSHED INTO THE SHARED rightSidebar via RightSidebarPortal.
 *   - Mobile (narrow): a sort + search + tag-filter header (#369), then the
 *     same tag groups as collapsible headings + ExcerptListItem rows, a
 *     92%-height detail sheet (the SAME note detail as the Desktop main, fully
 *     editable since #471 — mobile-scope #7), and a "+" QuickAddSheet.
 *
 * Both halves render the SAME derived list (search → tag groups → sort → tag
 * filter) off the same state, so the two breakpoints never disagree (#369).
 *
 * Data stays context-side (useNotesUnifiedContext / useWikiTagsUnifiedContext);
 * this view is DataService-free (§3.1) and takes copy from useTranslation →
 * props.
 *
 * Split (#588, zero behavior change). This file is the HOST: it owns the state
 * both surfaces read, the i18n → props hand-off, and the breakpoint switch.
 * The pieces:
 *   - hooks/useNoteListState — the derived list pipeline + sort/filter/collapse
 *   - hooks/useNoteLinking   — "[[" plumbing + cross-tab selection handoff
 *   - hooks/useNoteSheetTarget — which note the mobile sheet is showing
 *   - hooks/useNotePassword  — the password dialog + unlocked set
 *   - NotesSidebarList / NotesMobileList — the two list surfaces
 *   - NoteDetailSurface      — the detail panel both surfaces host
 *   - NoteListRows           — the Desktop draggable row + droppable heading
 * The derived list and the sheet target stay HERE because both surfaces read
 * them; computing them inside a surface would give each breakpoint its own
 * copy of the same state.
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
  const isWide = useMediaQuery(WIDE_QUERY, true);
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

  // Password gate — one object both surfaces ask, so the same locked note
  // behaves identically at either width (#526).
  const password = useNotePassword({
    setNotePassword: notes.setNotePassword,
    removeNotePassword: notes.removeNotePassword,
    verifyNotePassword: notes.verifyNotePassword,
  });

  const [trashOpen, setTrashOpen] = useState(false);
  // Sidebar Links panel (F-3 #260) — collapsed by default; the links moved
  // here from the note body so reading/writing stays unobstructed. Both
  // disclosures are host state: the side list unmounts on narrow, so keeping
  // them there would forget the user's choice across a resize.
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
  // Kept as one bundle: NoteBodyEditor takes the whole thing, so the two
  // surfaces cannot end up with different halves of it wired (#475).
  const linking = useNoteLinking({
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

  if (notes.isLoading) {
    return (
      <div className="px-4 pt-4">
        <SkeletonList rows={6} rowHeight={34} gap={4} />
      </div>
    );
  }

  // ---- i18n → props (§6.4) --------------------------------------------
  //
  // The list controls are the same controls at both widths, so the two label
  // sets are built off the same keys.

  const listLabels = {
    searchPlaceholder: t("materials.notes.searchPlaceholder"),
    sort: t("materials.sidebar.sort"),
    toggleDirection: t("materials.sidebar.toggleDirection"),
    tagFilter: t("materials.notes.tagFilterLabel"),
    empty: t("materials.notes.empty"),
    addCta: t("materials.notes.addCta"),
    collapseGroup: t("materials.notes.collapseGroup"),
    expandGroup: t("materials.notes.expandGroup"),
  };

  const detailLabels = {
    title: t("notesView.detailTitle"),
    pin: t("notesView.unpin"),
    unpin: t("notesView.pin"),
    delete: t("materials.notes.deleteNote"),
    moreActions: t("notesView.moreActions"),
    content: t("materials.notes.content"),
    lockedHint: t("materials.notes.lockedHint"),
  };

  // The controls both surfaces share (host-owned state, injected twice).
  const listControls = {
    searchQuery: notes.searchQuery,
    onSearchChange: handleSearchChange,
    sortModes,
    sortMode: notes.sortMode,
    onSortModeChange: (id: string) => notes.setSortMode(id as NoteSortMode),
    sortDirection: notes.sortDirection,
    onToggleDirection: () =>
      notes.setSortDirection(notes.sortDirection === "asc" ? "desc" : "asc"),
    directionLabel,
    showTagFilter,
    tagFilterChips,
    tagFilter,
    onTagFilterChange: setTagFilter,
    hasNotes,
    visibleGroups,
    collapsedGroups,
    onToggleGroup: toggleGroup,
  };

  // ---- Desktop side list ----------------------------------------------
  //
  // The tag-grouped note list, pushed into the shared rightSidebar (wide-only).

  const sidebarList = (
    <NotesSidebarList
      {...listControls}
      labels={{
        ...listLabels,
        deleteNote: t("materials.notes.deleteNote"),
        assignTagHint: t("materials.notes.assignTagHint"),
        links: t("materials.notes.links"),
        linksEmpty: t("materials.notes.mainEmpty"),
        trash: t("materials.notes.trash"),
        untitled: t("materials.notes.untitled"),
        restoreNote: (title) => t("materials.notes.restoreNote", { title }),
        permanentDeleteNote: (title) =>
          t("materials.notes.permanentDeleteNote", { title }),
      }}
      error={notes.error}
      selectedNoteId={selected?.id ?? null}
      onSelectNote={handleSelectDesktop}
      onDeleteNote={notes.softDeleteNote}
      onCreateNote={() => notes.createNote()}
      dnd={dnd}
      linksOpen={linksOpen}
      onToggleLinks={() => setLinksOpen((v) => !v)}
      linksPanel={
        selected ? (
          <LinkPanel
            itemId={selected.id}
            resolveTitle={linking.resolveTitle}
            // The same cross-role pool the body's "[[" menu searches, so both
            // pickers offer the same items — and the panel can name a Todo /
            // Daily target instead of falling back to an id fragment (#749).
            loadTargets={linking.loadLinkTargets}
            // Row clicks reuse the "[[" navigation route (#475): the shell
            // switches section + tab and hands the target id to the view.
            onNavigateToItem={onNavigateToItem}
          />
        ) : null
      }
      trashOpen={trashOpen}
      onToggleTrash={() => setTrashOpen((v) => !v)}
      deletedNotes={notes.deletedNotes}
      onRestoreNote={notes.restoreNote}
      onPermanentDeleteNote={notes.permanentDeleteNote}
    />
  );

  // ---- Mobile body ----------------------------------------------------

  const mobileBody = (
    <NotesMobileList
      {...listControls}
      labels={{ ...listLabels, quickAdd: t("materials.notes.quickAddTitle") }}
      searchActive={searchActive}
      onOpenNote={sheet.openSheet}
      onQuickAdd={() => setAddOpen(true)}
    />
  );

  // ---- Mobile detail sheet --------------------------------------------

  const sheetNote = sheet.sheetNote ?? null;
  // The LIST omits note bodies (content=""); the body arrives only after the
  // async hydrate driven by openSheet, and RichTextEditor ignores
  // initialContent changes once mounted under a stable key — so the mount is
  // gated on the body being HERE (isContentLoaded), not on the selection having
  // moved. The selection outlives both the sheet and a list reload, so "the id
  // matches" was true in a window where the body had been dropped and not yet
  // re-fetched: the editor opened empty over a note that had text, and the
  // first keystroke saved the empty version.
  const sheetReady = sheet.sheetReady;

  // ---- Desktop main editor --------------------------------------------
  //
  // The selected note's detail (meta row + tags + TipTap body) as the tab's
  // MAIN content — a centered surface (links live in the sidebar Links panel
  // — F-3 #260). Nothing selected → the select-or-create empty state. #375:
  // the folder guards on the tags / editor slots are gone with the folder type
  // — every selectable row is a note with a body.
  //
  // Main-content toolbar (#302): "+ Add Note" lives at the main-content
  // top-right — same accent pill + position sense as the Todos board toolbar.
  // Always present so a new note can be made with nothing selected.
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
        <NoteDetailSurface
          variant="main"
          note={selected}
          labels={detailLabels}
          locked={password.isGated(selected)}
          onUnlock={password.requestUnlock}
          onTitleCommit={(id, title) => notes.updateNote(id, { title })}
          onTogglePin={notes.togglePin}
          onDelete={(id) => notes.softDeleteNote(id)}
          contentEditor={
            <NoteBodyEditor
              note={selected}
              linking={linking}
              onNavigateToItem={onNavigateToItem}
              onSave={(id, content) => notes.updateNote(id, { content })}
              // Borderless — sit flush inside the detail card so the note body
              // reads as a single clean surface, matching the Daily editor card
              // (2026-07-18: align Notes main formatting to Daily).
              className="pt-1"
            />
          }
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
       * It hosts the same <NoteDetailSurface> the Desktop main content uses, so
       * title / tags / pin / delete / body are one implementation on both
       * surfaces: anything added to the note detail later reaches the phone for
       * free. The sheet's own header carries a generic label rather than the
       * note's title, which the panel's first field already shows (and can now
       * edit) — same call as the Todo sheet in #470.
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
              <NoteDetailSurface
                note={sheetNote}
                labels={detailLabels}
                locked={password.isGated(sheetNote)}
                onUnlock={password.requestUnlock}
                onTitleCommit={(id, title) => notes.updateNote(id, { title })}
                onTogglePin={notes.togglePin}
                // Deleting closes the sheet on its own: the note leaves the
                // active pool, so useNoteSheetTarget drops the id.
                onDelete={(id) => notes.softDeleteNote(id)}
                contentEditor={
                  sheetReady ? (
                    // The sheet's OWN note object, not selectedNote: they are
                    // the same row in the same array, and reading the sheet's
                    // removes any dependence on the selection having caught up.
                    <NoteBodyEditor
                      note={sheetNote}
                      linking={linking}
                      onNavigateToItem={onNavigateToItem}
                      onSave={(id, content) =>
                        notes.updateNote(id, { content })
                      }
                    />
                  ) : (
                    <SkeletonList rows={4} rowHeight={20} gap={8} />
                  )
                }
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

      {password.dialog && (
        <NotePasswordDialog
          mode={password.dialog.mode}
          labels={DIALOG_LABELS}
          onSubmit={password.submit}
          onClose={password.closeDialog}
        />
      )}
    </div>
  );
}

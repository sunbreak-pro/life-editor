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
  cn,
  type NoteSortMode,
  type DataService,
  WIDE_QUERY,
} from "@life-editor/shared";
import { useNoteTagDnd } from "./useNoteTagDnd";
import { NoteBodyEditor } from "./NoteBodyEditor";
import { NotePasswordDialog } from "./NotePasswordDialog";
import { LinkPanel } from "../wikitag";
import { NotesSidebarList } from "./NotesSidebarList";
import { NoteDetailSurface } from "./NoteDetailSurface";
import { useNoteListState } from "./hooks/useNoteListState";
import { useNoteLinking } from "./hooks/useNoteLinking";
import { useNotePassword } from "./hooks/useNotePassword";

/*
 * Web Notes tab (life-tags unification S1). The former folder tree is gone:
 * the side list now GROUPS active notes under a heading per life-tag (name-
 * sorted, color dot) plus a trailing "untagged" bucket. Grouping keys off tag
 * assignments only (buildTagGroups, shared) — NOT the tree position — so a
 * nested note stays fully visible. #375 retired the folder note type itself;
 * legacy folder rows are dropped at fetch time and never reach this view.
 *
 * ONE LAYOUT, TWO WIDTHS (#876, ユーザー裁定 D-20260815-materials-2 = A). The
 * MAIN content is the selected note's detail — title, tags, pin, delete and the
 * TipTap body — and the grouped list is the detail PANEL's content at both
 * widths, pushed there through <RightSidebarPortal>. Wide draws that panel as
 * the push-in rightSidebar; narrow draws the same content in the <MobileDrawer>
 * the section header's hamburger opens (`narrowHeader: "tabs+hamburger"` in
 * sectionDescriptors), so "list → pick → write in the main area" is one flow
 * rather than two.
 *
 * What #876 retired: the 92%-then-fullscreen detail BottomSheet (#471) and the
 * separate mobile list surface that opened it. With the main area showing the
 * body, the sheet was a second window onto the same note. Deleting it also
 * removed the sheet's own note identity (`useNoteSheetTarget`) — the reason
 * that existed was that the sheet opened a note SYNCHRONOUSLY while the list
 * carries no bodies, so it needed its own `isContentLoaded` gate or the editor
 * mounted over an empty body and saved that emptiness (#475). The selection
 * never had that hole: `selectNote` hydrates the body BEFORE flipping the id
 * (useNotesUnifiedAPI), so a surface keyed on `selectedNote` cannot open early.
 *
 * Narrow keeps two things of its own: the compact detail `variant` (the sheet's
 * title sizing, not the page-level one), and title-first quick capture — the
 * main toolbar's "+" opens the <QuickAddSheet> instead of creating an untitled
 * note the way the Desktop pill does.
 *
 * Both halves render the SAME derived list (search → tag groups → sort → tag
 * filter) off the same state, so the two breakpoints never disagree (#369).
 *
 * Data stays context-side (useNotesUnifiedContext / useWikiTagsUnifiedContext);
 * this view is DataService-free (§3.1) and takes copy from useTranslation →
 * props.
 *
 * Split (#588). This file is the HOST: it owns the state both surfaces read,
 * the i18n → props hand-off, and the breakpoint switch. The pieces:
 *   - hooks/useNoteListState — the derived list pipeline + sort/filter/collapse
 *   - hooks/useNoteLinking   — "[[" plumbing + cross-tab selection handoff
 *   - hooks/useNotePassword  — the password dialog + unlocked set
 *   - NotesSidebarList       — the list surface (the panel's content)
 *   - NoteDetailSurface      — the detail panel the main area hosts
 *   - NoteListRows           — the draggable row + droppable heading
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

  // On wide entry, open the shared rightSidebar so the note list (the panel's
  // content = this tab's nav) is visible. isOpen is non-persisted and starts
  // false, so without this the list would be hidden on mount. Narrow is left
  // CLOSED on purpose even though the list lives there too (#876): the drawer
  // is a modal overlay, and opening it on section entry would put a scrim over
  // the note the user came back to read.
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

  // Host state: the list unmounts whenever the narrow drawer is closed, so
  // keeping the disclosure's open/closed there would forget the user's choice
  // every time they picked a note.
  const [trashOpen, setTrashOpen] = useState(false);
  // Narrow-only: the title-first quick-add sheet.
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
  } = useNoteListState();

  // "[[" link plumbing + cross-tab pending-selection handoff (hooks split).
  // Kept as one bundle: NoteBodyEditor takes the whole thing, so the two
  // surfaces cannot end up with different halves of it wired (#475).
  const linking = useNoteLinking({
    dataService,
    pendingSelectNoteId,
    onConsumePendingSelect,
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

  // Picking from the list fills the MAIN editor. On wide the list is a pinned
  // column and stays put; on narrow it is the modal drawer, so choosing a note
  // also has to get out of the way of the thing it just opened.
  const handleSelectNote = useCallback(
    (id: string) => {
      notes.setSelectedNoteId(id);
      if (!isWide) rightSidebar.close();
    },
    [notes, isWide, rightSidebar],
  );

  // Wide creates an untitled note straight into the editor; narrow asks for the
  // title first, because a phone's create is usually the whole capture (#876
  // kept the QuickAddSheet the retired mobile list used to raise).
  const handleAddNote = useCallback(() => {
    if (isWide) notes.createNote();
    else setAddOpen(true);
  }, [isWide, notes]);

  if (notes.isLoading) {
    return (
      <div className="px-4 pt-4">
        <SkeletonList rows={6} rowHeight={34} gap={4} />
      </div>
    );
  }

  // ---- i18n → props (§6.4) --------------------------------------------

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
    pinned: t("notesView.pinned"),
    delete: t("materials.notes.deleteNote"),
    moreActions: t("notesView.moreActions"),
    content: t("materials.notes.content"),
    lockedHint: t("materials.notes.lockedHint"),
  };

  // ---- The list (the detail panel's content, both widths) --------------

  const sidebarList = (
    <NotesSidebarList
      searchQuery={notes.searchQuery}
      onSearchChange={handleSearchChange}
      sortModes={sortModes}
      sortMode={notes.sortMode}
      onSortModeChange={(id: string) => notes.setSortMode(id as NoteSortMode)}
      sortDirection={notes.sortDirection}
      onToggleDirection={() =>
        notes.setSortDirection(notes.sortDirection === "asc" ? "desc" : "asc")
      }
      directionLabel={directionLabel}
      showTagFilter={showTagFilter}
      tagFilterChips={tagFilterChips}
      tagFilter={tagFilter}
      onTagFilterChange={setTagFilter}
      hasNotes={hasNotes}
      visibleGroups={visibleGroups}
      collapsedGroups={collapsedGroups}
      onToggleGroup={toggleGroup}
      labels={{
        ...listLabels,
        deleteNote: t("materials.notes.deleteNote"),
        assignTagHint: t("materials.notes.assignTagHint"),
        trash: t("materials.notes.trash"),
        untitled: t("materials.notes.untitled"),
        restoreNote: (title) => t("materials.notes.restoreNote", { title }),
        permanentDeleteNote: (title) =>
          t("materials.notes.permanentDeleteNote", { title }),
      }}
      error={notes.error}
      selectedNoteId={selected?.id ?? null}
      onSelectNote={handleSelectNote}
      onDeleteNote={notes.softDeleteNote}
      onCreateNote={handleAddNote}
      dnd={dnd}
      trashOpen={trashOpen}
      onToggleTrash={() => setTrashOpen((v) => !v)}
      deletedNotes={notes.deletedNotes}
      onRestoreNote={notes.restoreNote}
      onPermanentDeleteNote={notes.permanentDeleteNote}
    />
  );

  // ---- Main content: the selected note --------------------------------
  //
  // The selected note's detail (meta row + tags + links + TipTap body) as the
  // tab's MAIN content. Nothing selected → the select-or-create empty state.
  //
  // Main-content toolbar (#302): "+ Add Note" at the main-content top-right —
  // same accent pill + position sense as the Todos board toolbar. Always
  // present so a new note can be made with nothing selected.
  const mainContent = (
    <>
      <div className="flex items-center justify-end px-1 pb-3">
        <button
          type="button"
          onClick={handleAddNote}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lumen-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          <Plus size={14} aria-hidden />
          {t("materials.notes.addCta")}
        </button>
      </div>
      {selected ? (
        <NoteDetailSurface
          // Page-level sizing on Desktop; narrow keeps the compact heading the
          // retired sheet used, which is what a phone column has room for.
          variant={isWide ? "main" : undefined}
          note={selected}
          labels={detailLabels}
          locked={password.isGated(selected)}
          onUnlock={password.requestUnlock}
          onTitleCommit={(id, title) => notes.updateNote(id, { title })}
          onTogglePin={notes.togglePin}
          onDelete={(id) => notes.softDeleteNote(id)}
          // The note's item links, beside the tags (#884 — they were a
          // rightSidebar disclosure until that Issue). Wide only, which is
          // where #884 put them; narrow has never had a Links affordance, and
          // #876 is about the layout rather than that scope call.
          linksSlot={
            isWide ? (
              <LinkPanel
                itemId={selected.id}
                resolveTitle={linking.resolveTitle}
                // The same cross-role pool the body's "[[" menu searches, so
                // both pickers offer the same items — and the panel can name a
                // Todo / Daily target instead of an id fragment (#749).
                loadTargets={linking.loadLinkTargets}
                // Chip clicks reuse the "[[" navigation route (#475): the shell
                // switches section + tab and hands the target id to the view.
                onNavigateToItem={onNavigateToItem}
              />
            ) : undefined
          }
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
            cta={{ label: t("materials.notes.addCta"), onClick: handleAddNote }}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Narrow renders through PageContainer `width="fluid"` (#875), a
          definite-height box with no gutter of its own — so the main column
          supplies its own padding AND owns the scroll. Wide keeps the page
          scroller PageContainer `width="wide"` gives it. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !isWide && "overflow-y-auto px-4 pt-2",
        )}
      >
        {mainContent}
      </div>

      {/* The note list — the detail panel's content at BOTH widths (#876).
          Wide: the push-in rightSidebar. Narrow: the hamburger's MobileDrawer,
          which mounts this only while it is open. */}
      <RightSidebarPortal>{sidebarList}</RightSidebarPortal>

      {/* Narrow quick capture: title first, then the note opens in the main
          area behind this sheet. */}
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

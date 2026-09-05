import { useCallback, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import {
  useNotesUnifiedContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  useMediaQuery,
  useRightSidebarContext,
  RightSidebarPortal,
  EmptyState,
  ExcerptListItem,
  SkeletonList,
  AddPill,
  TemplateSavedPanel,
  TemplateListPanel,
  TemplateApplyPanel,
  ConfirmDialog,
  useConfirmDialog,
  cn,
  type NoteSortMode,
  type DataService,
  WIDE_QUERY,
  useTourContextOptional,
  tourAnchor,
  useRecentNoteIds,
  resolveRecentNotes,
  dateKeyOfInstant,
} from "@life-editor/shared";
import { useNoteTagDnd } from "./useNoteTagDnd";
import { useAttachmentUpload } from "./useAttachmentUpload";
import { NoteBodyEditor } from "./NoteBodyEditor";
import { NotePasswordDialog } from "./NotePasswordDialog";
import { LinkPanel } from "../wikitag";
import { NotesSidebarList } from "./NotesSidebarList";
import { NoteDetailSurface } from "./NoteDetailSurface";
import { useNoteListState } from "./hooks/useNoteListState";
import { useNoteLinking } from "./hooks/useNoteLinking";
import { useNotePassword } from "./hooks/useNotePassword";
import { useNoteTemplateRegister } from "./hooks/useNoteTemplateRegister";
import { useNoteTemplateLibrary } from "./hooks/useNoteTemplateLibrary";
import {
  isBlankNoteBody,
  useNoteTemplateApply,
} from "./hooks/useNoteTemplateApply";
import { TemplateEditHost } from "./TemplateEditHost";

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
 * Narrow keeps ONE thing of its own: the compact detail `variant` (the sheet's
 * title sizing, not the page-level one). Creating is now identical at both
 * widths — #1147 retired the narrow title-first <QuickAddSheet>, so "+" makes
 * an Untitled note and opens the editor on a phone exactly as the Desktop pill
 * always has.
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

  // Image / file embedding for the "/" menu (#1404). Undefined without a
  // DataService, which is what keeps the two attach entries out of the picker
  // on a surface that cannot reach Storage — see useAttachmentUpload.
  const attachments = useAttachmentUpload(dataService);

  // "Register this note as a template" (#1179) + the receipt panel it opens.
  // Writes go straight out through the DataService, which is why it is not on
  // the notes context — see the hook's header.
  const templates = useNoteTemplateRegister(dataService);

  // Derived side-list pipeline + sort/filter/collapse state (hooks split).
  const {
    collapsedGroups,
    toggleGroup,
    sortModes,
    directionLabel,
    tagFilters,
    toggleTagFilter,
    clearTagFilters,
    tagFilterChips,
    visibleGroups,
    rowCap,
    showTagFilter,
    handleSearchChange,
    hasNotes,
    searchEmpty,
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

  // Saved templates: the sidebar disclosure + the draft the centre panel edits
  // (#1180). Reads and writes go straight out through the DataService — see the
  // hook's header for why templates are not on the notes context.
  const templateLibrary = useNoteTemplateLibrary(dataService);

  /*
   * The two template hooks meet here. #1179 WRITES one from the note kebab,
   * #1180 READS the list for the sidebar — and nothing connects them, because
   * the list only re-reads on the sync counter and a local write does not bump
   * it. Without this, the template you just registered is missing from the very
   * list that is supposed to hold it until the next push.
   *
   * Both edges of `savedId` matter: it is set when the write lands, and cleared
   * when the receipt closes, which is where the name the user typed is
   * committed.
   */
  const refreshTemplates = templateLibrary.refresh;
  const registeredId = templates.savedId;
  const lastRegistered = useRef(registeredId);
  useEffect(() => {
    if (lastRegistered.current === registeredId) return;
    lastRegistered.current = registeredId;
    refreshTemplates();
  }, [registeredId, refreshTemplates]);

  // Pouring a saved template into the open note (#1181). The picker reads
  // through the DataService (templates are not on the notes context); the WRITE
  // is the context, because the thing being changed is an ordinary note.
  const templateApply = useNoteTemplateApply(dataService);
  /*
   * Remount signal for the body editor. RichTextEditor ignores initialContent
   * once mounted, so replacing the body under the same note has to change the
   * key or the user keeps looking at what they just agreed to discard.
   *
   * The unmount FLUSH is not a hazard here: the editor persists on an 800ms
   * debounce, and reaching this point costs three deliberate clicks (kebab →
   * entry → confirm), so anything typed before them has long since been
   * written.
   */
  const [bodyEpoch, setBodyEpoch] = useState(0);

  const selected = notes.selectedNote;

  /*
   * Tutorial tour reporting (#1125).
   *
   * `notifyAction` is a no-op unless the tour is running AND the step on screen
   * waits for that exact event, so every call below costs nothing with the tour
   * off — which is what keeps "ツアー無効時に挙動・見た目が一切変わらない" true
   * without a single `if (tourRunning)` in the handlers.
   *
   * Read through the OPTIONAL hook. Reporting an action is not consuming the
   * tour, and the throwing variant would make TourProvider a mount-time
   * dependency of the Notes view — and of every suite that renders it on its
   * own. Same call as `useUndoRedoOptional`.
   */
  const tour = useTourContextOptional();
  const notifyAction = tour?.notifyAction;
  const notifyTour = useCallback(
    (event: string) => notifyAction?.(event),
    [notifyAction],
  );

  /*
   * "The note now carries a tag."
   *
   * Watched rather than wired to a button, because there are two routes to it
   * — the picker in the detail header and a drag onto a tag heading — and the
   * step teaches the outcome, not one control. Counting live assignments for
   * the SELECTED note and firing only on an increase is what keeps a removal,
   * a re-render or a note switch from being mistaken for a new tag.
   */
  const taggedCountRef = useRef<{ noteId: string | null; count: number }>({
    noteId: null,
    count: 0,
  });
  const selectedId = selected?.id ?? null;
  const selectedTagCount = selectedId
    ? getTagsForItem(selectedId).filter((a) => !a.isDeleted).length
    : 0;
  useEffect(() => {
    const prev = taggedCountRef.current;
    taggedCountRef.current = { noteId: selectedId, count: selectedTagCount };
    // A different note is a fresh baseline, never an increase.
    if (prev.noteId !== selectedId) return;
    if (selectedTagCount > prev.count) notifyTour("tag-assigned");
  }, [selectedId, selectedTagCount, notifyTour]);

  /*
   * "The user typed in the body."
   *
   * A DOM `input` listener on a wrapper, not a ProseMirror callback and not
   * anything coordinate-based: jsdom has no layout, so a position-derived
   * signal could not be tested at all (CLAUDE.md §7.1) — `posAtCoords` is the
   * exact shape #475 broke on. Bubbled events also mean the editor keeps its
   * own prop list; nothing about it changes in order to be observed.
   *
   * THE IME GUARD IS THE POINT OF THIS HANDLER. A Japanese conversion raises
   * `input` for every keystroke of the PRE-EDIT string, so an unguarded
   * listener advances the tour — moving the bubble and taking focus with it —
   * while the user is still choosing a candidate and has committed nothing.
   *
   * Guarded twice on purpose. `composition{start,end}` is the reliable half
   * (both fire in jsdom, so the guard is testable, which `InputEvent
   * .isComposing` is not — jsdom leaves it false); `isComposing` is the half
   * that still holds if an input arrives before compositionstart. Note this is
   * NOT `isImeComposing` from utils: that one answers a KEYDOWN question and
   * leans on `keyCode === 229` to catch the Enter that CONFIRMS a conversion.
   * A confirming Enter is a real commit here, and the step should advance on
   * it.
   */
  const composingRef = useRef(false);
  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);
  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
    // The commit itself is typing, and it is not guaranteed to be followed by
    // another `input` — so report here rather than waiting for one.
    notifyTour("note-typed");
  }, [notifyTour]);
  const handleBodyInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      if (composingRef.current) return;
      const native = e.nativeEvent as Partial<InputEvent>;
      if (native.isComposing === true) return;
      notifyTour("note-typed");
    },
    [notifyTour],
  );

  /*
   * "The user followed a tag to what else carries it."
   *
   * The filter chips are the in-Notes way to do that, so selecting one — and
   * only selecting one; clearing back to "all" is not following anything — is
   * what completes the step.
   */
  const handleToggleTagFilter = useCallback(
    (key: string) => {
      toggleTagFilter(key);
      // #1288: with multi-select, "following a tag" is any press that ADDS one.
      // Reporting on the toggle rather than on the resulting set keeps this out
      // of the set's identity — un-pressing the last chip is clearing, not
      // following, and the tour must not count it.
      if (!tagFilters.includes(key)) notifyTour("tag-filtered");
    },
    [toggleTagFilter, tagFilters, notifyTour],
  );

  // #1149: what the empty state offers to select. Resolved against the live
  // notes array on every render rather than stored with titles, which is what
  // keeps a renamed note's row current and drops a deleted one — `notes.notes`
  // has already had soft-deleted rows filtered out of it, so an id that no
  // longer resolves simply does not appear. Cheap enough to leave unmemoised:
  // it walks at most RECENT_NOTES_LIMIT ids and only the empty state reads it.
  const recentNoteIds = useRecentNoteIds();
  const recentNotes = resolveRecentNotes(recentNoteIds, notes.notes);

  // Picking from the list fills the MAIN editor. On wide the list is a pinned
  // column and stays put; on narrow it is the modal drawer, so choosing a note
  // also has to get out of the way of the thing it just opened.
  // Depend on the two members, not the whole context objects: `notes` is a new
  // object on every note edit / search keystroke and `rightSidebar` churns on
  // every resize sample, which would hand every row a brand-new onSelect and
  // defeat the memo on DesktopNoteRow. Both members are themselves useCallbacks.
  const selectNote = notes.setSelectedNoteId;
  const closeSidebar = rightSidebar.close;
  const handleSelectNote = useCallback(
    (id: string) => {
      selectNote(id);
      if (!isWide) closeSidebar();
    },
    [selectNote, isWide, closeSidebar],
  );

  // ONE create at both widths (#1147, ユーザー指示): "+" makes an Untitled note
  // and drops straight into the editor. Narrow used to raise a title-first
  // QuickAddSheet (#876's "a phone's create is usually the whole capture"),
  // which put a form between the user and the thing they wanted to write in.
  // The sheet is gone; `createNote()` with no title falls back to "Untitled"
  // (useNotesUnifiedCRUD) and selects the new note, so the body is already
  // mounted when the drawer gets out of the way.
  //
  // Closing the drawer is the same move `handleSelectNote` makes and for the
  // same reason: on narrow it is a modal overlay, so leaving it up would cover
  // the editor the create just opened.
  const createNote = notes.createNote;
  const handleAddNote = useCallback(() => {
    createNote();
    if (!isWide) closeSidebar();
    // #1125: the capture step is satisfied by a real create — and since #1147
    // retired the narrow title-first sheet, that is now the same create at
    // both widths.
    notifyTour("item-created");
  }, [createNote, isWide, closeSidebar, notifyTour]);

  // #1179: the kebab entry registers the OPEN note as a template in one press.
  // The default name is derived here rather than in the hook because the name
  // is copy, and copy is the host's (§6.4) — the hook takes it as a string.
  const registerTemplate = templates.register;
  const handleRegisterTemplate = useCallback(() => {
    if (!selected) return;
    registerTemplate({
      name: t("materials.templates.defaultName", {
        title: selected.title || t("materials.notes.untitled"),
      }),
      content: selected.content,
    });
  }, [registerTemplate, selected, t]);

  // #1181: the confirmed apply. Body only — the note keeps its own title, and
  // the epoch bump is what makes the editor show the new body (see above).
  const updateNote = notes.updateNote;
  const applyPending = templateApply.pending;
  const closeApply = templateApply.close;
  const handleApplyTemplate = useCallback(() => {
    if (!selected || !applyPending) return;
    updateNote(selected.id, { content: applyPending.content });
    setBodyEpoch((n) => n + 1);
    closeApply();
  }, [applyPending, closeApply, selected, updateNote]);

  /*
   * #1248: deleting a saved template asks first.
   *
   * The row's bin used to delete on the press. That was survivable while the
   * list lived behind a modal, but #1180 put it in the sidebar next to the note
   * list — a bin one slip away from the rows people click all day — and a
   * deleted template does NOT land in Trash (the trash read filters templates
   * out), so the press was both unguarded and unrecoverable. The question is
   * the guard; the recovery half is deliberately out of scope here.
   *
   * The in-app <ConfirmDialog> (#707), not the browser's own: a native dialog
   * lands outside the theme and freezes the page (#781). The name comes from
   * the list this row was drawn from — the same string the user is looking at.
   */
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
  const templateRows = templateLibrary.templates;
  const removeTemplate = templateLibrary.remove;
  const handleDeleteTemplate = useCallback(
    (id: string) => {
      const row = templateRows.find((tpl) => tpl.id === id);
      const name = row?.title || t("materials.templates.untitled");
      void askConfirm({
        message: t("materials.templates.deleteConfirmBody", { name }),
        confirmLabel: t("materials.templates.deleteConfirmAction"),
        cancelLabel: t("common.cancel"),
        danger: true,
      }).then((ok) => {
        if (ok) removeTemplate(id);
      });
    },
    [askConfirm, removeTemplate, t, templateRows],
  );

  /*
   * #1345: deleting a NOTE asks the same way.
   *
   * Until now this one file treated the smaller thing as the more dangerous
   * one — the template row above has asked since #1248, while a note went in
   * one press from both of its bins. Both note routes now come through this
   * single callback: the side-list row and the detail kebab's "delete note".
   * That is also what makes the two widths agree for free — wide and narrow
   * render the SAME list (#876) and the same detail surface, so there is no
   * second wiring to keep in step.
   *
   * The copy names Trash (which moved under Settings in #1293) because a note
   * DOES land there: this question is a pause, not the template's warning about
   * an unrecoverable row. The name comes from the note being deleted, so the
   * dialog repeats back what the user is looking at.
   */
  const noteRows = notes.notes;
  const softDeleteNote = notes.softDeleteNote;
  const handleDeleteNote = useCallback(
    (id: string) => {
      const row = noteRows.find((note) => note.id === id);
      const name = row?.title || t("materials.notes.untitled");
      void askConfirm({
        message: t("materials.notes.deleteConfirmBody", { name }),
        confirmLabel: t("materials.notes.deleteConfirmAction"),
        cancelLabel: t("common.cancel"),
        danger: true,
      }).then((ok) => {
        if (ok) softDeleteNote(id);
      });
    },
    [askConfirm, noteRows, softDeleteNote, t],
  );

  // #1255: what the apply confirm says depends on whether there is anything to
  // discard. The copy call is the host's (§6.4), so the branch lives here.
  const selectedBodyIsBlank = isBlankNoteBody(selected?.content);

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
    searchEmpty: t("materials.notes.searchEmpty"),
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
    registerTemplate: t("materials.templates.menuEntry"),
    applyTemplate: t("materials.templates.applyMenuEntry"),
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
      tagFilters={tagFilters}
      onToggleTagFilter={handleToggleTagFilter}
      onClearTagFilters={clearTagFilters}
      rowCap={rowCap}
      hasNotes={hasNotes}
      searchEmpty={searchEmpty}
      visibleGroups={visibleGroups}
      collapsedGroups={collapsedGroups}
      onToggleGroup={toggleGroup}
      labels={{
        ...listLabels,
        deleteNote: t("materials.notes.deleteNote"),
        assignTagHint: t("materials.notes.assignTagHint"),
        clearTagFilter: t("materials.notes.tagFilterClear"),
        moreTagFilters: (count) => t("materials.notes.tagFilterMore", { count }),
        fewerTagFilters: t("materials.notes.tagFilterLess"),
        moreRows: (count) => t("materials.notes.groupMoreRows", { count }),
      }}
      error={notes.error}
      selectedNoteId={selected?.id ?? null}
      onSelectNote={handleSelectNote}
      onDeleteNote={handleDeleteNote}
      onCreateNote={handleAddNote}
      dnd={dnd}
      // #1180 — only with a DataService, which is what templates are read and
      // written through (the same condition the "[[" pool has).
      templatesSlot={
        dataService ? (
          <TemplateListPanel
            templates={templateLibrary.templates}
            loading={templateLibrary.loading}
            open={templateLibrary.listOpen}
            onToggle={templateLibrary.toggleList}
            onEdit={templateLibrary.beginEdit}
            onDelete={handleDeleteTemplate}
            labels={{
              heading: t("materials.templates.sidebarHeading"),
              empty: t("materials.templates.empty"),
              untitled: t("materials.templates.untitled"),
              edit: t("materials.templates.edit"),
              delete: t("materials.templates.delete"),
              loading: t("common.loading"),
            }}
          />
        ) : undefined
      }
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
        {/* The tour points at the pill through this wrapper rather than at the
            button itself: AddPill is a shared primitive with a fixed prop list
            and no data-* passthrough, and the wrapper is the same box either
            way (inline-flex, no padding of its own) so the spotlight lands on
            the pill. */}
        <span {...tourAnchor("materials-add")} className="inline-flex">
          <AddPill
            onClick={handleAddNote}
            label={t("materials.notes.addCta")}
          />
        </span>
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
          onDelete={handleDeleteNote}
          // #1179: the kebab entry, wired only when there is a DataService to
          // write templates through — the same condition the "[[" pool has.
          //
          // A password-gated note is left OUT of it. The lock covers the body
          // (#526) and registering would copy that body into a surface the
          // lock does not reach, so the entry is absent exactly while the
          // gate is up rather than shipping a way around it.
          onRegisterTemplate={
            dataService && !password.isGated(selected)
              ? handleRegisterTemplate
              : undefined
          }
          // #1181: same DataService condition, plus the password gate. The
          // lock covers the body (#526) and applying REPLACES the body, so
          // offering it while the gate is up would let a note be overwritten
          // by someone who cannot see what they are overwriting.
          onApplyTemplate={
            dataService && !password.isGated(selected)
              ? templateApply.begin
              : undefined
          }
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
                // #1172: which day this note belongs to, for the "that day's
                // daily" relation. Derived here because only the host knows
                // what a NOTE's day is (the day it was written), and through
                // dateKeyOfInstant rather than a slice — the stored string is
                // UTC, so slicing it reads the wrong calendar day in JST
                // before 09:00 (#413).
                relatedDailyDate={
                  dateKeyOfInstant(selected.createdAt) ?? undefined
                }
              />
            ) : undefined
          }
          contentEditor={
            <div
              {...tourAnchor("materials-note-body")}
              onInput={handleBodyInput}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
            >
              <NoteBodyEditor
                note={selected}
                linking={linking}
                remountToken={bodyEpoch}
                attachments={attachments}
                onNavigateToItem={onNavigateToItem}
                onSave={(id, content) => notes.updateNote(id, { content })}
                // Borderless — sit flush inside the detail card so the note
                // body reads as a single clean surface, matching the Daily
                // editor card (2026-07-18: align Notes formatting to Daily).
                className="pt-1"
              />
            </div>
          }
        />
      ) : (
        <div className="flex min-h-[50vh] items-center justify-center">
          {/* #1149: "select a note or create a new one" used to be the whole
              screen, which asked the user to pick from nothing. The recently
              OPENED notes go underneath it as things to actually pick. With no
              history (first run, everything deleted) the list is absent and
              this is the centred icon + line on its own.

              #1372: no CTA of its own. The toolbar pill above is the add
              entry at BOTH widths, so a second button saying the same thing a
              few centimetres below it only doubled the target. */}
          <div className="flex w-full max-w-sm flex-col items-center">
            <EmptyState
              icon={<FileText aria-hidden />}
              message={
                /* #1470: `hasNotes` is the vault's, so a query that matched
                   nothing no longer makes this centre panel claim the vault is
                   empty — the note to select is still there, just not under
                   that word. */
                hasNotes
                  ? t("materials.notes.mainEmpty")
                  : t("materials.notes.empty")
              }
            />
            {recentNotes.length > 0 && (
              <nav
                aria-label={t("materials.notes.recentHeading")}
                className="w-full pb-8"
              >
                <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-lumen-text-tertiary">
                  {t("materials.notes.recentHeading")}
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {recentNotes.map((note) => (
                    <li key={note.id}>
                      <ExcerptListItem
                        title={note.title || t("materials.notes.untitled")}
                        leading={<FileText aria-hidden />}
                        onClick={() => handleSelectNote(note.id)}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
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

      {/* The receipt for "register as template" (#1179). Registering has no
          other visible result — the new row lands in a list this screen does
          not show — so the panel both confirms it happened and says where the
          template went. The name field is here because the derived default
          ("<note> のテンプレート") is worth changing often enough that doing so
          should not cost a second trip. */}
      <TemplateSavedPanel
        open={templates.savedId != null}
        name={templates.name}
        onNameChange={templates.setName}
        onNameCommit={templates.commitName}
        onClose={templates.close}
        labels={{
          title: t("materials.templates.savedTitle"),
          hint: t("materials.templates.savedHint"),
          nameLabel: t("materials.templates.nameLabel"),
          namePlaceholder: t("materials.templates.namePlaceholder"),
          done: t("materials.templates.savedDone"),
        }}
      />

      {/* Editing one saved template (#1180). Mounted at the view's top level
          rather than inside the sidebar portal: on narrow that portal is the
          MobileDrawer, and a panel living inside it would go away with the
          drawer that opened it. */}
      {dataService && <TemplateEditHost library={templateLibrary} />}

      {/* Pouring a template into this note (#1181) — picker, then confirm.
          Mounted at the view level rather than beside the kebab so the dialog
          survives the menu closing under it. */}
      <TemplateApplyPanel
        open={templateApply.open}
        templates={templateApply.templates}
        loading={templateApply.loading}
        pending={templateApply.pending}
        onPick={templateApply.pick}
        onConfirm={handleApplyTemplate}
        onCancel={templateApply.close}
        labels={{
          pickTitle: t("materials.templates.applyPickTitle"),
          confirmTitle: selectedBodyIsBlank
            ? t("materials.templates.applyConfirmTitleEmpty")
            : t("materials.templates.applyConfirmTitle"),
          pickHint: t("materials.templates.applyPickHint"),
          empty: t("materials.templates.applyEmpty"),
          untitled: t("materials.templates.untitled"),
          loading: t("common.loading"),
          confirmBody: (name) =>
            selectedBodyIsBlank
              ? t("materials.templates.applyConfirmBodyEmpty", { name })
              : t("materials.templates.applyConfirmBody", { name }),
          cancel: t("common.cancel"),
          apply: t("materials.templates.applyConfirm"),
        }}
      />

      {/* #1248's question. Mounted last so it portals ABOVE the sidebar the
          bin was pressed in — and it holds no place in the tree while nothing
          is being asked. */}
      {confirmRequest && (
        <ConfirmDialog
          open
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          cancelLabel={confirmRequest.cancelLabel}
          danger={confirmRequest.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
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

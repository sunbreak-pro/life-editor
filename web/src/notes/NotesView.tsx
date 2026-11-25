import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Editor } from "@tiptap/core";
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
  AddPill,
  TemplateSavedPanel,
  TemplateListPanel,
  TemplateApplyPanel,
  ConfirmDialog,
  useConfirmDialog,
  cn,
  type NoteNode,
  type NoteSortMode,
  type DataService,
  WIDE_QUERY,
  useRecentNoteIds,
  resolveRecentNotes,
  dateKeyOfInstant,
} from "@life-editor/shared";
import { useNoteTagDnd, planTagMove, type NoteTagMove } from "./useNoteTagDnd";
import { useAttachmentUpload } from "./useAttachmentUpload";
import { useSidebarContextMenus } from "./useSidebarContextMenus";
import { useHeaderTagEdit } from "./useHeaderTagEdit";
import { AttachmentUploadStatus } from "./AttachmentUploadStatus";
import { NoteBodyEditor } from "./NoteBodyEditor";
import { NotePasswordDialog } from "./NotePasswordDialog";
import { LinkPanel } from "../wikitag";
import { NotesSidebarList, type NoteRowDetails } from "./NotesSidebarList";
import { NoteDetailSurface } from "./NoteDetailSurface";
import { useNoteListState } from "./hooks/useNoteListState";
import { useNoteLinking } from "./hooks/useNoteLinking";
import { useNoteExcerpts } from "./hooks/useNoteExcerpts";
import { useNotePassword } from "./hooks/useNotePassword";
import { useNoteTemplateRegister } from "./hooks/useNoteTemplateRegister";
import { useNoteTemplateLibrary } from "./hooks/useNoteTemplateLibrary";
import {
  isBlankNoteBody,
  useNoteTemplateApply,
} from "./hooks/useNoteTemplateApply";
import { TemplateEditHost } from "./TemplateEditHost";
import { useElementWidth } from "./hooks/useElementWidth";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { formatNoteUpdated } from "./formatNoteUpdated";
import { NarrowHeaderActionPortal } from "../NarrowHeaderRow";

/*
 * The narrow top bar's "+" (#2795). It sits flush against Redo, so it takes
 * the same outlined 40px box as that pair (UndoRedoButtons' BTN). The floor is
 * unprefixed because only the narrow branch renders it.
 */
const NARROW_CREATE_BUTTON =
  "flex size-8 min-h-lumen-tap-touch min-w-lumen-tap-touch shrink-0 items-center justify-center rounded-lumen-md border border-lumen-border-strong text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

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
 * widths — the narrow title-first QuickAddSheet is deleted (#1147), so "+" makes
 * an Untitled note and opens the editor on a phone exactly as the Desktop pill
 * always has.
 *
 * Both halves render the SAME derived list off the same state, so the two
 * breakpoints never disagree (#369): the default list (search → pinned-first
 * sort → 15 rows + "Other items", #2061), or with a tag selected the grouped
 * one (search → tag groups → sort → tag filter).
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

interface NotesViewProps {
  /**
   * Injected for the "[[" link-target pool (notes + dailies fetched cross-
   * domain — the Notes tab has no DailiesUnifiedProvider). Everything else in
   * this view stays context-side; link features are off when it is absent.
   */
  dataService?: DataService;
  /** Navigate to a link target (MainScreen owns section + tab switching). */
  onNavigateToItem?: (target: {
    id: string;
    role: string;
    date?: string;
  }) => void;
  /** A pending note id to select (arrived via a link click from another tab). */
  pendingSelectNoteId?: string | null;
  /** Clear the pending selection once consumed. */
  onConsumePendingSelect?: () => void;
  /** Open a tag on Connect's tag screen (#2395). Absent → no such button. */
  onOpenTag?: (tagId: string) => void;
}

/**
 * One "recently opened" card in the empty main area (#2626): title, excerpt,
 * updated stamp. Not ExcerptListItem: that row names its button by ALL of its
 * text, so a screen reader would read the whole excerpt as the button's name.
 * Labelled by the title and described by the rest, as the side list's rows are.
 */
function RecentNoteCard({
  title,
  excerpt,
  updated,
  onSelect,
}: {
  title: string;
  excerpt?: string;
  updated?: string;
  onSelect: () => void;
}): React.JSX.Element {
  const id = useId();
  const titleId = `${id}-title`;
  const detailsId = `${id}-details`;
  const hasDetails = Boolean(excerpt) || updated !== undefined;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-labelledby={titleId}
      aria-describedby={hasDetails ? detailsId : undefined}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-3 py-2 text-left transition-colors",
        "hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
      )}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-lumen-text-tertiary"
      >
        <FileText aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          id={titleId}
          className="truncate text-sm font-semibold text-lumen-text"
        >
          {title}
        </span>
        <span id={detailsId} className="contents">
          {excerpt && (
            <span
              data-testid="recent-note-excerpt"
              className="truncate text-xs text-lumen-text-secondary"
            >
              {excerpt}
            </span>
          )}
          {updated !== undefined && (
            <span
              data-testid="recent-note-updated"
              className="text-[11px] tabular-nums text-lumen-text-tertiary"
            >
              {updated}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function NotesView({
  dataService,
  onNavigateToItem,
  pendingSelectNoteId,
  onConsumePendingSelect,
  onOpenTag,
}: NotesViewProps = {}) {
  const notes = useNotesUnifiedContext();
  // #409 moved tag MUTATION (create / rename / delete / color / icon) out of
  // this view and into the shell-level tag editor, so only the read side and
  // the per-note assign/link calls are needed here now.
  const { allTags, getTagsForItem, assignTagToItem, unassignTagFromItem } =
    useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const rightSidebar = useRightSidebarContext();
  // #2337: while offline only the body of a note can change, so these say why
  // the title, the pin and the delete are off on every surface below.
  const online = useOnlineStatus();
  const offlineReason = online ? undefined : t("materials.notes.offlineLocked");
  // A note still in the outbox has no row to rename until its send lands.
  const unsentReason = t("materials.notes.unsentLocked");

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
  // The file currently uploading, drawn as a band above the body (#1674).
  // Host state, never a document node: the node is still inserted only once
  // the bytes are there, so nothing mid-upload can be saved into the note
  // (D-20260902-materials-1 = B).
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const attachments = useAttachmentUpload(dataService, setUploadingFile);

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
    tagFilterOptions,
    visibleGroups,
    listMode,
    defaultNotes,
    otherNotes,
    showTagFilter,
    handleSearchChange,
    hasNotes,
    listNotes,
    offline,
    searchEmpty,
    searchBusy,
    searchFailed,
  } = useNoteListState();

  /*
   * The main column's rendered width (#1471). The template editor is a centred
   * modal portaled out to <body>, so it cannot inherit the column it is edited
   * over — and the column's size is not knowable statically either (the nav
   * collapses, the right panel is drag-resizable). Measuring the box the note
   * detail renders in is what lets the dialog open at the note's width instead
   * of at a token nothing on this screen uses.
   */
  const [measureMainColumn, mainColumnWidth] = useElementWidth();

  // "[[" link plumbing + cross-tab pending-selection handoff (hooks split).
  // Kept as one bundle: NoteBodyEditor takes the whole thing, so the two
  // surfaces cannot end up with different halves of it wired (#475).
  const linking = useNoteLinking({
    dataService,
    pendingSelectNoteId,
    onConsumePendingSelect,
  });
  // #2576: a list row's excerpt and tags. Tags in the order they were put on,
  // so the chip shows the note's first tag and "+n" the rest.
  const excerpts = useNoteExcerpts(dataService, listNotes);
  const tagById = useMemo(
    () =>
      new Map(
        allTags.filter((tag) => !tag.isDeleted).map((tag) => [tag.id, tag]),
      ),
    [allTags],
  );
  const rowDetails = useCallback(
    (node: NoteNode): NoteRowDetails => ({
      excerpt: excerpts.get(node.id),
      tags: getTagsForItem(node.id)
        .filter((a) => !a.isDeleted)
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
        .flatMap((a) => {
          const tag = tagById.get(a.tagId);
          return tag
            ? [{ name: tag.name, color: tag.color, icon: tag.icon }]
            : [];
        }),
    }),
    [excerpts, getTagsForItem, tagById],
  );

  // #1687 folded the old `handleAssignTag` into the move below: the drop is no
  // longer "add this tag", so the de-dupe it did now lives in `planTagMove`
  // alongside the removal it has to be decided with.

  /*
   * A drop in the side list MOVES the note between headings (#1687): the tag
   * of the heading it came from goes, the tag of the heading it landed on
   * arrives. Either end can be the untagged bucket, which is why both are
   * nullable — out of untagged is an add, into untagged is a remove.
   *
   * The remove goes through the ASSIGNMENT id, which is the only thing
   * `unassignTagFromItem` takes; a row that is already gone (a stale drag
   * after a sync) simply finds nothing and the add still happens.
   */
  const handleTagMove = useCallback(
    (move: NoteTagMove) => {
      const plan = planTagMove(move, getTagsForItem(move.noteId));
      if (plan.unassignId) void unassignTagFromItem(plan.unassignId);
      if (plan.assignTagId) void assignTagToItem(move.noteId, plan.assignTagId);
    },
    [getTagsForItem, unassignTagFromItem, assignTagToItem],
  );

  const dnd = useNoteTagDnd({ notes: notes.notes, onMove: handleTagMove });

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

  /*
   * #2060 — the body editor, lifted out of RichTextEditor for the formatting
   * bar in the detail's sticky header. The editor reports itself through
   * `onEditorChange` (and null as it goes away), so a note switch or a
   * template-apply remount always leaves the bar on the live instance.
   */
  const [bodyEditor, setBodyEditor] = useState<Editor | null>(null);

  const selected = notes.selectedNote;

  // #1149: what the empty state offers to select. Resolved against the live
  // notes array on every render rather than stored with titles, which is what
  // keeps a renamed note's row current and drops a deleted one — `notes.notes`
  // has already had soft-deleted rows filtered out of it, so an id that no
  // longer resolves simply does not appear. Cheap enough to leave unmemoised:
  // it walks at most RECENT_NOTES_LIMIT ids and only the empty state reads it.
  const recentNoteIds = useRecentNoteIds();
  const recentNotes = resolveRecentNotes(recentNoteIds, listNotes);
  // #2626: the cards' "updated" line. `now` per render, as the side list does,
  // so "today" follows the clock whenever the screen redraws.
  const recentNow = new Date();
  const recentUpdatedLabels = {
    updatedToday: (time: string) => t("materials.notes.updatedToday", { time }),
    updatedOn: (date: string) => t("materials.notes.updatedOn", { date }),
  };

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
  // and drops straight into it — into the TITLE since #1842, which is the one
  // thing the placeholder title is waiting for. Narrow used to raise a title-first
  // QuickAddSheet (#876's "a phone's create is usually the whole capture"),
  // which put a form between the user and the thing they wanted to write in.
  // The sheet is gone; `createNote()` with no title stores an empty one
  // (useNotesUnifiedCRUD, #2581 — the field shows a grey placeholder over it)
  // and selects the new note, so the body is already mounted when the drawer
  // gets out of the way.
  //
  // Closing the drawer is the same move `handleSelectNote` makes and for the
  // same reason: on narrow it is a modal overlay, so leaving it up would cover
  // the editor the create just opened.
  const createNote = notes.createNote;
  /*
   * #1842 — the new note's title comes up selected.
   *
   * "+" left the focus on the button it was pressed with and the title reading
   * the placeholder title, so naming the thing you had just made meant finding the field,
   * clicking it and selecting the text by hand. The id is held here until the
   * field reports back rather than kept forever, so returning to the note
   * later does not re-select the title under whoever is reading it.
   */
  const [focusTitleNoteId, setFocusTitleNoteId] = useState<string | null>(null);

  /*
   * #2581 — the note "+" just made, which the list draws first with a "New"
   * badge. It stays fresh while it is the open note, and stops being fresh
   * the moment the selection moves off it (another note, the recent cards, a
   * link, a delete). Adjusted while rendering rather than from an effect, the
   * same pattern ScheduleEventEditor uses for its selection. Until the
   * provider reports the create's selection back, `prevSelectedNoteId` is the
   * note that was open before, so the fresh id survives that first render.
   */
  const [freshNoteId, setFreshNoteId] = useState<string | null>(null);
  const selectedNoteId = selected?.id ?? null;
  const [prevSelectedNoteId, setPrevSelectedNoteId] = useState(selectedNoteId);
  if (selectedNoteId !== prevSelectedNoteId) {
    setPrevSelectedNoteId(selectedNoteId);
    if (freshNoteId !== null && prevSelectedNoteId === freshNoteId) {
      setFreshNoteId(null);
    }
  }

  // #2581: a search or a tag filter left on would hide the new, empty-titled
  // note from the very list that is supposed to show it first. One call
  // clears both (useNoteListState drops the tags with the query).
  const searchQuery = notes.searchQuery;
  const filteringByTag = tagFilters.length > 0;
  const handleAddNote = useCallback(() => {
    if (searchQuery !== "" || filteringByTag) handleSearchChange("");
    const id = createNote();
    if (typeof id === "string") {
      setFocusTitleNoteId(id);
      setFreshNoteId(id);
    }
    if (!isWide) closeSidebar();
  }, [
    createNote,
    isWide,
    closeSidebar,
    searchQuery,
    filteringByTag,
    handleSearchChange,
  ]);

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
  // #2057: through the version-checked save, so the replace is one atomic
  // write and the remounted editor's first check waits for it.
  const replaceNoteBody = notes.replaceNoteBody;
  const applyPending = templateApply.pending;
  const closeApply = templateApply.close;
  const handleApplyTemplate = useCallback(() => {
    if (!selected || !applyPending) return;
    void replaceNoteBody(selected.id, applyPending.content);
    setBodyEpoch((n) => n + 1);
    closeApply();
  }, [applyPending, closeApply, selected, replaceNoteBody]);

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

  /*
   * Right-click editing in the sidebar (#1677) — Desktop only, which is what
   * `enabled` carries: on narrow the handlers come back undefined and no row
   * attaches a contextmenu listener at all. Narrow gets a long-press on the tag
   * headings instead (#2008). The panels are rendered at this
   * view's top level (below), NOT inside <RightSidebarPortal>: on narrow that
   * portal is the MobileDrawer, and a panel mounted in it dies with the drawer.
   */
  const renameNote = useCallback(
    (id: string, title: string) => {
      notes.updateNote(id, { title });
    },
    [notes],
  );
  const sidebarMenus = useSidebarContextMenus({
    enabled: isWide,
    notes: noteRows,
    onRenameNote: renameNote,
    onDeleteNote: handleDeleteNote,
    offlineReason,
    unsentReason,
  });
  // #2395: the chips under the title. Right-click on Desktop, a hold on narrow.
  const headerTagEdit = useHeaderTagEdit({ enabled: isWide, onOpenTag });

  // #1255: what the apply confirm says depends on whether there is anything to
  // discard. The copy call is the host's (§6.4), so the branch lives here.
  const selectedBodyIsBlank = isBlankNoteBody(selected?.content);

  /*
   * Is the open note's body covered right now? (#526 / #1763)
   *
   * Since #1763 this decides more than a blur: a locked note's body is never
   * fetched, so `selected.content` is the light `""` and mounting the editor
   * over it would put a stray save one keystroke away from writing that
   * emptiness into the note (the #471 hazard). The gate gets a spacer instead,
   * and the real editor mounts once `verifyNotePassword` has brought the body
   * in. Computed once because four things downstream ask the same question.
   */
  const bodyGated = selected !== null && password.isGated(selected);

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
    empty: t(
      offline ? "materials.notes.offlineEmpty" : "materials.notes.empty",
    ),
    searchEmpty: t("materials.notes.searchEmpty"),
    bodySearchFailed: t("materials.notes.bodySearchFailed"),
    addCta: t("materials.notes.addCta"),
    addAria: t("materials.notes.addAria"),
    collapseGroup: t("materials.notes.collapseGroup"),
    expandGroup: t("materials.notes.expandGroup"),
  };

  /*
   * The password dialog's copy (#1843).
   *
   * It was a module constant of English strings, so the one entry point that
   * does reach this dialog -- the locked note's unlock prompt -- asked for a
   * password in English on a Japanese screen.
   *
   * All thirteen strings moved, not the four the unlock path uses: the set and
   * remove modes had no caller then, and D-20260922-materials-1 = A has since
   * given them one (the kebab's password entries). `setWarning` is the
   * confirmation that decision asked for, read in the set dialog before the
   * password is saved.
   *
   * `cancel` is the app's existing common.cancel rather than a fourteenth key:
   * this file already uses it two hundred lines down.
   */
  const passwordLabels = {
    setTitle: t("materials.notes.password.setTitle"),
    removeTitle: t("materials.notes.password.removeTitle"),
    verifyTitle: t("materials.notes.password.verifyTitle"),
    passwordLabel: t("materials.notes.password.passwordLabel"),
    currentPasswordLabel: t("materials.notes.password.currentPasswordLabel"),
    confirmPasswordLabel: t("materials.notes.password.confirmPasswordLabel"),
    submit: t("materials.notes.password.submit"),
    busy: t("materials.notes.password.busy"),
    cancel: t("common.cancel"),
    mismatch: t("materials.notes.password.mismatch"),
    wrongPassword: t("materials.notes.password.wrongPassword"),
    required: t("materials.notes.password.required"),
    saveFailed: t("materials.notes.password.saveFailed"),
    setWarning: t("materials.notes.password.setWarning"),
  };

  const detailLabels = {
    title: t("notesView.detailTitle"),
    titlePlaceholder: t("materials.notes.untitledPlaceholder"),
    pin: t("notesView.unpin"),
    unpin: t("notesView.pin"),
    pinned: t("notesView.pinned"),
    delete: t("materials.notes.deleteNote"),
    moreActions: t("notesView.moreActions"),
    lockedHint: t("materials.notes.lockedHint"),
    unlockLabel: t("materials.notes.password.unlockCta"),
    registerTemplate: t("materials.templates.menuEntry"),
    applyTemplate: t("materials.templates.applyMenuEntry"),
    setPassword: t("materials.notes.password.setEntry"),
    removePassword: t("materials.notes.password.removeEntry"),
    formatToolbar: {
      label: t("materials.notes.formatToolbar.label"),
      heading1: t("materials.notes.formatToolbar.heading1"),
      heading2: t("materials.notes.formatToolbar.heading2"),
      bold: t("materials.notes.formatToolbar.bold"),
      italic: t("materials.notes.formatToolbar.italic"),
      strike: t("materials.notes.formatToolbar.strike"),
      horizontalRule: t("materials.notes.formatToolbar.horizontalRule"),
      itemLink: t("materials.notes.formatToolbar.itemLink"),
    },
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
      tagFilterOptions={tagFilterOptions}
      tagFilters={tagFilters}
      onToggleTagFilter={toggleTagFilter}
      onClearTagFilters={clearTagFilters}
      listMode={listMode}
      defaultNotes={defaultNotes}
      otherNotes={otherNotes}
      // #2061: past the 15th row, wide opens a flyout on the sidebar's left
      // edge; narrow has no room left of the drawer, so the drawer's own list
      // gives way to the others instead.
      othersPresentation={isWide ? "flyout" : "inline"}
      hasNotes={hasNotes}
      searchEmpty={searchEmpty}
      searchBusy={searchBusy}
      searchFailed={searchFailed}
      visibleGroups={visibleGroups}
      collapsedGroups={collapsedGroups}
      onToggleGroup={toggleGroup}
      labels={{
        ...listLabels,
        deleteNote: t("materials.notes.deleteNote"),
        rowActions: t("materials.notes.rowActions"),
        assignTagHint: t("materials.notes.assignTagHint"),
        clearTagFilter: t("materials.notes.tagFilterClear"),
        tagFilterSelected: (count) =>
          t("materials.notes.tagFilterSelected", { count }),
        tagFilterPanel: t("materials.notes.tagFilterPanel"),
        otherItems: (count) => t("materials.notes.otherItems", { count }),
        closeOtherItems: t("materials.notes.closeOtherItems"),
        backToList: t("materials.notes.backToList"),
        createdOffline: t("materials.notes.createdOffline"),
        unsentLocked: unsentReason,
        pinnedHeading: t("materials.notes.pinnedHeading"),
        allHeading: t("materials.notes.allHeading"),
        updatedToday: (time) => t("materials.notes.updatedToday", { time }),
        updatedOn: (date) => t("materials.notes.updatedOn", { date }),
        untitled: t("materials.notes.untitledPlaceholder"),
        newBadge: t("materials.notes.newBadge"),
        newHeading: t("materials.notes.newHeading"),
      }}
      freshNoteId={freshNoteId}
      error={notes.error}
      selectedNoteId={selected?.id ?? null}
      onSelectNote={handleSelectNote}
      onDeleteNote={handleDeleteNote}
      onTagContextMenu={sidebarMenus.onTagContextMenu}
      onNoteContextMenu={sidebarMenus.onNoteContextMenu}
      onTagLongPress={sidebarMenus.onTagLongPress}
      onEditNote={sidebarMenus.onNoteEdit}
      offlineReason={offlineReason}
      rowDetails={rowDetails}
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
            // #2625: a row press applies it to the open note — the same
            // dialog, and the same gate, as the kebab's "apply a template".
            onApply={templateApply.beginWith}
            applyDisabledReason={
              !selected
                ? t("materials.templates.applyNoNote")
                : bodyGated
                  ? t("materials.templates.applyLocked")
                  : undefined
            }
            labels={{
              heading: t("materials.templates.sidebarHeading"),
              empty: t("materials.templates.empty"),
              untitled: t("materials.templates.untitled"),
              edit: t("materials.templates.edit"),
              delete: t("materials.templates.delete"),
              loading: t("common.loading"),
              apply: t("materials.templates.applyRow"),
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
  //
  // Narrow (#2795, ユーザー決定 2026-11-22 = 案 A): the pill's band took 62px
  // above every note on a phone, so the entry is a 40px "+" in the top bar
  // beside Redo instead. Still one press, and still there with nothing
  // selected. What stays in the column is the #2291 top gap alone.
  const mainContent = (
    <>
      <div
        className={cn(
          "flex items-center justify-end px-1",
          // #2291: the narrow column's top gap lives here, not as the
          // scroller's padding. A sticky box stops at the scroller's padding
          // edge, so a `pt-2` there left 9px of scrolled body showing above
          // the stuck note header. With the "+" up in the top bar this box is
          // empty, and its two paddings are the whole gap.
          isWide ? "pb-3" : "pt-2 pb-2",
        )}
      >
        {isWide ? (
          <span className="inline-flex">
            <AddPill
              onClick={handleAddNote}
              label={t("materials.notes.addCta")}
              // #2793: the visible "+ ノート" reads the same as the tab; the
              // spoken name says what the button does.
              ariaLabel={t("materials.notes.addAria")}
              // #1560: the pill measured 33 tall at 390px. The floor rides on
              // THIS call site rather than on AddPill's own recipe because the
              // part has two other hosts in the Schedule lane, and growing
              // their pills is that lane's call to make (#1512 splits by
              // section). It still matters on the wide layout: `max-md:` is
              // rem-based, so a window between 768px and 48rem draws this pill.
              className="max-md:min-h-11"
            />
          </span>
        ) : (
          <NarrowHeaderActionPortal>
            <button
              type="button"
              onClick={handleAddNote}
              aria-label={t("materials.notes.addAria")}
              title={t("materials.notes.addAria")}
              className={NARROW_CREATE_BUTTON}
            >
              <Plus aria-hidden className="size-4" />
            </button>
          </NarrowHeaderActionPortal>
        )}
      </div>
      {selected ? (
        // #2583: the open note is one centred 46rem column on the page, a
        // reading line length. It is capped here, not in the section
        // descriptor, because the Daily tab shares that descriptor. rem, so
        // the measure follows the font-size setting; on a phone the cap is
        // wider than the screen and only the gutter is left. The bottom
        // padding gives the end of the body room above the screen's edge.
        <div className="mx-auto w-full max-w-[46rem] pb-6">
          <NoteDetailSurface
            // Page-level sizing on Desktop; narrow keeps the compact heading the
            // retired sheet used, which is what a phone column has room for.
            variant={isWide ? "main" : undefined}
            note={selected}
            labels={detailLabels}
            locked={bodyGated}
            // #2060: null while the gate is up — no editor is mounted then —
            // which leaves the header's formatting bar switched off.
            bodyEditor={bodyGated ? null : bodyEditor}
            onUnlock={password.requestUnlock}
            onTitleCommit={(id, title) => notes.updateNote(id, { title })}
            // #1842 — only for the note "+" just made, and only until the field
            // says it has the focus.
            autoFocusTitle={focusTitleNoteId === selected.id}
            onTitleAutoFocused={() => setFocusTitleNoteId(null)}
            onTogglePin={notes.togglePin}
            onDelete={handleDeleteNote}
            offlineReason={
              offlineReason ??
              (selected.createdOffline ? unsentReason : undefined)
            }
            // #1179: the kebab entry, wired only when there is a DataService to
            // write templates through — the same condition the "[[" pool has.
            //
            // A password-gated note is left OUT of it. The lock covers the body
            // (#526) and registering would copy that body into a surface the
            // lock does not reach, so the entry is absent exactly while the
            // gate is up rather than shipping a way around it.
            onRegisterTemplate={
              dataService && !bodyGated ? handleRegisterTemplate : undefined
            }
            // #1181: same DataService condition, plus the password gate. The
            // lock covers the body (#526) and applying REPLACES the body, so
            // offering it while the gate is up would let a note be overwritten
            // by someone who cannot see what they are overwriting.
            onApplyTemplate={
              dataService && !bodyGated ? templateApply.begin : undefined
            }
            // #1843 / D-20260922-materials-1 = A: the way in to the lock, back in
            // the kebab. The surface shows "set" or "remove" from hasPassword;
            // "remove" stays offered while the gate is up because the dialog
            // asks for the current password before anything changes.
            onSetPassword={password.requestSet}
            onRemovePassword={password.requestRemove}
            onTagContextMenu={headerTagEdit.onTagContextMenu}
            onTagLongPress={headerTagEdit.onTagLongPress}
            // The note's item links, beside the tags (#884 — they were a
            // rightSidebar disclosure until that Issue), at both widths since
            // #2391. A locked note shows none: which items it links to is part
            // of what the password covers, and the chips would name them.
            linksSlot={
              bodyGated ? undefined : (
                <LinkPanel
                  itemId={selected.id}
                  resolveTitle={linking.resolveTitle}
                  // The same cross-role pool the body's "[[" menu searches, so
                  // both pickers offer the same items — and the panel can name a
                  // Todo / Daily target instead of an id fragment (#749).
                  loadTargets={linking.loadLinkTargets}
                  previews={linking.linkPreviews}
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
              )
            }
            contentEditor={
              bodyGated ? (
                // Nothing to render: the body was never fetched (#1763). A
                // spacer keeps the unlock CTA — which LockedBodyGate draws over
                // its children — a readable size instead of a 0px strip.
                <div className="min-h-48" />
              ) : (
                <div>
                  <AttachmentUploadStatus
                    fileName={uploadingFile}
                    uploadingLabel={t("attachment.uploading")}
                  />
                  <NoteBodyEditor
                    note={selected}
                    linking={linking}
                    remountToken={bodyEpoch}
                    attachments={attachments}
                    onEditorChange={setBodyEditor}
                    onNavigateToItem={onNavigateToItem}
                    // #2057: saves against the version the body opened at.
                    bodySync={notes}
                    // Borderless, so the title and the body read as one surface
                    // on the page, as the Daily body does (#2661, #2583).
                    className="pt-1"
                  />
                </div>
              )
            }
          />
        </div>
      ) : (
        <div className="flex min-h-[50vh] items-center justify-center">
          {/* #1149: "select a note or create a new one" used to be the whole
              screen, which asked the user to pick from nothing. The recently
              OPENED notes go underneath it as things to actually pick. With no
              history (first run, everything deleted) the list is absent and
              this is the centred icon + line on its own.

              #1372: no CTA of its own. The toolbar pill above (the top bar's
              "+" on narrow, #2795) is the add entry at both widths, so a
              second button saying the same thing only doubled the target. */}
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
                  : t(
                      offline
                        ? "materials.notes.offlineEmpty"
                        : "materials.notes.empty",
                    )
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
                      <RecentNoteCard
                        title={note.title || t("materials.notes.untitled")}
                        // A locked note's body is not shown anywhere until it
                        // is unlocked, the excerpt included — checked here too
                        // because the excerpt map can predate the lock.
                        excerpt={
                          note.hasPassword
                            ? undefined
                            : excerpts.get(note.id) || undefined
                        }
                        updated={formatNoteUpdated(
                          note.updatedAt,
                          recentNow,
                          recentUpdatedLabels,
                        )}
                        onSelect={() => handleSelectNote(note.id)}
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
        ref={measureMainColumn}
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          // The gutter token, so the note's sticky header can stretch across
          // exactly this padding (NoteDetailPanel STICKY_HEADER_BOX).
          !isWide && "overflow-y-auto px-lumen-gutter",
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
      {dataService && (
        <TemplateEditHost
          library={templateLibrary}
          columnWidth={mainColumnWidth}
        />
      )}

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

      {/* The sidebar's right-click panels (#1677). Top level, not inside
          the portal: on narrow that portal is the drawer, and a panel mounted
          in it would be unmounted with the drawer. */}
      {sidebarMenus.menus}
      {headerTagEdit.panel}

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
          labels={passwordLabels}
          onSubmit={password.submit}
          onClose={password.closeDialog}
        />
      )}
    </div>
  );
}

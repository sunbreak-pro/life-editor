import { useCallback, useEffect, useMemo, useState } from "react";
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
  EmptyState,
  SkeletonList,
  ExcerptListItem,
  QuickAddSheet,
  BottomSheet,
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
 *     92%-height read sheet, and a "+" QuickAddSheet.
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
  const { allTags, getTagsForItem, assignTagToItem } =
    useWikiTagsUnifiedContext();
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
  // Mobile-only: the note whose read sheet is open + the quick-add sheet.
  const [readNoteId, setReadNoteId] = useState<string | null>(null);
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
    handleCreateNoteForLink,
  } = useNoteLinking({
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

  // Read-only tag pills for a note (Mobile read sheet). Desktop uses the
  // editable TagPicker instead.
  const tagsById = useMemo(() => {
    const map = new Map<string, (typeof allTags)[number]>();
    for (const tag of allTags) map.set(tag.id, tag);
    return map;
  }, [allTags]);

  const renderReadonlyTags = (noteId: string) => {
    const noteAssignments = getTagsForItem(noteId).filter((a) => !a.isDeleted);
    if (noteAssignments.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {noteAssignments.map((a) => {
          const tag = tagsById.get(a.tagId);
          if (!tag) return null;
          return (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-lumen-border bg-lumen-bg px-2 py-0.5 text-[11.5px] text-lumen-text-secondary"
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  tag.color ? "" : "bg-lumen-border-strong",
                )}
                style={tag.color ? { backgroundColor: tag.color } : undefined}
              />
              {tag.name}
            </span>
          );
        })}
      </div>
    );
  };

  // Selecting from the side list fills the MAIN editor; the list stays open.
  const handleSelectDesktop = (id: string) => {
    notes.setSelectedNoteId(id);
  };

  const handleOpenRead = (id: string) => {
    notes.setSelectedNoteId(id); // hydrates the body before the sheet reads it
    setReadNoteId(id);
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
              className="min-w-0 flex-1 bg-transparent text-[13px] text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none"
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
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-4">
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
                      "min-w-0 shrink truncate rounded-full border px-2.5 py-0.5 text-[13px] font-semibold text-lumen-text",
                      color ? "" : "border-lumen-border bg-lumen-bg-secondary",
                    )}
                    style={bandStyle}
                  >
                    {group.tagName}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-lumen-text-tertiary">
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
                        onClick={() => handleOpenRead(node.id)}
                      />
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating "+" quick-add. */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label={t("materials.notes.quickAddTitle")}
        className={cn(
          "absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full",
          "bg-lumen-accent text-lumen-on-accent shadow-lumen-md transition-opacity hover:opacity-90",
          FOCUS_RING,
        )}
      >
        <Plus size={22} aria-hidden />
      </button>
    </div>
  );

  // ---- Mobile read sheet ----------------------------------------------

  const readNote = readNoteId
    ? notes.notes.find((n) => n.id === readNoteId)
    : null;
  const readGated =
    !!readNote?.hasPassword && !unlocked.has(readNote?.id ?? "");
  // The LIST omits note bodies (content=""); the body arrives only after the
  // async hydrate driven by handleOpenRead. selectedNote.id matches readNoteId
  // exactly when that hydrate has completed, so gate the editor mount on it —
  // RichTextEditor ignores initialContent changes once mounted under a stable key.
  const readReady = readNoteId != null && notes.selectedNote?.id === readNoteId;

  // ---- Desktop rightSidebar detail ------------------------------------

  const detailGated =
    !!selected?.hasPassword && !unlocked.has(selected?.id ?? "");

  const detailContentEditor = selected ? (
    <div className="relative">
      <div
        className={
          detailGated ? "pointer-events-none select-none blur-md" : undefined
        }
        aria-hidden={detailGated}
      >
        <RichTextEditor
          key={selected.id}
          noteId={selected.id}
          initialContent={selected.content || undefined}
          editable={!selected.isEditLocked}
          onUpdate={(content) => notes.updateNote(selected.id, { content })}
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
        />
      </div>
      {detailGated && (
        <button
          type="button"
          onClick={() => setPwDialog({ mode: "verify", noteId: selected.id })}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary text-lumen-text",
            FOCUS_RING,
          )}
        >
          <Lock size={20} aria-hidden />
          <span className="text-sm">{t("materials.notes.lockedHint")}</span>
        </button>
      )}
    </div>
  ) : undefined;

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

      {/* Mobile read sheet — 92% height, read-only. */}
      {!isWide && (
        <BottomSheet
          open={readNote != null}
          onClose={() => setReadNoteId(null)}
          title={readNote?.title || t("notesView.detailTitle")}
          className="flex max-h-[92vh] min-h-[70vh] flex-col overflow-hidden"
        >
          {readNote && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              <h2 className="text-lg font-semibold text-lumen-text">
                {readNote.title || "(untitled)"}
              </h2>
              {renderReadonlyTags(readNote.id)}
              {readGated ? (
                <button
                  type="button"
                  onClick={() =>
                    setPwDialog({ mode: "verify", noteId: readNote.id })
                  }
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary py-12 text-lumen-text",
                    FOCUS_RING,
                  )}
                >
                  <Lock size={20} aria-hidden />
                  <span className="text-sm">
                    {t("materials.notes.lockedHint")}
                  </span>
                </button>
              ) : readReady ? (
                <RichTextEditor
                  key={readNote.id}
                  noteId={readNote.id}
                  initialContent={notes.selectedNote?.content || undefined}
                  editable={false}
                  onUpdate={() => {}}
                  // Read-only: no "[[" suggestion (loadLinkTargets omitted), but
                  // resolved links stay clickable for navigation.
                  onNavigateToItem={onNavigateToItem}
                />
              ) : (
                <SkeletonList rows={4} rowHeight={20} gap={8} />
              )}
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

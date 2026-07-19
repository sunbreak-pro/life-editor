import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  GripVertical,
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
  buildTagGroups,
  sortNotesForList,
  cn,
  type NoteNode,
  type NoteSortMode,
  type NoteTagGroup,
  type DataService,
} from "@life-editor/shared";
import {
  useNoteTagDnd,
  tagDroppableId,
  noteDraggableId,
} from "./useNoteTagDnd";
import { RichTextEditor } from "./RichTextEditor";
import { useItemLinkTargets } from "./useItemLinkTargets";
import {
  NotePasswordDialog,
  type NotePasswordMode,
} from "./NotePasswordDialog";
import { TagPicker, LinkPanel } from "../wikitag";
import { TreeDragGhost } from "../components/TreeDragGhost";

/*
 * Web Notes tab (life-tags unification S1). The former folder tree is gone:
 * the side list now GROUPS active notes under a heading per life-tag (name-
 * sorted, color dot) plus a trailing "untagged" bucket. Grouping keys off tag
 * assignments only (buildTagGroups, shared) — NOT the tree position — so real
 * data still carrying folder nodes / folder-nested notes stays fully visible
 * while the data-layer folder retirement waits for S3.
 *
 *   - Desktop (isWide): the MAIN content is the selected note's editor — the
 *     shared <NoteDetailPanel variant="main"> in a centered surface. Nothing
 *     selected → the shared <EmptyState>. The grouped side list (search + "+
 *     note", collapsible tag headings, draggable note rows, a "Trash (N)" row)
 *     is PUSHED INTO THE SHARED rightSidebar via RightSidebarPortal.
 *   - Mobile (narrow): the same tag groups as collapsible headings +
 *     ExcerptListItem rows, a 92%-height read sheet, and a "+" QuickAddSheet.
 *
 * DnD: drag a note onto a tag heading = assign that tag (useNoteTagDnd). The
 * untagged bucket is NOT a drop target (dropping there would mean "remove all
 * tags" — destructive, so a no-op). No reorder / move-into: sort_order carries
 * no meaning across the many-to-many tag model. Data stays context-side
 * (useNotesUnifiedContext / useWikiTagsUnifiedContext); this view is
 * DataService-free (§3.1) and takes copy from useTranslation → props.
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

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg";

// Collapse state for tag-group headings. Persisted so a folded group stays
// folded across reloads. The untagged bucket uses the sentinel key below.
const LS_TAG_GROUPS_COLLAPSED = "note-tag-groups-collapsed";
const UNTAGGED_KEY = "__untagged__";

const groupKey = (group: NoteTagGroup): string => group.tagId ?? UNTAGGED_KEY;

function loadCollapsedGroups(): Set<string> {
  try {
    const saved = localStorage.getItem(LS_TAG_GROUPS_COLLAPSED);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // ignore malformed / unavailable storage
  }
  return new Set();
}

function saveCollapsedGroups(keys: Set<string>): void {
  try {
    localStorage.setItem(LS_TAG_GROUPS_COLLAPSED, JSON.stringify([...keys]));
  } catch {
    // ignore storage write failures (private mode / quota)
  }
}

// ---- Desktop draggable note row -------------------------------------------

function DesktopNoteRow({
  node,
  dragId,
  selected,
  onSelect,
  onDelete,
  deleteLabel,
  dragHintLabel,
}: {
  node: NoteNode;
  dragId: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  deleteLabel: string;
  dragHintLabel: string;
}) {
  // dragId is group-scoped: the same note renders under every tag heading it
  // has, and @dnd-kit needs globally-unique draggable ids.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "group relative flex items-center gap-2 rounded-lumen-md border px-2",
        "h-[36px] text-[13px]",
        isDragging && "opacity-40",
        selected
          ? "border-lumen-accent bg-lumen-accent-subtle"
          : "border-transparent hover:bg-lumen-hover",
      )}
    >
      {/* Grip — hover-revealed, keyboard-focusable. Starts the drag. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={dragHintLabel}
        className={cn(
          "shrink-0 cursor-grab text-lumen-text-tertiary opacity-0 transition-opacity",
          "hover:text-lumen-text focus-visible:opacity-100 group-hover:opacity-100",
          FOCUS_RING,
        )}
      >
        <GripVertical size={13} aria-hidden />
      </button>

      <FileText
        size={14}
        aria-hidden
        className={cn(
          "shrink-0",
          selected ? "text-lumen-accent" : "text-lumen-text-secondary",
        )}
      />

      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex flex-1 items-center gap-1.5 truncate text-left",
          FOCUS_RING,
        )}
      >
        <span
          className={cn(
            "truncate",
            node.isPinned ? "font-medium" : "",
            selected ? "text-lumen-accent" : "text-lumen-text",
          )}
        >
          {node.title || "(untitled)"}
        </span>
        {node.isPinned && (
          <Pin
            size={12}
            aria-label="Pinned"
            className="shrink-0 text-lumen-accent"
          />
        )}
        {node.hasPassword && (
          <Lock
            size={12}
            aria-label="Password protected"
            className="shrink-0 text-lumen-text-tertiary"
          />
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
        aria-label={`${deleteLabel}: ${node.title || "untitled"}`}
        className={cn(
          "shrink-0 text-lumen-text-tertiary opacity-0 transition-opacity",
          "hover:text-lumen-danger focus-visible:opacity-100 group-hover:opacity-100",
          FOCUS_RING,
        )}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}

// ---- Desktop droppable tag heading ----------------------------------------

function DesktopTagHeading({
  group,
  collapsed,
  onToggle,
  collapseLabel,
  expandLabel,
}: {
  group: NoteTagGroup;
  collapsed: boolean;
  onToggle: (key: string) => void;
  collapseLabel: string;
  expandLabel: string;
}) {
  const isUntagged = group.tagId === null;
  // Untagged is a no-op drop target: disabled so it never becomes `over`.
  const { setNodeRef, isOver } = useDroppable({
    id: isUntagged ? "note-untagged-nodrop" : tagDroppableId(group.tagId!),
    disabled: isUntagged,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lumen-md border",
        isOver
          ? "border-lumen-accent bg-lumen-accent-subtle"
          : "border-transparent",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(groupKey(group))}
        aria-expanded={!collapsed}
        aria-label={collapsed ? expandLabel : collapseLabel}
        className={cn(
          "flex w-full items-center gap-2 rounded-lumen-md px-1.5 py-2 text-left hover:bg-lumen-hover",
          FOCUS_RING,
        )}
      >
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
        <span
          aria-hidden
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            group.tagColor ? "" : "bg-lumen-border-strong",
          )}
          style={
            group.tagColor ? { backgroundColor: group.tagColor } : undefined
          }
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-lumen-text">
          {group.tagName}
        </span>
        <span className="shrink-0 rounded-full bg-lumen-bg-secondary px-2 py-0.5 text-[11px] font-medium tabular-nums text-lumen-text-secondary">
          {group.notes.length}
        </span>
      </button>
    </div>
  );
}

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
  const {
    allTags,
    getTagsForItem,
    assignTagToItem,
    createItemLink,
    getLinksForItem,
  } = useWikiTagsUnifiedContext();
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
  const [collapsedGroups, setCollapsedGroups] =
    useState<Set<string>>(loadCollapsedGroups);
  // Mobile-only: the note whose read sheet is open + the quick-add sheet.
  const [readNoteId, setReadNoteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveCollapsedGroups(next);
      return next;
    });
  }, []);

  // Linkable candidates pool for the LinkPanel: active notes only.
  const linkableItems = useMemo(
    () =>
      notes.notes
        .filter((n) => !n.isDeleted)
        .map((n) => ({
          id: n.id,
          label: `[${n.type}] ${n.title || "(untitled)"}`,
        })),
    [notes.notes],
  );
  const resolveTitle = (id: string): string | undefined => {
    const n = notes.notes.find((nn) => nn.id === id);
    if (!n) return undefined;
    return `[${n.type}] ${n.title || "(untitled)"}`;
  };

  // "[[" link-target pool (notes + dailies, cross-domain) for the editor's
  // wiki-link autocomplete. Absent when no DataService is injected.
  const linkTargets = useItemLinkTargets(dataService);

  // A link click from another tab lands here with a pending note id — select
  // it once (the async note load resolves selectedNote afterwards), then clear.
  useEffect(() => {
    if (!pendingSelectNoteId) return;
    notes.setSelectedNoteId(pendingSelectNoteId);
    onConsumePendingSelect?.();
    // notes.setSelectedNoteId / onConsumePendingSelect are stable enough; rerun
    // only when a new pending id arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelectNoteId]);

  // Mirror a resolved "[[" link into the item_links graph (Connect / backlinks)
  // as an edge from the CURRENT note to the target. Duplicate-guarded against
  // the bulk cache; NEVER deleted when the text link is removed — item_links has
  // no origin column, so a delete-sync would also destroy links the user added
  // by hand in the LinkPanel. Self-links are skipped (createItemLink rejects
  // them anyway).
  const handleResolvedLinkInserted = useCallback(
    (fromId: string, targetId: string) => {
      if (!fromId || fromId === targetId) return;
      const already = getLinksForItem(fromId).outgoing.some(
        (l) => !l.isDeleted && l.toItemId === targetId,
      );
      if (already) return;
      void createItemLink(fromId, targetId).catch((e) =>
        console.error("[NotesView] item link upsert failed", e),
      );
    },
    [getLinksForItem, createItemLink],
  );

  // "[[" create-a-note-and-link. select:false keeps the editor on the note the
  // user is writing in (createNote otherwise switches selection, remounting the
  // editor mid-insert); skipUndo avoids polluting the undo stack for a link.
  const handleCreateNoteForLink = useCallback(
    async (label: string): Promise<{ id: string } | null> => {
      const id = notes.createNote(label, { select: false, skipUndo: true });
      return id ? { id } : null;
    },
    [notes],
  );

  // Search filter (title-only — the list is body-free under M1). Applied
  // before grouping so a query narrows every tag heading at once.
  const searchedNotes = useMemo(() => {
    const q = notes.searchQuery.trim().toLowerCase();
    if (!q) return notes.notes;
    return notes.notes.filter((n) => (n.title || "").toLowerCase().includes(q));
  }, [notes.notes, notes.searchQuery]);

  // Flat assignment pool for the notes in view. getTagsForItem reads the
  // Provider's bulk cache synchronously (no N+1); buildTagGroups drops
  // deleted assignments / deleted-tag assignments itself.
  const assignments = useMemo(
    () => searchedNotes.flatMap((n) => getTagsForItem(n.id)),
    [searchedNotes, getTagsForItem],
  );

  const groups = useMemo(
    () =>
      buildTagGroups({
        notes: searchedNotes,
        tags: allTags,
        assignments,
        untaggedLabel: t("materials.notes.untagged"),
      }),
    [searchedNotes, allTags, assignments, t],
  );

  // #283 sort controls (desktop sidebar). Mode ids map 1:1 to NoteSortMode.
  const sortModes = useMemo(
    () => [
      { id: "updatedAt", label: t("materials.notes.sortUpdated") },
      { id: "createdAt", label: t("materials.notes.sortCreated") },
      { id: "title", label: t("materials.notes.sortTitle") },
    ],
    [t],
  );

  // buildTagGroups re-sorts each group internally (pinned-first then title), so
  // the user's chosen sort is applied AFTER grouping — within each tag group,
  // preserving pinned-first. Group ORDER (by tag name) is left unchanged.
  const sortedGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        notes: sortNotesForList(
          group.notes,
          notes.sortMode,
          notes.sortDirection,
        ),
      })),
    [groups, notes.sortMode, notes.sortDirection],
  );

  // Direction label must describe the REAL rendered order. For the date modes
  // the comparator's "asc" reads as newest-first (compareNotes quirk), so date
  // modes use newest/oldest; title uses ascending/descending.
  const isTitleSort = notes.sortMode === "title";
  const directionLabel = isTitleSort
    ? notes.sortDirection === "asc"
      ? t("materials.sidebar.ascending")
      : t("materials.sidebar.descending")
    : notes.sortDirection === "asc"
      ? t("materials.sidebar.newest")
      : t("materials.sidebar.oldest");

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

  const hasNotes = groups.length > 0;

  // ---- Desktop side list ----------------------------------------------
  //
  // The tag-grouped note list, pushed into the shared rightSidebar (wide-
  // only). The panel well supplies padding + scroll, so this is frameless
  // natural-flow content: search + create, the groups, then the Trash section.

  const sidebarList = (
    <div className="flex flex-col gap-2">
      {/* Search + create. Folder-create is gone — organization is tags now. */}
      <div className="flex flex-col gap-2">
        <div className="flex h-8 items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-surface-sunken px-2.5">
          <Search
            size={13}
            aria-hidden
            className="shrink-0 text-lumen-text-tertiary"
          />
          <input
            value={notes.searchQuery}
            onChange={(e) => notes.setSearchQuery(e.target.value)}
            placeholder={t("materials.notes.searchPlaceholder")}
            aria-label={t("materials.notes.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-lumen-text placeholder:text-lumen-text-tertiary focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => notes.createNote()}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3 py-1.5",
            "text-[12.5px] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90",
            FOCUS_RING,
          )}
        >
          <Plus size={14} aria-hidden className="shrink-0" />
          <span className="truncate">{t("materials.notes.addCta")}</span>
        </button>
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
            {sortedGroups.map((group) => {
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
                    <ul className="ml-[10px] flex flex-col gap-0.5 border-l border-lumen-border pl-2.5">
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
          (selected && selected.type !== "folder" ? (
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
    </div>
  );

  // ---- Mobile body ----------------------------------------------------

  const mobileBody = (
    <div className="flex h-full flex-col px-4 pt-2">
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
          {groups.map((group) => {
            const key = groupKey(group);
            const collapsed = collapsedGroups.has(key);
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
                    "flex items-center gap-2 px-1 py-1.5 text-left",
                    FOCUS_RING,
                  )}
                >
                  {collapsed ? (
                    <ChevronRight
                      size={13}
                      aria-hidden
                      className="shrink-0 text-lumen-text-secondary"
                    />
                  ) : (
                    <ChevronDown
                      size={13}
                      aria-hidden
                      className="shrink-0 text-lumen-text-secondary"
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      group.tagColor ? "" : "bg-lumen-border-strong",
                    )}
                    style={
                      group.tagColor
                        ? { backgroundColor: group.tagColor }
                        : undefined
                    }
                  />
                  <span className="text-sm font-semibold text-lumen-text">
                    {group.tagName}
                  </span>
                  <span className="text-[13px] text-lumen-text-tertiary">
                    （{group.notes.length}）
                  </span>
                </button>
                {!collapsed &&
                  group.notes.map((node) => (
                    <div key={`${key}-${node.id}`} className="pl-4">
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
          linkTargets={linkTargets}
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
  // — F-3 #260). Nothing selected → the select-or-create empty state. Folders can no longer be selected (they are never
  // rendered as rows), but the folder guards on the slots are kept as defence
  // in depth while real data still carries folder nodes.

  const desktopMain = selected ? (
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
        selected.type === "folder" ? undefined : (
          <TagPicker itemId={selected.id} showLabel size="sm" />
        )
      }
      contentLabel={t("materials.notes.content")}
      contentEditor={
        selected.type === "folder" ? undefined : detailContentEditor
      }
    />
  ) : (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<FileText aria-hidden />}
        message={
          hasNotes ? t("materials.notes.mainEmpty") : t("materials.notes.empty")
        }
        cta={{
          label: t("materials.notes.addCta"),
          onClick: () => notes.createNote(),
        }}
      />
    </div>
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
                  // Read-only: no "[[" suggestion (linkTargets omitted), but
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

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  FileText,
  Folder,
  ChevronRight,
  ChevronDown,
  GripVertical,
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
  cn,
  type NoteNode,
} from "@life-editor/shared";
import { useNoteTreeDnd } from "./useNoteTreeDnd";
import { RichTextEditor } from "./RichTextEditor";
import {
  NotePasswordDialog,
  type NotePasswordMode,
} from "./NotePasswordDialog";
import { TagPicker, LinkPanel } from "../wikitag";
import { TreeNodeIndent } from "../components/TreeNodeIndent";
import { treeCollisionDetection } from "../components/treeCollision";
import { TreeDragGhost } from "../components/TreeDragGhost";

/*
 * Web Notes tab. Flipped to the Daily操作モデル ("sidebar = list / main =
 * editor") so Notes / Daily read the same way:
 *
 *   - Desktop (isWide): the MAIN content is the selected note's editor — the
 *     shared <NoteDetailPanel variant="main"> (title / pin / delete meta row +
 *     tags + TipTap body + links) in a centered max-width 800px surface, the
 *     Daily EditorCard's slot. Nothing selected → the shared <EmptyState>
 *     select-or-create CTA. The note tree (search + "+ note" / folder create,
 *     34px rows with chevron folders, hover grip + trash, pin / lock
 *     indicators, and a "Trash (N)" row) is PUSHED INTO THE SHARED
 *     rightSidebar via RightSidebarPortal — it is always-present nav content
 *     (not selection-driven), so the portal renders whenever wide. On mount we
 *     call rightSidebar.open() (isOpen is non-persisted / starts false) so the
 *     list = the tab's nav is visible on entry. Context method only — the
 *     shell files stay untouched.
 *   - Mobile (narrow): unchanged. A read + shortest-add surface (brief): a
 *     "Pinned" section, an "All notes (N)" tree of collapsible folder headings
 *     + ExcerptListItem rows, a 92%-height read sheet (title + read-only tags +
 *     read-only body, unlock gate preserved), and a "+" QuickAddSheet.
 *
 * DnD (reorder / move-into-folder / to-root), the password / unlock
 * subsystem, and Trash restore/purge are preserved. Data stays context-side
 * (useNotesUnifiedContext); this view is DataService-free (§3.1) and takes copy
 * from useTranslation → props.
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

interface FlatRow {
  node: NoteNode;
  depth: number;
  hasChildren: boolean;
  isLastChild: boolean;
}

// ---- Desktop tree row -------------------------------------------------

function DesktopNoteRow({
  row,
  expanded,
  selected,
  dropPosition,
  onToggleExpand,
  onSelect,
  onDelete,
  deleteLabel,
}: {
  row: FlatRow;
  expanded: boolean;
  selected: boolean;
  dropPosition: "above" | "below" | "inside" | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  deleteLabel: string;
}) {
  const { node, depth, hasChildren, isLastChild } = row;
  const { attributes, listeners, setNodeRef } = useSortable({ id: node.id });
  const isFolder = node.type === "folder";
  const showInside = dropPosition === "inside";
  const highlighted = showInside || selected;

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "group relative flex items-center gap-2 rounded-lumen-md border px-2",
        "h-[34px] text-[13.5px]",
        highlighted
          ? "border-lumen-accent bg-lumen-accent-subtle"
          : "border-transparent hover:bg-lumen-hover",
      )}
    >
      {dropPosition === "above" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded-full bg-lumen-accent"
        />
      )}
      {dropPosition === "below" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-lumen-accent"
        />
      )}

      {/* Grip — hover-revealed (TaskTree parity), keyboard-focusable. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder or move"
        className={cn(
          "shrink-0 cursor-grab text-lumen-text-tertiary opacity-0 transition-opacity",
          "hover:text-lumen-text focus-visible:opacity-100 group-hover:opacity-100",
          FOCUS_RING,
        )}
      >
        <GripVertical size={13} aria-hidden />
      </button>

      <TreeNodeIndent depth={depth} isLastChild={isLastChild} />

      {isFolder ? (
        <button
          type="button"
          onClick={() => onToggleExpand(node.id)}
          aria-label={expanded ? "Collapse folder" : "Expand folder"}
          aria-expanded={expanded}
          className={cn(
            "inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center text-lumen-text-secondary hover:text-lumen-text",
            FOCUS_RING,
          )}
        >
          {expanded ? (
            <ChevronDown size={14} aria-hidden />
          ) : (
            <ChevronRight size={14} aria-hidden />
          )}
        </button>
      ) : (
        <FileText
          size={14}
          aria-hidden
          className={cn(
            "shrink-0",
            selected ? "text-lumen-accent" : "text-lumen-text-secondary",
          )}
        />
      )}

      <button
        type="button"
        onClick={() => (isFolder ? onToggleExpand(node.id) : onSelect(node.id))}
        className={cn(
          "flex flex-1 items-center gap-1.5 truncate text-left",
          FOCUS_RING,
        )}
      >
        <span
          className={cn(
            "truncate",
            isFolder || node.isPinned ? "font-medium" : "",
            selected ? "text-lumen-accent" : "text-lumen-text",
          )}
        >
          {node.title || "(untitled)"}
        </span>
        {!hasChildren && node.isPinned && (
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

      {!isFolder && (
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
      )}
    </li>
  );
}

export function NotesView() {
  const notes = useNotesUnifiedContext();
  const { allTags, getTagsForItem } = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  const isWide = useMediaQuery("(min-width: 768px)", true);
  const rightSidebar = useRightSidebarContext();

  // On wide entry, open the shared rightSidebar so the note tree (now the
  // panel's content = this tab's nav) is visible. isOpen is non-persisted and
  // starts false, so without this the list would be hidden on mount. open() is
  // idempotent (setState bails when already true); gate on the breakpoint only.
  useEffect(() => {
    if (isWide) rightSidebar.open();
    // rightSidebar.open is stable for the panel's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWide]);

  const [pwDialog, setPwDialog] = useState<{
    mode: NotePasswordMode;
    noteId: string;
  } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [trashOpen, setTrashOpen] = useState(false);
  // Mobile-only: the note whose read sheet is open + the quick-add sheet.
  const [readNoteId, setReadNoteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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

  const dnd = useNoteTreeDnd({
    notes: notes.notes,
    expandedIds: notes.expandedIds,
    toggleExpanded: notes.toggleExpanded,
    moveNode: notes.moveNode,
    moveNodeInto: notes.moveNodeInto,
    moveToRoot: notes.moveToRoot,
    onMoveRejected: (reason) =>
      setMoveError(`Move rejected: ${reason.replace(/_/g, " ")}`),
  });

  const flat = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = notes.getChildren(parentId).filter((n) => !n.isDeleted);
      children.forEach((node, index) => {
        const grand = notes.getChildren(node.id).filter((n) => !n.isDeleted);
        rows.push({
          node,
          depth,
          hasChildren: grand.length > 0,
          isLastChild: index === children.length - 1,
        });
        if (node.type === "folder" && notes.expandedIds.has(node.id)) {
          walk(node.id, depth + 1);
        }
      });
    };
    walk(null, 0);
    return rows;
  }, [notes]);

  const selected = notes.selectedNote;

  // Read-only tag pills for a note (Mobile read sheet). Desktop uses the
  // editable TagPicker instead.
  const tagsById = useMemo(() => {
    const map = new Map<string, (typeof allTags)[number]>();
    for (const tag of allTags) map.set(tag.id, tag);
    return map;
  }, [allTags]);

  const renderReadonlyTags = (noteId: string) => {
    const assignments = getTagsForItem(noteId).filter((a) => !a.isDeleted);
    if (assignments.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {assignments.map((a) => {
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

  // Selecting from the sidebar tree fills the MAIN editor; the sidebar (= the
  // tree/nav) stays open, so no open()/close() here — just flip the selection.
  const handleSelectDesktop = (id: string) => {
    notes.setSelectedNoteId(id);
  };

  const handleOpenRead = (id: string) => {
    notes.setSelectedNoteId(id); // hydrates the body before the sheet reads it
    setReadNoteId(id);
  };

  const addFolder = () => {
    const title = window.prompt(t("materials.notes.newFolderPrompt"), "");
    if (title === null) return;
    notes.createFolder(title.trim() || t("notes.newFolder"));
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

  const ids: UniqueIdentifier[] = flat.map((r) => r.node.id);
  const hasNotes = flat.length > 0;

  // ---- Desktop sidebar tree -------------------------------------------
  //
  // The note tree/nav, pushed into the shared rightSidebar (wide-only). The
  // panel well (RightSidebarContents) supplies the p-3 padding + scroll, so
  // this is frameless natural-flow content: search + create controls, the
  // tree, then the Trash section — no card frame of its own.

  const sidebarTree = (
    <div className="flex flex-col gap-2">
      {/* Search + create controls. Stacked so each stays legible at the panel's
          240px min width. */}
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
        {/* "+ note" primary fills the row; folder-create is a secondary
            icon-only square (aria-label carries the copy) so both stay
            comfortable at the 240px min panel width. */}
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => notes.createNote()}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3 py-1.5",
              "text-[12.5px] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90",
              FOCUS_RING,
            )}
          >
            <Plus size={14} aria-hidden className="shrink-0" />
            <span className="truncate">{t("materials.notes.addCta")}</span>
          </button>
          <button
            type="button"
            onClick={addFolder}
            aria-label={t("materials.notes.folderCta")}
            title={t("materials.notes.folderCta")}
            className={cn(
              "grid w-8 shrink-0 place-items-center rounded-lumen-md border border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
              FOCUS_RING,
            )}
          >
            <Folder size={14} aria-hidden />
          </button>
        </div>
      </div>

      {moveError && (
        <p
          role="alert"
          className="rounded-lumen-md border border-lumen-danger px-3 py-2 text-sm text-lumen-danger"
        >
          {moveError}
        </p>
      )}
      {notes.error && (
        <p
          role="alert"
          className="rounded-lumen-md border border-lumen-danger px-3 py-2 text-sm text-lumen-danger"
        >
          {notes.error}
        </p>
      )}

      {/* Tree. */}
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
          collisionDetection={treeCollisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={dnd.handleDragStart}
          onDragMove={dnd.handleDragMove}
          onDragEnd={dnd.handleDragEnd}
          onDragCancel={dnd.handleDragCancel}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-px">
              {flat.map((row) => (
                <DesktopNoteRow
                  key={row.node.id}
                  row={row}
                  expanded={notes.expandedIds.has(row.node.id)}
                  selected={selected?.id === row.node.id}
                  dropPosition={
                    dnd.overInfo?.overId === row.node.id &&
                    dnd.activeId !== row.node.id
                      ? dnd.overInfo.position
                      : null
                  }
                  onToggleExpand={notes.toggleExpanded}
                  onSelect={handleSelectDesktop}
                  onDelete={notes.softDeleteNote}
                  deleteLabel={t("materials.notes.deleteNote")}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {dnd.activeNode ? (
              <TreeDragGhost title={dnd.activeNode.title} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

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

  const pinnedNotes = flat.filter(
    (r) => r.node.type === "note" && r.node.isPinned,
  );

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
          {pinnedNotes.length > 0 && (
            <>
              <div className="px-0.5 text-[11px] uppercase tracking-wide text-lumen-text-tertiary">
                {t("materials.notes.pinnedSection")}
              </div>
              {pinnedNotes.map((r) => (
                <ExcerptListItem
                  key={`pin-${r.node.id}`}
                  title={r.node.title || "(untitled)"}
                  leading={<FileText size={14} aria-hidden />}
                  meta={
                    <Pin
                      size={13}
                      aria-label="Pinned"
                      className="text-lumen-accent"
                    />
                  }
                  onClick={() => handleOpenRead(r.node.id)}
                />
              ))}
            </>
          )}

          <div className="px-0.5 pt-1 text-[11px] uppercase tracking-wide text-lumen-text-tertiary">
            {t("materials.notes.allNotes")}（
            {flat.filter((r) => r.node.type === "note").length}）
          </div>

          {flat.map((r) => {
            const { node, depth } = r;
            if (node.type === "folder") {
              const expanded = notes.expandedIds.has(node.id);
              const count = notes
                .getChildren(node.id)
                .filter((n) => !n.isDeleted).length;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => notes.toggleExpanded(node.id)}
                  aria-expanded={expanded}
                  style={{ marginLeft: depth * 20 }}
                  className={cn(
                    "flex items-center gap-2 px-1 py-1.5 text-left",
                    FOCUS_RING,
                  )}
                >
                  {expanded ? (
                    <ChevronDown
                      size={13}
                      aria-hidden
                      className="shrink-0 text-lumen-text-secondary"
                    />
                  ) : (
                    <ChevronRight
                      size={13}
                      aria-hidden
                      className="shrink-0 text-lumen-text-secondary"
                    />
                  )}
                  <Folder
                    size={14}
                    aria-hidden
                    className="shrink-0 text-lumen-text-secondary"
                  />
                  <span className="text-sm font-semibold text-lumen-text">
                    {node.title || "(untitled)"}
                  </span>
                  <span className="text-[13px] text-lumen-text-tertiary">
                    （{count}）
                  </span>
                </button>
              );
            }
            // Pinned notes already surfaced in the Pinned section; skip the
            // duplicate here so the list reads cleanly.
            if (node.isPinned) return null;
            return (
              <div key={node.id} style={{ marginLeft: depth * 20 }}>
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
                    ) : undefined
                  }
                  onClick={() => handleOpenRead(node.id)}
                />
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
  // The selected note's detail (meta row + tags + TipTap body + links) as the
  // tab's MAIN content — a centered max-width 800px surface (the Daily
  // EditorCard slot). Nothing selected → the select-or-create empty state.
  // Folders never reach the main surface (the tree toggles them, never selects
  // them), but the folder guards on the slots are kept as defence in depth.

  const desktopMain = (
    <div className="flex h-full min-h-0 flex-col px-7 pb-6 pt-5">
      <div className="mx-auto flex min-h-0 w-full max-w-[800px] flex-1 flex-col overflow-y-auto">
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
            tagsSlot={
              selected.type === "folder" ? undefined : (
                <TagPicker itemId={selected.id} showLabel size="sm" />
              )
            }
            contentLabel={t("materials.notes.content")}
            contentEditor={
              selected.type === "folder" ? undefined : detailContentEditor
            }
            linksLabel={t("materials.notes.links")}
            linksSlot={
              selected.type === "folder" ? undefined : (
                <LinkPanel
                  itemId={selected.id}
                  resolveTitle={resolveTitle}
                  linkableItems={linkableItems}
                />
              )
            }
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
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
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {isWide ? desktopMain : mobileBody}

      {/* Note tree — pushed into the shared rightSidebar as always-present nav
          content (wide-only, so narrow never fills the MobileDrawer). */}
      {isWide && <RightSidebarPortal>{sidebarTree}</RightSidebarPortal>}

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

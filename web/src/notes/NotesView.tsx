import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FileText,
  Folder,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Lock,
  Pin,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useNotesUnifiedContext, type NoteNode } from "@life-editor/shared";
import { useNoteTreeDnd } from "./useNoteTreeDnd";
import { RichTextEditor } from "./RichTextEditor";
import {
  NotePasswordDialog,
  type NotePasswordMode,
} from "./NotePasswordDialog";
import { TagPicker, LinkPanel } from "../wikitag";

/*
 * Web Notes UI (S3). New, purpose-built notion-token UI (NOT a port of
 * the Tauri Notes screen) that exercises every shared Note data path:
 * hierarchical tree, expand/collapse, @dnd-kit reorder + into-folder +
 * to-root, create note/folder, rename, pin, soft-delete + restore +
 * purge, lean TipTap content edit, and the password / edit-lock
 * subsystem. Heavier Tauri features (wiki/note links, sidebar grouping,
 * search dropdown, sort UI chrome) are out of this milestone's scope.
 */

// i18n strings live in the host shell (CLAUDE.md §6.4 — never a
// useTranslation() inside shared/UI leaf components). English only for
// the web build so far; a real i18n table arrives with the Settings
// section S-step.
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

// Shared focus-visible ring (notion tokens only — no hardcoded colors).
// Kept in sync with the identical constant in NotePasswordDialog.tsx;
// promoting it to a shared export is out of this focused pass's scope.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent focus-visible:ring-offset-2 focus-visible:ring-offset-notion-bg";

interface FlatRow {
  node: NoteNode;
  depth: number;
  hasChildren: boolean;
}

function NoteRow({
  row,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onDelete,
}: {
  row: FlatRow;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { node, depth, hasChildren } = row;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 18 + 8}px`,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-md border px-2 py-1.5 ${
        selected
          ? "border-notion-accent bg-notion-hover"
          : "border-notion-border bg-notion-bg-secondary"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder or move"
        className={`cursor-grab text-notion-text-secondary hover:text-notion-text ${FOCUS_RING}`}
      >
        <GripVertical size={14} aria-hidden />
      </button>

      {node.type === "folder" ? (
        <button
          type="button"
          onClick={() => onToggleExpand(node.id)}
          aria-label={expanded ? "Collapse folder" : "Expand folder"}
          aria-expanded={expanded}
          className={`text-notion-text-secondary hover:text-notion-text ${FOCUS_RING}`}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )
          ) : (
            <span className="inline-block w-[14px]" aria-hidden />
          )}
        </button>
      ) : (
        <span className="inline-block w-[14px]" aria-hidden />
      )}

      <button
        type="button"
        onClick={() =>
          node.type === "folder" ? onToggleExpand(node.id) : onSelect(node.id)
        }
        className={`flex flex-1 items-center gap-1.5 text-left text-sm text-notion-text ${FOCUS_RING}`}
      >
        {node.type === "folder" ? (
          <Folder
            size={14}
            aria-hidden
            className="text-notion-text-secondary"
          />
        ) : (
          <FileText
            size={14}
            aria-hidden
            className="text-notion-text-secondary"
          />
        )}
        <span className={node.isPinned ? "font-medium" : ""}>
          {node.title || "(untitled)"}
        </span>
        {node.isPinned && (
          <Pin size={11} aria-label="Pinned" className="text-notion-accent" />
        )}
        {node.hasPassword && (
          <Lock
            size={11}
            aria-label="Password protected"
            className="text-notion-text-secondary"
          />
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          // Row click handles select/expand; the delete action must not
          // bubble to it (and folders are not selectable at all).
          e.stopPropagation();
          onDelete(node.id);
        }}
        aria-label={`Delete ${
          node.type === "folder" ? "folder" : "note"
        } ${node.title || "untitled"}`}
        className={`text-notion-text-secondary opacity-0 transition-opacity hover:text-notion-danger focus-visible:opacity-100 group-hover:opacity-100 ${FOCUS_RING}`}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}

/*
 * Note title field (B2). The previous inline <input> called `updateNote`
 * on every keystroke — a DataService write per character, and writes
 * mid-IME-composition. This mirrors RichTextEditor's debounce-and-flush
 * pattern exactly: a local draft, a 300ms debounced persist, an
 * immediate flush on blur, and a final flush on unmount. The parent
 * remounts this via `key={selected.id}` so a note switch (id change)
 * re-seeds the draft cleanly with no setState-in-effect / ref-in-render.
 * The key intentionally excludes `title`: the debounced persist mutates
 * `selected.title`, and keying on it would remount mid-typing and steal
 * focus (single-user app — an external rename re-seed is not needed).
 * The eventually-persisted value is unchanged — only the write cadence
 * differs.
 */
function NoteTitleInput({
  noteId,
  initialTitle,
  onCommit,
}: {
  noteId: string;
  initialTitle: string;
  onCommit: (id: string, title: string) => void;
}) {
  const [draft, setDraft] = useState(initialTitle);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      onCommitRef.current(noteId, pendingRef.current);
      pendingRef.current = null;
    }
  };

  useEffect(() => {
    // flush only touches refs (stable for this component lifetime), so
    // an empty dep array is correct — same as RichTextEditor.
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      value={draft}
      onChange={(e) => {
        const value = e.target.value;
        setDraft(value);
        pendingRef.current = value;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, 300);
      }}
      onBlur={flush}
      aria-label="Note title"
      className={`flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1.5 text-sm font-medium text-notion-text ${FOCUS_RING}`}
    />
  );
}

export function NotesView() {
  const notes = useNotesUnifiedContext();
  const [pwDialog, setPwDialog] = useState<{
    mode: NotePasswordMode;
    noteId: string;
  } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Linkable candidates pool for the LinkPanel (DU-F Step 9): active
  // notes only. Cross-role links (note → task / event / daily) still
  // need a raw id paste — DU-G removes this per-role wiring once
  // items_meta resolver is unified.
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
  // Session unlock set (no re-lock for the session — mirrors the legacy
  // ScreenLockContext `unlockedIds: Set`). A correct verify adds the note
  // id; switching notes and coming back keeps it unlocked.
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  const dnd = useNoteTreeDnd({
    notes: notes.notes,
    expandedIds: notes.expandedIds,
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
      for (const node of children) {
        const grand = notes.getChildren(node.id).filter((n) => !n.isDeleted);
        rows.push({ node, depth, hasChildren: grand.length > 0 });
        if (node.type === "folder" && notes.expandedIds.has(node.id)) {
          walk(node.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return rows;
    // `notes` is the memoised shared context value — its identity changes
    // whenever notes/expandedIds change, so it fully covers this memo.
  }, [notes]);

  const selected = notes.selectedNote;

  const promptTitle = (label: string, current?: string): string | null => {
    const next = window.prompt(label, current ?? "");
    if (next === null) return null;
    return next.trim();
  };

  const addNote = () => {
    const title = promptTitle("New note title");
    if (title === null) return;
    notes.createNote(title || "Untitled");
  };

  const addFolder = () => {
    const title = promptTitle("New folder title");
    if (title === null) return;
    notes.createFolder(title || "New Folder");
  };

  const rename = (node: NoteNode) => {
    const title = promptTitle("New title", node.title);
    if (title === null || !title || title === node.title) return;
    notes.updateNote(node.id, { title });
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

  const ids: UniqueIdentifier[] = flat.map((r) => r.node.id);

  if (notes.isLoading) {
    return <p className="text-notion-text-secondary">Loading notes…</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addNote}
            className={`rounded-md bg-notion-accent px-3 py-1.5 text-sm text-white hover:opacity-90 ${FOCUS_RING}`}
          >
            + Note
          </button>
          <button
            type="button"
            onClick={addFolder}
            className={`rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover ${FOCUS_RING}`}
          >
            + Folder
          </button>
        </div>

        {notes.error && (
          <p
            role="alert"
            className="rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
          >
            {notes.error}
          </p>
        )}

        {moveError && (
          <p
            role="alert"
            className="rounded-md border border-notion-danger px-3 py-2 text-sm text-notion-danger"
          >
            {moveError}
          </p>
        )}

        {flat.length === 0 ? (
          <p className="text-notion-text-secondary">
            No notes yet. Create one above.
          </p>
        ) : (
          <DndContext
            sensors={dnd.sensors}
            collisionDetection={closestCenter}
            onDragStart={dnd.handleDragStart}
            onDragMove={dnd.handleDragMove}
            onDragEnd={dnd.handleDragEnd}
            onDragCancel={dnd.handleDragCancel}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {flat.map((row) => (
                  <NoteRow
                    key={row.node.id}
                    row={row}
                    expanded={notes.expandedIds.has(row.node.id)}
                    selected={selected?.id === row.node.id}
                    onToggleExpand={notes.toggleExpanded}
                    onSelect={notes.setSelectedNoteId}
                    onDelete={notes.softDeleteNote}
                  />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay>
              {dnd.activeNode ? (
                <div className="rounded-md border border-notion-accent bg-notion-bg px-2 py-1.5 text-sm text-notion-text shadow-lg">
                  {dnd.activeNode.title || "(untitled)"}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {notes.deletedNotes.length > 0 && (
          <details className="rounded-md border border-notion-border px-3 py-2">
            <summary className="cursor-pointer text-sm text-notion-text-secondary">
              Trash ({notes.deletedNotes.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {notes.deletedNotes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-notion-text-secondary line-through">
                    {n.title || "(untitled)"}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => notes.restoreNote(n.id)}
                      aria-label={`Restore ${n.title || "untitled"}`}
                      className={`text-notion-accent hover:opacity-80 ${FOCUS_RING}`}
                    >
                      <RotateCcw size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => notes.permanentDeleteNote(n.id)}
                      aria-label={`Permanently delete ${n.title || "untitled"}`}
                      className={`text-notion-danger hover:opacity-80 ${FOCUS_RING}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="space-y-3">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <NoteTitleInput
                key={selected.id}
                noteId={selected.id}
                initialTitle={selected.title}
                onCommit={(id, title) => notes.updateNote(id, { title })}
              />
              <button
                type="button"
                onClick={() => notes.togglePin(selected.id)}
                aria-pressed={selected.isPinned}
                aria-label={selected.isPinned ? "Unpin note" : "Pin note"}
                className={`rounded-md border border-notion-border p-1.5 text-notion-text hover:bg-notion-hover ${FOCUS_RING}`}
              >
                <Pin
                  size={14}
                  aria-hidden
                  className={selected.isPinned ? "text-notion-accent" : ""}
                />
              </button>
              {/*
               * DU-F note (2026-05-24): Edit-lock / password / "Unlock"
               * buttons were removed because their legacy backends
               * (`toggleNoteEditLock` / `setNotePassword` /
               * `removeNotePassword` / `verifyNotePassword`) still throw
               * `_pendingDuRewrite` — the DU-F bridge ports only CRUD +
               * DnD. DU-G re-adds these once the Unified service grows
               * the password/lock subsystem. See git history (commit
               * before this comment) for the original button block.
               */}
              <button
                type="button"
                onClick={() => rename(selected)}
                className={`rounded-md border border-notion-border px-2 py-1.5 text-xs text-notion-text hover:bg-notion-hover ${FOCUS_RING}`}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => notes.softDeleteNote(selected.id)}
                className={`rounded-md border border-notion-border px-2 py-1.5 text-xs text-notion-danger hover:bg-notion-hover ${FOCUS_RING}`}
              >
                Delete
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TagPicker itemId={selected.id} showLabel size="sm" />
            </div>
            <LinkPanel
              itemId={selected.id}
              resolveTitle={resolveTitle}
              linkableItems={linkableItems}
            />

            {(() => {
              const gated =
                !!selected.hasPassword && !unlocked.has(selected.id);
              return (
                <div className="relative">
                  <div
                    className={
                      gated
                        ? "select-none blur-md pointer-events-none"
                        : undefined
                    }
                    aria-hidden={gated}
                  >
                    <RichTextEditor
                      key={selected.id}
                      noteId={selected.id}
                      initialContent={selected.content || undefined}
                      editable={!selected.isEditLocked}
                      onUpdate={(content) =>
                        notes.updateNote(selected.id, { content })
                      }
                    />
                  </div>
                  {gated && (
                    <button
                      type="button"
                      onClick={() =>
                        setPwDialog({ mode: "verify", noteId: selected.id })
                      }
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md border border-notion-border bg-notion-bg-secondary text-notion-text ${FOCUS_RING}`}
                    >
                      <Lock size={20} aria-hidden />
                      <span className="text-sm">
                        This note is password protected
                      </span>
                      <span className="text-xs text-notion-text-secondary">
                        Click to unlock
                      </span>
                    </button>
                  )}
                </div>
              );
            })()}
            {selected.isEditLocked && (
              <p className="text-xs text-notion-text-secondary">
                This note is edit-locked. Unlock it to make changes.
              </p>
            )}
          </>
        ) : (
          <p className="text-notion-text-secondary">
            Select a note to view and edit it.
          </p>
        )}
      </section>

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

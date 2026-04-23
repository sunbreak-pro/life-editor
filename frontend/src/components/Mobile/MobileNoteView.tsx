import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderPlus,
  Heart,
  HeartOff,
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { NoteNode } from "../../types/note";
import { useNoteContext } from "../../hooks/useNoteContext";
import { LazyRichTextEditor as RichTextEditor } from "../shared/LazyRichTextEditor";
import { MobileNoteTree } from "./materials/MobileNoteTree";
import { MobileNoteTreeItem } from "./materials/MobileNoteTreeItem";
import {
  MobileActionSheet,
  type MobileActionSheetItem,
} from "./shared/MobileActionSheet";
import {
  NumericPadPasswordDialog,
  type NumericPadMode,
} from "./shared/NumericPadPasswordDialog";
import { MobileNoteTagsBar } from "./materials/MobileNoteTagsBar";

function extractPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.content) {
      return parsed.content
        .map(
          (block: { content?: Array<{ text?: string }> }) =>
            block.content?.map((c) => c.text || "").join("") || "",
        )
        .join(" ")
        .slice(0, 120);
    }
  } catch {
    // plain text
  }
  return content?.slice(0, 120) || "";
}

const STORAGE_FAVORITES_OPEN = "mobile-note-favorites-open";

export function MobileNoteView() {
  const { t } = useTranslation();
  const {
    notes,
    expandedIds,
    toggleExpanded,
    createNote,
    createFolder,
    updateNote,
    softDeleteNote,
    togglePin,
    setNotePassword,
    removeNotePassword,
    verifyNotePassword,
    toggleEditLock,
  } = useNoteContext();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [favoritesOpen, setFavoritesOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(STORAGE_FAVORITES_OPEN);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [contextNode, setContextNode] = useState<NoteNode | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    mode: NumericPadMode;
    nodeId: string;
    onSuccess?: () => void;
  } | null>(null);

  const selectedNote = useMemo(
    () =>
      selectedId ? (notes.find((n) => n.id === selectedId) ?? null) : null,
    [notes, selectedId],
  );

  const pinnedNotes = useMemo(
    () =>
      notes
        .filter((n) => n.isPinned && !n.isDeleted && n.type === "note")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  );

  const toggleFavoritesOpen = () => {
    setFavoritesOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_FAVORITES_OPEN, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const openNote = useCallback(
    (node: NoteNode) => {
      if (node.hasPassword && !unlockedIds.has(node.id)) {
        setPasswordPrompt({
          mode: "verify",
          nodeId: node.id,
          onSuccess: () => {
            setUnlockedIds((prev) => new Set(prev).add(node.id));
            setSelectedId(node.id);
          },
        });
        return;
      }
      setSelectedId(node.id);
    },
    [unlockedIds],
  );

  const handleCreateNote = (parentId: string | null = null) => {
    const id = createNote("Untitled", { parentId });
    setSelectedId(id);
  };

  const handleCreateFolder = (parentId: string | null = null) => {
    createFolder(t("mobile.note.newFolder", "New Folder"), parentId);
  };

  const handleRename = (node: NoteNode) => {
    const next = window.prompt(
      t("mobile.note.rename", "Rename"),
      node.title || "",
    );
    if (next !== null && next.trim() !== "") {
      updateNote(node.id, { title: next.trim() });
    }
  };

  const handleDelete = (node: NoteNode) => {
    if (
      window.confirm(
        t("mobile.note.confirmDelete", "Move to trash?") + `\n${node.title}`,
      )
    ) {
      softDeleteNote(node.id);
      if (selectedId === node.id) setSelectedId(null);
    }
  };

  const contextMenuItems = useMemo<MobileActionSheetItem[]>(() => {
    if (!contextNode) return [];
    const items: MobileActionSheetItem[] = [];

    items.push({
      id: "rename",
      label: t("mobile.note.rename", "Rename"),
      icon: <Pencil size={16} />,
      onSelect: () => handleRename(contextNode),
    });

    if (contextNode.type === "note") {
      items.push({
        id: "pin",
        label: contextNode.isPinned
          ? t("mobile.note.unpin", "Remove from favorites")
          : t("mobile.note.pin", "Add to favorites"),
        icon: contextNode.isPinned ? (
          <HeartOff size={16} />
        ) : (
          <Heart size={16} />
        ),
        onSelect: () => togglePin(contextNode.id),
      });

      if (contextNode.hasPassword) {
        items.push({
          id: "remove-password",
          label: t("mobile.note.removePassword", "Remove password"),
          icon: <KeyRound size={16} />,
          onSelect: () => {
            setPasswordPrompt({ mode: "remove", nodeId: contextNode.id });
          },
        });
        items.push({
          id: "change-password",
          label: t("mobile.note.changePassword", "Change password"),
          icon: <KeyRound size={16} />,
          onSelect: () => {
            setPasswordPrompt({ mode: "change", nodeId: contextNode.id });
          },
        });
      } else {
        items.push({
          id: "set-password",
          label: t("mobile.note.setPassword", "Set password"),
          icon: <KeyRound size={16} />,
          onSelect: () => {
            setPasswordPrompt({ mode: "set", nodeId: contextNode.id });
          },
        });
      }

      items.push({
        id: "edit-lock",
        label: contextNode.isEditLocked
          ? t("mobile.note.unlockEdit", "Unlock edit")
          : t("mobile.note.lockEdit", "Lock edit"),
        icon: contextNode.isEditLocked ? (
          <LockOpen size={16} />
        ) : (
          <Lock size={16} />
        ),
        onSelect: () => toggleEditLock(contextNode.id),
      });
    }

    if (contextNode.type === "folder") {
      items.push({
        id: "new-note-in-folder",
        label: t("mobile.note.newInFolder", "New note in this folder"),
        icon: <StickyNote size={16} />,
        onSelect: () => handleCreateNote(contextNode.id),
      });
      items.push({
        id: "new-folder-in-folder",
        label: t("mobile.note.newSubfolder", "New subfolder"),
        icon: <FolderPlus size={16} />,
        onSelect: () => handleCreateFolder(contextNode.id),
      });
    }

    items.push({
      id: "delete",
      label: t("mobile.note.delete", "Delete"),
      icon: <Trash2 size={16} />,
      destructive: true,
      onSelect: () => handleDelete(contextNode),
    });

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextNode, t, togglePin, toggleEditLock]);

  const handlePasswordSubmit = async (
    password: string,
    newPassword?: string,
  ): Promise<boolean> => {
    if (!passwordPrompt) return false;
    const { mode, nodeId, onSuccess } = passwordPrompt;
    try {
      if (mode === "set") {
        await setNotePassword(nodeId, password);
      } else if (mode === "verify") {
        const ok = await verifyNotePassword(nodeId, password);
        if (!ok) return false;
      } else if (mode === "remove") {
        const ok = await verifyNotePassword(nodeId, password);
        if (!ok) return false;
        await removeNotePassword(nodeId, password);
        setUnlockedIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      } else if (mode === "change") {
        const ok = await verifyNotePassword(nodeId, password);
        if (!ok) return false;
        await removeNotePassword(nodeId, password);
        if (newPassword) await setNotePassword(nodeId, newPassword);
      }
      setPasswordPrompt(null);
      onSuccess?.();
      return true;
    } catch {
      return false;
    }
  };

  if (selectedNote) {
    return (
      <MobileNoteDetail
        key={selectedNote.id}
        note={selectedNote}
        onBack={() => setSelectedId(null)}
        onUpdate={updateNote}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
        <h2 className="text-sm font-medium text-notion-text-primary">
          {t("mobile.tabs.notes", "Notes")}
        </h2>
        <button
          type="button"
          onClick={() => setCreateSheetOpen(true)}
          className="flex items-center gap-1 rounded bg-notion-accent px-3 py-1 text-xs text-white"
        >
          <Plus size={14} /> {t("mobile.note.new", "New")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Favorites toggle section */}
        <button
          type="button"
          onClick={toggleFavoritesOpen}
          className="flex w-full items-center justify-between border-b border-notion-border bg-notion-hover/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-notion-text-secondary"
        >
          <span className="flex items-center gap-1.5">
            <Heart
              size={12}
              className={
                pinnedNotes.length > 0
                  ? "fill-red-400 text-red-400"
                  : "text-notion-text-secondary"
              }
            />
            {t("mobile.note.favorites", "Favorites")}
            <span className="opacity-60">({pinnedNotes.length})</span>
          </span>
          <span className="text-notion-text-secondary">
            {favoritesOpen ? "−" : "+"}
          </span>
        </button>

        {favoritesOpen && pinnedNotes.length > 0 && (
          <ul>
            {pinnedNotes.map((note) => (
              <MobileNoteTreeItem
                key={`fav-${note.id}`}
                node={note}
                depth={0}
                isExpanded={false}
                onSelect={openNote}
                onToggleExpand={() => undefined}
                onLongPress={(n) => setContextNode(n)}
                renderExtra={() => (
                  <span className="shrink-0 text-[10px] text-notion-text-secondary">
                    {extractPlainText(note.content).slice(0, 24)}
                  </span>
                )}
              />
            ))}
          </ul>
        )}

        {/* Tree section */}
        <div className="border-b border-notion-border bg-notion-hover/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-notion-text-secondary">
          {t("mobile.note.all", "All notes")}
        </div>

        {notes.filter((n) => !n.isDeleted).length === 0 ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("mobile.note.empty", "No notes yet")}
          </div>
        ) : (
          <MobileNoteTree
            notes={notes}
            parentId={null}
            depth={0}
            expandedIds={expandedIds}
            onSelect={openNote}
            onToggleExpand={toggleExpanded}
            onLongPress={(n) => setContextNode(n)}
          />
        )}
      </div>

      <MobileActionSheet
        isOpen={createSheetOpen}
        title={t("mobile.note.createWhat", "Create")}
        onClose={() => setCreateSheetOpen(false)}
        items={[
          {
            id: "new-note",
            label: t("mobile.note.newNote", "New note"),
            icon: <StickyNote size={16} />,
            onSelect: () => handleCreateNote(null),
          },
          {
            id: "new-folder",
            label: t("mobile.note.newFolder", "New folder"),
            icon: <FolderPlus size={16} />,
            onSelect: () => handleCreateFolder(null),
          },
        ]}
      />

      <MobileActionSheet
        isOpen={contextNode !== null}
        title={contextNode?.title || ""}
        onClose={() => setContextNode(null)}
        items={contextMenuItems}
      />

      {passwordPrompt && (
        <NumericPadPasswordDialog
          mode={passwordPrompt.mode}
          onSubmit={handlePasswordSubmit}
          onCancel={() => setPasswordPrompt(null)}
        />
      )}
    </div>
  );
}

interface MobileNoteDetailProps {
  note: NoteNode;
  onBack: () => void;
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
    >,
  ) => void;
}

function MobileNoteDetail({ note, onBack, onUpdate }: MobileNoteDetailProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(note.title ?? "");
  const titleDebounceRef = useRef<number | null>(null);

  const saveTitle = useCallback(
    (value: string) => {
      onUpdate(note.id, { title: value });
    },
    [note.id, onUpdate],
  );

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleDebounceRef.current) window.clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = window.setTimeout(() => saveTitle(value), 400);
  };

  const handleContentChange = useCallback(
    (content: string) => {
      onUpdate(note.id, { content });
    },
    [note.id, onUpdate],
  );

  const handleBack = () => {
    if (titleDebounceRef.current) {
      window.clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = null;
      saveTitle(title);
    }
    onBack();
  };

  const isLocked = Boolean(note.isEditLocked);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-notion-border px-4 py-3">
        <button onClick={handleBack} className="text-sm text-notion-accent">
          &larr; {t("common.back", "Back")}
        </button>
        <div className="flex items-center gap-2 text-notion-text-secondary">
          {note.hasPassword && <Lock size={14} />}
          {note.isPinned && (
            <Heart size={14} className="fill-red-400 text-red-400" />
          )}
          {isLocked && (
            <span className="text-[10px] uppercase tracking-wide">
              {t("mobile.note.readOnly", "Read-only")}
            </span>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={isLocked}
          className="mb-2 w-full border-b border-notion-border bg-transparent pb-2 text-lg font-semibold text-notion-text-primary focus:outline-none disabled:opacity-70"
          placeholder={t("mobile.note.titlePlaceholder", "Title")}
        />
        <MobileNoteTagsBar entityId={note.id} readOnly={isLocked} />
        <Suspense
          fallback={
            <div className="text-sm text-notion-text-secondary">
              {t("common.loading", "Loading...")}
            </div>
          }
        >
          <RichTextEditor
            taskId={note.id}
            initialContent={note.content || ""}
            onUpdate={handleContentChange}
            entityType="note"
            editable={!isLocked}
          />
        </Suspense>
      </div>
    </div>
  );
}

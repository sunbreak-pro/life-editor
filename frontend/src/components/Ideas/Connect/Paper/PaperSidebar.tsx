import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutGrid,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  StickyNote,
  Layers,
} from "lucide-react";
import type { PaperBoard, PaperNode } from "../../../../types/paperBoard";
import type { NoteNode } from "../../../../types/note";
import { SearchBar, type SearchSuggestion } from "../../../shared/SearchBar";
import { CollapsibleSection } from "../../../shared/CollapsibleSection";
import { BoardCreateDialog } from "./BoardCreateDialog";
import { PaperLayersPanel } from "./PaperLayersPanel";

interface PaperSidebarProps {
  boards: PaperBoard[];
  activeBoardId: string | null;
  onSelectBoard: (id: string) => void;
  onCreateBoard: (name: string) => void;
  onDeleteBoard: (id: string) => void;
  onRenameBoard: (id: string, name: string) => void;
  notes: NoteNode[];
  onOpenNoteBoard: (noteId: string, noteName: string) => void;
  boardNodeCounts: Record<string, number>;
  paperNodes?: PaperNode[];
  selectedNodeIds?: string[];
  onSelectNode?: (nodeId: string) => void;
  onBulkUpdateLayerOrder?: (
    zIndexUpdates: Array<{
      id: string;
      zIndex: number;
      parentNodeId: string | null;
    }>,
    positionUpdates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ) => Promise<void>;
  onDeleteNode?: (id: string) => Promise<void>;
  onUpdateNode?: (
    id: string,
    updates: Partial<Pick<PaperNode, "label">>,
  ) => Promise<PaperNode>;
  onDuplicateNode?: (nodeId: string) => Promise<PaperNode | undefined>;
  onToggleHidden?: (nodeId: string) => Promise<void>;
}

interface SectionsState {
  boards: boolean;
  notes: boolean;
  layers: boolean;
}

const SECTIONS_KEY = "life-editor-paper-sidebar-sections";

function loadSectionsState(): SectionsState {
  try {
    const saved = localStorage.getItem(SECTIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        boards: parsed.boards ?? true,
        notes: parsed.notes ?? true,
        layers: parsed.layers ?? true,
      };
    }
  } catch {
    // ignore
  }
  return { boards: true, notes: true, layers: true };
}

function saveSectionsState(state: SectionsState): void {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(state));
}

export function PaperSidebar({
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  onRenameBoard,
  notes,
  onOpenNoteBoard,
  boardNodeCounts,
  paperNodes,
  selectedNodeIds,
  onSelectNode,
  onBulkUpdateLayerOrder,
  onDeleteNode,
  onUpdateNode,
  onDuplicateNode,
  onToggleHidden,
}: PaperSidebarProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionsState>(loadSectionsState);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const isSearching = debouncedQuery.trim().length > 0;
  const lowerQuery = debouncedQuery.toLowerCase();

  const customBoards = boards.filter((b) => !b.linkedNoteId);
  const linkedBoards = boards.filter((b) => b.linkedNoteId);

  const toggleSection = (key: keyof SectionsState) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSectionsState(next);
      return next;
    });
  };

  // Filter: hide empty custom boards (unless active)
  const visibleCustomBoards = useMemo(() => {
    return customBoards.filter(
      (b) => (boardNodeCounts[b.id] ?? 0) > 0 || b.id === activeBoardId,
    );
  }, [customBoards, boardNodeCounts, activeBoardId]);

  // Filter: hide notes without boards or with empty boards (unless active)
  const activeNotes = useMemo(() => {
    const nonDeletedNotes = notes.filter((n) => !n.isDeleted).slice(0, 30);
    return nonDeletedNotes.filter((note) => {
      const linked = linkedBoards.find((b) => b.linkedNoteId === note.id);
      if (!linked) return false; // No board exists — hide
      return (
        (boardNodeCounts[linked.id] ?? 0) > 0 || linked.id === activeBoardId
      );
    });
  }, [notes, linkedBoards, boardNodeCounts, activeBoardId]);

  // Search suggestions
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const items: SearchSuggestion[] = [];
    for (const b of customBoards) {
      items.push({ id: b.id, label: b.name, icon: "board" });
    }
    for (const note of notes.filter((n) => !n.isDeleted).slice(0, 20)) {
      items.push({
        id: `note:${note.id}`,
        label: note.title || "Untitled",
        icon: "note",
      });
    }
    if (isSearching) {
      return items.filter((i) => i.label.toLowerCase().includes(lowerQuery));
    }
    return items;
  }, [customBoards, notes, isSearching, lowerQuery]);

  const handleSuggestionSelect = useCallback(
    (id: string) => {
      if (id.startsWith("note:")) {
        const noteId = id.replace("note:", "");
        const note = notes.find((n) => n.id === noteId);
        if (note) onOpenNoteBoard(note.id, note.title);
      } else {
        onSelectBoard(id);
      }
    },
    [notes, onSelectBoard, onOpenNoteBoard],
  );

  // Search filter
  const searchFilteredCustomBoards = useMemo(() => {
    if (!isSearching) return visibleCustomBoards;
    return customBoards.filter((b) =>
      b.name.toLowerCase().includes(lowerQuery),
    );
  }, [isSearching, lowerQuery, customBoards, visibleCustomBoards]);

  const searchFilteredNotes = useMemo(() => {
    if (!isSearching) return activeNotes;
    return notes
      .filter((n) => !n.isDeleted)
      .filter((n) => (n.title || "").toLowerCase().includes(lowerQuery));
  }, [isSearching, lowerQuery, notes, activeNotes]);

  const startRename = useCallback((board: PaperBoard) => {
    setRenamingId(board.id);
    setRenameValue(board.name);
  }, []);

  const confirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameBoard(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onRenameBoard]);

  const renderBoardItem = (board: PaperBoard) => (
    <div
      key={board.id}
      className={`group flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer ${
        activeBoardId === board.id
          ? "bg-notion-accent/10 text-notion-accent"
          : "text-notion-text hover:bg-notion-hover"
      }`}
      onClick={() => onSelectBoard(board.id)}
    >
      {renamingId === board.id ? (
        <div
          className="flex items-center gap-1 flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") setRenamingId(null);
            }}
            className="flex-1 bg-transparent outline-none text-xs text-notion-text"
            autoFocus
          />
          <button onClick={confirmRename} className="text-green-500">
            <Check size={12} />
          </button>
          <button onClick={() => setRenamingId(null)} className="text-red-500">
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <LayoutGrid size={12} className="shrink-0" />
          <span className="truncate flex-1">{board.name}</span>
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                startRename(board);
              }}
              className="text-notion-text-secondary hover:text-notion-text"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(t("ideas.deleteBoardConfirm"))) {
                  onDeleteBoard(board.id);
                }
              }}
              className="text-notion-text-secondary hover:text-red-500"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderNoteItem = (note: NoteNode) => {
    const linked = linkedBoards.find((b) => b.linkedNoteId === note.id);
    return (
      <button
        key={note.id}
        onClick={() => onOpenNoteBoard(note.id, note.title)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left ${
          linked && activeBoardId === linked.id
            ? "bg-notion-accent/10 text-notion-accent"
            : "text-notion-text hover:bg-notion-hover"
        }`}
      >
        <StickyNote size={12} className="shrink-0 text-yellow-500" />
        <span className="truncate">{note.title || "Untitled"}</span>
      </button>
    );
  };

  // Search results view
  if (isSearching) {
    const noResults =
      searchFilteredCustomBoards.length === 0 &&
      searchFilteredNotes.length === 0;
    return (
      <div className="h-full flex flex-col">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("ideas.searchBoards")}
          suggestions={suggestions}
          onSuggestionSelect={handleSuggestionSelect}
        />
        <div className="flex-1 overflow-y-auto p-1">
          {noResults && (
            <p className="text-xs text-notion-text-secondary text-center py-4">
              {t("ideas.noSearchResults")}
            </p>
          )}
          {searchFilteredCustomBoards.map(renderBoardItem)}
          {searchFilteredNotes.map(renderNoteItem)}
        </div>
      </div>
    );
  }

  const isEmpty = visibleCustomBoards.length === 0 && activeNotes.length === 0;

  return (
    <div className="h-full flex flex-col">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t("ideas.searchBoards")}
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Boards */}
        <CollapsibleSection
          label={t("ideas.boards")}
          icon={<LayoutGrid size={12} />}
          isOpen={sections.boards}
          onToggle={() => toggleSection("boards")}
          rightAction={
            <button
              onClick={() => setShowCreateDialog(true)}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title={t("ideas.createBoard")}
            >
              <Plus size={14} />
            </button>
          }
        >
          {isEmpty && visibleCustomBoards.length === 0 && (
            <p className="text-xs text-notion-text-secondary px-2 py-2">
              {t("ideas.emptyBoardMessage")}
            </p>
          )}
          {visibleCustomBoards.map(renderBoardItem)}
        </CollapsibleSection>

        {/* Notes */}
        <CollapsibleSection
          label={t("ideas.notes")}
          icon={<StickyNote size={12} />}
          isOpen={sections.notes}
          onToggle={() => toggleSection("notes")}
        >
          {activeNotes.length === 0 ? (
            <p className="text-xs text-notion-text-secondary px-2 py-2">
              {t("ideas.noSearchResults")}
            </p>
          ) : (
            activeNotes.map(renderNoteItem)
          )}
        </CollapsibleSection>

        {/* Layers */}
        {paperNodes && onSelectNode && onBulkUpdateLayerOrder && (
          <CollapsibleSection
            label="Layers"
            icon={<Layers size={12} />}
            isOpen={sections.layers}
            onToggle={() => toggleSection("layers")}
          >
            <PaperLayersPanel
              nodes={paperNodes}
              selectedNodeIds={selectedNodeIds ?? []}
              onSelectNode={onSelectNode}
              onBulkUpdateLayerOrder={onBulkUpdateLayerOrder}
              onDeleteNode={onDeleteNode}
              onUpdateNode={onUpdateNode}
              onDuplicateNode={onDuplicateNode}
              onToggleHidden={onToggleHidden}
            />
          </CollapsibleSection>
        )}
      </div>

      {showCreateDialog && (
        <BoardCreateDialog
          notes={notes}
          onCreateBoard={onCreateBoard}
          onOpenNoteBoard={onOpenNoteBoard}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}

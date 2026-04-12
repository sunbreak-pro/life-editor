import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Filter, ArrowUpDown, MoreHorizontal, Trash2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useDatabase } from "../../hooks/useDatabase";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { DatabaseTable } from "./DatabaseTable";
import { DatabaseFilterBar } from "./DatabaseFilterBar";
import { DatabaseSortBar } from "./DatabaseSortBar";
import type { DatabaseFilter, DatabaseSort } from "../../types/database";

interface DatabaseViewProps {
  databaseId: string;
  editor: Editor;
  getPos: () => number;
}

export function DatabaseView({
  databaseId,
  editor,
  getPos,
}: DatabaseViewProps) {
  const {
    data,
    loading,
    updateTitle,
    addProperty,
    updateProperty,
    removeProperty,
    addRow,
    duplicateRow,
    reorderRows,
    removeRow,
    upsertCell,
    getCellValue,
    pushCellUndo,
  } = useDatabase(databaseId);
  const { t } = useTranslation();
  const { setActiveDomains } = useUndoRedo();

  const handleFocusCapture = useCallback(() => {
    setActiveDomains(["database"]);
  }, [setActiveDomains]);

  const handleBlurCapture = useCallback(() => {
    setActiveDomains(null);
  }, [setActiveDomains]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Filter & Sort state (lifted from DatabaseTable)
  const [filters, setFilters] = useState<DatabaseFilter[]>([]);
  const [sorts, setSorts] = useState<DatabaseSort[]>([]);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [showSortBar, setShowSortBar] = useState(false);

  // More menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingTitle) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [isEditingTitle]);

  // Close more menu on click outside
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMoreMenu]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== data?.database.title) {
      updateTitle(trimmed);
    }
    setIsEditingTitle(false);
  };

  // Delete database block via more menu
  const handleDeleteBlock = useCallback(() => {
    const pos = getPos();
    if (pos === undefined) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
    editor.view.dispatch(tr);
    setShowMoreMenu(false);
  }, [editor, getPos]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-notion-text-secondary">
        {t("database.loading")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-notion-text-secondary">
        {t("database.notFound")}
      </div>
    );
  }

  const hasFilters = filters.length > 0;
  const hasSorts = sorts.length > 0;
  const sortedProperties = [...data.properties].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div
      className="w-full"
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      {/* Title row */}
      <div className="flex items-center gap-1 mb-1 group/db-title">
        {/* Title */}
        {isEditingTitle ? (
          <input
            ref={titleRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") setIsEditingTitle(false);
              e.stopPropagation();
            }}
            className="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-notion-text px-1"
          />
        ) : (
          <h3
            className="text-sm font-semibold text-notion-text px-1 cursor-pointer hover:bg-notion-hover rounded"
            onClick={() => {
              setTitleDraft(data.database.title);
              setIsEditingTitle(true);
            }}
          >
            {data.database.title}
          </h3>
        )}

        {/* Action icons */}
        <div className="ml-auto flex items-center gap-0.5">
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilterBar((v) => !v)}
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
              hasFilters || showFilterBar
                ? "text-notion-accent bg-notion-accent/10"
                : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
            }`}
            type="button"
            title={t("database.filter")}
          >
            <Filter size={13} />
          </button>

          {/* Sort toggle */}
          <button
            onClick={() => setShowSortBar((v) => !v)}
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
              hasSorts || showSortBar
                ? "text-notion-accent bg-notion-accent/10"
                : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
            }`}
            type="button"
            title={t("database.sort")}
          >
            <ArrowUpDown size={13} />
          </button>

          {/* More options */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className="flex items-center justify-center w-6 h-6 rounded text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors"
              type="button"
            >
              <MoreHorizontal size={13} />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 z-30 min-w-[160px] bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1">
                <button
                  onClick={handleDeleteBlock}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-notion-hover text-left"
                >
                  <Trash2 size={12} />
                  {t("blockMenu.delete")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {(showFilterBar || hasFilters) && (
        <div className="mb-1 px-1">
          <DatabaseFilterBar
            filters={filters}
            properties={sortedProperties}
            onFiltersChange={setFilters}
          />
        </div>
      )}

      {/* Sort bar */}
      {(showSortBar || hasSorts) && (
        <div className="mb-1 px-1">
          <DatabaseSortBar
            sorts={sorts}
            properties={sortedProperties}
            onSortsChange={setSorts}
          />
        </div>
      )}

      {/* Table (no outer border frame) */}
      <DatabaseTable
        properties={data.properties}
        rows={data.rows}
        cells={data.cells}
        filters={filters}
        sorts={sorts}
        onAddProperty={addProperty}
        onUpdateProperty={updateProperty}
        onRemoveProperty={removeProperty}
        onAddRow={addRow}
        onDuplicateRow={duplicateRow}
        onReorderRows={reorderRows}
        onRemoveRow={removeRow}
        onUpsertCell={upsertCell}
        getCellValue={getCellValue}
        onPushCellUndo={pushCellUndo}
      />
    </div>
  );
}

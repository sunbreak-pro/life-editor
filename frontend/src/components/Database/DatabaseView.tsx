import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDatabase } from "../../hooks/useDatabase";
import { DatabaseTable } from "./DatabaseTable";

interface DatabaseViewProps {
  databaseId: string;
}

export function DatabaseView({ databaseId }: DatabaseViewProps) {
  const {
    data,
    loading,
    updateTitle,
    addProperty,
    updateProperty,
    removeProperty,
    addRow,
    removeRow,
    upsertCell,
    getCellValue,
  } = useDatabase(databaseId);
  const { t } = useTranslation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [isEditingTitle]);

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

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== data.database.title) {
      updateTitle(trimmed);
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="w-full">
      {/* Title */}
      <div className="mb-2">
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
            className="w-full text-sm font-semibold bg-transparent border-none outline-none text-notion-text px-1"
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
      </div>

      {/* Table */}
      <div className="border border-notion-border rounded-md overflow-hidden">
        <DatabaseTable
          properties={data.properties}
          rows={data.rows}
          cells={data.cells}
          onAddProperty={addProperty}
          onUpdateProperty={updateProperty}
          onRemoveProperty={removeProperty}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpsertCell={upsertCell}
          getCellValue={getCellValue}
        />
      </div>
    </div>
  );
}

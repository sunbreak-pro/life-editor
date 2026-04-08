import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpDown, Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type {
  DatabaseSort,
  DatabaseProperty,
  SortDirection,
} from "../../types/database";

interface DatabaseSortBarProps {
  sorts: DatabaseSort[];
  properties: DatabaseProperty[];
  onSortsChange: (sorts: DatabaseSort[]) => void;
}

export function DatabaseSortBar({
  sorts,
  properties,
  onSortsChange,
}: DatabaseSortBarProps) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handleClick = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAdd]);

  const addSort = (propertyId: string) => {
    const newSort: DatabaseSort = {
      propertyId,
      direction: "asc",
    };
    onSortsChange([...sorts, newSort]);
    setShowAdd(false);
  };

  const removeSort = (index: number) => {
    onSortsChange(sorts.filter((_, i) => i !== index));
  };

  const toggleDirection = (index: number) => {
    onSortsChange(
      sorts.map((s, i) =>
        i === index
          ? {
              ...s,
              direction: (s.direction === "asc"
                ? "desc"
                : "asc") as SortDirection,
            }
          : s,
      ),
    );
  };

  // Available properties that aren't already sorted
  const availableProps = properties.filter(
    (p) => !sorts.some((s) => s.propertyId === p.id),
  );

  if (sorts.length === 0) {
    return (
      <div className="relative" ref={addRef}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
        >
          <ArrowUpDown size={12} />
          {t("database.sort")}
        </button>
        {showAdd && availableProps.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-30 min-w-[140px] bg-notion-bg border border-notion-border rounded-md shadow-lg py-1">
            {availableProps.map((prop) => (
              <button
                key={prop.id}
                onClick={() => addSort(prop.id)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-notion-hover text-notion-text"
              >
                {prop.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {sorts.map((sort, index) => {
        const prop = properties.find((p) => p.id === sort.propertyId);
        if (!prop) return null;

        return (
          <div
            key={`${sort.propertyId}-${index}`}
            className="flex items-center gap-1 px-2 py-0.5 bg-notion-hover rounded text-xs"
          >
            <span className="text-notion-text-secondary font-medium">
              {prop.name}
            </span>
            <button
              onClick={() => toggleDirection(index)}
              className="text-notion-text hover:text-notion-accent"
              title={
                sort.direction === "asc"
                  ? t("database.ascending")
                  : t("database.descending")
              }
            >
              {sort.direction === "asc" ? (
                <ArrowUp size={10} />
              ) : (
                <ArrowDown size={10} />
              )}
            </button>
            <button
              onClick={() => removeSort(index)}
              className="text-notion-text-secondary hover:text-red-400"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
      {availableProps.length > 0 && (
        <div className="relative" ref={addRef}>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded hover:bg-notion-hover"
          >
            <Plus size={12} />
          </button>
          {showAdd && (
            <div className="absolute left-0 top-full mt-1 z-30 min-w-[140px] bg-notion-bg border border-notion-border rounded-md shadow-lg py-1">
              {availableProps.map((prop) => (
                <button
                  key={prop.id}
                  onClick={() => addSort(prop.id)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-notion-hover text-notion-text"
                >
                  {prop.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

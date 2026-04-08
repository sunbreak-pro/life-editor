import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Filter, Plus, X } from "lucide-react";
import type {
  DatabaseFilter,
  DatabaseProperty,
  FilterOperator,
} from "../../types/database";
import { getOperatorsForType } from "../../utils/databaseFilter";
import { generateId } from "../../utils/generateId";

interface DatabaseFilterBarProps {
  filters: DatabaseFilter[];
  properties: DatabaseProperty[];
  onFiltersChange: (filters: DatabaseFilter[]) => void;
}

const NO_VALUE_OPERATORS: Set<FilterOperator> = new Set([
  "is_empty",
  "is_not_empty",
  "is_checked",
  "is_not_checked",
]);

export function DatabaseFilterBar({
  filters,
  properties,
  onFiltersChange,
}: DatabaseFilterBarProps) {
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

  const addFilter = (propertyId: string) => {
    const prop = properties.find((p) => p.id === propertyId);
    if (!prop) return;
    const operators = getOperatorsForType(prop.type);
    const newFilter: DatabaseFilter = {
      id: generateId("filter"),
      propertyId,
      operator: operators[0],
      value: "",
    };
    onFiltersChange([...filters, newFilter]);
    setShowAdd(false);
  };

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (
    id: string,
    updates: Partial<Pick<DatabaseFilter, "operator" | "value">>,
  ) => {
    onFiltersChange(
      filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    );
  };

  if (filters.length === 0) {
    return (
      <div className="relative" ref={addRef}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
        >
          <Filter size={12} />
          {t("database.filter")}
        </button>
        {showAdd && (
          <PropertyPicker properties={properties} onSelect={addFilter} />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {filters.map((filter) => {
        const prop = properties.find((p) => p.id === filter.propertyId);
        if (!prop) return null;
        const operators = getOperatorsForType(prop.type);
        const needsValue = !NO_VALUE_OPERATORS.has(filter.operator);

        return (
          <div
            key={filter.id}
            className="flex items-center gap-1 px-2 py-0.5 bg-notion-hover rounded text-xs"
          >
            <span className="text-notion-text-secondary font-medium">
              {prop.name}
            </span>
            <select
              value={filter.operator}
              onChange={(e) =>
                updateFilter(filter.id, {
                  operator: e.target.value as FilterOperator,
                })
              }
              className="bg-transparent border-none outline-none text-xs text-notion-text cursor-pointer"
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {t(`database.operators.${op}`)}
                </option>
              ))}
            </select>
            {needsValue && (
              <input
                value={filter.value}
                onChange={(e) =>
                  updateFilter(filter.id, { value: e.target.value })
                }
                placeholder={t("database.filterValue")}
                className="w-20 bg-transparent border-none outline-none text-xs text-notion-text"
                onKeyDown={(e) => e.stopPropagation()}
              />
            )}
            <button
              onClick={() => removeFilter(filter.id)}
              className="text-notion-text-secondary hover:text-red-400"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
      <div className="relative" ref={addRef}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="p-1 text-notion-text-secondary hover:text-notion-text rounded hover:bg-notion-hover"
        >
          <Plus size={12} />
        </button>
        {showAdd && (
          <PropertyPicker properties={properties} onSelect={addFilter} />
        )}
      </div>
    </div>
  );
}

function PropertyPicker({
  properties,
  onSelect,
}: {
  properties: DatabaseProperty[];
  onSelect: (propertyId: string) => void;
}) {
  return (
    <div className="absolute left-0 top-full mt-1 z-30 min-w-[140px] bg-notion-bg border border-notion-border rounded-md shadow-lg py-1">
      {properties.map((prop) => (
        <button
          key={prop.id}
          onClick={() => onSelect(prop.id)}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-notion-hover text-notion-text"
        >
          {prop.name}
        </button>
      ))}
    </div>
  );
}

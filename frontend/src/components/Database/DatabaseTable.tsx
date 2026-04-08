import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseCell,
  DatabaseFilter,
  DatabaseSort,
  PropertyType,
  SelectOption,
} from "../../types/database";
import { CellRenderer } from "./CellRenderer";
import { CellEditor } from "./CellEditor";
import { PropertyHeader } from "./PropertyHeader";
import { AddPropertyPopover } from "./AddPropertyPopover";
import { DatabaseFilterBar } from "./DatabaseFilterBar";
import { DatabaseSortBar } from "./DatabaseSortBar";
import { applyFilters } from "../../utils/databaseFilter";
import { applySorts } from "../../utils/databaseSort";

interface DatabaseTableProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  cells: DatabaseCell[];
  onAddProperty: (name: string, type: PropertyType) => void;
  onUpdateProperty: (
    propertyId: string,
    updates: {
      name?: string;
      type?: PropertyType;
      order?: number;
      config?: DatabaseProperty["config"];
    },
  ) => void;
  onRemoveProperty: (propertyId: string) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onUpsertCell: (rowId: string, propertyId: string, value: string) => void;
  getCellValue: (rowId: string, propertyId: string) => string;
}

interface EditingCell {
  rowId: string;
  propertyId: string;
}

export function DatabaseTable({
  properties,
  rows,
  cells,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
  onAddRow,
  onRemoveRow,
  onUpsertCell,
  getCellValue,
}: DatabaseTableProps) {
  const { t } = useTranslation();
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [filters, setFilters] = useState<DatabaseFilter[]>([]);
  const [sorts, setSorts] = useState<DatabaseSort[]>([]);

  const sortedProperties = useMemo(
    () => [...properties].sort((a, b) => a.order - b.order),
    [properties],
  );

  const displayRows = useMemo(() => {
    const ordered = [...rows].sort((a, b) => a.order - b.order);
    const filtered = applyFilters(ordered, cells, properties, filters);
    return applySorts(filtered, cells, properties, sorts);
  }, [rows, cells, properties, filters, sorts]);

  const getOptions = useCallback(
    (propertyId: string): SelectOption[] => {
      const prop = properties.find((p) => p.id === propertyId);
      return prop?.config?.options ?? [];
    },
    [properties],
  );

  const handleCellClick = useCallback(
    (rowId: string, propertyId: string, type: PropertyType) => {
      if (type === "checkbox") {
        const current = getCellValue(rowId, propertyId);
        onUpsertCell(rowId, propertyId, current === "true" ? "false" : "true");
      } else {
        setEditingCell({ rowId, propertyId });
      }
    },
    [getCellValue, onUpsertCell],
  );

  const handleCellChange = useCallback(
    (rowId: string, propertyId: string, value: string) => {
      onUpsertCell(rowId, propertyId, value);
    },
    [onUpsertCell],
  );

  if (sortedProperties.length === 0 && rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-notion-text-secondary">
        <p className="text-xs">{t("database.empty")}</p>
        <button
          onClick={() => onAddProperty("Name", "text")}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-notion-accent text-white hover:bg-notion-accent/90 transition-colors"
        >
          <Plus size={12} />
          {t("database.addProperty")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      {/* Filter & Sort toolbar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-notion-border">
        <DatabaseFilterBar
          filters={filters}
          properties={sortedProperties}
          onFiltersChange={setFilters}
        />
        <DatabaseSortBar
          sorts={sorts}
          properties={sortedProperties}
          onSortsChange={setSorts}
        />
      </div>

      <table className="w-full border-collapse text-sm">
        {/* Header */}
        <thead>
          <tr className="border-b border-notion-border">
            {sortedProperties.map((prop) => (
              <th
                key={prop.id}
                className="text-left font-normal border-r border-notion-border last:border-r-0 min-w-[120px]"
              >
                <PropertyHeader
                  property={prop}
                  onUpdate={(updates) => onUpdateProperty(prop.id, updates)}
                  onRemove={() => onRemoveProperty(prop.id)}
                />
              </th>
            ))}
            <th className="w-8 border-r-0">
              <AddPropertyPopover onAdd={onAddProperty} />
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {displayRows.map((row) => (
            <tr
              key={row.id}
              className="group/row border-b border-notion-border hover:bg-notion-hover/50 transition-colors"
            >
              {sortedProperties.map((prop) => {
                const isEditing =
                  editingCell?.rowId === row.id &&
                  editingCell?.propertyId === prop.id;
                const value = getCellValue(row.id, prop.id);

                return (
                  <td
                    key={prop.id}
                    className="relative border-r border-notion-border last:border-r-0 h-8 min-w-[120px] cursor-pointer"
                    onClick={() =>
                      !isEditing && handleCellClick(row.id, prop.id, prop.type)
                    }
                  >
                    {isEditing ? (
                      <CellEditor
                        type={prop.type}
                        value={value}
                        options={getOptions(prop.id)}
                        onChange={(v) => handleCellChange(row.id, prop.id, v)}
                        onClose={() => setEditingCell(null)}
                      />
                    ) : (
                      <div className="px-2 py-1 h-full flex items-center">
                        <CellRenderer
                          type={prop.type}
                          value={value}
                          options={getOptions(prop.id)}
                        />
                      </div>
                    )}
                  </td>
                );
              })}
              {/* Delete row button */}
              <td className="w-8 text-center">
                <button
                  onClick={() => onRemoveRow(row.id)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 text-notion-text-secondary hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add row button */}
      <button
        onClick={onAddRow}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-xs text-notion-text-secondary hover:bg-notion-hover rounded-b transition-colors"
      >
        <Plus size={12} />
        {t("database.newRow")}
      </button>
    </div>
  );
}

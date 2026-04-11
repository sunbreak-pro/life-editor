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
  AggregationType,
  SelectOption,
} from "../../types/database";
import { CellRenderer } from "./CellRenderer";
import { CellEditor } from "./CellEditor";
import { PropertyHeader } from "./PropertyHeader";
import { AddPropertyPopover } from "./AddPropertyPopover";
import { AggregationSelector } from "./AggregationSelector";
import { applyFilters } from "../../utils/databaseFilter";
import { applySorts } from "../../utils/databaseSort";
import { computeAggregation } from "../../utils/databaseAggregation";

interface DatabaseTableProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  cells: DatabaseCell[];
  filters: DatabaseFilter[];
  sorts: DatabaseSort[];
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
  filters,
  sorts,
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
  const [aggSelector, setAggSelector] = useState<{
    x: number;
    y: number;
    propertyId: string;
  } | null>(null);

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
      <table
        className="border-collapse text-sm"
        style={{ tableLayout: "fixed" }}
      >
        {/* Header */}
        <thead>
          <tr>
            {sortedProperties.map((prop) => (
              <th
                key={prop.id}
                className="text-left font-normal"
                style={{
                  width: prop.config?.width ?? 120,
                  minWidth: 60,
                }}
              >
                <PropertyHeader
                  property={prop}
                  isFixed={prop.order === 0}
                  onUpdate={(updates) => onUpdateProperty(prop.id, updates)}
                  onRemove={() => onRemoveProperty(prop.id)}
                />
              </th>
            ))}
            <th className="w-8">
              <AddPropertyPopover onAdd={onAddProperty} />
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {displayRows.map((row) => (
            <tr
              key={row.id}
              className="group/row hover:bg-notion-hover/50 transition-colors"
            >
              {sortedProperties.map((prop) => {
                const isEditing =
                  editingCell?.rowId === row.id &&
                  editingCell?.propertyId === prop.id;
                const value = getCellValue(row.id, prop.id);

                const cellOverflow = prop.config?.overflow ?? "truncate";
                return (
                  <td
                    key={prop.id}
                    className={`relative cursor-pointer ${cellOverflow === "wrap" ? "min-h-[2rem]" : "h-8"}`}
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
                          overflow={cellOverflow}
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

        {/* Aggregation footer */}
        <tfoot>
          <tr>
            {sortedProperties.map((prop) => {
              const agg = prop.config?.aggregation ?? "none";
              const values = displayRows.map((row) =>
                getCellValue(row.id, prop.id),
              );
              const result =
                agg !== "none"
                  ? computeAggregation(agg, prop.type, values)
                  : "";
              return (
                <td
                  key={prop.id}
                  className="h-7 cursor-pointer hover:bg-notion-hover/50 transition-colors"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setAggSelector({
                      x: rect.left,
                      y: rect.bottom,
                      propertyId: prop.id,
                    });
                  }}
                >
                  <div className="px-2 py-1 text-xs text-notion-text-secondary tabular-nums">
                    {result || (
                      <span className="opacity-0 group-hover/db-title:opacity-40">
                        {t("database.aggregation.label")}
                      </span>
                    )}
                  </div>
                </td>
              );
            })}
            <td className="w-8" />
          </tr>
        </tfoot>
      </table>

      {/* Aggregation selector popover */}
      {aggSelector &&
        (() => {
          const prop = sortedProperties.find(
            (p) => p.id === aggSelector.propertyId,
          );
          if (!prop) return null;
          return (
            <AggregationSelector
              x={aggSelector.x}
              y={aggSelector.y}
              propertyType={prop.type}
              current={prop.config?.aggregation ?? "none"}
              onSelect={(aggregation: AggregationType) => {
                onUpdateProperty(prop.id, {
                  config: { ...prop.config, aggregation },
                });
                setAggSelector(null);
              }}
              onClose={() => setAggSelector(null)}
            />
          );
        })()}

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

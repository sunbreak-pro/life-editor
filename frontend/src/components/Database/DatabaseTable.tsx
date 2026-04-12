import { useState, useCallback, useMemo, createContext } from "react";
import { useTranslation } from "react-i18next";
import { Plus, GripVertical } from "lucide-react";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
import { SELECT_COLORS } from "./CellEditor";
import { PropertyHeader } from "./PropertyHeader";
import { AddPropertyPopover } from "./AddPropertyPopover";
import { AggregationSelector } from "./AggregationSelector";
import { applyFilters } from "../../utils/databaseFilter";
import { applySorts } from "../../utils/databaseSort";
import { computeAggregation } from "../../utils/databaseAggregation";
import {
  useDatabaseRowDnd,
  type DbRowDragOverStore,
} from "../../hooks/useDatabaseRowDnd";
import { DatabaseTableRow } from "./DatabaseTableRow";

export const DbRowDragOverStoreContext =
  createContext<DbRowDragOverStore | null>(null);

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
  onDuplicateRow: (rowId: string) => void;
  onReorderRows: (rowIds: string[]) => void;
  onRemoveRow: (rowId: string) => void;
  onUpsertCell: (rowId: string, propertyId: string, value: string) => void;
  getCellValue: (rowId: string, propertyId: string) => string;
  onPushCellUndo: (
    rowId: string,
    propertyId: string,
    originalValue: string,
    newValue: string,
  ) => void;
}

interface EditingCell {
  rowId: string;
  propertyId: string;
  originalValue: string;
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
  onDuplicateRow,
  onReorderRows,
  onRemoveRow,
  onUpsertCell,
  getCellValue,
  onPushCellUndo,
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

  const hasSorts = sorts.length > 0;

  const {
    sensors,
    activeRow,
    dragOverStore,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  } = useDatabaseRowDnd({ rows: displayRows, onReorderRows });

  const getOptions = useCallback(
    (propertyId: string): SelectOption[] => {
      const prop = properties.find((p) => p.id === propertyId);
      return prop?.config?.options ?? [];
    },
    [properties],
  );

  const handleCreateOption = useCallback(
    (propertyId: string, label: string): SelectOption => {
      const prop = properties.find((p) => p.id === propertyId);
      const existing = prop?.config?.options ?? [];
      const color =
        SELECT_COLORS[existing.length % SELECT_COLORS.length] ?? "#6366f1";
      const newOption: SelectOption = {
        id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        color,
      };
      onUpdateProperty(propertyId, {
        config: { ...prop?.config, options: [...existing, newOption] },
      });
      return newOption;
    },
    [properties, onUpdateProperty],
  );

  const handleCellClick = useCallback(
    (rowId: string, propertyId: string, type: PropertyType) => {
      if (type === "checkbox") {
        const current = getCellValue(rowId, propertyId);
        const newValue = current === "true" ? "false" : "true";
        onUpsertCell(rowId, propertyId, newValue);
        onPushCellUndo(rowId, propertyId, current, newValue);
      } else {
        const originalValue = getCellValue(rowId, propertyId);
        setEditingCell({ rowId, propertyId, originalValue });
      }
    },
    [getCellValue, onUpsertCell, onPushCellUndo],
  );

  const handleCellChange = useCallback(
    (rowId: string, propertyId: string, value: string) => {
      onUpsertCell(rowId, propertyId, value);
    },
    [onUpsertCell],
  );

  const handleCellEditClose = useCallback(
    (rowId: string, propertyId: string, originalValue: string) => {
      const currentValue = getCellValue(rowId, propertyId);
      onPushCellUndo(rowId, propertyId, originalValue, currentValue);
      setEditingCell(null);
    },
    [getCellValue, onPushCellUndo],
  );

  // Column width: equal distribution with min-width guard
  const colWidthPercent = useMemo(() => {
    const count = sortedProperties.length;
    if (count === 0) return "100%";
    return `${100 / count}%`;
  }, [sortedProperties.length]);

  if (sortedProperties.length === 0 && rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-notion-text-secondary">
        <p className="text-xs">{t("database.empty")}</p>
        <button
          onClick={() => onAddProperty(t("database.nameProperty"), "text")}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-notion-accent text-white hover:bg-notion-accent/90 transition-colors"
        >
          <Plus size={12} />
          {t("database.addProperty")}
        </button>
      </div>
    );
  }

  const isLastProp = (index: number) => index === sortedProperties.length - 1;

  return (
    <div
      className="-ml-12 overflow-x-auto"
      style={{ width: "calc(100% + 3rem)" }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <DbRowDragOverStoreContext.Provider value={dragOverStore}>
          <SortableContext
            items={displayRows.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <table className="w-full border-collapse text-sm">
              {/* Header */}
              <thead>
                <tr>
                  <th className="w-10 !border-none" />
                  {sortedProperties.map((prop, i) => (
                    <th
                      key={prop.id}
                      className="text-left font-normal"
                      style={{
                        width: colWidthPercent,
                        minWidth: 60,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <PropertyHeader
                            property={prop}
                            isFixed={prop.order === 0}
                            existingNames={sortedProperties
                              .filter((p) => p.id !== prop.id)
                              .map((p) => p.name)}
                            onUpdate={(updates) =>
                              onUpdateProperty(prop.id, updates)
                            }
                            onRemove={() => onRemoveProperty(prop.id)}
                          />
                        </div>
                        {isLastProp(i) && (
                          <AddPropertyPopover
                            onAdd={onAddProperty}
                            existingNames={sortedProperties.map((p) => p.name)}
                          />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {displayRows.map((row) => (
                  <DatabaseTableRow
                    key={row.id}
                    row={row}
                    sortedProperties={sortedProperties}
                    editingCell={editingCell}
                    hasSorts={hasSorts}
                    getCellValue={getCellValue}
                    getOptions={getOptions}
                    onCellClick={handleCellClick}
                    onCellChange={handleCellChange}
                    onCellEditClose={handleCellEditClose}
                    onAddRow={onAddRow}
                    onDuplicateRow={onDuplicateRow}
                    onRemoveRow={onRemoveRow}
                    onCreateOption={handleCreateOption}
                  />
                ))}
              </tbody>

              {/* Aggregation footer */}
              <tfoot>
                <tr>
                  <td className="w-10 !border-none" />
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
                </tr>
              </tfoot>
            </table>
          </SortableContext>
        </DbRowDragOverStoreContext.Provider>

        {/* Drag overlay — semi-transparent row clone */}
        <DragOverlay dropAnimation={null}>
          {activeRow && (
            <table className="w-full border-collapse text-sm db-row-drag-overlay">
              <tbody>
                <tr className="bg-notion-bg">
                  <td className="w-10 !border-none !p-0">
                    <div className="flex items-center justify-center gap-0 h-8">
                      <GripVertical
                        size={11}
                        className="text-notion-text-secondary"
                      />
                    </div>
                  </td>
                  {sortedProperties.map((prop) => {
                    const value = getCellValue(activeRow.id, prop.id);
                    const cellOverflow = prop.config?.overflow ?? "truncate";
                    return (
                      <td
                        key={prop.id}
                        style={{ width: colWidthPercent, minWidth: 60 }}
                        className={
                          cellOverflow === "wrap" ? "min-h-[2rem]" : "h-8"
                        }
                      >
                        <div className="px-2 py-1 h-full flex items-center">
                          <CellRenderer
                            type={prop.type}
                            value={value}
                            options={getOptions(prop.id)}
                            overflow={cellOverflow}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </DragOverlay>
      </DndContext>

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
        className="flex items-center gap-1 w-full pl-12 pr-2 py-1.5 text-xs text-notion-text-secondary hover:bg-notion-hover rounded-b transition-colors"
      >
        <Plus size={12} />
        {t("database.newRow")}
      </button>
    </div>
  );
}

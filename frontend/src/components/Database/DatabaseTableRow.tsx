import { useState, useCallback, useContext, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSyncExternalStore } from "react";
import { Plus, GripVertical } from "lucide-react";
import type {
  DatabaseProperty,
  DatabaseRow,
  PropertyType,
  SelectOption,
} from "../../types/database";
import { CellRenderer } from "./CellRenderer";
import { CellEditor } from "./CellEditor";
import { RowContextMenu } from "./RowContextMenu";
import { DbRowDragOverStoreContext } from "./DatabaseTable";

interface EditingCell {
  rowId: string;
  propertyId: string;
  originalValue: string;
}

interface DatabaseTableRowProps {
  row: DatabaseRow;
  sortedProperties: DatabaseProperty[];
  editingCell: EditingCell | null;
  hasSorts: boolean;
  getCellValue: (rowId: string, propertyId: string) => string;
  getOptions: (propertyId: string) => SelectOption[];
  onCellClick: (rowId: string, propertyId: string, type: PropertyType) => void;
  onCellChange: (rowId: string, propertyId: string, value: string) => void;
  onCellEditClose: (
    rowId: string,
    propertyId: string,
    originalValue: string,
  ) => void;
  onAddRow: () => void;
  onDuplicateRow: (rowId: string) => void;
  onRemoveRow: (rowId: string) => void;
}

const noopSubscribe = (_listener: () => void) => () => {};

function useDbRowDropIndicator(rowId: string): "above" | "below" | null {
  const store = useContext(DbRowDragOverStoreContext);
  const subscribe = store?.subscribe ?? noopSubscribe;
  const rawGetSnapshot = store?.getSnapshot;

  const getSnapshot = useCallback(() => {
    const info = rawGetSnapshot?.();
    if (!info || info.overId !== rowId) return null;
    return info.position;
  }, [rowId, rawGetSnapshot]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

export function DatabaseTableRow({
  row,
  sortedProperties,
  editingCell,
  hasSorts,
  getCellValue,
  getOptions,
  onCellClick,
  onCellChange,
  onCellEditClose,
  onAddRow,
  onDuplicateRow,
  onRemoveRow,
}: DatabaseTableRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: row.id, disabled: hasSorts });

  const dropPosition = useDbRowDropIndicator(row.id);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleGripClick = useCallback(
    (e: React.MouseEvent) => {
      // Only open context menu on click (not after drag)
      if (!isDragging) {
        setContextMenu({ x: e.clientX, y: e.clientY });
      }
    },
    [isDragging],
  );

  const style = useMemo(
    () => ({
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.3 : 1,
      position: "relative" as const,
    }),
    [transform, isDragging],
  );

  const colSpan = sortedProperties.length + 1;

  return (
    <>
      {dropPosition === "above" && (
        <tr aria-hidden>
          <td colSpan={colSpan} className="!p-0 !border-none h-0">
            <div className="h-0.5 bg-notion-accent rounded-full" />
          </td>
        </tr>
      )}
      <tr
        ref={setNodeRef}
        style={style}
        data-row-id={row.id}
        className="group/row hover:bg-notion-hover/50 transition-colors"
        {...attributes}
      >
        {/* Grip + Add row column */}
        <td className="w-10 !border-none !p-0">
          <div className="flex items-center justify-center gap-0 h-8">
            <button
              type="button"
              className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded opacity-0 group-hover/row:opacity-100 transition-opacity"
              onClick={onAddRow}
            >
              <Plus size={11} />
            </button>
            {!hasSorts && (
              <button
                type="button"
                className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-100 transition-opacity"
                onClick={handleGripClick}
                {...listeners}
              >
                <GripVertical size={11} />
              </button>
            )}
          </div>
        </td>
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
                !isEditing && onCellClick(row.id, prop.id, prop.type)
              }
            >
              {isEditing ? (
                <CellEditor
                  type={prop.type}
                  value={value}
                  options={getOptions(prop.id)}
                  onChange={(v) => onCellChange(row.id, prop.id, v)}
                  onClose={() =>
                    onCellEditClose(row.id, prop.id, editingCell.originalValue)
                  }
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
      </tr>
      {dropPosition === "below" && (
        <tr aria-hidden>
          <td colSpan={colSpan} className="!p-0 !border-none h-0">
            <div className="h-0.5 bg-notion-accent rounded-full" />
          </td>
        </tr>
      )}

      {/* Row context menu */}
      {contextMenu && (
        <RowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDuplicate={() => onDuplicateRow(row.id)}
          onDelete={() => onRemoveRow(row.id)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

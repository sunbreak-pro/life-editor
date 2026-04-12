import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  DatabaseFull,
  DatabaseProperty,
  DatabaseRow,
  DatabaseCell,
  PropertyType,
} from "../types/database";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { useUndoRedo } from "./useUndoRedo";

export function useDatabase(databaseId: string | null) {
  const [data, setData] = useState<DatabaseFull | null>(null);
  const [loading, setLoading] = useState(false);
  const { push: pushUndo } = useUndoRedo();

  const load = useCallback(async () => {
    if (!databaseId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const result = await getDataService().fetchDatabaseFull(databaseId);
      setData(result ?? null);
    } catch (e) {
      logServiceError("Database", "fetchFull", e);
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateTitle = useCallback(
    (title: string) => {
      if (!data) return;
      setData((prev) =>
        prev
          ? {
              ...prev,
              database: {
                ...prev.database,
                title,
                updatedAt: new Date().toISOString(),
              },
            }
          : null,
      );
      getDataService()
        .updateDatabase(data.database.id, title)
        .catch((e) => logServiceError("Database", "updateTitle", e));
    },
    [data],
  );

  const addProperty = useCallback(
    (name: string, type: PropertyType) => {
      if (!data) return;
      const id = generateId("dbprop");
      const order = data.properties.length;
      const config = type === "select" ? { options: [] } : {};
      const newProp: DatabaseProperty = {
        id,
        databaseId: data.database.id,
        name,
        type,
        order,
        config,
        createdAt: new Date().toISOString(),
      };
      setData((prev) =>
        prev ? { ...prev, properties: [...prev.properties, newProp] } : null,
      );
      getDataService()
        .addDatabaseProperty(id, data.database.id, name, type, order, config)
        .catch((e) => logServiceError("Database", "addProperty", e));
    },
    [data],
  );

  const updateProperty = useCallback(
    (
      propertyId: string,
      updates: {
        name?: string;
        type?: PropertyType;
        order?: number;
        config?: DatabaseProperty["config"];
      },
    ) => {
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          properties: prev.properties.map((p) =>
            p.id === propertyId ? { ...p, ...updates } : p,
          ),
        };
      });
      getDataService()
        .updateDatabaseProperty(propertyId, updates)
        .catch((e) => logServiceError("Database", "updateProperty", e));
    },
    [],
  );

  const removeProperty = useCallback((propertyId: string) => {
    setData((prev) => {
      if (!prev) return null;
      const target = prev.properties.find((p) => p.id === propertyId);
      if (target?.order === 0) return prev;
      return {
        ...prev,
        properties: prev.properties.filter((p) => p.id !== propertyId),
        cells: prev.cells.filter((c) => c.propertyId !== propertyId),
      };
    });
    getDataService()
      .removeDatabaseProperty(propertyId)
      .catch((e) => logServiceError("Database", "removeProperty", e));
  }, []);

  const addRow = useCallback(() => {
    if (!data) return;
    const id = generateId("dbrow");
    const order = data.rows.length;
    const dbId = data.database.id;
    const newRow: DatabaseRow = {
      id,
      databaseId: dbId,
      order,
      createdAt: new Date().toISOString(),
    };
    setData((prev) =>
      prev ? { ...prev, rows: [...prev.rows, newRow] } : null,
    );
    getDataService()
      .addDatabaseRow(id, dbId, order)
      .catch((e) => logServiceError("Database", "addRow", e));

    pushUndo("database", {
      label: "addRow",
      undo: () => {
        setData((prev) =>
          prev
            ? {
                ...prev,
                rows: prev.rows.filter((r) => r.id !== id),
                cells: prev.cells.filter((c) => c.rowId !== id),
              }
            : null,
        );
        getDataService()
          .removeDatabaseRow(id)
          .catch((e) => logServiceError("Database", "undoAddRow", e));
      },
      redo: () => {
        setData((prev) =>
          prev ? { ...prev, rows: [...prev.rows, newRow] } : null,
        );
        getDataService()
          .addDatabaseRow(id, dbId, order)
          .catch((e) => logServiceError("Database", "redoAddRow", e));
      },
    });
  }, [data, pushUndo]);

  const duplicateRow = useCallback(
    (rowId: string) => {
      if (!data) return;
      const sourceRow = data.rows.find((r) => r.id === rowId);
      if (!sourceRow) return;
      const sourceCells = data.cells.filter((c) => c.rowId === rowId);

      const newId = generateId("dbrow");
      const order = data.rows.length;
      const dbId = data.database.id;
      const newRow: DatabaseRow = {
        id: newId,
        databaseId: dbId,
        order,
        createdAt: new Date().toISOString(),
      };
      const newCells = sourceCells.map((c) => ({
        ...c,
        id: generateId("dbcell"),
        rowId: newId,
      }));

      setData((prev) =>
        prev
          ? {
              ...prev,
              rows: [...prev.rows, newRow],
              cells: [...prev.cells, ...newCells],
            }
          : null,
      );
      getDataService()
        .addDatabaseRow(newId, dbId, order)
        .then(() =>
          Promise.all(
            newCells.map((c) =>
              getDataService().upsertDatabaseCell(
                c.id,
                c.rowId,
                c.propertyId,
                c.value,
              ),
            ),
          ),
        )
        .catch((e) => logServiceError("Database", "duplicateRow", e));

      pushUndo("database", {
        label: "duplicateRow",
        undo: () => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  rows: prev.rows.filter((r) => r.id !== newId),
                  cells: prev.cells.filter((c) => c.rowId !== newId),
                }
              : null,
          );
          getDataService()
            .removeDatabaseRow(newId)
            .catch((e) => logServiceError("Database", "undoDuplicateRow", e));
        },
        redo: () => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  rows: [...prev.rows, newRow],
                  cells: [...prev.cells, ...newCells],
                }
              : null,
          );
          getDataService()
            .addDatabaseRow(newId, dbId, order)
            .then(() =>
              Promise.all(
                newCells.map((c) =>
                  getDataService().upsertDatabaseCell(
                    c.id,
                    c.rowId,
                    c.propertyId,
                    c.value,
                  ),
                ),
              ),
            )
            .catch((e) => logServiceError("Database", "redoDuplicateRow", e));
        },
      });
    },
    [data, pushUndo],
  );

  const reorderRows = useCallback(
    (rowIds: string[]) => {
      const previousOrder = data?.rows
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((r) => r.id);

      const applyOrder = (ids: string[]) => {
        setData((prev) => {
          if (!prev) return null;
          const map = new Map(prev.rows.map((r) => [r.id, r]));
          const reordered = ids
            .map((id, i) => {
              const row = map.get(id);
              return row ? { ...row, order: i } : null;
            })
            .filter(Boolean) as typeof prev.rows;
          return { ...prev, rows: reordered };
        });
        getDataService()
          .reorderDatabaseRows(ids)
          .catch((e) => logServiceError("Database", "reorderRows", e));
      };

      applyOrder(rowIds);

      if (previousOrder) {
        pushUndo("database", {
          label: "reorderRows",
          undo: () => applyOrder(previousOrder),
          redo: () => applyOrder(rowIds),
        });
      }
    },
    [data, pushUndo],
  );

  const removeRow = useCallback(
    (rowId: string) => {
      if (!data) return;
      const deletedRow = data.rows.find((r) => r.id === rowId);
      const deletedCells = data.cells.filter((c) => c.rowId === rowId);
      if (!deletedRow) return;

      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          rows: prev.rows.filter((r) => r.id !== rowId),
          cells: prev.cells.filter((c) => c.rowId !== rowId),
        };
      });
      getDataService()
        .removeDatabaseRow(rowId)
        .catch((e) => logServiceError("Database", "removeRow", e));

      pushUndo("database", {
        label: "removeRow",
        undo: () => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  rows: [...prev.rows, deletedRow],
                  cells: [...prev.cells, ...deletedCells],
                }
              : null,
          );
          getDataService()
            .addDatabaseRow(
              deletedRow.id,
              deletedRow.databaseId,
              deletedRow.order,
            )
            .then(() =>
              Promise.all(
                deletedCells.map((c) =>
                  getDataService().upsertDatabaseCell(
                    c.id,
                    c.rowId,
                    c.propertyId,
                    c.value,
                  ),
                ),
              ),
            )
            .catch((e) => logServiceError("Database", "undoRemoveRow", e));
        },
        redo: () => {
          setData((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              rows: prev.rows.filter((r) => r.id !== rowId),
              cells: prev.cells.filter((c) => c.rowId !== rowId),
            };
          });
          getDataService()
            .removeDatabaseRow(rowId)
            .catch((e) => logServiceError("Database", "redoRemoveRow", e));
        },
      });
    },
    [data, pushUndo],
  );

  const upsertCell = useCallback(
    (rowId: string, propertyId: string, value: string) => {
      let cellId = "";
      setData((prev) => {
        if (!prev) return null;
        const existing = prev.cells.find(
          (c) => c.rowId === rowId && c.propertyId === propertyId,
        );
        if (existing) {
          cellId = existing.id;
          return {
            ...prev,
            cells: prev.cells.map((c) =>
              c.rowId === rowId && c.propertyId === propertyId
                ? { ...c, value }
                : c,
            ),
          };
        }
        cellId = generateId("dbcell");
        return {
          ...prev,
          cells: [...prev.cells, { id: cellId, rowId, propertyId, value }],
        };
      });

      if (cellId) {
        getDataService()
          .upsertDatabaseCell(cellId, rowId, propertyId, value)
          .catch((e) => logServiceError("Database", "upsertCell", e));
      }
    },
    [],
  );

  const getCellValue = useCallback(
    (rowId: string, propertyId: string): string => {
      if (!data) return "";
      const cell = data.cells.find(
        (c) => c.rowId === rowId && c.propertyId === propertyId,
      );
      return cell?.value ?? "";
    },
    [data],
  );

  /** Push undo for a committed cell edit (call from CellEditor close) */
  const pushCellUndo = useCallback(
    (
      rowId: string,
      propertyId: string,
      originalValue: string,
      newValue: string,
    ) => {
      if (originalValue === newValue) return;
      pushUndo("database", {
        label: "editCell",
        undo: () => {
          upsertCell(rowId, propertyId, originalValue);
        },
        redo: () => {
          upsertCell(rowId, propertyId, newValue);
        },
      });
    },
    [pushUndo, upsertCell],
  );

  return useMemo(
    () => ({
      data,
      loading,
      reload: load,
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
    }),
    [
      data,
      loading,
      load,
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
    ],
  );
}

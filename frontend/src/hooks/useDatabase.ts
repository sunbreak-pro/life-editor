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

export function useDatabase(databaseId: string | null) {
  const [data, setData] = useState<DatabaseFull | null>(null);
  const [loading, setLoading] = useState(false);

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
    const newRow: DatabaseRow = {
      id,
      databaseId: data.database.id,
      order,
      createdAt: new Date().toISOString(),
    };
    setData((prev) =>
      prev ? { ...prev, rows: [...prev.rows, newRow] } : null,
    );
    getDataService()
      .addDatabaseRow(id, data.database.id, order)
      .catch((e) => logServiceError("Database", "addRow", e));
  }, [data]);

  const removeRow = useCallback((rowId: string) => {
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
  }, []);

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
      removeRow,
      upsertCell,
      getCellValue,
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
      removeRow,
      upsertCell,
      getCellValue,
    ],
  );
}

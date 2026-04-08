import { useEffect, useCallback, useRef } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { DatabaseView } from "../components/Database/DatabaseView";
import { getDataService } from "../services";
import { generateId } from "../utils/generateId";
import { logServiceError } from "../utils/logError";

export function DatabaseBlockView({ node, updateAttributes }: NodeViewProps) {
  const databaseId = node.attrs.databaseId as string | null;
  const creatingRef = useRef(false);

  // Auto-create database on first mount if no ID
  useEffect(() => {
    if (databaseId || creatingRef.current) return;
    creatingRef.current = true;

    const id = generateId("database");
    getDataService()
      .createDatabase(id, "Untitled")
      .then(() => {
        updateAttributes({ databaseId: id });
        // Add default "Name" column
        return getDataService().addDatabaseProperty(
          generateId("dbprop"),
          id,
          "Name",
          "text",
          0,
          {},
        );
      })
      .catch((e) => logServiceError("DatabaseBlock", "autoCreate", e));
  }, [databaseId, updateAttributes]);

  // Stop keyboard events from propagating to TipTap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <NodeViewWrapper
      className="my-2"
      data-type="database-block"
      contentEditable={false}
    >
      <div onKeyDown={handleKeyDown}>
        {databaseId ? (
          <DatabaseView databaseId={databaseId} />
        ) : (
          <div className="flex items-center justify-center py-4 text-xs text-notion-text-secondary border border-notion-border rounded-md">
            Creating database...
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

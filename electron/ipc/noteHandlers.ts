import { query, mutation } from "./handlerUtil";
import type { NoteRepository } from "../database/noteRepository";

export function registerNoteHandlers(repo: NoteRepository): void {
  query("db:notes:fetchAll", "Notes", "fetchAll", () => repo.fetchAll());

  query("db:notes:fetchDeleted", "Notes", "fetchDeleted", () =>
    repo.fetchDeleted(),
  );

  query("db:notes:search", "Notes", "search", (_event, searchQuery: string) => {
    if (typeof searchQuery !== "string" || searchQuery.length > 500) return [];
    return repo.search(searchQuery);
  });

  mutation(
    "db:notes:create",
    "Notes",
    "create",
    "note",
    "create",
    (_event, id: string, title: string) => repo.create(id, title),
  );

  mutation(
    "db:notes:update",
    "Notes",
    "update",
    "note",
    "update",
    (
      _event,
      id: string,
      updates: {
        title?: string;
        content?: string;
        isPinned?: boolean;
        color?: string;
      },
    ) => repo.update(id, updates),
  );

  mutation(
    "db:notes:softDelete",
    "Notes",
    "softDelete",
    "note",
    "delete",
    (_event, id: string) => repo.softDelete(id),
  );

  mutation(
    "db:notes:restore",
    "Notes",
    "restore",
    "note",
    "update",
    (_event, id: string) => repo.restore(id),
  );

  mutation(
    "db:notes:permanentDelete",
    "Notes",
    "permanentDelete",
    "note",
    "delete",
    (_event, id: string) => repo.permanentDelete(id),
  );

  mutation(
    "db:notes:createFolder",
    "Notes",
    "createFolder",
    "note",
    "create",
    (_event, id: string, title: string, parentId: string | null) =>
      repo.createFolder(id, title, parentId),
  );

  mutation(
    "db:notes:syncTree",
    "Notes",
    "syncTree",
    "note",
    "update",
    (
      _event,
      items: Array<{ id: string; parentId: string | null; order: number }>,
    ) => repo.syncTree(items),
  );

  // Note tag handlers moved to tagHandlers.ts (db:noteTags:*)
}

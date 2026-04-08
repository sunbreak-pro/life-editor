import { query, mutation } from "./handlerUtil";
import type { NoteRepository } from "../database/noteRepository";
import { hashPassword, verifyPassword } from "../utils/passwordHash";

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

  mutation(
    "db:notes:setPassword",
    "Notes",
    "setPassword",
    "note",
    "update",
    (_event: unknown, id: string, password: string) => {
      const hash = hashPassword(password);
      return repo.setPassword(id, hash);
    },
  );

  mutation(
    "db:notes:removePassword",
    "Notes",
    "removePassword",
    "note",
    "update",
    (_event: unknown, id: string, currentPassword: string) => {
      const stored = repo.getPasswordHash(id);
      if (!stored || !verifyPassword(currentPassword, stored)) {
        throw new Error("Invalid password");
      }
      return repo.removePassword(id);
    },
  );

  query(
    "db:notes:verifyPassword",
    "Notes",
    "verifyPassword",
    (_event: unknown, id: string, password: string) => {
      const stored = repo.getPasswordHash(id);
      if (!stored) return false;
      return verifyPassword(password, stored);
    },
  );

  // Note tag handlers moved to tagHandlers.ts (db:noteTags:*)
}

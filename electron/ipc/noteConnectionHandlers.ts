import { query, mutation } from "./handlerUtil";
import type { NoteConnectionRepository } from "../database/noteConnectionRepository";

export function registerNoteConnectionHandlers(
  repo: NoteConnectionRepository,
): void {
  query("db:noteConnections:fetchAll", "NoteConnections", "fetchAll", () =>
    repo.fetchAll(),
  );

  mutation(
    "db:noteConnections:create",
    "NoteConnections",
    "create",
    "noteConnection",
    "create",
    (_event, sourceNoteId: string, targetNoteId: string) =>
      repo.create(sourceNoteId, targetNoteId),
    (_args, result) => (result as { id?: string })?.id,
  );

  mutation(
    "db:noteConnections:delete",
    "NoteConnections",
    "delete",
    "noteConnection",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );

  mutation(
    "db:noteConnections:deleteByNotePair",
    "NoteConnections",
    "deleteByNotePair",
    "noteConnection",
    "delete",
    (_event, sourceNoteId: string, targetNoteId: string) => {
      repo.deleteByNotePair(sourceNoteId, targetNoteId);
    },
    () => undefined,
  );
}

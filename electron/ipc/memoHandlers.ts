import { query, mutation } from "./handlerUtil";
import type { MemoRepository } from "../database/memoRepository";

export function registerMemoHandlers(repo: MemoRepository): void {
  query("db:memo:fetchAll", "Memo", "fetchAll", () => repo.fetchAll());

  query("db:memo:fetchByDate", "Memo", "fetchByDate", (_event, date: string) =>
    repo.fetchByDate(date),
  );

  query("db:memo:fetchDeleted", "Memo", "fetchDeleted", () =>
    repo.fetchDeleted(),
  );

  mutation(
    "db:memo:upsert",
    "Memo",
    "upsert",
    "memo",
    "update",
    (_event, date: string, content: string) => repo.upsert(date, content),
  );

  mutation(
    "db:memo:delete",
    "Memo",
    "delete",
    "memo",
    "delete",
    (_event, date: string) => repo.delete(date),
  );

  mutation(
    "db:memo:restore",
    "Memo",
    "restore",
    "memo",
    "update",
    (_event, date: string) => repo.restore(date),
  );

  mutation(
    "db:memo:permanentDelete",
    "Memo",
    "permanentDelete",
    "memo",
    "delete",
    (_event, date: string) => repo.permanentDelete(date),
  );

  mutation(
    "db:memo:togglePin",
    "Memo",
    "togglePin",
    "memo",
    "update",
    (_event, date: string) => repo.togglePin(date),
  );
}

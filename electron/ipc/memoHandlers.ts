import { query, mutation } from "./handlerUtil";
import type { MemoRepository } from "../database/memoRepository";
import { hashPassword, verifyPassword } from "../utils/passwordHash";

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

  mutation(
    "db:memo:setPassword",
    "Memo",
    "setPassword",
    "memo",
    "update",
    (_event: unknown, date: string, password: string) => {
      const hash = hashPassword(password);
      return repo.setPassword(date, hash);
    },
    (_args, result) => (result as { date?: string })?.date,
  );

  mutation(
    "db:memo:removePassword",
    "Memo",
    "removePassword",
    "memo",
    "update",
    (_event: unknown, date: string, currentPassword: string) => {
      const stored = repo.getPasswordHash(date);
      if (!stored || !verifyPassword(currentPassword, stored)) {
        throw new Error("Invalid password");
      }
      return repo.removePassword(date);
    },
    (_args, result) => (result as { date?: string })?.date,
  );

  mutation(
    "db:memo:toggleEditLock",
    "Memo",
    "toggleEditLock",
    "memo",
    "update",
    (_event: unknown, date: string) => repo.toggleEditLock(date),
    (_args, result) => (result as { date?: string })?.date,
  );

  query(
    "db:memo:verifyPassword",
    "Memo",
    "verifyPassword",
    (_event: unknown, date: string, password: string) => {
      const stored = repo.getPasswordHash(date);
      if (!stored) return false;
      return verifyPassword(password, stored);
    },
  );
}

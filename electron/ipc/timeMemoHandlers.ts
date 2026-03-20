import { query, mutation } from "./handlerUtil";
import type { TimeMemoRepository } from "../database/timeMemoRepository";

export function registerTimeMemoHandlers(repo: TimeMemoRepository): void {
  query(
    "db:timeMemos:fetchByDate",
    "TimeMemos",
    "fetchByDate",
    (_event, date: string) => repo.fetchByDate(date),
  );

  mutation(
    "db:timeMemos:upsert",
    "TimeMemos",
    "upsert",
    "timeMemo",
    "update",
    (_event, id: string, date: string, hour: number, content: string) =>
      repo.upsert(id, date, hour, content),
  );

  mutation(
    "db:timeMemos:delete",
    "TimeMemos",
    "delete",
    "timeMemo",
    "delete",
    (_event, id: string) => {
      repo.delete(id);
    },
  );
}

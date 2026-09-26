import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportDataService } from "./DataService";
import { fetchAllPages } from "./postgrestFetchAll";
import { getAuthedUserId } from "./supabaseServiceHelpers";
import {
  USER_DATA_EXPORT_SCHEMA_VERSION,
  USER_DATA_EXPORT_TABLES,
  type UserDataExport,
  type UserDataExportTable,
} from "./userDataExport";

/*
 * Whole-account export (#1988). Reads only — nothing here writes a row.
 *
 * TWO FENCES AROUND "ONLY MINE". RLS already scopes every one of these tables
 * to `auth.uid() = user_id` (each has a SELECT or ALL policy in
 * supabase/migrations), and that is the fence that matters. The explicit
 * `.eq("user_id", uid)` is the second one: a file the user downloads and
 * keeps is the worst possible place for a policy mistake to surface as
 * someone else's rows, and the filter costs one query-string parameter.
 *
 * SEQUENTIAL, NOT Promise.all. Twenty tables at once is twenty concurrent
 * paginated pulls from one tab on a free-tier project; one after another the
 * export takes a little longer and never competes with the screen the user is
 * looking at for the connection pool. The button stays busy the whole time,
 * which is what the user needs to see.
 */
export const PHASE2_EXPORT_METHOD_NAMES = ["exportUserData"] as const;

export type ExportMethodName = (typeof PHASE2_EXPORT_METHOD_NAMES)[number];

export const PHASE2_EXPORT_METHODS: ReadonlySet<string> = new Set(
  PHASE2_EXPORT_METHOD_NAMES,
);

export class SupabaseExportService implements ExportDataService {
  constructor(private readonly client: SupabaseClient) {}

  async exportUserData(): Promise<UserDataExport> {
    const uid = await getAuthedUserId(this.client);
    const tables = {} as UserDataExport["tables"];
    for (const { table, orderBy } of USER_DATA_EXPORT_TABLES) {
      tables[table as UserDataExportTable] = await fetchAllPages<
        Record<string, unknown>
      >(
        (from, to) =>
          this.client
            .from(table)
            .select("*")
            .eq("user_id", uid)
            .order(orderBy)
            .range(from, to),
        `exportUserData(${table}) failed`,
      );
    }
    return {
      schemaVersion: USER_DATA_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tables,
    };
  }
}

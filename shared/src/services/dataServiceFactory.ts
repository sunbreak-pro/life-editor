import type { DataService } from "./DataService";
import { createSupabaseDataService } from "./SupabaseDataService";

/*
 * Single source for the web/Electron/Capacitor DataService singleton.
 *
 * Hosts (MainScreen / TodosScreen) previously each kept a private
 * `dataServiceSingleton` + `getDataService()`, which produced one
 * SupabaseDataService PER screen. Centralising here gives the whole web
 * build one shared instance. CLAUDE.md §3.1: components reach data only
 * through getDataService(); §6.4: shared HOOKS never touch a module
 * singleton — they take DataService via DI. This factory is for HOSTS
 * (screens), not hooks.
 *
 * The singleton is built lazily on first access, so importing this module has
 * no Supabase side effect. There is no test-override hook (#1389): the
 * `setDataServiceForTest` seam this file used to carry had no caller left, not
 * even in the suites — they build a typed fake with `stubDataService` /
 * `makeDS` and hand it to the unit under test, which is the same DI the hooks
 * already take.
 */

let dataServiceSingleton: DataService | null = null;

export function getDataService(): DataService {
  if (!dataServiceSingleton) {
    dataServiceSingleton = createSupabaseDataService();
  }
  return dataServiceSingleton;
}

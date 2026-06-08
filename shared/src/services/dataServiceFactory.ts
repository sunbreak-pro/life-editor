import type { DataService } from "./DataService";
import { createSupabaseDataService } from "./SupabaseDataService";

/*
 * Single source for the web/Electron/Capacitor DataService singleton.
 *
 * Hosts (MainScreen / TasksScreen) previously each kept a private
 * `dataServiceSingleton` + `getDataService()`, which produced one
 * SupabaseDataService PER screen. Centralising here gives the whole web
 * build one shared instance. CLAUDE.md §3.1: components reach data only
 * through getDataService(); §6.4: shared HOOKS never touch a module
 * singleton — they take DataService via DI. This factory is for HOSTS
 * (screens), not hooks.
 *
 * testOverride mirrors frontend/src/services/dataServiceFactory.ts: tests
 * inject a fake via setDataServiceForTest(fake) and clear it with
 * setDataServiceForTest(null). The real singleton is created lazily on
 * first access so importing this module has no Supabase side effect.
 */

let dataServiceSingleton: DataService | null = null;
let testOverride: DataService | null = null;

/** Inject a fake DataService for tests; pass null to clear the override. */
export function setDataServiceForTest(ds: DataService | null): void {
  testOverride = ds;
}

export function getDataService(): DataService {
  if (testOverride) {
    return testOverride;
  }
  if (!dataServiceSingleton) {
    dataServiceSingleton = createSupabaseDataService();
  }
  return dataServiceSingleton;
}

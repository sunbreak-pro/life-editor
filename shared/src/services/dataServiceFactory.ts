import type { DataService } from "./DataService";
import { createSupabaseDataService } from "./SupabaseDataService";
import {
  createOfflineDataService,
  createOutboxSender,
  sessionOwner,
  type OutboxSender,
  type OutboxSent,
} from "./offlineDataService";
import type { KnownDailies } from "./offlineDaily";
import { getSupabaseClient } from "./supabaseClient";

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
 *
 * #2335: what hosts get is wrapped once with the outbox, so `useDomainLoad`'s
 * identity check keeps seeing one object. The sender uses the unwrapped service.
 */

let dataServiceSingleton: DataService | null = null;
let outboxSender: OutboxSender | null = null;
let lastOnSent: OutboxSent = () => {};

export function getDataService(): DataService {
  if (!dataServiceSingleton) {
    const inner = createSupabaseDataService();
    const owner = sessionOwner(getSupabaseClient().auth);
    const landed = new Set<string>();
    const dropped = new Set<string>();
    const known: KnownDailies = new Map();
    dataServiceSingleton = createOfflineDataService(
      inner,
      owner,
      landed,
      dropped,
      known,
      () => outboxSender?.nudge(lastOnSent),
    );
    outboxSender = createOutboxSender(inner, owner, landed, dropped, known);
  }
  return dataServiceSingleton;
}

/** Send what waits in the outbox. Resolves either way; `onSent` if any went. */
export async function sendOutbox(onSent: OutboxSent): Promise<void> {
  getDataService();
  lastOnSent = onSent;
  await outboxSender?.run(onSent);
}

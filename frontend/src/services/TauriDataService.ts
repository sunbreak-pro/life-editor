import type { DataService } from "./DataService";
import { calendarsApi } from "./data/calendars";
import { dailyApi } from "./data/daily";
import { databasesApi } from "./data/databases";
import { filesApi } from "./data/files";
import { miscApi } from "./data/misc";
import { notesApi } from "./data/notes";
import { paperApi } from "./data/paper";
import { playlistsApi } from "./data/playlists";
import { routinesApi } from "./data/routines";
import { scheduleItemsApi } from "./data/scheduleItems";
import { sidebarApi } from "./data/sidebar";
import { soundApi } from "./data/sound";
import { syncApi } from "./data/sync";
import { systemApi } from "./data/system";
import { tasksApi } from "./data/tasks";
import { templatesApi } from "./data/templates";
import { timeMemosApi } from "./data/timeMemos";
import { timerApi } from "./data/timer";
import { wikiTagsApi } from "./data/wikiTags";

/**
 * Composition root for the Tauri-backed DataService implementation.
 *
 * Each domain bridge (`./data/*.ts`) exports a typed const object of
 * `tauriInvoke` wrappers; this file spreads them into a single singleton
 * that satisfies `DataService`. The factory (`dataServiceFactory.ts`)
 * imports `tauriDataService` directly — there is no class wrapper, which
 * keeps the type system honest (no class/interface declaration merging).
 */
export const tauriDataService: DataService = {
  ...tasksApi,
  ...timerApi,
  ...soundApi,
  ...dailyApi,
  ...notesApi,
  ...calendarsApi,
  ...routinesApi,
  ...scheduleItemsApi,
  ...playlistsApi,
  ...wikiTagsApi,
  ...timeMemosApi,
  ...paperApi,
  ...databasesApi,
  ...filesApi,
  ...sidebarApi,
  ...systemApi,
  ...templatesApi,
  ...syncApi,
  ...miscApi,
};

import {
  getOfflineDb,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from "./indexedDb";
import type { SyncFullResponse, SyncChangesResponse } from "../types/sync";
import { apiFetch } from "../config/api";

export async function performFullSync(): Promise<void> {
  const res = await apiFetch("/api/sync/full");
  if (!res.ok) throw new Error(`Full sync failed: ${res.status}`);
  const data: SyncFullResponse = await res.json();

  const db = await getOfflineDb();

  // Clear and repopulate all stores
  const storeNames = [
    "tasks",
    "memos",
    "notes",
    "scheduleItems",
    "routines",
    "wikiTags",
    "wikiTagAssignments",
    "wikiTagConnections",
    "noteConnections",
    "timeMemos",
    "calendars",
  ] as const;

  const tx = db.transaction([...storeNames], "readwrite");

  for (const name of storeNames) {
    tx.objectStore(name).clear();
  }

  for (const item of data.tasks) {
    tx.objectStore("tasks").put(item as unknown as Record<string, unknown>);
  }
  for (const item of data.memos) {
    tx.objectStore("memos").put(item as unknown as Record<string, unknown>);
  }
  for (const item of data.notes) {
    tx.objectStore("notes").put(item as unknown as Record<string, unknown>);
  }
  for (const item of data.scheduleItems) {
    tx.objectStore("scheduleItems").put(
      item as unknown as Record<string, unknown>,
    );
  }
  for (const item of data.routines) {
    tx.objectStore("routines").put(item as unknown as Record<string, unknown>);
  }
  for (const item of data.wikiTags) {
    tx.objectStore("wikiTags").put(item as unknown as Record<string, unknown>);
  }
  for (const item of data.wikiTagAssignments) {
    tx.objectStore("wikiTagAssignments").put(
      item as unknown as Record<string, unknown>,
    );
  }
  for (const item of data.wikiTagConnections) {
    tx.objectStore("wikiTagConnections").put(
      item as unknown as Record<string, unknown>,
    );
  }
  for (const item of data.noteConnections) {
    tx.objectStore("noteConnections").put(
      item as unknown as Record<string, unknown>,
    );
  }
  for (const item of data.timeMemos) {
    tx.objectStore("timeMemos").put(item as unknown as Record<string, unknown>);
  }
  for (const item of data.calendars) {
    tx.objectStore("calendars").put(item as unknown as Record<string, unknown>);
  }

  await tx.done;
  await setLastSyncTimestamp(data.timestamp);
}

export async function performIncrementalSync(): Promise<boolean> {
  const since = await getLastSyncTimestamp();
  if (!since) {
    // No previous sync — need full sync
    await performFullSync();
    return true;
  }

  let hasMore = true;
  let currentSince = since;

  while (hasMore) {
    const res = await apiFetch(
      `/api/sync/changes?since=${encodeURIComponent(currentSince)}`,
    );
    if (!res.ok) throw new Error(`Incremental sync failed: ${res.status}`);
    const data: SyncChangesResponse = await res.json();

    const db = await getOfflineDb();
    const storeNames = [
      "tasks",
      "memos",
      "notes",
      "scheduleItems",
      "routines",
      "wikiTags",
      "wikiTagAssignments",
      "wikiTagConnections",
      "noteConnections",
      "timeMemos",
      "calendars",
    ] as const;

    const tx = db.transaction([...storeNames], "readwrite");

    // Upsert changed records into each store
    for (const item of data.tasks) {
      tx.objectStore("tasks").put(item as unknown as Record<string, unknown>);
    }
    for (const item of data.memos) {
      tx.objectStore("memos").put(item as unknown as Record<string, unknown>);
    }
    for (const item of data.notes) {
      tx.objectStore("notes").put(item as unknown as Record<string, unknown>);
    }
    for (const item of data.scheduleItems) {
      tx.objectStore("scheduleItems").put(
        item as unknown as Record<string, unknown>,
      );
    }
    for (const item of data.routines) {
      tx.objectStore("routines").put(
        item as unknown as Record<string, unknown>,
      );
    }
    for (const item of data.wikiTags) {
      tx.objectStore("wikiTags").put(
        item as unknown as Record<string, unknown>,
      );
    }
    for (const item of data.wikiTagAssignments) {
      tx.objectStore("wikiTagAssignments").put(
        item as unknown as Record<string, unknown>,
      );
    }
    for (const item of data.wikiTagConnections) {
      tx.objectStore("wikiTagConnections").put(
        item as unknown as Record<string, unknown>,
      );
    }
    for (const item of data.noteConnections) {
      tx.objectStore("noteConnections").put(
        item as unknown as Record<string, unknown>,
      );
    }
    for (const item of data.timeMemos) {
      tx.objectStore("timeMemos").put(
        item as unknown as Record<string, unknown>,
      );
    }
    for (const item of data.calendars) {
      tx.objectStore("calendars").put(
        item as unknown as Record<string, unknown>,
      );
    }

    await tx.done;
    await setLastSyncTimestamp(data.timestamp);

    hasMore = data.hasMore;
    currentSince = data.timestamp;
  }

  return true;
}

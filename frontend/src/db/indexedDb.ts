import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SyncQueueEntry } from "../types/sync";

const DB_NAME = "life-editor-offline";
const DB_VERSION = 2;

export interface OfflineDBSchema extends DBSchema {
  tasks: {
    key: string;
    value: Record<string, unknown>;
    indexes: { "by-updated": string };
  };
  memos: {
    key: string;
    value: Record<string, unknown>;
    indexes: { "by-updated": string };
  };
  notes: {
    key: string;
    value: Record<string, unknown>;
    indexes: { "by-updated": string };
  };
  scheduleItems: {
    key: string;
    value: Record<string, unknown>;
    indexes: { "by-updated": string; "by-date": string };
  };
  routines: {
    key: string;
    value: Record<string, unknown>;
    indexes: { "by-updated": string };
  };
  wikiTags: {
    key: string;
    value: Record<string, unknown>;
    indexes: { "by-updated": string };
  };
  wikiTagAssignments: {
    key: string;
    value: Record<string, unknown>;
  };
  wikiTagConnections: {
    key: string;
    value: Record<string, unknown>;
  };
  noteConnections: {
    key: string;
    value: Record<string, unknown>;
  };
  timeMemos: {
    key: string;
    value: Record<string, unknown>;
    indexes: { "by-date": string };
  };
  calendars: {
    key: string;
    value: Record<string, unknown>;
  };
  timerSettings: {
    key: string;
    value: Record<string, unknown>;
  };
  timerSessions: {
    key: number;
    value: Record<string, unknown>;
    indexes: { "by-taskId": string };
  };
  pomodoroPresets: {
    key: number;
    value: Record<string, unknown>;
  };
  syncMeta: {
    key: string;
    value: { key: string; value: string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueEntry;
    indexes: { "by-created": string };
  };
}

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null;

export async function getOfflineDb(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Entity stores
      const entityStores = [
        "tasks",
        "memos",
        "notes",
        "scheduleItems",
        "routines",
        "wikiTags",
      ] as const;

      for (const name of entityStores) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
          if (name === "scheduleItems") {
            (
              store as unknown as {
                createIndex: (n: string, k: string) => void;
              }
            ).createIndex("by-date", "date");
          }
        }
      }

      // Junction/association stores
      if (!db.objectStoreNames.contains("wikiTagAssignments")) {
        db.createObjectStore("wikiTagAssignments", {
          keyPath: ["tagId", "entityId"],
        });
      }
      if (!db.objectStoreNames.contains("wikiTagConnections")) {
        db.createObjectStore("wikiTagConnections", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("noteConnections")) {
        db.createObjectStore("noteConnections", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("timeMemos")) {
        const tmStore = db.createObjectStore("timeMemos", { keyPath: "id" });
        tmStore.createIndex("by-date", "date");
      }
      if (!db.objectStoreNames.contains("calendars")) {
        db.createObjectStore("calendars", { keyPath: "id" });
      }

      // Timer stores (v2)
      if (!db.objectStoreNames.contains("timerSettings")) {
        db.createObjectStore("timerSettings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("timerSessions")) {
        const tsStore = db.createObjectStore("timerSessions", {
          keyPath: "id",
          autoIncrement: true,
        });
        tsStore.createIndex("by-taskId", "taskId");
      }
      if (!db.objectStoreNames.contains("pomodoroPresets")) {
        db.createObjectStore("pomodoroPresets", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      // Sync metadata
      if (!db.objectStoreNames.contains("syncMeta")) {
        db.createObjectStore("syncMeta", { keyPath: "key" });
      }

      // Sync queue for offline changes
      if (!db.objectStoreNames.contains("syncQueue")) {
        const queueStore = db.createObjectStore("syncQueue", {
          keyPath: "id",
        });
        queueStore.createIndex("by-created", "createdAt");
      }
    },
  });

  return dbInstance;
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  const db = await getOfflineDb();
  const meta = await db.get("syncMeta", "lastSync");
  return meta?.value ?? null;
}

export async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put("syncMeta", { key: "lastSync", value: timestamp });
}

export async function clearOfflineDb(): Promise<void> {
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
    "timerSettings",
    "timerSessions",
    "pomodoroPresets",
    "syncQueue",
    "syncMeta",
  ] as const;

  const tx = db.transaction([...storeNames], "readwrite");
  for (const name of storeNames) {
    tx.objectStore(name).clear();
  }
  await tx.done;
}

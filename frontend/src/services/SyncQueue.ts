import { getOfflineDb } from "../db/indexedDb";
import type {
  SyncQueueEntry,
  SyncEntityType,
  SyncAction,
  SyncBatchResponse,
} from "../types/sync";
import { apiFetch } from "../config/api";

const MAX_RETRY_COUNT = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BATCH_SIZE = 50;

type ConflictHandler = (
  entityType: SyncEntityType,
  entityId: string,
  serverData: unknown,
) => void;

export class SyncQueue {
  private flushing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onConflict: ConflictHandler | null = null;
  private onChange: (() => void) | null = null;

  setConflictHandler(handler: ConflictHandler): void {
    this.onConflict = handler;
  }

  setChangeHandler(handler: () => void): void {
    this.onChange = handler;
  }

  async enqueue(
    entityType: SyncEntityType,
    entityId: string,
    action: SyncAction,
    data?: unknown,
  ): Promise<void> {
    const db = await getOfflineDb();

    // Queue compression: merge with existing entry for same entity
    const allEntries = await db.getAllFromIndex("syncQueue", "by-created");
    const existing = allEntries.find(
      (e) => e.entityType === entityType && e.entityId === entityId,
    );

    if (existing) {
      // If existing is create and new is update, keep create with updated data
      if (existing.action === "create" && action === "update") {
        await db.put("syncQueue", {
          ...existing,
          data: {
            ...(existing.data as Record<string, unknown>),
            ...(data as Record<string, unknown>),
          },
        });
        this.onChange?.();
        return;
      }
      // If existing is create and new is delete, just remove from queue
      if (existing.action === "create" && action === "delete") {
        await db.delete("syncQueue", existing.id);
        this.onChange?.();
        return;
      }
      // If existing is update and new is update, merge data
      if (existing.action === "update" && action === "update") {
        await db.put("syncQueue", {
          ...existing,
          data: {
            ...(existing.data as Record<string, unknown>),
            ...(data as Record<string, unknown>),
          },
        });
        this.onChange?.();
        return;
      }
      // If existing is update and new is delete, replace with delete
      if (existing.action === "update" && action === "delete") {
        await db.put("syncQueue", {
          ...existing,
          action: "delete",
          data: undefined,
        });
        this.onChange?.();
        return;
      }
    }

    const entry: SyncQueueEntry = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entityType,
      entityId,
      action,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    await db.add("syncQueue", entry);
    this.onChange?.();
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;

    try {
      const db = await getOfflineDb();
      let entries = await db.getAllFromIndex("syncQueue", "by-created");

      while (entries.length > 0) {
        const batch = entries.slice(0, BATCH_SIZE);

        const operations = batch.map((e) => ({
          entityType: e.entityType,
          action: e.action,
          entityId: e.entityId,
          data: e.data as Record<string, unknown> | undefined,
          version: (e.data as Record<string, unknown> | undefined)?.version as
            | number
            | undefined,
        }));

        const res = await apiFetch("/api/sync/batch", {
          method: "POST",
          body: JSON.stringify({ operations }),
        });

        if (!res.ok) {
          // Network error — schedule retry
          this.scheduleRetry(batch);
          return;
        }

        const response: SyncBatchResponse = await res.json();

        // Process results
        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          const entry = batch[i];

          if (result.status === "success") {
            await db.delete("syncQueue", entry.id);
          } else if (result.status === "conflict") {
            // Last-write-wins: remove from queue and notify
            await db.delete("syncQueue", entry.id);
            this.onConflict?.(
              entry.entityType,
              entry.entityId,
              result.serverData,
            );
          } else {
            // Error — increment retry count
            if (entry.retryCount >= MAX_RETRY_COUNT) {
              // Give up on this entry
              await db.delete("syncQueue", entry.id);
            } else {
              await db.put("syncQueue", {
                ...entry,
                retryCount: entry.retryCount + 1,
              });
            }
          }
        }

        this.onChange?.();

        // Fetch remaining entries
        entries = await db.getAllFromIndex("syncQueue", "by-created");
      }
    } finally {
      this.flushing = false;
    }
  }

  async getQueueSize(): Promise<number> {
    const db = await getOfflineDb();
    return db.count("syncQueue");
  }

  private scheduleRetry(failedBatch: SyncQueueEntry[]): void {
    const maxRetry = Math.max(...failedBatch.map((e) => e.retryCount));
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, maxRetry), MAX_DELAY_MS);

    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushing = false;
      this.flush();
    }, delay);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

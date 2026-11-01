import { useMemo } from "react";
import {
  clipExcerpt,
  contentExcerpt,
  extractEveningSection,
  todoScheduleSlot,
  useSyncDomains,
  type DataService,
  type TodoScheduleSlot,
} from "@life-editor/shared";

/*
 * useItemLinkPreview (#2392) — what a link chip's panel says about its target,
 * read one item at a time when a panel opens.
 *
 * Not on `ItemLinkTarget`, on purpose. That pool is loaded whole for the "[["
 * menu and the "+" picker, so a body on every row would cost everyone who never
 * opens a chip. Only the short result is kept here, never the body it came from.
 *
 * A LOCKED item says less. `getNoteUnified` already leaves a locked note's body
 * out (#1763), and the excerpt below is never asked for. `getDailyByDateUnified`
 * does return a locked day's body, so that branch drops it unread: the mood is
 * in the same text and is covered by the same password.
 *
 * The cache lives as long as nothing changed: a sync bump on any domain read
 * here builds a new source, which is how a panel still open picks up an edit.
 */

/** Longest excerpt a panel shows, in characters (Claude Design B3). */
export const LINK_PREVIEW_EXCERPT_MAX = 64;

export type ItemLinkPreview =
  | { kind: "note"; updatedAt: string; excerpt?: string }
  | { kind: "daily"; date: string; mood: number | null; excerpt?: string }
  | {
      kind: "task";
      done: boolean;
      slot: TodoScheduleSlot | null;
      excerpt?: string;
    }
  | {
      kind: "event";
      date: string;
      startTime: string;
      endTime: string;
      isAllDay: boolean;
      excerpt?: string;
    };

export interface ItemLinkPreviewTarget {
  id: string;
  role: string;
  /** The event's day: the read below goes through it. */
  date?: string;
}

export interface ItemLinkPreviewSource {
  /**
   * The value already read, so a reopened panel draws it at once. `undefined` =
   * not read yet; `null` = read, and there is no such item.
   */
  peek: (id: string) => ItemLinkPreview | null | undefined;
  load: (target: ItemLinkPreviewTarget) => Promise<ItemLinkPreview | null>;
}

function excerptOf(body: string | null | undefined): string | undefined {
  const line = contentExcerpt(body ?? undefined);
  return line ? clipExcerpt(line, LINK_PREVIEW_EXCERPT_MAX) : undefined;
}

async function readPreview(
  ds: DataService,
  target: ItemLinkPreviewTarget,
): Promise<ItemLinkPreview | null> {
  switch (target.role) {
    case "note": {
      const note = await ds.getNoteUnified(target.id);
      if (!note) return null;
      return {
        kind: "note",
        updatedAt: note.updatedAt,
        excerpt: note.hasPassword ? undefined : excerptOf(note.content),
      };
    }
    case "daily": {
      const date = target.id.replace(/^daily-/, "");
      const daily = await ds.getDailyByDateUnified(date);
      if (!daily) return null;
      if (daily.hasPassword) return { kind: "daily", date, mood: null };
      return {
        kind: "daily",
        date,
        mood: extractEveningSection(daily.content).mood,
        excerpt: excerptOf(daily.content),
      };
    }
    case "task": {
      const todo = await ds.getTodoById(target.id);
      if (!todo) return null;
      return {
        kind: "task",
        done: todo.status === "DONE",
        slot: todoScheduleSlot(todo),
        excerpt: excerptOf(todo.content),
      };
    }
    case "event": {
      if (!target.date) return null;
      // Events have no read by id, and the day is known. A day's rows are few.
      const rows = await ds.fetchScheduleItemsByDate(target.date);
      const event = rows.find((row) => row.id === target.id);
      if (!event) return null;
      return {
        kind: "event",
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: !!event.isAllDay,
        excerpt: excerptOf(event.memo),
      };
    }
    default:
      return null;
  }
}

export function useItemLinkPreview(
  dataService: DataService | undefined,
): ItemLinkPreviewSource | undefined {
  const syncVersion = useSyncDomains("notes", "dailies", "todos", "schedule");

  return useMemo(() => {
    if (!dataService) return undefined;
    const settled = new Map<string, ItemLinkPreview | null>();
    const inFlight = new Map<string, Promise<ItemLinkPreview | null>>();
    return {
      // Carried so the memo has a reason to depend on it: a new version is a
      // new, empty cache.
      syncVersion,
      peek: (id: string) => settled.get(id),
      load: (target: ItemLinkPreviewTarget) => {
        const running = inFlight.get(target.id);
        if (running) return running;
        const read = readPreview(dataService, target).then(
          (preview) => {
            settled.set(target.id, preview);
            inFlight.delete(target.id);
            return preview;
          },
          (error: unknown) => {
            // Not cached, so the next open tries again.
            inFlight.delete(target.id);
            throw error;
          },
        );
        inFlight.set(target.id, read);
        return read;
      },
    };
  }, [dataService, syncVersion]);
}

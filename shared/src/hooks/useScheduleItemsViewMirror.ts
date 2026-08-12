import { useCallback, useMemo, useRef, type RefObject } from "react";
import type { ScheduleItem } from "../types/schedule";

/**
 * The host's own copy of the rows currently on screen (#568).
 *
 * useScheduleItemsAPI is anchored on ONE day, so its `items` only ever holds
 * that day's rows — but the calendar grid renders a whole week/month out of
 * its own visible-range store. Two things broke because of that gap: a
 * mutation on any other day found no `prev` in the hook and pushed NO undo
 * command at all, and the commands that did get pushed wrote their rollback
 * into `items`, which the grid does not read (so "元に戻しました" appeared
 * while the event stayed put until a Realtime refetch).
 *
 * The host registers this mirror once (`registerViewMirror`) and the undo /
 * redo closures then read and write BOTH lists. Forward writes stay where they
 * are — the host's mutation layer already patches its own store on the way in
 * (and owns extras like selection), so mirroring them here would just do the
 * same work twice.
 *
 * All four methods must be no-op-safe for ids the mirror does not hold: an
 * undo may run long after the view navigated away from that row.
 *
 * ORDER CONTRACT: the host calls the mutation in useScheduleItemsAPI FIRST and
 * patches its own store after. The undo command snapshots the row through
 * `find`, and this interface deliberately says NOTHING about when a patch
 * becomes visible to `find` — a mirror backed by an effect-updated ref lags a
 * commit behind, one answering from live state does not. Calling in this order
 * is what makes the snapshot the pre-edit row under either implementation; a
 * host that patches first is correct only by accident of its own timing, and
 * the accident ends the day the mirror is reimplemented.
 */
export interface ScheduleItemsViewMirror {
  /** Row lookup for ids outside the anchored day. */
  find: (id: string) => ScheduleItem | undefined;
  /** Insert (or replace) a row — undo of a delete / dismiss / redo of create. */
  upsert: (item: ScheduleItem) => void;
  /** Patch fields of a row the mirror already holds; no-op otherwise. */
  patch: (id: string, patch: Partial<ScheduleItem>) => void;
  /** Drop a row — undo of a create / redo of a delete / dismiss. */
  remove: (id: string) => void;
}

/**
 * What the rest of useScheduleItemsAPI talks to (#675 split). Every method is
 * a no-op while no host has registered, so callers never null-check — that
 * guard used to be spelled out at each of the dozen call sites inside the
 * undo/redo closures.
 */
export interface ScheduleItemsMirrorAccess {
  /**
   * Attach the host's on-screen store; returns the detach function (call it
   * from the effect's cleanup). Only one mirror at a time — the calendar host
   * is the single surface that keeps a range copy.
   */
  registerViewMirror: (mirror: ScheduleItemsViewMirror) => () => void;
  /**
   * The row as it is RIGHT NOW, from the anchored day or the mirror. This is
   * what an undo command captures as its "prev" — before #568 it only looked
   * at the anchored day, so every edit outside today pushed nothing and Ctrl+Z
   * sat disabled.
   */
  findItem: (id: string) => ScheduleItem | undefined;
  upsert: (item: ScheduleItem) => void;
  patch: (id: string, patch: Partial<ScheduleItem>) => void;
  remove: (id: string) => void;
  /**
   * Put a row back on screen: replace it wholesale when the caller still holds
   * the pre-mutation snapshot, otherwise patch whatever the mirror has.
   */
  restore: (
    id: string,
    snapshot: ScheduleItem | undefined,
    patch: Partial<ScheduleItem>,
  ) => void;
}

/**
 * @param itemsRef the anchored day's rows, mirrored into a ref by the host
 *   hook — read by `findItem`, whose callers are undo/redo closures that run
 *   long after the commit.
 */
export function useScheduleItemsViewMirror(
  itemsRef: RefObject<ScheduleItem[]>,
): ScheduleItemsMirrorAccess {
  // Held in a ref, not state, because its only readers are the undo/redo
  // closures — and because re-rendering every consumer when a host attaches
  // its store would buy nothing.
  const viewMirrorRef = useRef<ScheduleItemsViewMirror | null>(null);

  const registerViewMirror = useCallback((mirror: ScheduleItemsViewMirror) => {
    viewMirrorRef.current = mirror;
    return () => {
      // Guarded: a later host may have replaced it already (StrictMode
      // double-effects re-register before the first cleanup runs).
      if (viewMirrorRef.current === mirror) viewMirrorRef.current = null;
    };
  }, []);

  const findItem = useCallback(
    (id: string): ScheduleItem | undefined =>
      itemsRef.current.find((i) => i.id === id) ??
      viewMirrorRef.current?.find(id),
    [itemsRef],
  );

  const upsert = useCallback((item: ScheduleItem) => {
    viewMirrorRef.current?.upsert(item);
  }, []);

  const patch = useCallback((id: string, next: Partial<ScheduleItem>) => {
    viewMirrorRef.current?.patch(id, next);
  }, []);

  const remove = useCallback((id: string) => {
    viewMirrorRef.current?.remove(id);
  }, []);

  const restore = useCallback(
    (
      id: string,
      snapshot: ScheduleItem | undefined,
      next: Partial<ScheduleItem>,
    ) => {
      const mirror = viewMirrorRef.current;
      if (!mirror) return;
      if (snapshot) mirror.upsert({ ...snapshot, ...next });
      else mirror.patch(id, next);
    },
    [],
  );

  return useMemo(
    () => ({ registerViewMirror, findItem, upsert, patch, remove, restore }),
    [registerViewMirror, findItem, upsert, patch, remove, restore],
  );
}

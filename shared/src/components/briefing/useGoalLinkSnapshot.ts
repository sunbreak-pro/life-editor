import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataService } from "../../services/DataService";
import type { Goal, GoalTodoLink } from "../../types/goal";
import type { TodoNode } from "../../types/todoTree";
import { useSyncDomains } from "../../hooks/useSyncDomains";
import { logServiceError } from "../../utils/logError";
import {
  toGoalLinkState,
  type GoalLinkState,
  type GoalTodoPair,
} from "./goalLinkPreview";

/*
 * The data behind the linking screens (#2109): every live goal, their links,
 * and the todos those links point at — and the two writes that change them.
 *
 * The DataService arrives as a parameter (§6.4 — a shared hook never reaches
 * for the singleton); `null` means "no data source", and the hook then stays
 * empty instead of throwing, which is what a host without Supabase config
 * gets from a guarded `getDataService()`.
 *
 * Loads only while `active` (a panel is open), like useCreatePanelNotes: the
 * goal set is small, but the todo tree is not, and a host that already holds
 * the live tree passes it as `todos` so it is not read a second time.
 *
 * Writes patch the local state as each one lands, so a screen that drops its
 * draft after a save reads the new links at once rather than flickering back
 * to the old ones until the Realtime bump refetches.
 */

export type GoalLinkLoader = Pick<
  DataService,
  | "fetchGoals"
  | "fetchGoalTodoLinks"
  | "fetchTodoTree"
  | "linkGoalTodo"
  | "unlinkGoalTodo"
>;

export interface GoalLinkSnapshot {
  /** Null until the first read lands (or when there is no loader). */
  state: GoalLinkState | null;
  /**
   * Link, then unlink, one pair at a time. Rejects on the first failure; the
   * pairs written before it stay written (and patched in).
   */
  writeLinks: (
    link: readonly GoalTodoPair[],
    unlink: readonly GoalTodoPair[],
  ) => Promise<void>;
}

interface Loaded {
  goals: Goal[];
  links: GoalTodoLink[];
  tree: TodoNode[] | null;
}

const samePair = (l: GoalTodoLink, p: GoalTodoPair): boolean =>
  l.goalId === p.goalId && l.todoId === p.todoId;

export function useGoalLinkSnapshot(
  loader: GoalLinkLoader | null,
  options: { active: boolean; todos?: readonly TodoNode[] },
): GoalLinkSnapshot {
  const { active, todos } = options;
  const ownTree = todos === undefined;
  // Progress reads todos too; a host passing its live tree already follows
  // `todos` itself, so only goals are ours to watch then.
  const syncVersion = useSyncDomains(
    ...(ownTree ? (["goals", "todos"] as const) : (["goals"] as const)),
  );
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  /*
   * Write fences. A read that was in flight when a write started returns the
   * links from BEFORE it, and landing that would wipe the write's local patch
   * until the next bump (or for good, with Realtime down). So every write
   * moves the fence at its start and its end, a read lands only if the fence
   * did not move under it, and the end of a write asks for one fresh read.
   */
  const writeFenceRef = useRef(0);
  const [afterWrite, setAfterWrite] = useState(0);

  useEffect(() => {
    if (!loader || !active) return;
    let cancelled = false;
    const fence = writeFenceRef.current;
    void (async () => {
      try {
        const goals = await loader.fetchGoals();
        const [links, tree] = await Promise.all([
          goals.length > 0
            ? loader.fetchGoalTodoLinks(goals.map((g) => g.id))
            : Promise.resolve([]),
          ownTree ? loader.fetchTodoTree() : Promise.resolve(null),
        ]);
        if (!cancelled && writeFenceRef.current === fence)
          setLoaded({ goals, links, tree });
      } catch (e) {
        // The previous state stays: a failed refresh must not blank a field
        // the user is in the middle of.
        logServiceError("Goals", "load goal links", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loader, active, ownTree, syncVersion, afterWrite]);

  const state = useMemo<GoalLinkState | null>(() => {
    if (!loaded) return null;
    const tree = todos ?? loaded.tree;
    return tree ? toGoalLinkState(loaded.goals, loaded.links, tree) : null;
  }, [loaded, todos]);

  const writeLinks = useCallback(
    async (
      link: readonly GoalTodoPair[],
      unlink: readonly GoalTodoPair[],
    ): Promise<void> => {
      if (!loader) throw new Error("writeLinks: no data source");
      writeFenceRef.current += 1;
      try {
        for (const pair of link) {
          const row = await loader.linkGoalTodo(pair.goalId, pair.todoId);
          setLoaded(
            (prev) =>
              prev && {
                ...prev,
                links: [...prev.links.filter((l) => !samePair(l, pair)), row],
              },
          );
        }
        for (const pair of unlink) {
          await loader.unlinkGoalTodo(pair.goalId, pair.todoId);
          setLoaded(
            (prev) =>
              prev && {
                ...prev,
                links: prev.links.filter((l) => !samePair(l, pair)),
              },
          );
        }
      } finally {
        writeFenceRef.current += 1;
        setAfterWrite((n) => n + 1);
      }
    },
    [loader],
  );

  return { state, writeLinks };
}

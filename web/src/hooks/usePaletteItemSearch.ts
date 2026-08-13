import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CalendarDays,
  CheckSquare,
  FileText,
  type LucideIcon,
} from "lucide-react";
import {
  useSyncDomains,
  useLazyStalePool,
  useTranslation,
  searchItemPool,
  type Command,
  type DataService,
  type SearchableItem,
  type SearchableItemRole,
} from "@life-editor/shared";

/*
 * usePaletteItemSearch (#503) — the cross-item half of the command palette.
 *
 * The header field has said "検索・コマンド実行" since #306, but the palette only
 * ever matched navigation commands: typing an existing note's title answered
 * "no results". This hook is what makes the label true — it turns a query into
 * palette rows for notes / tasks / events / dailies, each of which opens its
 * item through the shell's existing item-nav route (the same one a "[[" link
 * click takes).
 *
 * WHY IT LIVES IN web/. The pool comes off the injected DataService, and every
 * surface it can open is a section of this host. `shared` keeps the two pieces
 * that are host-independent: the lazy/stale cache (useLazyStalePool) and the
 * matching (searchItemPool), both pinned by vitest.
 *
 * FETCHING IS LAZY, and stays lazy (#430's rule): nothing is read until a
 * non-empty query is typed. Opening the palette to jump to a section — by far
 * its most common use — costs no queries at all.
 */

const ROLE_ICON: Record<SearchableItemRole, LucideIcon> = {
  note: FileText,
  task: CheckSquare,
  event: Calendar,
  daily: CalendarDays,
};

/*
 * Group headings reuse the section names the nav already uses, rather than
 * minting a parallel vocabulary: a row filed under "ノート" is a row in the
 * place the sidebar calls ノート.
 */
const ROLE_LABEL_KEY: Record<SearchableItemRole, string> = {
  note: "section.notes",
  task: "section.tasks",
  event: "section.schedule",
  daily: "section.daily",
};

const EMPTY_POOL: SearchableItem[] = [];

export function usePaletteItemSearch({
  dataService,
  isOpen,
  onOpenItem,
}: {
  dataService: DataService | undefined;
  /** Palette visibility — the freshness of a session is scoped to one opening. */
  isOpen: boolean;
  /** The shell's item-nav route (section + tab switch, then a pending select). */
  onOpenItem: (target: { id: string; role: string; date?: string }) => void;
}) {
  const { t } = useTranslation();
  // Every domain this pool reads. Under-declaring here is a silent stale the
  // user has no way to fix (rules/frontend.md §Sync).
  const syncVersion = useSyncDomains("notes", "dailies", "todos", "schedule");

  const fetchPool = useCallback(async (): Promise<SearchableItem[]> => {
    if (!dataService) return EMPTY_POOL;
    const [notes, dailies, tasks, events] = await Promise.all([
      dataService.listNotesUnified(),
      dataService.listDailiesUnified(),
      dataService.fetchTodoTree(),
      dataService.fetchEvents(),
    ]);
    const pool: SearchableItem[] = [];
    for (const n of notes) {
      if (n.isDeleted) continue;
      pool.push({ id: n.id, role: "note", title: n.title || "(untitled)" });
    }
    for (const task of tasks) {
      if (task.isDeleted) continue;
      pool.push({
        id: task.id,
        role: "task",
        title: task.title || "(untitled)",
      });
    }
    for (const ev of events) {
      if (ev.isDeleted) continue;
      // The date is the detail line AND part of the match: "予定" are routinely
      // remembered by when rather than by what they were called.
      pool.push({
        id: ev.id,
        role: "event",
        title: ev.title || "(untitled)",
        detail: ev.date,
      });
    }
    for (const d of dailies) {
      if (d.isDeleted) continue;
      // A daily has no title of its own — its date IS its name.
      pool.push({ id: d.id, role: "daily", title: d.date });
    }
    return pool;
  }, [dataService]);

  const load = useLazyStalePool(
    dataService ? fetchPool : null,
    syncVersion,
    EMPTY_POOL,
  );

  const [matches, setMatches] = useState<SearchableItem[]>([]);
  // Guards against an out-of-order resolve: two queries can be in flight after
  // a fast typist outruns the first fetch, and the slower one must not paint
  // over the newer query's results.
  const querySeqRef = useRef(0);
  // First search after an opening reads fresh; the rest of that session serve
  // the cache. Without this, typing re-marks the pool stale (own writes bump
  // the sync version) and every keystroke would re-query.
  const loadedThisSessionRef = useRef(false);

  useEffect(() => {
    if (isOpen) return;
    // Closing ends the session: the next opening reads fresh once, and any
    // fetch still in flight is disowned so it cannot land on the new one.
    // Only refs here — the stale MATCHES are handled where they can be, in
    // render: the palette ignores these rows while its field is empty, which
    // is the same condition and costs no extra render.
    loadedThisSessionRef.current = false;
    querySeqRef.current++;
  }, [isOpen]);

  const handleQueryChange = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      const seq = ++querySeqRef.current;
      if (trimmed === "") {
        setMatches([]);
        return;
      }
      const allowStale = loadedThisSessionRef.current;
      loadedThisSessionRef.current = true;
      void load({ allowStale }).then((pool) => {
        if (seq !== querySeqRef.current) return;
        setMatches(searchItemPool(pool, trimmed));
      });
    },
    [load],
  );

  const results = useMemo<Command[]>(
    () =>
      matches.map((item) => ({
        // Namespaced so an item id can never collide with a command id.
        id: `item-${item.role}-${item.id}`,
        title: item.detail ? `${item.title} — ${item.detail}` : item.title,
        category: t(ROLE_LABEL_KEY[item.role], { defaultValue: item.role }),
        icon: ROLE_ICON[item.role],
        // `detail` is the event's date, which the Calendar needs to move its
        // window to before a selection means anything. It is undefined for the
        // other roles, whose destinations show one list of everything.
        action: () =>
          onOpenItem({ id: item.id, role: item.role, date: item.detail }),
      })),
    [matches, t, onOpenItem],
  );

  return { results, handleQueryChange };
}

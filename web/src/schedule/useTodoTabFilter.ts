import { useCallback, useMemo, useState } from "react";
import {
  buildTagMemberIds,
  type CalendarMemberAssignment,
  type TodayTodoAddableRow,
  type TodayTodoRow,
} from "@life-editor/shared";

/*
 * The Todo tab's own filter (#1641).
 *
 * Two axes, ANDed: which of the two lists to show ("区分"), and which tags a
 * row must carry. Tags are ORed among themselves — the same rule the calendar's
 * tag lens follows, and the same helper decides membership
 * (`buildTagMemberIds`), so "carries this tag" cannot come to mean two things
 * in one section.
 *
 * Deliberately NOT wired to `useScheduleGridFilters` (ユーザー確認済みの仮定):
 * that state narrows what the GRID draws, and the tray is a different question
 * on a different surface — filtering the tray to read a list should not empty
 * the calendar beside it, and vice versa.
 *
 * The rows and the assignments arrive from the host; this hook only decides
 * which rows survive. Keeping the context out of it is what lets the sidebar
 * stay Provider-free (its suite renders it with none) and what makes this
 * testable without a calendar.
 */

export type TodoTabScope = "both" | "today" | "other";

export interface TodoTabFilterRows {
  placed: TodayTodoRow[];
  unplaced: TodayTodoRow[];
  addable: TodayTodoAddableRow[];
}

export interface TodoTabFilter {
  scope: TodoTabScope;
  setScope: (scope: TodoTabScope) => void;
  tagIds: string[];
  toggleTag: (tagId: string) => void;
  clear: () => void;
  /** How many things are narrowing the list — the number on the button. */
  activeCount: number;
  /** Whether the today list / the "other" list is drawn at all. */
  showToday: boolean;
  showOther: boolean;
  /** Narrow the host's rows. Identity-safe: an inactive filter returns the same arrays. */
  apply: (rows: TodoTabFilterRows) => TodoTabFilterRows;
}

export function useTodoTabFilter(
  allAssignments: readonly CalendarMemberAssignment[],
): TodoTabFilter {
  const [scope, setScope] = useState<TodoTabScope>("both");
  const [tagIds, setTagIds] = useState<string[]>([]);

  const toggleTag = useCallback((tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  const clear = useCallback(() => {
    setScope("both");
    setTagIds([]);
  }, []);

  // The ids carrying ANY of the ticked tags. Null while nothing is ticked, so
  // the identity case below can return the host's own arrays.
  const memberIds = useMemo(
    () =>
      tagIds.length === 0 ? null : buildTagMemberIds(allAssignments, tagIds),
    [allAssignments, tagIds],
  );

  const showToday = scope !== "other";
  const showOther = scope !== "today";

  const apply = useCallback(
    (rows: TodoTabFilterRows): TodoTabFilterRows => {
      const keep = <T extends { id: string }>(list: T[], visible: boolean) => {
        if (!visible) return [];
        if (!memberIds) return list;
        return list.filter((row) => memberIds.has(row.id));
      };
      return {
        placed: keep(rows.placed, showToday),
        unplaced: keep(rows.unplaced, showToday),
        addable: keep(rows.addable, showOther),
      };
    },
    [memberIds, showToday, showOther],
  );

  return {
    scope,
    setScope,
    tagIds,
    toggleTag,
    clear,
    // The 区分 counts as ONE thing narrowing the list however it is set, the
    // same way the calendar's badge counts a group as the tags it expands to
    // rather than as "a group" (#1639).
    activeCount: (scope === "both" ? 0 : 1) + tagIds.length,
    showToday,
    showOther,
    apply,
  };
}

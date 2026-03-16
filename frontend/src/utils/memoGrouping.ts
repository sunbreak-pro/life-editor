import type { MemoNode } from "../types/memo";

export interface MemoMonthGroup {
  monthKey: string;
  memos: MemoNode[];
}

export function groupMemosByMonth(memos: MemoNode[]): MemoMonthGroup[] {
  const map = new Map<string, MemoNode[]>();
  for (const memo of memos) {
    const monthKey = memo.date.slice(0, 7);
    const group = map.get(monthKey);
    if (group) {
      group.push(memo);
    } else {
      map.set(monthKey, [memo]);
    }
  }

  const groups: MemoMonthGroup[] = [];
  for (const [monthKey, groupMemos] of map) {
    groupMemos.sort((a, b) => b.date.localeCompare(a.date));
    groups.push({ monthKey, memos: groupMemos });
  }

  groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return groups;
}

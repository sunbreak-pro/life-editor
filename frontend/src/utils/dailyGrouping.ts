import type { DailyNode } from "../types/daily";

export interface DailyMonthGroup {
  monthKey: string;
  dailies: DailyNode[];
}

export function groupDailiesByMonth(dailies: DailyNode[]): DailyMonthGroup[] {
  const map = new Map<string, DailyNode[]>();
  for (const memo of dailies) {
    const monthKey = memo.date.slice(0, 7);
    const group = map.get(monthKey);
    if (group) {
      group.push(memo);
    } else {
      map.set(monthKey, [memo]);
    }
  }

  const groups: DailyMonthGroup[] = [];
  for (const [monthKey, groupMemos] of map) {
    groupMemos.sort((a, b) => b.date.localeCompare(a.date));
    groups.push({ monthKey, dailies: groupMemos });
  }

  groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return groups;
}

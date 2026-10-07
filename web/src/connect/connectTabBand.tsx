import type { HeaderTab } from "@life-editor/shared";
import type { TabBand } from "../MainScreen";
import type { ConnectTab } from "../hooks/useShellNavigation";
import { ConnectHeaderCounts } from "./ConnectHeaderCounts";

/**
 * Connect's header band: タグ / 目標と Todo (#2108), with the tag hub's totals
 * beside the tabs. The band replaces the section's title row, and with it the
 * subtitle those totals used to sit in (plan Risks), so they ride in the
 * band's `trailing` slot instead.
 *
 * The totals are the tag hub's numbers, so they show on the Tags tab only:
 * the hub reports them and clears them on unmount, which is what the Goals
 * tab does to it. Built here rather than inline in MainScreen so
 * web/tests/connectTabs.test.tsx renders the very band the shell does.
 */
export function connectTabBand({
  defs,
  active,
  onSelect,
  label,
  counts,
}: {
  defs: HeaderTab[];
  active: ConnectTab;
  onSelect: (tab: ConnectTab) => void;
  label: string;
  counts: { tags: number; items: number } | null;
}): TabBand {
  return {
    defs,
    active,
    onSelect: (id) => onSelect(id as ConnectTab),
    label,
    trailing: <ConnectHeaderCounts counts={counts} />,
  };
}

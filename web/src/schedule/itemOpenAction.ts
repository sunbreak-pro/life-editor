import { ArrowUpRight, CalendarSearch, type LucideIcon } from "lucide-react";

/*
 * What a link's "open" button says, and with which icon, by the kind of item it
 * goes to (#2393, Claude Design's B4). A todo or an event says 「予定で見る」,
 * because the button lands on the calendar with a mark on the item; a note or a
 * daily simply opens.
 *
 * In its own file so the link panel (#2392) and OpenInScheduleButton read one
 * answer. The label comes back as a key because i18n is resolved by the caller
 * (§6.4), and the keys stay literal so the catalog scan (i18nKeys.test.ts) can
 * see them.
 */

export const OPEN_IN_SCHEDULE_ICON: LucideIcon = CalendarSearch;

export interface ItemOpenAction {
  labelKey: "scheduleScreen.openInSchedule" | "materials.links.openAction";
  icon: LucideIcon;
}

/** The action for a role, or null for a role a link cannot open. */
export function itemOpenAction(role: string): ItemOpenAction | null {
  switch (role) {
    case "task":
    case "event":
      return {
        labelKey: "scheduleScreen.openInSchedule",
        icon: OPEN_IN_SCHEDULE_ICON,
      };
    case "note":
    case "daily":
      return { labelKey: "materials.links.openAction", icon: ArrowUpRight };
    default:
      return null;
  }
}

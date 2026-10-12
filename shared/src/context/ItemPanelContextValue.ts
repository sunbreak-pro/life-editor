import { createContext } from "react";

/*
 * ItemPanel context value — Pattern A 1/3 (#2218).
 *
 * The one way a screen OTHER than Schedule opens the Schedule's event / todo
 * editor, or its creation panel, on top of itself. Before this, the only
 * route was `navigateToItem`, which leaves the screen the user was reading.
 *
 * Pure UI state: what was asked for, nothing else. The panels themselves need
 * the Schedule section's Providers and its host-side wiring, which live in
 * `web/`, so the host that draws them (web/src/schedule/ItemPanelHost.tsx)
 * reads `request` from here. This file carries no DataService (§3.1).
 */

/** What to edit. A routine occurrence and an all-day item are both "event". */
export type ItemPanelEditTarget =
  | {
      role: "event";
      id: string;
      /**
       * The day the row is on (YYYY-MM-DD). The host loads that day to find
       * the row, the same window the Schedule grid would have loaded.
       */
      date: string;
    }
  | { role: "task"; id: string };

/** Handed to `onOpenInSchedule`: the item, and the day to show it on. */
export interface ItemPanelScheduleTarget {
  id: string;
  role: "event" | "task";
  /** The row's day; null for a todo that is set for no day. */
  date: string | null;
}

export interface ItemPanelOptions {
  /**
   * Given, the panel shows 「予定の画面で開く」. The panel closes first (after
   * the unsaved-draft question) and then this is called, so the caller decides
   * how to get there — the shell's navigation is web's, not this context's.
   */
  onOpenInSchedule?: (target: ItemPanelScheduleTarget) => void;
  /** Where a "[[" link inside a todo body goes. Absent = clicks are inert. */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
}

/** Seeds the creation panel. Times default to the panel's own 09:00–10:00. */
export interface ItemPanelCreateInitial {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM. */
  start?: string;
  /** HH:MM. */
  end?: string;
}

export type ItemPanelRequest =
  | {
      mode: "edit";
      target: ItemPanelEditTarget;
      options: ItemPanelOptions;
      /** Bumps on every open, so a second open of the same item remounts. */
      seq: number;
    }
  | {
      mode: "create";
      initial: ItemPanelCreateInitial;
      options: ItemPanelOptions;
      seq: number;
    };

export interface ItemPanelContextValue {
  /** The open request, or null when no panel is up. */
  request: ItemPanelRequest | null;
  /** Open the editor for one event or todo, over the calling screen. */
  openEdit: (target: ItemPanelEditTarget, options?: ItemPanelOptions) => void;
  /** Open the creation panel, over the calling screen. */
  openCreate: (
    initial: ItemPanelCreateInitial,
    options?: ItemPanelOptions,
  ) => void;
  /** Drop the request. The host calls it once every panel it drew is shut. */
  close: () => void;
}

export const ItemPanelContext = createContext<ItemPanelContextValue | null>(
  null,
);

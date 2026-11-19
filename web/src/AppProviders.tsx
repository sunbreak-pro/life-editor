import type { ComponentProps, ReactNode } from "react";
import {
  useTranslation,
  ItemPanelProvider,
  RightSidebarProvider,
  ShortcutConfigProvider,
  SyncProvider,
  ToastProvider,
  type DataService,
} from "@life-editor/shared";
import { DailyMergeNotice } from "./components/DailyMergeNotice";
import { GlobalShortcuts } from "./GlobalShortcuts";
import { ItemPanelHost } from "./schedule/ItemPanelHost";
import { MaterialsCountsBridge } from "./MaterialsCountsBridge";
import { OutboxNoticeHost } from "./components/OutboxNoticeHost";
import { ScheduleReminderBridge } from "./ScheduleReminderBridge";
import { UndoRedoHost } from "./UndoRedoHost";

/*
 * The web host's global Provider chain (#676 (a)).
 *
 * Everything here is mounted ONCE, above the section switch, and stays
 * mounted for the life of the session — that is the property that makes it a
 * unit worth naming. The section-layer Providers (Materials' tag/todo/note
 * trees, Schedule's calendar/routine stack) are the
 * opposite: they live in the descriptor rows and are torn down on navigation.
 * Splitting the two apart is what lets MainScreen read as "chrome + shell"
 * instead of a 160-line staircase with the shell buried at the bottom.
 *
 * ORDER IS A DEPENDENCY GRAPH, not a preference (rules/frontend.md §Provider
 * 順序 — outer may not read inner):
 *
 *   Toast → Sync → UndoRedo → ShortcutConfig → RightSidebar → ItemPanel
 *
 * - Sync is above everything that reads `useSyncDomains`, and is mounted once
 *   rather than per-section: a per-section mount would tear down and rebuild
 *   the Supabase Realtime channel on every navigation.
 * - RightSidebar wraps the shell AND the shell-level siblings the host
 *   renders as `children`, so all of them sit inside it.
 * - ItemPanel (#2218) is innermost: the screens that open the Schedule's
 *   editor from outside it (Briefing, Connect) are inside the section switch,
 *   and its host draws that editor with the Toast / Sync / UndoRedo it reads.
 *   The host is a sibling of the shell rather than inside a section, so the
 *   panel survives nothing but its own close.
 *
 * Three headless bridges are interleaved rather than hoisted, because each has
 * to sit inside a specific Provider: MaterialsCountsBridge refetches on
 * Realtime bumps (needs Sync), ScheduleReminderBridge sweeps for due event
 * reminders and so needs BOTH Sync and Toast, and GlobalShortcuts reads the
 * live, rebindable config (needs ShortcutConfig). They take their props
 * through this component precisely so callers cannot mount them at the wrong
 * depth — and the reminder one has to be GLOBAL rather than section-layer, or
 * it would stop firing the moment the user left Schedule.
 */
export interface AppProvidersProps {
  /** Injected into every Provider that talks to the backend (§6.4). */
  dataService: DataService;
  /**
   * Materials tab count badges. Typed off the bridge so the two cannot drift
   * — this component only decides WHERE the bridge hangs, never its shape.
   */
  onMaterialsCounts: ComponentProps<typeof MaterialsCountsBridge>["onCounts"];
  /** Forwarded verbatim to the headless global shortcut executor. */
  shortcuts: ComponentProps<typeof GlobalShortcuts>;
  /** Signed-in account id, handed to the UndoRedo host (#1727). */
  userId: string;
  /** The shell and its shell-level siblings. */
  children: ReactNode;
}

export function AppProviders({
  dataService,
  onMaterialsCounts,
  shortcuts,
  userId,
  children,
}: AppProvidersProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ToastProvider dismissLabel={t("common.close")}>
      <SyncProvider>
        <OutboxNoticeHost />
        <DailyMergeNotice />
        <MaterialsCountsBridge
          dataService={dataService}
          onCounts={onMaterialsCounts}
        />
        <ScheduleReminderBridge dataService={dataService} />
        <UndoRedoHost userId={userId}>
          <ShortcutConfigProvider>
            <GlobalShortcuts {...shortcuts} />
            <RightSidebarProvider>
              <ItemPanelProvider>
                {children}
                <ItemPanelHost dataService={dataService} />
              </ItemPanelProvider>
            </RightSidebarProvider>
          </ShortcutConfigProvider>
        </UndoRedoHost>
      </SyncProvider>
    </ToastProvider>
  );
}

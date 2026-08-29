import type { ComponentProps, ReactNode } from "react";
import {
  isNativeMobile,
  useTranslation,
  AudioProvider,
  RightSidebarProvider,
  ShortcutConfigProvider,
  SyncProvider,
  ToastProvider,
  TourProvider,
  type DataService,
  type SectionId,
} from "@life-editor/shared";
import { GlobalShortcuts } from "./GlobalShortcuts";
import { MaterialsCountsBridge } from "./MaterialsCountsBridge";
import { TimerHost } from "./TimerHost";
import { UndoRedoHost } from "./UndoRedoHost";

/*
 * The web host's global Provider chain (#676 (a)).
 *
 * Everything here is mounted ONCE, above the section switch, and stays
 * mounted for the life of the session — that is the property that makes it a
 * unit worth naming. The section-layer Providers (Materials' tag/todo/note
 * trees, Schedule's calendar/routine stack, Analytics' filter) are the
 * opposite: they live in the descriptor rows and are torn down on navigation.
 * Splitting the two apart is what lets MainScreen read as "chrome + shell"
 * instead of a 160-line staircase with the shell buried at the bottom.
 *
 * ORDER IS A DEPENDENCY GRAPH, not a preference (rules/frontend.md §Provider
 * 順序 — outer may not read inner):
 *
 *   Toast → Sync → UndoRedo → ShortcutConfig → Audio → Timer → RightSidebar
 *
 * - Sync is above everything that reads `useSyncDomains`, and is mounted once
 *   rather than per-section: a per-section mount would tear down and rebuild
 *   the Supabase Realtime channel on every navigation.
 * - Audio is OUTSIDE Timer because the Pomodoro's completion chime is Audio's
 *   to play — since #676 (c) that dependency runs inward like every other
 *   pair, and the old `chimeRef` + AudioChimeBridge back-channel is gone.
 * - RightSidebar is innermost so the shell AND the palette/tag-editor
 *   siblings the host renders as `children` all sit inside it.
 * - Tour (#1122) sits inside RightSidebar, i.e. innermost of all: nothing
 *   reads it, it reads the section switch the host passes down, and its
 *   overlay is a shell-level sibling of the palette. It is GLOBAL rather than
 *   section-layer because a tour crosses sections — a section-layer Provider
 *   is unmounted by the very navigation the tour asks for. It is also above
 *   the sections themselves, which is what lets Settings' Tutorial card
 *   (#1123) reach `restart` from inside the section switch.
 *
 * Two headless bridges are interleaved rather than hoisted, because each has
 * to sit inside a specific Provider: MaterialsCountsBridge refetches on
 * Realtime bumps (needs Sync) and GlobalShortcuts reads the live, rebindable
 * config (needs ShortcutConfig). They take their props through this
 * component precisely so callers cannot mount them at the wrong depth.
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
  /** The section on screen right now — the tour needs it to know whether its
   *  next step is reachable from here (#1122). */
  currentSection: SectionId;
  /** Section switch, handed to the tour so it can walk across sections.
   *  Shared must not import web's navigation, so it arrives as a prop. */
  onNavigateToSection: (section: SectionId) => void;
  /** The shell and its shell-level siblings (palette, tag editor). */
  children: ReactNode;
}

export function AppProviders({
  dataService,
  onMaterialsCounts,
  shortcuts,
  currentSection,
  onNavigateToSection,
  children,
}: AppProvidersProps) {
  const { t } = useTranslation();

  return (
    <ToastProvider dismissLabel={t("common.close")}>
      <SyncProvider>
        <MaterialsCountsBridge
          dataService={dataService}
          onCounts={onMaterialsCounts}
        />
        <UndoRedoHost>
          <ShortcutConfigHost>
            <GlobalShortcuts {...shortcuts} />
            <AudioProvider dataService={dataService}>
              <TimerHost dataService={dataService}>
                <RightSidebarProvider>
                  <TourProvider
                    currentSection={currentSection}
                    onNavigateToSection={onNavigateToSection}
                    // #1123: the tour offers itself on first run. "First run"
                    // is the Provider's own persisted state — it stays quiet
                    // once the tour has been finished or skipped, and Settings'
                    // Tutorial card is what brings it back after that.
                    autoStart
                  >
                    {children}
                  </TourProvider>
                </RightSidebarProvider>
              </TimerHost>
            </AudioProvider>
          </ShortcutConfigHost>
        </UndoRedoHost>
      </SyncProvider>
    </ToastProvider>
  );
}

/*
 * Mobile 省略 Provider gate (#320 — CLAUDE.md §2). The SAME web bundle ships
 * to browser / Electron / Capacitor, so the omission is a runtime decision:
 * on the native mobile shells (`isNativeMobile()` — window.Capacitor present)
 * this renders children WITHOUT the Provider. Consumers stay safe because the
 * context exposes an OPTIONAL hook (useShortcutConfig → null outside a
 * Provider, coding-principles §4): the shortcut executor goes inert and
 * Settings hides the Shortcuts card. `isNativeMobile()` reads a runtime global
 * that never changes within a page load, so evaluating it during render is
 * stable (no reactivity needed).
 *
 * AudioProvider is deliberately NOT gated: the Pomodoro completion chime is
 * part of the Mobile-Full work timer (mobile-scope.md #10/#11 — user-confirmed
 * #319), so the Provider stays mounted everywhere and only the ambient-mixer
 * UI is native-omitted, inside WorkScreen.
 */
function ShortcutConfigHost({ children }: { children: ReactNode }) {
  if (isNativeMobile()) return <>{children}</>;
  return <ShortcutConfigProvider>{children}</ShortcutConfigProvider>;
}

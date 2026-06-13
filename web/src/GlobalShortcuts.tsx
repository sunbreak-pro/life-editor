import {
  useGlobalShortcuts,
  useShortcutConfig,
  type NavSection,
} from "@life-editor/shared";

/*
 * Headless global-shortcut wiring (W3-0 / W3-B).
 *
 * ShortcutConfigProvider is mounted inside MainScreen's JSX (just under
 * SyncProvider), so MainScreen's own body can't read useShortcutConfig. This
 * tiny child sits INSIDE that Provider and bridges the gap: it reads the
 * (rebindable) config via the optional hook and hands it, plus the host
 * callbacks, to the shared useGlobalShortcuts executor.
 *
 * Renders nothing — it only installs the window keydown listener. Callbacks are
 * injected as props (CLAUDE.md §6.4). `onNewTask` is wired in W3-B (the host
 * navigates to the Tasks section — see MainScreen). undo / redo still have no
 * web surface (no UndoRedo on web yet), so they're left unwired = no-op until
 * W4.
 */
export function GlobalShortcuts({
  onNavigate,
  onOpenSettings,
  onTogglePalette,
  onNewTask,
}: {
  onNavigate: (section: NavSection) => void;
  onOpenSettings: () => void;
  onTogglePalette: () => void;
  onNewTask?: () => void;
}) {
  const shortcutConfig = useShortcutConfig();
  useGlobalShortcuts(shortcutConfig, {
    onNavigate,
    onOpenSettings,
    onTogglePalette,
    onNewTask,
    // undo / redo: no web handler yet (W4).
  });
  return null;
}

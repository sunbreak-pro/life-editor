import {
  useGlobalShortcuts,
  useShortcutConfig,
  type NavSection,
} from "@life-editor/shared";

/*
 * Headless global-shortcut wiring (W3-0).
 *
 * ShortcutConfigProvider is mounted inside MainScreen's JSX (just under
 * SyncProvider), so MainScreen's own body can't read useShortcutConfig. This
 * tiny child sits INSIDE that Provider and bridges the gap: it reads the
 * (rebindable) config via the optional hook and hands it, plus the host
 * callbacks, to the shared useGlobalShortcuts executor.
 *
 * Renders nothing — it only installs the window keydown listener. Callbacks are
 * injected as props (CLAUDE.md §6.4). new-task / undo / redo have no web
 * surface yet, so they're intentionally left unwired here (no-op) until
 * W3-B / W4.
 */
export function GlobalShortcuts({
  onNavigate,
  onOpenSettings,
  onTogglePalette,
}: {
  onNavigate: (section: NavSection) => void;
  onOpenSettings: () => void;
  onTogglePalette: () => void;
}) {
  const shortcutConfig = useShortcutConfig();
  useGlobalShortcuts(shortcutConfig, {
    onNavigate,
    onOpenSettings,
    onTogglePalette,
    // new-task / undo / redo: no web handler yet (W3-B / W4).
  });
  return null;
}

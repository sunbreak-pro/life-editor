import {
  useGlobalShortcuts,
  useShortcutConfig,
  useUndoRedoOptional,
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
 * navigates to the Tasks section — see MainScreen). undo / redo (#304) route
 * through the ambient global UndoRedo context (⌘Z / ⌘⇧Z; the shared executor
 * already skips text fields / contentEditable and IME composition, so TipTap
 * keeps its own history). No provider mounted → left as no-op.
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
  const undoRedo = useUndoRedoOptional();
  useGlobalShortcuts(shortcutConfig, {
    onNavigate,
    onOpenSettings,
    onTogglePalette,
    onNewTask,
    // #304: app-level undo/redo via the ambient global stack (null → no-op).
    onUndo: undoRedo ? () => undoRedo.undo() : undefined,
    onRedo: undoRedo ? () => undoRedo.redo() : undefined,
  });
  return null;
}

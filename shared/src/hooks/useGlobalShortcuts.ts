import { useEffect } from "react";
import type { ShortcutId } from "../types/shortcut";
import type { ShortcutConfigContextValue } from "../context/ShortcutConfigContextValue";
import { DEFAULT_SHORTCUTS } from "../constants/defaultShortcuts";

/*
 * Global shortcut executor (W3-0). W1 shipped the ShortcutConfig settings UI
 * (rebind / conflict / reset) but never wired the keydown side — pressing a
 * binding did nothing. This headless hook closes that gap: it listens on
 * `window` and, for each live ShortcutId, asks the (rebindable) config whether
 * the event matches, then fires the host-injected callback.
 *
 * It reads the binding through `shortcutConfig.matchEvent` (NOT a captured
 * snapshot), so a rebind in Settings takes effect immediately — the matcher
 * always consults the current override → default chain.
 *
 * ShortcutConfig is a Mobile 省略 Provider (CLAUDE.md §2). The host passes the
 * value from the OPTIONAL `useShortcutConfig` hook, which is `null` when no
 * Provider is mounted; in that case this hook is inert (no listener attached).
 *
 * Callbacks are injected per CLAUDE.md §6.4 (no getDataService / no
 * useTranslation inside shared hooks). Handlers without a web surface yet
 * (new-task / undo / redo) are optional; the host wires them in W3-B / W4.
 */

/** Host-injected actions, keyed by intent. All optional → unmapped = no-op. */
export interface GlobalShortcutHandlers {
  /** global:command-palette — toggle the command palette. */
  onTogglePalette?: () => void;
  /** global:settings — open the Settings section. */
  onOpenSettings?: () => void;
  /** global:new-task — start a new task (no web surface yet; W3-B/W4). */
  onNewTask?: () => void;
  /** nav:* — switch to the given section. The string is the web Section id. */
  onNavigate?: (section: NavSection) => void;
  /** edit:undo — undo (no web surface yet; W3-B/W4). */
  onUndo?: () => void;
  /** edit:redo — redo (no web surface yet; W3-B/W4). */
  onRedo?: () => void;
}

/** Section ids the nav:* shortcuts map to (web MainScreen sections). */
export type NavSection = "tasks" | "daily" | "notes" | "schedule" | "tags";

/** nav:* ShortcutId → web Section id. */
const NAV_TARGET: Record<string, NavSection> = {
  "nav:tasks": "tasks",
  "nav:daily": "daily",
  "nav:notes": "notes",
  "nav:schedule": "schedule",
  "nav:tags": "tags",
};

/**
 * Is the event currently inside an editable field (input / textarea /
 * contentEditable)? Pure + DOM-light so it can be unit-tested with a stub
 * target. Used to suppress bare (modifier-less) shortcuts like "n" while the
 * user is typing — accelerator shortcuts (⌘…) still fire (handled by the
 * caller via `hasAccelerator`).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // jsdom leaves isContentEditable undefined on plain elements; coerce to bool.
  return target.isContentEditable === true;
}

/** Does the event hold an accelerator modifier (meta or ctrl)? */
export function hasAccelerator(
  e: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
): boolean {
  return e.metaKey || e.ctrlKey;
}

/**
 * QA-W3A申し送り #2 — single source of truth for the input-focus guard.
 * The guard used to infer "fires while typing" from `hasAccelerator(e)`,
 * which DUPLICATED the per-shortcut `activeInInput` flag carried on each
 * ShortcutDefinition (the flag was effectively dead — nothing read it at
 * dispatch time). The two could silently drift: rebind an `activeInInput:
 * true` shortcut onto a bare key and the hardcoded accelerator-inference
 * would have wrongly suppressed it inside inputs.
 *
 * The resolver is now flag-driven: it asks `isActiveInInput(id)` whether the
 * matched shortcut may fire while a field is focused. For the default set the
 * behaviour is identical (every accelerator shortcut is activeInInput:true,
 * every bare-key shortcut is false), so this is a no-op for current bindings
 * but removes the drift hazard and makes the definition flag load-bearing.
 */
export function isActiveInInput(id: ShortcutId): boolean {
  return DEFAULT_SHORTCUTS.find((s) => s.id === id)?.activeInInput ?? false;
}

/**
 * Resolve a keyboard event to the first matching ShortcutId, applying the
 * input-focus guard. Pure (besides the injected matcher) so the dispatch logic
 * is unit-testable without a real DOM:
 *  - IME composing → null (caller also guards, defence in depth)
 *  - editable target + the matched shortcut is NOT activeInInput → null
 *    (don't steal "n" while typing)
 *  - otherwise the first id whose binding matches
 *
 * `activeInInput` defaults to {@link isActiveInInput} (definition-driven) but
 * is injectable for tests / non-default configs.
 */
export function resolveShortcut(
  e: Pick<
    KeyboardEvent,
    | "key"
    | "code"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "altKey"
    | "isComposing"
  >,
  target: EventTarget | null,
  ids: readonly ShortcutId[],
  matchEvent: (e: KeyboardEvent, id: ShortcutId) => boolean,
  activeInInput: (id: ShortcutId) => boolean = isActiveInInput,
): ShortcutId | null {
  if (e.isComposing) return null;
  const editable = isEditableTarget(target);
  for (const id of ids) {
    if (!matchEvent(e as KeyboardEvent, id)) continue;
    // Inside a field, only shortcuts declared activeInInput may fire.
    if (editable && !activeInInput(id)) return null;
    return id;
  }
  return null;
}

/** ShortcutIds this executor dispatches, in match-priority order. */
const DISPATCH_ORDER: readonly ShortcutId[] = [
  "global:command-palette",
  "global:settings",
  "global:new-task",
  "nav:tasks",
  "nav:daily",
  "nav:notes",
  "nav:schedule",
  "nav:tags",
  "edit:redo",
  "edit:undo",
];

/**
 * Wire the global keydown executor. Inert when `shortcutConfig` is null (no
 * Provider — Mobile). Re-subscribes when the config or handlers change so a
 * rebind / new callback is picked up. The matcher reads the live config, so
 * rebinds in Settings apply without a remount.
 */
export function useGlobalShortcuts(
  shortcutConfig: ShortcutConfigContextValue | null,
  handlers: GlobalShortcutHandlers,
): void {
  const {
    onTogglePalette,
    onOpenSettings,
    onNewTask,
    onNavigate,
    onUndo,
    onRedo,
  } = handlers;

  useEffect(() => {
    if (!shortcutConfig) return;
    const matchEvent = shortcutConfig.matchEvent;

    const onKeyDown = (e: KeyboardEvent) => {
      const id = resolveShortcut(e, e.target, DISPATCH_ORDER, matchEvent);
      if (!id) return;

      switch (id) {
        case "global:command-palette":
          if (!onTogglePalette) return;
          e.preventDefault();
          onTogglePalette();
          return;
        case "global:settings":
          if (!onOpenSettings) return;
          e.preventDefault();
          onOpenSettings();
          return;
        case "global:new-task":
          // No web surface yet — wired in W3-B / W4.
          if (!onNewTask) return;
          e.preventDefault();
          onNewTask();
          return;
        case "nav:tasks":
        case "nav:daily":
        case "nav:notes":
        case "nav:schedule":
        case "nav:tags":
          if (!onNavigate) return;
          e.preventDefault();
          onNavigate(NAV_TARGET[id]);
          return;
        case "edit:undo":
          // No web surface yet — wired in W3-B / W4.
          if (!onUndo) return;
          e.preventDefault();
          onUndo();
          return;
        case "edit:redo":
          // No web surface yet — wired in W3-B / W4.
          if (!onRedo) return;
          e.preventDefault();
          onRedo();
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    shortcutConfig,
    onTogglePalette,
    onOpenSettings,
    onNewTask,
    onNavigate,
    onUndo,
    onRedo,
  ]);
}

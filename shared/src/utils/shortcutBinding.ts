import type { KeyBinding } from "../types/shortcut";

/*
 * Pure keybinding helpers (W1). Extracted from ShortcutConfigContext so the
 * display / match / conflict logic is unit-testable without React (the
 * Context just wires these to localStorage-backed state). Ported from the
 * FROZEN frontend, web-lean.
 */

const CODE_LABELS: Record<string, string> = {
  KeyD: "D",
  KeyJ: "J",
  KeyK: "K",
  KeyN: "N",
  KeyT: "T",
  KeyW: "W",
  KeyZ: "Z",
  Comma: ",",
  Period: ".",
  Enter: "Enter",
  Backquote: "`",
};

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Tab: "Tab",
  Enter: "Enter",
};

/** Render a binding as a human-readable accelerator, e.g. "⌘ + K". */
export function bindingToDisplayString(
  binding: KeyBinding,
  mac: boolean,
): string {
  const parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.meta) parts.push(mac ? "⌘" : "Ctrl");
  if (binding.shift) parts.push(mac ? "⇧" : "Shift");
  if (binding.alt) parts.push(mac ? "⌥" : "Alt");

  if (binding.code) {
    parts.push(CODE_LABELS[binding.code] ?? binding.code.replace(/^Key/, ""));
  } else if (binding.key) {
    parts.push(KEY_LABELS[binding.key] ?? binding.key.toUpperCase());
  }

  return parts.join(" + ");
}

/** Does a keyboard event satisfy the binding (modifiers + key/code)? */
export function matchBinding(
  e: Pick<
    KeyboardEvent,
    "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
  >,
  binding: KeyBinding,
): boolean {
  if (binding.ctrl) {
    if (!e.ctrlKey) return false;
  } else {
    const mod = e.metaKey || e.ctrlKey;
    if (binding.meta && !mod) return false;
    if (!binding.meta && mod) return false;
  }
  if (binding.shift && !e.shiftKey) return false;
  if (!binding.shift && e.shiftKey) return false;
  if (binding.alt && !e.altKey) return false;
  if (!binding.alt && e.altKey) return false;

  if (binding.code) {
    return e.code === binding.code;
  }
  if (binding.key) {
    return e.key === binding.key;
  }
  return false;
}

/** Structural equality of two bindings (undefined modifiers === false). */
export function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  return (
    (a.key ?? "") === (b.key ?? "") &&
    (a.code ?? "") === (b.code ?? "") &&
    !!a.meta === !!b.meta &&
    !!a.ctrl === !!b.ctrl &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  );
}

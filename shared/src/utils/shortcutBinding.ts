import type { KeyBinding } from "../types/shortcut";

/*
 * Pure keybinding helpers (W1). Extracted from ShortcutConfigContext so the
 * display / match / conflict logic is unit-testable without React (the
 * Context just wires these to localStorage-backed state). Ported from the
 * FROZEN frontend, web-lean.
 */

/*
 * Physical `code` values whose printed label is NOT the code with its
 * `Key` / `Digit` prefix removed. Letters and digits are handled by the
 * generic rule in `codeToLabel` rather than listed one by one.
 */
const CODE_LABELS: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Space: "Space",
  Enter: "Enter",
  NumpadEnter: "Enter",
  Tab: "Tab",
};

/**
 * The label printed on the physical key a `code` names: `KeyA` -> "A",
 * `Digit9` -> "9", `Numpad9` -> "9", `Comma` -> ",".
 *
 * Rebinding stores `KeyboardEvent.code` (eventToBinding) while the nav
 * DEFAULTS store `key: "1"`..., so before #1483 a rebound digit rendered as
 * the raw code ("Ctrl Digit9") one row below a default rendered as "Ctrl 1".
 * Both sides go through here now.
 */
function codeToLabel(code: string): string {
  const named = CODE_LABELS[code];
  if (named) return named;
  const stripped = code.replace(/^(?:Key|Digit|Numpad(?=\d))/, "");
  return stripped || code;
}

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
    parts.push(codeToLabel(binding.code));
  } else if (binding.key) {
    parts.push(KEY_LABELS[binding.key] ?? binding.key.toUpperCase());
  }

  return parts.join(" + ");
}

/**
 * Build a KeyBinding from a keyboard event (W3-0). Inverse of matchBinding:
 * captures the held modifiers + the physical `code`, so the result round-trips
 * through matchBinding for the same event. `code` is preferred (matchBinding /
 * bindingToDisplayString both consult `code` first); `key` is left unset so the
 * binding is layout-independent like the DEFAULT_SHORTCUTS code-based entries.
 * The web model treats meta/ctrl as one accelerator (matchBinding does too), so
 * either physical modifier maps to `meta: true`.
 */
export function eventToBinding(
  e: Pick<
    KeyboardEvent,
    "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
  >,
): KeyBinding {
  const binding: KeyBinding = {};
  if (e.metaKey || e.ctrlKey) binding.meta = true;
  if (e.shiftKey) binding.shift = true;
  if (e.altKey) binding.alt = true;
  if (e.code) {
    binding.code = e.code;
  } else if (e.key) {
    binding.key = e.key;
  }
  return binding;
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

/**
 * The physical key a binding names, as one comparable token: `Digit2` and
 * `key: "2"` both reduce to "2", `KeyN` and `key: "n"` both to "n".
 *
 * Rebinding always stores `code` (eventToBinding) while several DEFAULT
 * bindings store `key`, so the two spellings have to be reduced to one thing
 * before they can be compared at all.
 */
function physicalKeyToken(binding: KeyBinding): string | null {
  if (binding.code) {
    return binding.code
      .replace(/^(?:Key|Digit|Numpad(?=\d))/, "")
      .toLowerCase();
  }
  if (binding.key) return binding.key.toLowerCase();
  return null;
}

/**
 * Would ONE keypress fire both bindings? That is the question the rebind
 * dialog has to ask, and it is looser than structural equality — which is why
 * the dialog used to accept a key another action already owned: a captured
 * `{ code: "Digit2", meta: true }` and the nav default `{ key: "2", meta: true }`
 * are different objects but the same Ctrl+2, and matchBinding fires on both.
 *
 *   - the `code` / `key` spellings of one physical key collide
 *     (see physicalKeyToken)
 *   - `ctrl` and `meta` are one accelerator on the web — matchBinding lets a
 *     held Ctrl satisfy either — so those collide too
 *
 * Shift / Alt stay exact: matchBinding rejects an event holding a modifier the
 * binding did not ask for, so undo and redo never fire together.
 */
export function bindingsConflict(a: KeyBinding, b: KeyBinding): boolean {
  const tokenA = physicalKeyToken(a);
  const tokenB = physicalKeyToken(b);
  // A binding naming no key cannot fire, so it cannot collide with anything.
  if (tokenA === null || tokenB === null) return false;
  if (tokenA !== tokenB) return false;
  if (!!(a.ctrl || a.meta) !== !!(b.ctrl || b.meta)) return false;
  return !!a.shift === !!b.shift && !!a.alt === !!b.alt;
}

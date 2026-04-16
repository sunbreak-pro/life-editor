import type { KeyBinding } from "../types/shortcut";

const CODE_TO_KEY: Record<string, string> = {
  KeyA: "A",
  KeyB: "B",
  KeyC: "C",
  KeyD: "D",
  KeyE: "E",
  KeyF: "F",
  KeyG: "G",
  KeyH: "H",
  KeyI: "I",
  KeyJ: "J",
  KeyK: "K",
  KeyL: "L",
  KeyM: "M",
  KeyN: "N",
  KeyO: "O",
  KeyP: "P",
  KeyQ: "Q",
  KeyR: "R",
  KeyS: "S",
  KeyT: "T",
  KeyU: "U",
  KeyV: "V",
  KeyW: "W",
  KeyX: "X",
  KeyY: "Y",
  KeyZ: "Z",
  Digit0: "0",
  Digit1: "1",
  Digit2: "2",
  Digit3: "3",
  Digit4: "4",
  Digit5: "5",
  Digit6: "6",
  Digit7: "7",
  Digit8: "8",
  Digit9: "9",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Backquote: "`",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Minus: "-",
  Equal: "=",
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Escape: "Escape",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  F1: "F1",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  F7: "F7",
  F8: "F8",
  F9: "F9",
  F10: "F10",
  F11: "F11",
  F12: "F12",
};

const KEY_TO_ACCELERATOR: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

const ACCELERATOR_TO_CODE: Record<string, string> = {};
for (const [code, accel] of Object.entries(CODE_TO_KEY)) {
  ACCELERATOR_TO_CODE[accel.toLowerCase()] = code;
}

const ACCELERATOR_KEY_MAP: Record<string, string> = {
  space: " ",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  escape: "Escape",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
};

export function keyBindingToAccelerator(binding: KeyBinding): string {
  const parts: string[] = [];

  if (binding.ctrl) parts.push("Ctrl");
  if (binding.meta) parts.push("CmdOrCtrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");

  if (binding.code) {
    const mapped = CODE_TO_KEY[binding.code];
    parts.push(mapped ?? binding.code.replace(/^Key/, ""));
  } else if (binding.key) {
    const mapped = KEY_TO_ACCELERATOR[binding.key];
    parts.push(mapped ?? binding.key.toUpperCase());
  }

  return parts.join("+");
}

export function acceleratorToKeyBinding(accel: string): KeyBinding {
  const tokens = accel.split("+");
  const binding: KeyBinding = {};
  let keyToken: string | null = null;

  // First pass: collect modifiers and key token
  for (const token of tokens) {
    const lower = token.toLowerCase();
    switch (lower) {
      case "cmdorctrl":
      case "cmd":
      case "command":
      case "meta":
        binding.meta = true;
        break;
      case "ctrl":
      case "control":
        binding.ctrl = true;
        break;
      case "shift":
        binding.shift = true;
        break;
      case "alt":
      case "option":
        binding.alt = true;
        break;
      default:
        keyToken = token;
        break;
    }
  }

  if (!keyToken) return binding;

  const lower = keyToken.toLowerCase();
  const code = ACCELERATOR_TO_CODE[lower];
  const hasMetaOrAlt = binding.meta || binding.alt;

  if (code) {
    // When meta/alt modifiers are present, eventToBinding always uses code.
    // Mirror that behavior for consistent conflict detection via bindingsEqual.
    if (
      hasMetaOrAlt ||
      code.startsWith("Key") ||
      ["Comma", "Period", "Slash", "Backslash"].includes(code)
    ) {
      binding.code = code;
    } else {
      const keyVal = ACCELERATOR_KEY_MAP[lower];
      if (keyVal) {
        binding.key = keyVal;
      } else {
        binding.code = code;
      }
    }
  } else {
    binding.key = keyToken;
  }

  return binding;
}

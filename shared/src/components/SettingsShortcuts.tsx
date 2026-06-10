import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";
import type { KeyBinding, ShortcutId } from "../types/shortcut";

/** One row's view-model — already-resolved label + accelerator (host owns t()). */
export interface ShortcutRow {
  id: ShortcutId;
  /** Translated action name. */
  label: string;
  /** Human-readable accelerator (e.g. "⌘ + K"). */
  displayString: string;
  /** True when an override differs from the default. */
  isModified: boolean;
}

export interface SettingsShortcutsProps {
  rows: ShortcutRow[];
  /** Commit a captured binding for `id`. */
  onRebind: (id: ShortcutId, binding: KeyBinding) => void;
  /** Reset a single shortcut to its default. */
  onResetOne: (id: ShortcutId) => void;
  /** Reset every shortcut. */
  onResetAll: () => void;
  /**
   * Returns the translated label of the shortcut that already uses `binding`
   * (excluding `id`), or null when there is no conflict. Host wires this to
   * the ShortcutConfig context's findConflict.
   */
  getConflictLabel: (binding: KeyBinding, id: ShortcutId) => string | null;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    resetAll: string;
    change: string;
    reset: string;
    pressKey: string;
    cancel: string;
    /** Suffix appended when the row is modified, e.g. "Modified". */
    modified: string;
    /** `{{action}}` is replaced with the conflicting action label. */
    conflictTemplate: string;
  };
}

/** Pure: turn a keydown into a KeyBinding. Modifier-only presses return null. */
function keyEventToBinding(e: React.KeyboardEvent): KeyBinding | null {
  const { key, code } = e;
  if (key === "Meta" || key === "Control" || key === "Shift" || key === "Alt") {
    return null;
  }
  const binding: KeyBinding = {
    meta: e.metaKey,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
  // Prefer physical `code` for letters/punctuation (layout-stable); fall back
  // to `key` for named keys (Arrow*, Enter, Space, digits).
  if (/^Key[A-Z]$/.test(code) || code === "Comma" || code === "Period") {
    binding.code = code;
  } else {
    binding.key = key;
  }
  return binding;
}

function fillConflict(template: string, action: string): string {
  return template.replace("{{action}}", action);
}

/*
 * Keyboard shortcuts settings part (W1). Minimal, pure / props-injected:
 * list + rebind (key capture) + conflict display + reset. The ShortcutConfig
 * context (rebind/conflict/reset logic) is owned by the HOST and reaches this
 * primitive only through callbacks + the `rows` view-model (CLAUDE.md §6.4).
 * notion-* tokens, opaque rows.
 */
export function SettingsShortcuts({
  rows,
  onRebind,
  onResetOne,
  onResetAll,
  getConflictLabel,
  labels,
}: SettingsShortcutsProps) {
  // Which row is currently capturing a key, plus its live conflict warning.
  const [capturingId, setCapturingId] = useState<ShortcutId | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  // Esc cancels capture; handled at window level so it works even when focus
  // sits on the capture button.
  useEffect(() => {
    if (!capturingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCapturingId(null);
        setConflict(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capturingId]);

  const handleCapture = useCallback(
    (id: ShortcutId, e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturingId(null);
        setConflict(null);
        return;
      }
      const binding = keyEventToBinding(e);
      if (!binding) return; // modifier-only — keep waiting
      const conflictLabel = getConflictLabel(binding, id);
      if (conflictLabel) {
        setConflict(fillConflict(labels.conflictTemplate, conflictLabel));
        return; // do not commit a conflicting binding
      }
      onRebind(id, binding);
      setCapturingId(null);
      setConflict(null);
    },
    [getConflictLabel, labels.conflictTemplate, onRebind],
  );

  return (
    <div className="space-y-4" data-section-id="shortcuts">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-notion-text">
          {labels.heading}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<RotateCcw size={14} />}
          onClick={onResetAll}
        >
          {labels.resetAll}
        </Button>
      </div>

      <ul className="divide-y divide-notion-border rounded-lg border border-notion-border bg-notion-bg">
        {rows.map((row) => {
          const capturing = capturingId === row.id;
          return (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-notion-text">{row.label}</p>
                {row.isModified && (
                  <span className="text-xs text-notion-text-secondary">
                    {labels.modified}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {capturing ? (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      autoFocus
                      onKeyDown={(e) => handleCapture(row.id, e)}
                      className={cn(
                        "rounded-md border border-notion-accent bg-notion-bg-secondary",
                        "px-2.5 py-1 text-xs text-notion-accent",
                        "focus-visible:outline-none focus-visible:ring-2",
                        "focus-visible:ring-notion-accent",
                      )}
                    >
                      {labels.pressKey}
                    </button>
                    {conflict && (
                      <span className="text-xs text-notion-danger">
                        {conflict}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCapturingId(null);
                        setConflict(null);
                      }}
                    >
                      {labels.cancel}
                    </Button>
                  </div>
                ) : (
                  <>
                    <kbd className="rounded border border-notion-border bg-notion-bg-secondary px-2 py-0.5 text-xs tabular-nums text-notion-text">
                      {row.displayString || "—"}
                    </kbd>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setConflict(null);
                        setCapturingId(row.id);
                      }}
                    >
                      {labels.change}
                    </Button>
                    {row.isModified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResetOne(row.id)}
                      >
                        {labels.reset}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

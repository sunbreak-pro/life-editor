import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "./cn";
import { CategoryLabel, groupByCategory } from "./shortcutParts";
import { eventToBinding } from "../utils/shortcutBinding";
import type { ShortcutRow } from "./SettingsShortcuts";
import type {
  KeyBinding,
  ShortcutCategory,
  ShortcutConfig,
  ShortcutId,
} from "../types/shortcut";

export interface ShortcutEditModalLabels {
  title: string;
  description: string;
  /** e.g. "キー入力を待機中 · Esc で中止". */
  waiting: string;
  change: string;
  cancel: string;
  reset: string;
  modified: string;
  resetAll: string;
  done: string;
  /** `{{action}}` replaced with the conflicting action label. */
  conflictTemplate: string;
  categories: Record<ShortcutCategory, string>;
}

export interface ShortcutEditModalProps {
  open: boolean;
  rows: ShortcutRow[];
  /** Current overrides — snapshotted when the modal opens (cancel restores it). */
  config: ShortcutConfig;
  /** Row that begins capturing the moment the modal opens. */
  initialCaptureId?: ShortcutId | null;
  onRebind: (id: ShortcutId, binding: KeyBinding) => void;
  onResetOne: (id: ShortcutId) => void;
  onResetAll: () => void;
  getConflictLabel: (binding: KeyBinding, id: ShortcutId) => string | null;
  /** Commit (live changes stay) + close. */
  onDone: () => void;
  /** Restore the open-time snapshot + close. */
  onCancel: () => void;
  labels: ShortcutEditModalLabels;
}

const MODIFIER_KEYS = new Set(["Meta", "Control", "Shift", "Alt"]);

/** Ordered modifier symbols currently held during a capture. */
function heldModifierSymbols(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): string[] {
  const out: string[] = [];
  if (e.metaKey || e.ctrlKey) out.push("⌘");
  if (e.shiftKey) out.push("⇧");
  if (e.altKey) out.push("⌥");
  return out;
}

function fillConflict(template: string, action: string): string {
  return template.replace("{{action}}", action);
}

/*
 * Shortcut rebind modal (design 1d — "案B: keycap slots"). Pure /
 * props-injected (§6.4), lumen-* tokens, opaque panel (Modal handles the
 * backdrop). Semantics: the open-time overrides are snapshotted; every rebind /
 * reset applies live, "完了" just closes, "キャンセル" restores the snapshot.
 * Capture keeps the row height constant (no layout shift) and shows confirmed
 * modifiers as solid keycaps + a dashed slot for the key still awaited.
 */
export function ShortcutEditModal({
  open,
  rows,
  config,
  initialCaptureId,
  onRebind,
  onResetOne,
  onResetAll,
  getConflictLabel,
  onDone,
  onCancel,
  labels,
}: ShortcutEditModalProps) {
  const [capturingId, setCapturingId] = useState<ShortcutId | null>(null);
  const [held, setHeld] = useState<string[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);

  // Snapshot of overrides + which ids this session touched, for cancel-restore.
  const snapshotRef = useRef<ShortcutConfig>({});
  const touchedRef = useRef<Set<ShortcutId>>(new Set());
  const capturingRef = useRef<ShortcutId | null>(null);
  capturingRef.current = capturingId;

  // On open: snapshot config, clear session tracking, start the initial capture.
  useEffect(() => {
    if (!open) return;
    snapshotRef.current = { ...config };
    touchedRef.current = new Set();
    setCapturingId(initialCaptureId ?? null);
    setHeld([]);
    setConflict(null);
    // Intentionally snapshot only on the open transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopCapture = useCallback(() => {
    setCapturingId(null);
    setHeld([]);
    setConflict(null);
  }, []);

  const markTouched = useCallback((id: ShortcutId) => {
    touchedRef.current.add(id);
  }, []);

  const startCapture = useCallback((id: ShortcutId) => {
    setConflict(null);
    setHeld([]);
    setCapturingId(id);
  }, []);

  const handleCapture = useCallback(
    (id: ShortcutId, e: React.KeyboardEvent) => {
      // Never capture mid-IME-composition (§frontend gotcha).
      if (e.nativeEvent.isComposing) return;
      // Esc is handled by the Modal-level close router (cancel capture first).
      if (e.key === "Escape") return;
      e.preventDefault();
      e.stopPropagation();

      setHeld(heldModifierSymbols(e));
      if (MODIFIER_KEYS.has(e.key)) return; // modifier-only — keep waiting

      const binding = eventToBinding(e.nativeEvent);
      const conflictLabel = getConflictLabel(binding, id);
      if (conflictLabel) {
        setConflict(fillConflict(labels.conflictTemplate, conflictLabel));
        return; // do not commit a conflicting binding
      }
      onRebind(id, binding);
      markTouched(id);
      stopCapture();
    },
    [
      getConflictLabel,
      labels.conflictTemplate,
      onRebind,
      markTouched,
      stopCapture,
    ],
  );

  const handleResetOne = useCallback(
    (id: ShortcutId) => {
      onResetOne(id);
      markTouched(id);
    },
    [onResetOne, markTouched],
  );

  const handleResetAll = useCallback(() => {
    onResetAll();
    rows.forEach((r) => touchedRef.current.add(r.id));
    stopCapture();
  }, [onResetAll, rows, stopCapture]);

  // Restore the snapshot for every id touched this session, then close.
  const restoreAndClose = useCallback(() => {
    touchedRef.current.forEach((id) => {
      const snap = snapshotRef.current[id];
      if (snap) onRebind(id, snap);
      else onResetOne(id);
    });
    touchedRef.current = new Set();
    onCancel();
  }, [onRebind, onResetOne, onCancel]);

  // Router for Modal's Esc / backdrop: while capturing, cancel the capture
  // first; otherwise cancel the modal (restore snapshot).
  const handleModalClose = useCallback(() => {
    if (capturingRef.current) stopCapture();
    else restoreAndClose();
  }, [stopCapture, restoreAndClose]);

  const groups = groupByCategory(rows);

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      title={labels.title}
      className="max-w-[560px] p-0"
    >
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex-shrink-0 border-b border-lumen-border px-5 pb-3.5 pt-1">
          <p className="text-xs text-lumen-text-secondary">
            {labels.description}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-1.5">
          {groups.map(({ category, rows: groupRows }) => (
            <div key={category}>
              <CategoryLabel>{labels.categories[category]}</CategoryLabel>
              {groupRows.map((row) => {
                const capturing = capturingId === row.id;
                return (
                  <div key={row.id}>
                    <div
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-lumen-md px-2",
                        capturing
                          ? "bg-lumen-accent-subtle"
                          : "border-b border-lumen-border",
                      )}
                    >
                      <span
                        className={cn(
                          "flex-1 truncate text-sm",
                          capturing
                            ? "font-medium text-lumen-text"
                            : "text-lumen-text",
                        )}
                      >
                        {row.label}
                      </span>

                      {capturing ? (
                        <>
                          {/* Focusable capture surface: grabs the keydown while
                              this row is recording (autoFocus on open / on the
                              row that triggered capture). Height matches the
                              non-capturing cluster so there is no layout shift. */}
                          <button
                            type="button"
                            autoFocus
                            aria-label={labels.waiting}
                            onKeyDown={(e) => handleCapture(row.id, e)}
                            className="flex flex-col items-end gap-1 py-1.5 focus-visible:outline-none"
                          >
                            <span className="flex items-center gap-1.5">
                              {held.map((sym, i) => (
                                <span
                                  key={`${sym}-${i}`}
                                  className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-lumen-sm border border-lumen-border-strong bg-lumen-bg px-1.5 text-[13px] tabular-nums text-lumen-text shadow-lumen-sm"
                                >
                                  {sym}
                                </span>
                              ))}
                              <span className="inline-flex h-6 w-[26px] items-center justify-center rounded-lumen-sm border-[1.5px] border-dashed border-lumen-accent bg-lumen-accent-subtle motion-safe:animate-pulse">
                                <span className="h-0.5 w-[9px] rounded-full bg-lumen-accent" />
                              </span>
                            </span>
                            <span className="text-[11px] text-lumen-text-secondary">
                              {labels.waiting}
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={stopCapture}
                          >
                            {labels.cancel}
                          </Button>
                        </>
                      ) : (
                        <>
                          {row.isModified && (
                            <span className="inline-flex h-5 items-center rounded-lumen-md bg-lumen-chip-mint-bg px-2 text-[11px] font-medium text-lumen-chip-mint-fg">
                              {labels.modified}
                            </span>
                          )}
                          <KeycapDisplay displayString={row.displayString} />
                          <button
                            type="button"
                            onClick={() => startCapture(row.id)}
                            className="ml-1 inline-flex h-[26px] items-center rounded-lumen-sm border border-lumen-border bg-lumen-bg px-2.5 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                          >
                            {labels.change}
                          </button>
                          {row.isModified && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetOne(row.id)}
                            >
                              {labels.reset}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    {capturing && conflict && (
                      <div className="flex items-center gap-1.5 px-0.5 py-1.5">
                        <TriangleAlert
                          size={14}
                          className="shrink-0 text-lumen-danger"
                        />
                        <span className="text-xs text-lumen-danger">
                          {conflict}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t border-lumen-border bg-lumen-bg-subsidebar px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<RotateCcw size={13} />}
            onClick={handleResetAll}
          >
            {labels.resetAll}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={restoreAndClose}>
              {labels.cancel}
            </Button>
            <Button variant="primary" onClick={onDone}>
              {labels.done}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** The current binding rendered as solid keycaps (one per key). */
function KeycapDisplay({ displayString }: { displayString: string }) {
  const keys = displayString ? displayString.split(" + ") : ["—"];
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <kbd
          key={`${k}-${i}`}
          className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary px-1.5 text-xs tabular-nums text-lumen-text-secondary"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

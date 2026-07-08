import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";
import { CategoryLabel, KbdChips, groupByCategory } from "./shortcutParts";
import { ShortcutEditModal } from "./ShortcutEditModal";
import type {
  KeyBinding,
  ShortcutCategory,
  ShortcutConfig,
  ShortcutId,
} from "../types/shortcut";

/** One row's view-model — already-resolved label + accelerator (host owns t()). */
export interface ShortcutRow {
  id: ShortcutId;
  /** Category for grouping (global / navigation / edit). */
  category: ShortcutCategory;
  /** Translated action name. */
  label: string;
  /** Human-readable accelerator (e.g. "⌘ + K"). */
  displayString: string;
  /** True when an override differs from the default. */
  isModified: boolean;
}

export interface SettingsShortcutsLabels {
  heading: string;
  resetAll: string;
  change: string;
  reset: string;
  modified: string;
  cancel: string;
  done: string;
  /** Modal title + description. */
  editTitle: string;
  editDescription: string;
  /** Capture hint, e.g. "キー入力を待機中 · Esc で中止". */
  waiting: string;
  /** `{{action}}` replaced with the conflicting action label. */
  conflictTemplate: string;
  /** Category captions. */
  categories: Record<ShortcutCategory, string>;
}

export interface SettingsShortcutsProps {
  rows: ShortcutRow[];
  /** Current overrides — passed through to the edit modal for cancel-restore. */
  config: ShortcutConfig;
  /** Commit a captured binding for `id`. */
  onRebind: (id: ShortcutId, binding: KeyBinding) => void;
  /** Reset a single shortcut to its default. */
  onResetOne: (id: ShortcutId) => void;
  /** Reset every shortcut. */
  onResetAll: () => void;
  /**
   * Returns the translated label of the shortcut that already uses `binding`
   * (excluding `id`), or null when there is no conflict.
   */
  getConflictLabel: (binding: KeyBinding, id: ShortcutId) => string | null;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: SettingsShortcutsLabels;
}

/*
 * Keyboard shortcuts settings card (W1, redesigned). Pure / props-injected
 * (§6.4), lumen-* tokens, opaque surfaces (§5). Shows the full binding list
 * grouped by category; the "変更" button opens a rebind modal (capture + live
 * conflict) instead of expanding inline, so the card never shifts height.
 */
export function SettingsShortcuts({
  rows,
  config,
  onRebind,
  onResetOne,
  onResetAll,
  getConflictLabel,
  labels,
}: SettingsShortcutsProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [initialCaptureId, setInitialCaptureId] = useState<ShortcutId | null>(
    null,
  );

  const openEditor = (id: ShortcutId | null) => {
    setInitialCaptureId(id);
    setEditorOpen(true);
  };

  const groups = groupByCategory(rows);

  return (
    <div className="flex flex-col gap-1" data-section-id="shortcuts">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-lumen-text">
          {labels.heading}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<RotateCcw size={13} />}
          onClick={onResetAll}
        >
          {labels.resetAll}
        </Button>
      </div>

      {groups.map(({ category, rows: groupRows }, groupIdx) => (
        <div key={category}>
          <CategoryLabel>{labels.categories[category]}</CategoryLabel>
          {groupRows.map((row, rowIdx) => {
            const isLast =
              groupIdx === groups.length - 1 && rowIdx === groupRows.length - 1;
            return (
              <div
                key={row.id}
                className={cn(
                  "flex min-h-11 items-center gap-2 px-0.5",
                  !isLast && "border-b border-lumen-border",
                )}
              >
                <span className="flex-1 truncate text-sm text-lumen-text">
                  {row.label}
                </span>
                {row.isModified && (
                  <span className="inline-flex h-5 items-center rounded-lumen-md bg-lumen-chip-mint-bg px-2 text-[11px] font-medium text-lumen-chip-mint-fg">
                    {labels.modified}
                  </span>
                )}
                <KbdChips displayString={row.displayString} />
                <button
                  type="button"
                  onClick={() => openEditor(row.id)}
                  className="ml-1 inline-flex h-[26px] items-center rounded-lumen-sm border border-lumen-border bg-lumen-bg px-2.5 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
                >
                  {labels.change}
                </button>
                {row.isModified && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onResetOne(row.id)}
                  >
                    {labels.reset}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <ShortcutEditModal
        open={editorOpen}
        rows={rows}
        config={config}
        initialCaptureId={initialCaptureId}
        onRebind={onRebind}
        onResetOne={onResetOne}
        onResetAll={onResetAll}
        getConflictLabel={getConflictLabel}
        onDone={() => setEditorOpen(false)}
        onCancel={() => setEditorOpen(false)}
        labels={{
          title: labels.editTitle,
          description: labels.editDescription,
          waiting: labels.waiting,
          change: labels.change,
          cancel: labels.cancel,
          reset: labels.reset,
          modified: labels.modified,
          resetAll: labels.resetAll,
          done: labels.done,
          conflictTemplate: labels.conflictTemplate,
          categories: labels.categories,
        }}
      />
    </div>
  );
}

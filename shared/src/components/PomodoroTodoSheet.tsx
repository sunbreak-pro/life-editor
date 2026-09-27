import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Input } from "./Input";
import { isImeComposing } from "../utils/imeGuard";
import { workTargetIcon, type WorkTargetOption } from "./PomodoroTodoSelector";
import { cn } from "./cn";

/*
 * Mobile work-target picker for the Work tab (target-IA import). The fullscreen
 * timer face has no room for an inline dropdown, so tapping the chip opens this
 * BottomSheet with the candidate list + a "clear selection" row. Pure
 * primitive: host supplies the items + selection + copy (§6.4). Selecting one
 * (or clearing) closes the sheet via the host's onSelect + onClose.
 *
 * Todos and Events share one list, for the reason spelled out on the selector.
 * The kind rides on the leading glyph — the check mark that marks the CURRENT
 * selection keeps its own column so the two never contend for the same slot.
 *
 * A row is two lines when the option carries a subtitle (#1519): the mobile
 * sheet is where a daily routine's seven occurrences stacked up as seven rows
 * of the same name, so the day + start time gets its own line under the title
 * rather than the desktop menu's trailing slot — there is no room beside a
 * full-width title at 390px.
 *
 * The sheet can also NAME a new free session (#2009) when the host passes
 * `freeSessionName`: a text field over the list whose placeholder is the
 * default title, so leaving it blank reads as exactly what gets filed. Using
 * it clears any picked target (a named session is still a free session) and
 * closes the sheet like a row does; the host decides where the name lives.
 */

export interface PomodoroTodoSheetLabels {
  title: string;
  /** Name for the sheet's close button (#525). */
  close: string;
  /** Row that clears the current attribution. */
  clearSelection: string;
  /** Shown when there are no candidates at all. */
  emptyHint: string;
  /** Accessible name of the free-session name field (#2009). */
  nameLabel?: string;
  /** Placeholder of that field — the title a blank name files under. */
  namePlaceholder?: string;
  /** Button that starts working under the typed name. */
  nameSubmit?: string;
}

export interface PomodoroTodoSheetProps {
  open: boolean;
  onClose: () => void;
  items: readonly WorkTargetOption[];
  selectedId: string | null;
  labels: PomodoroTodoSheetLabels;
  onSelect: (item: WorkTargetOption | null) => void;
  /**
   * The free session's current name (#2009). Passing it (with `onNameSubmit`)
   * turns the name field on; omitting it keeps the sheet a plain picker.
   */
  freeSessionName?: string;
  /** Receives the name as typed; blank means "the default title". */
  onNameSubmit?: (name: string) => void;
}

export function PomodoroTodoSheet({
  open,
  onClose,
  items,
  selectedId,
  labels,
  onSelect,
  freeSessionName,
  onNameSubmit,
}: PomodoroTodoSheetProps) {
  const choose = (item: WorkTargetOption | null) => {
    onSelect(item);
    onClose();
  };

  const submitName = (name: string) => {
    onNameSubmit?.(name);
    choose(null);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={labels.title}
      closeLabel={labels.close}
    >
      {freeSessionName !== undefined && onNameSubmit ? (
        <FreeSessionNameField
          initial={freeSessionName}
          labels={labels}
          onSubmit={submitName}
        />
      ) : null}
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-lumen-text-tertiary">
          {labels.emptyHint}
        </p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => choose(null)}
              className="flex w-full items-center gap-3 rounded-lumen-md px-3 py-3 text-left text-sm text-lumen-text-secondary hover:bg-lumen-hover"
            >
              <X size={16} aria-hidden="true" className="shrink-0" />
              {labels.clearSelection}
            </button>
          </li>
          {items.map((t) => {
            const active = t.id === selectedId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => choose(t)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lumen-md px-3 py-3 text-left text-sm hover:bg-lumen-hover",
                    active
                      ? "font-semibold text-lumen-accent"
                      : "text-lumen-text",
                  )}
                >
                  <span
                    className="flex w-4 shrink-0 justify-center"
                    aria-hidden="true"
                  >
                    {active ? <Check size={16} /> : null}
                  </span>
                  <span className="shrink-0 text-lumen-text-tertiary">
                    {workTargetIcon(t.kind, 16)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{t.title}</span>
                    {t.subtitle ? (
                      <span className="truncate text-xs font-normal text-lumen-text-tertiary">
                        {t.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}

/*
 * Its own component so the draft starts over from the saved name every time
 * the sheet opens: BottomSheet renders nothing while closed, which unmounts
 * this and drops a draft the user walked away from.
 */
function FreeSessionNameField({
  initial,
  labels,
  onSubmit,
}: {
  initial: string;
  labels: PomodoroTodoSheetLabels;
  onSubmit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(initial);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter also confirms a Japanese conversion; that one must not submit.
    if (e.key !== "Enter" || isImeComposing(e)) return;
    e.preventDefault();
    onSubmit(draft);
  };

  return (
    <div className="flex items-center gap-2 px-1 pb-3">
      {/* min-h-11 rather than h-11: `cn` does not merge, and Input sets h-9. */}
      <Input
        value={draft}
        aria-label={labels.nameLabel}
        placeholder={labels.namePlaceholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-11"
      />
      <button
        type="button"
        onClick={() => onSubmit(draft)}
        className="inline-flex min-h-11 shrink-0 items-center rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3.5 text-sm font-semibold text-lumen-text hover:bg-lumen-hover"
      >
        {labels.nameSubmit}
      </button>
    </div>
  );
}

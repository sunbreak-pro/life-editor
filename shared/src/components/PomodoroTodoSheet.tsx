import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, CircleX, Inbox } from "lucide-react";
import { WorkLoadFailed } from "./WorkLoadFailed";
import { BottomSheet } from "./BottomSheet";
import { Input } from "./Input";
import { isImeComposing } from "../utils/imeGuard";
import { WorkTargetGlyph, type WorkTargetOption } from "./PomodoroTodoSelector";
import { cn } from "./cn";

/*
 * Mobile work-target picker for the Work tab (target-IA import). The fullscreen
 * timer face has no room for an inline dropdown, so tapping the link row opens
 * this BottomSheet with the candidate list + a "clear selection" row. Pure
 * primitive: host supplies the items + selection + copy (§6.4). Selecting one
 * (or clearing) closes the sheet via the host's onSelect + onClose.
 *
 * Todos and Events share one sheet, for the reason spelled out on the
 * selector, but since #2054 (Claude Design plan A) they sit under their own
 * headings — "Todo" first, then "予定" — with the "clear selection" row last,
 * under a rule. The kind rides on the leading glyph; the check mark that marks
 * the CURRENT selection sits at the far end so the two never share a slot.
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
 *
 * The other two states the plan draws: `loading` shows skeleton rows while the
 * host's first read is in flight, and an empty list shows an icon, a heading
 * and a line that points back at the name field above it.
 *
 * The plan draws no failure, but an empty list is not one (#2054): a read that
 * failed used to fall through to the empty state and say there was nothing to
 * link, which was false. `loadFailed` with nothing on screen swaps the empty
 * state for a failure with a retry. A failed REFETCH keeps the rows it already
 * has — they are still the best answer the sheet holds — so the swap only
 * happens when the list is empty. The name field stays above either way: a
 * free session needs no list at all.
 */

export interface PomodoroTodoSheetLabels {
  title: string;
  /** Name for the sheet's close button (#525). */
  close: string;
  /** Row that clears the current attribution. */
  clearSelection: string;
  /** Shown when there are no candidates at all. */
  emptyHint: string;
  /**
   * Heading of the empty state (#2054). When given, the empty list draws the
   * plan's icon + heading + `emptyHint` as the line under it; without it the
   * sheet falls back to the one-line hint.
   */
  emptyTitle?: string;
  /** Heading over the todo rows (#2054). */
  todoHeading?: string;
  /** Heading over the event rows (#2054). */
  eventHeading?: string;
  /** Name of the free-session name field (#2009), drawn as its label. */
  nameLabel?: string;
  /** Placeholder of that field — the title a blank name files under. */
  namePlaceholder?: string;
  /** Button that starts working under the typed name. */
  nameSubmit?: string;
  /** Heading of the failed-read state (#2054). */
  loadFailedTitle?: string;
  /** Its line — what to do now. */
  loadFailedBody?: string;
  /** Its retry button. */
  retry?: string;
  /** The retry button while a retry is in flight. */
  retrying?: string;
}

export interface PomodoroTodoSheetProps {
  open: boolean;
  onClose: () => void;
  items: readonly WorkTargetOption[];
  selectedId: string | null;
  labels: PomodoroTodoSheetLabels;
  onSelect: (item: WorkTargetOption | null) => void;
  /** Skeleton rows while the host's first read is in flight (#2054). */
  loading?: boolean;
  /**
   * The free session's current name (#2009). Passing it (with `onNameSubmit`)
   * turns the name field on; omitting it keeps the sheet a plain picker.
   */
  freeSessionName?: string;
  /** Receives the name as typed; blank means "the default title". */
  onNameSubmit?: (name: string) => void;
  /**
   * The host's last read failed (#2054). Shown only while the list is empty,
   * and only with `onRetry` and the three failure labels.
   */
  loadFailed?: boolean;
  /** Reads the candidates again. */
  onRetry?: () => void;
  /** A retry is in flight (the failure stays up until a read succeeds). */
  retrying?: boolean;
}

/** Skeleton bar widths — uneven on purpose, so the rows read as text. */
const SKELETON_WIDTHS = ["w-[62%]", "w-[48%]", "w-[70%]", "w-[40%]"];

const ROW =
  "flex min-h-13 w-full items-center gap-3 px-5 py-2 text-left hover:bg-lumen-hover";
const GROUP_HEADING =
  "px-5 pb-1 pt-5 text-xs font-semibold text-lumen-text-tertiary";

export function PomodoroTodoSheet({
  open,
  onClose,
  items,
  selectedId,
  labels,
  onSelect,
  loading = false,
  freeSessionName,
  onNameSubmit,
  loadFailed = false,
  onRetry,
  retrying = false,
}: PomodoroTodoSheetProps) {
  const choose = (item: WorkTargetOption | null) => {
    onSelect(item);
    onClose();
  };

  const submitName = (name: string) => {
    onNameSubmit?.(name);
    choose(null);
  };

  const todos = items.filter((t) => t.kind === "todo");
  const events = items.filter((t) => t.kind === "event");

  const row = (t: WorkTargetOption) => {
    const active = t.id === selectedId;
    return (
      <li key={t.id}>
        <button
          type="button"
          onClick={() => choose(t)}
          aria-current={active || undefined}
          className={cn(
            ROW,
            active ? "font-semibold text-lumen-accent" : "text-lumen-text",
          )}
        >
          <WorkTargetGlyph kind={t.kind} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-pretty text-sm leading-snug">{t.title}</span>
            {t.subtitle ? (
              <span className="truncate text-xs font-normal text-lumen-text-tertiary">
                {t.subtitle}
              </span>
            ) : null}
          </span>
          {active ? (
            <Check aria-hidden="true" className="size-lumen-icon-md shrink-0" />
          ) : null}
        </button>
      </li>
    );
  };

  let body;
  if (loading) {
    body = (
      <div
        aria-busy="true"
        data-testid="work-target-skeleton"
        className="-mx-5"
      >
        <div className="px-5 pb-2 pt-5">
          <div className="h-3 w-12 rounded-full bg-lumen-surface-sunken" />
        </div>
        {SKELETON_WIDTHS.map((w) => (
          <div key={w} className="flex h-13 items-center gap-3 px-5">
            <div className="h-8 w-8 shrink-0 rounded-full bg-lumen-surface-sunken" />
            <div
              className={cn("h-3 rounded-full bg-lumen-surface-sunken", w)}
            />
          </div>
        ))}
      </div>
    );
  } else if (
    items.length === 0 &&
    loadFailed &&
    onRetry &&
    labels.loadFailedTitle &&
    labels.loadFailedBody &&
    labels.retry
  ) {
    body = (
      <WorkLoadFailed
        title={labels.loadFailedTitle}
        body={labels.loadFailedBody}
        retry={labels.retry}
        onRetry={onRetry}
        retrying={retrying}
        retryingLabel={labels.retrying}
        className="pb-12 pt-10"
      />
    );
  } else if (items.length === 0) {
    body = labels.emptyTitle ? (
      <div className="flex flex-col items-center gap-2 px-6 pb-12 pt-10 text-center">
        <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-lumen-border bg-lumen-bg-secondary text-lumen-text-tertiary">
          <Inbox aria-hidden="true" className="size-lumen-icon-lg" />
        </span>
        <p className="text-sm font-bold text-lumen-text">{labels.emptyTitle}</p>
        <p className="text-pretty text-xs leading-relaxed text-lumen-text-secondary">
          {labels.emptyHint}
        </p>
      </div>
    ) : (
      <p className="py-6 text-center text-sm text-lumen-text-tertiary">
        {labels.emptyHint}
      </p>
    );
  } else {
    body = (
      <div className="-mx-5 flex max-h-[50vh] flex-col overflow-y-auto">
        {todos.length > 0 ? (
          <>
            {labels.todoHeading ? (
              <h3 className={GROUP_HEADING}>{labels.todoHeading}</h3>
            ) : null}
            <ul className="flex flex-col">{todos.map(row)}</ul>
          </>
        ) : null}
        {events.length > 0 ? (
          <>
            {labels.eventHeading ? (
              <h3 className={GROUP_HEADING}>{labels.eventHeading}</h3>
            ) : null}
            <ul className="flex flex-col">{events.map(row)}</ul>
          </>
        ) : null}
        <div className="mx-5 mt-2 h-px shrink-0 bg-lumen-border" />
        <button
          type="button"
          onClick={() => choose(null)}
          className={cn(ROW, "text-lumen-text-secondary")}
        >
          <span className="flex w-8 shrink-0 justify-center" aria-hidden="true">
            <CircleX className="size-lumen-icon-md" />
          </span>
          <span className="text-sm">{labels.clearSelection}</span>
        </button>
      </div>
    );
  }

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
      {body}
    </BottomSheet>
  );
}

/*
 * Its own component so the draft starts over from the saved name every time
 * the sheet opens: BottomSheet renders nothing while closed, which unmounts
 * this and drops a draft the user walked away from.
 *
 * The submit button stays beside the field (#2054 kept it — plan A draws the
 * field alone). Enter submits too, but a phone keyboard's return key is not
 * where everyone looks for "go", and the button is what says that typing a
 * name is a way to start at all.
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
  const fieldId = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter also confirms a Japanese conversion; that one must not submit.
    if (e.key !== "Enter" || isImeComposing(e)) return;
    e.preventDefault();
    onSubmit(draft);
  };

  return (
    <div className="flex flex-col gap-1.5 pb-1">
      <label
        htmlFor={fieldId}
        className="text-xs font-semibold text-lumen-text-secondary"
      >
        {labels.nameLabel}
      </label>
      <div className="flex items-center gap-2">
        {/* min-h-11 rather than h-11: `cn` does not merge, and Input sets h-9. */}
        <Input
          id={fieldId}
          value={draft}
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
    </div>
  );
}

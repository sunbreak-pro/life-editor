import { useEffect, useState, type KeyboardEvent } from "react";
import { BottomSheet } from "../BottomSheet";
import { cn } from "../cn";
import { SegmentedControl } from "../SegmentedControl";
import {
  DISABLED_FILLED_BTN,
  FIELD,
  FIELD_LABEL,
  FOCUS_RING_ON_ACCENT,
} from "../styleTokens";
import { TimeRangeField } from "../TimeRangeField";
import { isImeComposing } from "../../utils/imeGuard";
import {
  ItemCreatePanel,
  type ItemCreatePanelInitial,
  type ItemCreatePanelProps,
  type ItemCreatePanelLabels,
  type ItemCreateSlot,
  type ItemCreateType,
} from "./ItemCreatePanel";

/*
 * QuickCaptureSheet — the Mobile creation frame. Since #299 it is a thin frame
 * around the shared creation fields; since #376 those fields are the unified
 * <ItemCreatePanel> (event / todo tabs), so a phone reaches everything the
 * Desktop overlay does.
 *
 * #2624 put a short sheet in front of that panel, as the Claude Design
 * proposal's 「クイック追加」 draws it. The sheet rises over the lower part of
 * the screen and asks only for the type, the title, the day and (for an
 * event) the times. Its 「追加して詳細へ」 writes nothing: it carries what was
 * typed into the full-screen panel (#874), where a repeat, tags and notes can
 * be added. Before, every add on a phone opened on all of those fields at
 * once (2026-11-04 owner's choice in #2624: the sheet first, the full page
 * only on request).
 *
 * #874 made the panel full height because a partial sheet left the calendar
 * re-flowing behind it each time an input summoned the keyboard. #917 also
 * stopped the shell from dropping its tab bar under the keyboard, which was
 * what moved the calendar, so a short sheet holding three fields is safe
 * again (the Todos quick add stayed a sheet for the same reason).
 *
 * The frame owns which of the two is up, and nothing else: every panel prop is
 * forwarded verbatim (pure presentation — §3.1 / §6.4, lumen-* tokens only —
 * §5). Closing is the host's job: its submit handlers clear the open-panel
 * state, which flips `open` here, so the sheet does not double-close. A close
 * from either stage ends the whole add, and the next opening starts on the
 * short sheet again.
 *
 * `initial.start` / `initial.end` prefill the times (#299): the FAB opens with
 * the defaults, an empty-slot tap opens with the tapped slot's time. The
 * BottomSheet unmounts its children when closed, so the form re-seeds on every
 * open — which is also why a fresh `initial` object per render costs nothing:
 * the fields read it once, at mount.
 */

export type QuickCaptureLabels = ItemCreatePanelLabels;

export interface QuickCaptureSheetProps extends ItemCreatePanelProps {
  open: boolean;
  onClose: () => void;
  /**
   * Already-translated BottomSheet header. Separate from `labels.title` (the
   * title input's aria-label) since #376: the sheet now holds more than one
   * kind of item, so its heading names the panel, not the event.
   */
  sheetTitle: string;
  /** Already-translated name for the sheet's close button (§6.4, #525). */
  closeLabel: string;
}

// The footer pair of the full panel, at the same 44px floor on a phone
// (rules/frontend.md §Gotchas). Equal halves, so the two read as one row.
const SUBMIT_BTN = `flex-1 rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover max-md:min-h-11 ${FOCUS_RING_ON_ACCENT} ${DISABLED_FILLED_BTN}`;
const DETAIL_BTN =
  "flex-1 rounded-lumen-md border border-lumen-border-strong py-2 text-center text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11";

/**
 * The short sheet's fields (#2624). A todo takes a day and no time, so it is
 * sent all-day — the way the Todos tray's "add to today" writes one.
 */
function QuickCaptureFields({
  initial,
  pools,
  handlers,
  labels,
  formatDuration,
  onDetail,
}: Pick<
  ItemCreatePanelProps,
  "initial" | "pools" | "handlers" | "labels" | "formatDuration"
> & {
  /** 「追加して詳細へ」: the draft, to seed the full panel with. */
  onDetail: (draft: ItemCreatePanelInitial) => void;
}) {
  const [type, setType] = useState<ItemCreateType>(initial.type ?? "event");
  const [title, setTitle] = useState(initial.title ?? "");
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start ?? "09:00");
  const [end, setEnd] = useState(initial.end ?? "10:00");
  const isTodo = type === "task";

  /*
   * The host keeps the tags and goals the full panel last staged until a
   * submit takes them (useCreatePanelTags). The full panel reports `[]` when
   * it mounts, which is what used to clear a set left by a cancelled add.
   * This sheet replaces that mount, so it reports the same: it stages
   * nothing, and a quick add must not pick up the last add's tags.
   */
  const onStagedTags = pools.tags?.onStagedChange;
  const onStagedGoals = pools.goals?.onStagedChange;
  useEffect(() => {
    onStagedTags?.([]);
  }, [onStagedTags]);
  useEffect(() => {
    onStagedGoals?.([]);
  }, [onStagedGoals]);

  const trimmed = title.trim();
  const submit = () => {
    if (!trimmed) return;
    const slot: ItemCreateSlot = { date, start, end, isAllDay: isTodo };
    (isTodo ? handlers.onCreateTodo : handlers.onSubmitEvent)(
      trimmed,
      slot,
      [],
    );
  };
  // Never the Enter that confirms an IME conversion (rules/frontend.md).
  const submitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isImeComposing(e)) submit();
  };

  return (
    <div data-quick-capture="" className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span aria-hidden className={FIELD_LABEL}>
          {labels.typeLabel}
        </span>
        <SegmentedControl
          options={[
            { id: "event", label: labels.typeEvent },
            { id: "task", label: labels.typeTodo },
          ]}
          value={type}
          onChange={(id) => setType(id as ItemCreateType)}
          label={labels.typeLabel}
        />
      </div>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.title}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={submitOnEnter}
          className={FIELD}
        />
      </label>
      {/* The full panel's date line, less the all-day check: the wrap
          bases and `min-w-0` are #1036 / #1403's, see ItemCreatePanel. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 basis-32 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.date}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => {
              if (!date) setDate(initial.date);
            }}
            onKeyDown={submitOnEnter}
            aria-label={labels.date}
            className={cn(FIELD, "min-w-0 appearance-none tabular-nums")}
          />
        </label>
        {!isTodo && (
          <TimeRangeField
            start={start}
            end={end}
            onChange={(next) => {
              setStart(next.start);
              setEnd(next.end);
            }}
            labels={{ start: labels.startTime, end: labels.endTime }}
            formatDuration={formatDuration}
            className="min-w-0 flex-[2] basis-44"
          />
        )}
      </div>
      <div className="flex items-stretch gap-2">
        {/* Not gated on the title: it writes nothing, and the title can as
            well be typed on the next screen. */}
        <button
          type="button"
          onClick={() =>
            onDetail({ type, title, date, start, end, isAllDay: isTodo })
          }
          className={DETAIL_BTN}
        >
          {labels.addEventAndOpen}
        </button>
        <button
          type="button"
          disabled={!trimmed}
          onClick={submit}
          className={SUBMIT_BTN}
        >
          {isTodo ? labels.addTodo : labels.addEvent}
        </button>
      </div>
    </div>
  );
}

export function QuickCaptureSheet({
  open,
  onClose,
  sheetTitle,
  closeLabel,
  ...panel
}: QuickCaptureSheetProps) {
  // The draft the short sheet went on with; null while the short sheet is up.
  const [detail, setDetail] = useState<ItemCreatePanelInitial | null>(null);
  // Dropped when the host closes the add, so the next opening starts short.
  // Adjusted while rendering, React's pattern for state that follows a prop.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setDetail(null);
  }

  return (
    <>
      <BottomSheet
        open={open && !detail}
        onClose={onClose}
        title={sheetTitle}
        closeLabel={closeLabel}
      >
        <QuickCaptureFields
          initial={panel.initial}
          pools={panel.pools}
          handlers={panel.handlers}
          labels={panel.labels}
          formatDuration={panel.formatDuration}
          onDetail={setDetail}
        />
      </BottomSheet>
      <BottomSheet
        open={open && !!detail}
        onClose={onClose}
        title={sheetTitle}
        closeLabel={closeLabel}
        /*
         * Full height (#874). This is the create FORM — date, times, a repeat
         * section, a tab row — not a one-field quick add, and every field in it
         * summons the keyboard. Partial, it left a live strip of calendar
         * showing that re-flowed on each focus.
         */
        fullScreen
      >
        {/* #2396: on a phone the note picker is a sheet of its own, over this
            one — there is no room beside the form. */}
        {detail && (
          <ItemCreatePanel
            {...panel}
            initial={detail}
            notePicker={panel.notePicker ?? "sheet"}
          />
        )}
      </BottomSheet>
    </>
  );
}

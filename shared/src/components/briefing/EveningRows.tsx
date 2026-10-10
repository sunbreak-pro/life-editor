import { useId, useRef, useState } from "react";
import { isImeComposing } from "../../utils/imeGuard";
import type { EveningEvent, EveningTomorrowCandidate } from "./eveningDay";

/*
 * The evening paper's rows that hold a draft of their own (#2107): a
 * 「今日の出来事」row with its one-line note, and a「明日の予定に置く」row
 * with its optional time. EveningView keeps only the section frames.
 *
 * Pure presentation (§6.4): the host owns the writes, the copy comes in as
 * labels. Every control floors at 44px below `md` only — one component draws
 * these rows at every width, and Desktop keeps its compact boxes.
 */

/** A「今日の出来事」row plus the note already saved on it. */
export interface EveningEventEntry extends EveningEvent {
  note: string | null;
}

export interface EveningRowLabels {
  allDay: string;
  eventDone: string;
  eventWork: string;
  eventNoteButton: string;
  eventNoteAdd: (title: string) => string;
  eventNoteEdit: (title: string) => string;
  eventNotePlaceholder: string;
  tomorrowTimeLabel: (title: string) => string;
  placeTomorrow: string;
  placeTomorrowLabel: (title: string) => string;
  placedTomorrow: (time: string) => string;
}

const ROW_BUTTON =
  "inline-flex flex-shrink-0 items-center justify-center rounded-lumen-sm px-1.5 py-0.5 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11";

// 16px below `md` so iOS does not zoom the page on focus.
const ROW_INPUT =
  "rounded-lumen-sm border border-lumen-border bg-lumen-bg px-2 py-1 text-base text-lumen-text outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 md:text-sm";

function eventTime(entry: EveningEvent, allDay: string): string {
  if (entry.startTime === null) return allDay;
  return entry.endTime === null
    ? entry.startTime
    : `${entry.startTime}–${entry.endTime}`;
}

export function EveningEventRow({
  entry,
  labels,
  onSaveNote,
}: {
  entry: EveningEventEntry;
  labels: EveningRowLabels;
  onSaveNote: (key: string, text: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const noteHintId = useId();
  // Enter / Esc close the field, and the blur that follows the unmount must
  // not save a second time (or save what Esc just threw away).
  const closedRef = useRef(false);
  const kind =
    entry.kind === "todo"
      ? labels.eventDone
      : entry.kind === "session"
        ? labels.eventWork
        : null;
  // The spoken name carries the time and the kind as well as the title: a
  // todo worked on and then done gives two rows with the same title, and a
  // screen reader could not tell their note buttons apart otherwise. A
  // session with nothing to name it reads「作業」once, not「作業 作業」.
  const name = [
    eventTime(entry, labels.allDay),
    kind,
    entry.title ?? (kind === null ? labels.eventWork : null),
  ]
    .filter((part): part is string => part !== null)
    .join(" ");

  const open = () => {
    closedRef.current = false;
    setDraft(entry.note ?? "");
  };
  const close = (save: boolean) => {
    if (closedRef.current || draft === null) return;
    closedRef.current = true;
    // Saved only when it changed: an opened-and-left field writes nothing.
    if (save && draft.trim() !== (entry.note ?? ""))
      onSaveNote(entry.key, draft);
    setDraft(null);
  };

  return (
    <li className="border-b border-dashed border-lumen-border py-2 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <span className="w-24 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
          {eventTime(entry, labels.allDay)}
        </span>
        {kind !== null && (
          <span className="flex-shrink-0 text-xs text-lumen-text-secondary">
            {kind}
          </span>
        )}
        {entry.title !== null && (
          <span className="min-w-0 flex-1 text-sm text-lumen-text">
            {entry.title}
          </span>
        )}
        {draft === null && entry.note === null && (
          <button
            type="button"
            onClick={open}
            aria-label={labels.eventNoteAdd(name)}
            className={`ml-auto ${ROW_BUTTON}`}
          >
            {labels.eventNoteButton}
          </button>
        )}
      </div>
      {/* Under the title, not the time column — `md:pl-26` is the w-24
          column plus its gap-2. */}
      {draft !== null ? (
        <div className="mt-1 md:pl-26">
          <input
            type="text"
            autoFocus
            value={draft}
            placeholder={labels.eventNotePlaceholder}
            aria-label={
              entry.note === null
                ? labels.eventNoteAdd(name)
                : labels.eventNoteEdit(name)
            }
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // The Enter that confirms a conversion is not a save (#737).
              if (isImeComposing(e)) return;
              if (e.key === "Enter") {
                e.preventDefault();
                close(true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                close(false);
              }
            }}
            onBlur={() => close(true)}
            className={`block w-full ${ROW_INPUT}`}
          />
        </div>
      ) : (
        entry.note !== null && (
          <div className="mt-0.5 md:pl-26">
            {/* The note itself is the button's name (WCAG 2.5.3 — an
                aria-label here hid the saved text from screen readers); the
                row it belongs to and the「直す」verb ride as its description. */}
            <button
              type="button"
              onClick={open}
              aria-describedby={noteHintId}
              className="rounded-lumen-sm text-left text-sm text-lumen-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11"
            >
              {entry.note}
            </button>
            <span id={noteHintId} hidden>
              {labels.eventNoteEdit(name)}
            </span>
          </div>
        )
      )}
    </li>
  );
}

export function EveningTomorrowRow({
  entry,
  labels,
  onPlace,
}: {
  entry: EveningTomorrowCandidate;
  labels: EveningRowLabels;
  onPlace: (id: string, time: string | null) => void;
}): React.JSX.Element {
  const [time, setTime] = useState("");
  // The spoken name carries the goal as well as the title, read in the order
  // the row prints them: the same title can serve two goals, and a screen
  // reader could not tell their time fields and buttons apart otherwise.
  const name = [entry.title, entry.goalTitle]
    .filter((part): part is string => part !== null)
    .join(" ");
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-dashed border-lumen-border py-2 last:border-b-0">
      <span className="min-w-0 flex-1 text-sm text-lumen-text">
        {entry.title}
        {entry.goalTitle !== null && (
          <span className="ml-2 text-xs text-lumen-text-tertiary">
            {entry.goalTitle}
          </span>
        )}
      </span>
      {entry.placed !== null ? (
        <span className="rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-xs text-lumen-briefing-kohaku">
          {labels.placedTomorrow(entry.placed.time ?? labels.allDay)}
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <input
            type="time"
            value={time}
            aria-label={labels.tomorrowTimeLabel(name)}
            onChange={(e) => setTime(e.target.value)}
            className={ROW_INPUT}
          />
          <button
            type="button"
            onClick={() => onPlace(entry.id, time === "" ? null : time)}
            aria-label={labels.placeTomorrowLabel(name)}
            className={`${ROW_BUTTON} border border-lumen-border`}
          >
            {labels.placeTomorrow}
          </button>
        </span>
      )}
    </li>
  );
}

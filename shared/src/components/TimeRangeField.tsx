import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "./cn";
import { FIELD, FIELD_LABEL } from "./styleTokens";
import { minutesToTime } from "../utils/scheduleGridLayout";
import { isImeComposing } from "../utils/imeGuard";

/*
 * TimeRangeField (#553) — the app-original start–end editor that replaces the
 * native <input type="time"> pair on Schedule surfaces (and is reusable by any
 * screen that edits a time range).
 *
 * Two combo fields: free keyboard entry (commit on Enter/blur, IME-safe,
 * full-width digits accepted) over a snapped option list that opens on focus.
 * The END list annotates each option with the resulting duration, so "until
 * when" and "how long" are answered by the same row. ↑/↓ step a field along
 * the snap grid without leaving the keyboard.
 *
 * The field OWNS the range invariant — a commit can never produce end ≤
 * start: moving the start drags the end along (duration preserved, capped at
 * 23:59), and an end typed at-or-before the start lands one step after it.
 * Both halves therefore report through ONE onChange payload; a host that
 * writes per-field would otherwise fire two writes (and, on a routine
 * occurrence, two scope dialogs) for a single gesture.
 *
 * Pure presentation (§3.1/§6.4): labels + the duration formatter arrive from
 * the host already translated; lumen-* tokens only; the option lists are
 * DOM-event driven (no coordinate math), so jsdom can exercise every path.
 */

export interface TimeRangeValue {
  /** HH:MM (24h). */
  start: string;
  /** HH:MM (24h), always after `start`. */
  end: string;
}

export interface TimeRangeFieldLabels {
  /** Field label + accessible name for the start combo. */
  start: string;
  /** Field label + accessible name for the end combo. */
  end: string;
}

export interface TimeRangeFieldProps {
  start: string;
  end: string;
  /** One combined commit; the field guarantees start < end. */
  onChange: (next: TimeRangeValue) => void;
  labels: TimeRangeFieldLabels;
  /** Snap grid for the option lists and ↑/↓ stepping. Default 15. */
  stepMinutes?: number;
  /**
   * Formats the duration suffix on end options (e.g. 90 → "1時間30分").
   * Omit to render the bare times.
   */
  formatDuration?: (minutes: number) => string;
  className?: string;
}

const DAY_MAX = 23 * 60 + 59; // 23:59 — the latest same-day end we can write.

/** Full-width digits / colon → ASCII, so an IME-entered "１４：３０" parses. */
function normalize(raw: string): string {
  return raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .trim();
}

/** "9", "930", "0930", "9:3", "09:30" → minutes-from-midnight, else null. */
export function parseTimeInput(raw: string): number | null {
  const s = normalize(raw);
  if (!s) return null;
  let h: number;
  let m: number;
  const colon = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

// Same HH:MM formatter as the schedule grid's. Its 0–24:00 clamp is a no-op
// here: every caller feeds a value already bounded by `step()` /
// `parseTimeInput` / the `m < 24 * 60` option loop.
const fmt = minutesToTime;

function TimeCombo({
  value,
  ariaLabel,
  options,
  activeOption,
  onCommitRaw,
  onPick,
  onStep,
  renderOption,
}: {
  value: string;
  ariaLabel: string;
  /** Snapped option list (minutes). */
  options: number[];
  /** The option to highlight + scroll to when the list opens. */
  activeOption: number;
  /** Commit a typed value (raw text; parser + invariant live in the parent). */
  onCommitRaw: (raw: string) => void;
  /** Commit a picked option (already valid). */
  onPick: (min: number) => void;
  /** ↑/↓ stepping (+1 / -1 grid step). */
  onStep: (direction: 1 | -1) => void;
  renderOption: (min: number) => string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Bring the active option into view when the list opens (jsdom has no
  // scrollIntoView — the optional call keeps tests running).
  useLayoutEffect(() => {
    if (open) activeRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open]);

  const commitDraft = () => {
    if (draft != null && draft !== value) onCommitRaw(draft);
    setDraft(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e)) return; // IME guard (§frontend gotcha)
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
      setOpen(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(null);
      setOpen(false);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      setDraft(null);
      setOpen(false);
      onStep(e.key === "ArrowUp" ? 1 : -1);
    }
  };

  return (
    <div className="relative">
      <input
        value={draft ?? value}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        placeholder="HH:MM"
        inputMode="numeric"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          // Typing after an Enter closed the list brings it back — focus
          // alone cannot, since focus never left.
          setOpen(true);
        }}
        onBlur={() => {
          commitDraft();
          setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        className={cn(FIELD, "w-full tabular-nums")}
      />
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full min-w-max overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg py-1 shadow-lumen-lg"
        >
          {options.map((min) => {
            const active = min === activeOption;
            return (
              <li key={min} role="presentation">
                <button
                  ref={active ? activeRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  // preventDefault so the input keeps focus — a mousedown blur
                  // would commit the draft and close the list before the click
                  // lands on this row.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraft(null);
                    setOpen(false);
                    onPick(min);
                  }}
                  className={cn(
                    "w-full whitespace-nowrap px-2.5 py-1.5 text-left text-sm tabular-nums transition-colors",
                    active
                      ? "bg-lumen-accent-subtle text-lumen-accent"
                      : "text-lumen-text hover:bg-lumen-hover",
                  )}
                >
                  {renderOption(min)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TimeRangeField({
  start,
  end,
  onChange,
  labels,
  stepMinutes = 15,
  formatDuration,
  className,
}: TimeRangeFieldProps) {
  const startMin = parseTimeInput(start) ?? 9 * 60;
  const endMin = Math.min(parseTimeInput(end) ?? startMin + 60, DAY_MAX);

  /** Move the start; the end rides along so the duration survives (capped at
   *  23:59 — the end must stay on the same day). */
  const commitStart = (nextStart: number) => {
    const duration = Math.max(endMin - startMin, stepMinutes);
    const nextEnd =
      nextStart < endMin ? endMin : Math.min(nextStart + duration, DAY_MAX);
    // A start so late that no same-day end fits (23:59) is invalid input —
    // reject it like unparsable text rather than commit a degenerate range.
    if (nextEnd <= nextStart) return;
    if (nextStart === startMin && nextEnd === endMin) return;
    onChange({ start: fmt(nextStart), end: fmt(nextEnd) });
  };

  /** Move the end; at-or-before the start lands one step after it instead. */
  const commitEnd = (nextEnd: number) => {
    const fixed =
      nextEnd > startMin ? nextEnd : Math.min(startMin + stepMinutes, DAY_MAX);
    if (fixed === endMin) return;
    onChange({ start: fmt(startMin), end: fmt(fixed) });
  };

  const startOptions = useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m < 24 * 60; m += stepMinutes) list.push(m);
    return list;
  }, [stepMinutes]);

  // End options: every grid point after the start, so an off-grid start
  // (typed 09:10) still offers 09:15, 09:30, …
  const endOptions = useMemo(() => {
    const first =
      Math.floor(startMin / stepMinutes) * stepMinutes + stepMinutes;
    const list: number[] = [];
    for (let m = first; m < 24 * 60; m += stepMinutes) list.push(m);
    return list;
  }, [startMin, stepMinutes]);

  const step = (base: number, direction: 1 | -1) => {
    const snapped =
      direction === 1
        ? Math.floor(base / stepMinutes) * stepMinutes + stepMinutes
        : Math.ceil(base / stepMinutes) * stepMinutes - stepMinutes;
    return Math.min(Math.max(snapped, 0), 24 * 60 - stepMinutes);
  };

  /*
   * `min-w-0` is what lets the pair fit a phone (#1036). A flex item defaults
   * to `min-width: auto`, which floors it at the CONTENT's min-content width —
   * and an <input> reports the ~20-character box browsers give it by default,
   * not the "HH:MM" it actually holds. Two of those plus the gap need ~370px,
   * so at 375px the pair pushed out through the right edge of the sheet (the
   * full-screen BottomSheet scrolls, so the overflow became a horizontal
   * scrollbar rather than being clipped). `w-full` on the input cannot fix it:
   * a percentage width is ignored while the parent computes its intrinsic
   * minimum. Releasing the floor lets `flex-1` do what it already said.
   */
  const COMBO_COL = cn("flex min-w-0 flex-1 flex-col gap-1", FIELD_LABEL);

  return (
    <div className={cn("flex gap-2", className)}>
      <label className={COMBO_COL}>
        {labels.start}
        <TimeCombo
          value={fmt(startMin)}
          ariaLabel={labels.start}
          options={startOptions}
          activeOption={Math.floor(startMin / stepMinutes) * stepMinutes}
          onCommitRaw={(raw) => {
            const parsed = parseTimeInput(raw);
            if (parsed != null) commitStart(parsed);
          }}
          onPick={commitStart}
          onStep={(d) => {
            const next = step(startMin, d);
            // step() clamps to the grid's ends, so against a rail it can
            // hand back a move in the WRONG direction — drop those.
            if (d === 1 ? next > startMin : next < startMin) {
              commitStart(next);
            }
          }}
          renderOption={fmt}
        />
      </label>
      <label className={COMBO_COL}>
        {labels.end}
        <TimeCombo
          value={fmt(endMin)}
          ariaLabel={labels.end}
          options={endOptions}
          // Snapped so an off-grid end (drag-resized 10:07) still highlights
          // its nearest row instead of nothing.
          activeOption={Math.floor(endMin / stepMinutes) * stepMinutes}
          onCommitRaw={(raw) => {
            const parsed = parseTimeInput(raw);
            if (parsed != null) commitEnd(parsed);
          }}
          onPick={commitEnd}
          onStep={(d) => {
            const next = step(endMin, d);
            // Same wrong-direction guard as the start, plus the range floor:
            // stepping down against the start is a no-op, not a re-fix.
            if ((d === 1 ? next > endMin : next < endMin) && next > startMin) {
              commitEnd(next);
            }
          }}
          renderOption={(min) =>
            formatDuration
              ? `${fmt(min)} (${formatDuration(min - startMin)})`
              : fmt(min)
          }
        />
      </label>
    </div>
  );
}

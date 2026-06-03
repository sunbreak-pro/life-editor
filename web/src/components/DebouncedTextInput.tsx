import { useEffect, useRef, useState } from "react";

/*
 * DebouncedTextInput (M3). A controlled-draft text/time input that
 * debounces the persist callback and flushes immediately on blur + on
 * unmount. Extracted verbatim from the NotesView `NoteTitleInput`
 * debounce-and-flush pattern (300ms local draft + blur flush + unmount
 * flush) so Schedule inline edits (ScheduleItemsView item title/time,
 * ScheduleView routine title/time) stop firing a DataService write per
 * keystroke. The eventually-persisted value is unchanged — only the
 * write cadence differs.
 *
 * Re-seeding: the parent remounts via `key={<rowId>}` so a row switch
 * re-seeds the draft cleanly (single-user app — an external rename
 * re-seed mid-typing is not needed, same rationale as NoteTitleInput).
 *
 * IME: a native <input> handles IME composition itself; the draft is
 * local React state so composition is never interrupted (CLAUDE.md §6.6
 * — no manual keydown handler that could break `isComposing`).
 */

interface DebouncedTextInputProps {
  value: string;
  onCommit: (value: string) => void;
  type?: "text" | "time";
  debounceMs?: number;
  className?: string;
  "aria-label"?: string;
}

export function DebouncedTextInput({
  value,
  onCommit,
  type = "text",
  debounceMs = 300,
  className,
  "aria-label": ariaLabel,
}: DebouncedTextInputProps) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      onCommitRef.current(pendingRef.current);
      pendingRef.current = null;
    }
  };

  useEffect(() => {
    // flush only touches refs (stable for this component lifetime), so
    // an empty dep array is correct — same as NoteTitleInput.
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      type={type}
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        pendingRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, debounceMs);
      }}
      onBlur={flush}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

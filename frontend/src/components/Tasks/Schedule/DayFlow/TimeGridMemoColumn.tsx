import { useState, useCallback, useRef, useEffect } from "react";
import { TIME_GRID } from "../../../../constants/timeGrid";
import type { TimeMemo } from "../../../../types/timeMemo";

const HOURS = Array.from(
  { length: TIME_GRID.END_HOUR - TIME_GRID.START_HOUR },
  (_, i) => i + TIME_GRID.START_HOUR,
);

interface TimeGridMemoColumnProps {
  date: string;
  timeMemos: TimeMemo[];
  onUpsertMemo: (date: string, hour: number, content: string) => void;
}

function MemoCell({
  hour,
  memo,
  date,
  onUpsertMemo,
}: {
  hour: number;
  memo: TimeMemo | undefined;
  date: string;
  onUpsertMemo: (date: string, hour: number, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(memo?.content ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(memo?.content ?? "");
  }, [memo?.content]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed !== (memo?.content ?? "")) {
      if (trimmed) {
        onUpsertMemo(date, hour, trimmed);
      }
    }
  }, [value, memo?.content, date, hour, onUpsertMemo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setValue(memo?.content ?? "");
        setEditing(false);
      }
    },
    [memo?.content],
  );

  const hasMemo = !!memo?.content;

  return (
    <div
      className={`absolute w-full border-b border-notion-border/30 px-1.5 ${
        hasMemo ? "bg-notion-accent/5" : ""
      }`}
      style={{
        top: (hour - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT,
        height: TIME_GRID.SLOT_HEIGHT,
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-transparent text-[10px] text-notion-text resize-none outline-none py-1 leading-tight"
          placeholder="..."
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="w-full h-full cursor-text py-1 overflow-hidden"
        >
          {hasMemo ? (
            <span className="text-[10px] text-notion-text leading-tight line-clamp-3 whitespace-pre-wrap">
              {memo.content}
            </span>
          ) : (
            <span className="text-[10px] text-notion-text-secondary/30 select-none">
              ...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function TimeGridMemoColumn({
  date,
  timeMemos,
  onUpsertMemo,
}: TimeGridMemoColumnProps) {
  const totalHeight =
    (TIME_GRID.END_HOUR - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;

  const memoMap = new Map<number, TimeMemo>();
  for (const m of timeMemos) {
    memoMap.set(m.hour, m);
  }

  return (
    <div
      className="relative border-l border-notion-border/50"
      style={{ height: totalHeight }}
    >
      {HOURS.map((hour) => (
        <MemoCell
          key={hour}
          hour={hour}
          memo={memoMap.get(hour)}
          date={date}
          onUpsertMemo={onUpsertMemo}
        />
      ))}
    </div>
  );
}

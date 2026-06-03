import {
  MessageSquare,
  MessageSquareText,
  Timer as TimerIcon,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";
import { deleteTimerSession, updateTimerSession } from "../lib/mockStore";
import { C } from "../lib/theme";
import type { SessionType, TimerSession } from "../lib/types";
import { BottomSheet } from "./BottomSheet";

/**
 * Shared Pomodoro session-history list (Work › History tab and Schedule › History
 * view both render this). Groups sessions by day, reveals a delete button on
 * left-swipe, and lets WORK sessions carry an editable memo (tap the message icon).
 */

const sessionColor = (t: SessionType): string =>
  t === "WORK" ? C.mauve : t === "BREAK" ? C.green : C.sky;

const sessionLabel = (t: SessionType): string =>
  t === "WORK" ? "WORK" : t === "BREAK" ? "BREAK" : "LONG BREAK";

const pad2 = (n: number): string => String(n).padStart(2, "0");

const formatDurationMin = (sec: number): string => `${Math.round(sec / 60)}m`;

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatDateLabel = (ts: number, today: Date): string => {
  const d = new Date(ts);
  const y = ymd(d);
  if (y === ymd(today)) return "今日";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (y === ymd(yesterday)) return "昨日";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

export function SessionHistoryList({ sessions }: { sessions: TimerSession[] }) {
  const today = useMemo(() => new Date(), []);
  const [editTarget, setEditTarget] = useState<TimerSession | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TimerSession | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, TimerSession[]>();
    for (const s of [...sessions].sort(
      (a, b) => b.completedAt - a.completedAt,
    )) {
      const label = formatDateLabel(s.completedAt, today);
      const arr = map.get(label) ?? [];
      arr.push(s);
      map.set(label, arr);
    }
    return Array.from(map.entries());
  }, [sessions, today]);

  // `editTarget` is captured at open time; keep it pointing at the freshest copy
  // so the memo a row shows stays in sync after a save.
  const liveEditTarget = editTarget
    ? (sessions.find((s) => s.id === editTarget.id) ?? null)
    : null;

  if (groups.length === 0) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center gap-2 px-4 text-center"
        style={{ color: C.subtext0 }}
      >
        <TimerIcon size={32} />
        <div className="text-sm">セッション履歴はまだありません</div>
        <div className="text-xs">Timer タブで開始しましょう</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-4">
      {groups.map(([label, items]) => (
        <section key={label}>
          <header
            className="px-3 py-2 text-xs font-medium sticky top-0 z-10"
            style={{
              color: C.subtext1,
              background: C.mantle,
              borderBottom: `1px solid ${C.surface1}`,
            }}
          >
            {label} ({items.length})
          </header>
          {items.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              swipeOpen={swipeOpenId === s.id}
              onRequestSwipeOpen={() => setSwipeOpenId(s.id)}
              onRequestSwipeClose={() =>
                setSwipeOpenId((id) => (id === s.id ? null : id))
              }
              onAskDelete={() => setConfirmDelete(s)}
              onEditComment={() => setEditTarget(s)}
            />
          ))}
        </section>
      ))}

      <CommentEditor
        session={liveEditTarget}
        onClose={() => setEditTarget(null)}
      />

      {confirmDelete && (
        <ConfirmDeleteModal
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            deleteTimerSession(confirmDelete.id);
            setConfirmDelete(null);
            setSwipeOpenId(null);
          }}
        />
      )}
    </div>
  );
}

const ACTION_W = 88;
const SWIPE_THRESHOLD = 44;

function SessionRow({
  session,
  swipeOpen,
  onRequestSwipeOpen,
  onRequestSwipeClose,
  onAskDelete,
  onEditComment,
}: {
  session: TimerSession;
  swipeOpen: boolean;
  onRequestSwipeOpen: () => void;
  onRequestSwipeClose: () => void;
  onAskDelete: () => void;
  onEditComment: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{
    x: number;
    y: number;
    locked: "h" | "v" | null;
  } | null>(null);

  useEffect(() => {
    if (!dragging) setDx(swipeOpen ? -ACTION_W : 0);
  }, [swipeOpen, dragging]);

  const onDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, locked: null };
    setDragging(true);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!startRef.current) return;
    const ddx = e.clientX - startRef.current.x;
    const ddy = e.clientY - startRef.current.y;
    if (startRef.current.locked === null) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      startRef.current.locked = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
    }
    if (startRef.current.locked !== "h") return;
    const base = swipeOpen ? -ACTION_W : 0;
    setDx(Math.min(0, Math.max(-ACTION_W * 1.2, base + ddx)));
  };
  const onUp = () => {
    const locked = startRef.current?.locked ?? null;
    startRef.current = null;
    setDragging(false);
    if (locked !== "h") return;
    const open = -dx > SWIPE_THRESHOLD;
    setDx(open ? -ACTION_W : 0);
    if (open) onRequestSwipeOpen();
    else onRequestSwipeClose();
  };
  const onCancel = () => {
    startRef.current = null;
    setDragging(false);
    setDx(swipeOpen ? -ACTION_W : 0);
  };

  // While the delete action is revealed, a tap on the row content just closes it.
  const onContentClickCapture = (e: React.MouseEvent) => {
    if (swipeOpen) {
      e.stopPropagation();
      e.preventDefault();
      onRequestSwipeClose();
    }
  };

  const isWork = session.sessionType === "WORK";
  const hasComment = !!session.comment && session.comment.trim().length > 0;
  const c = sessionColor(session.sessionType);
  const time = new Date(session.completedAt - session.durationSec * 1000);

  return (
    <div
      className="relative overflow-hidden"
      style={{ touchAction: "pan-y", background: C.red }}
    >
      <button
        type="button"
        onClick={onAskDelete}
        aria-label="このセッションを削除"
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 text-xs font-medium"
        style={{ width: ACTION_W, background: C.red, color: C.crust }}
      >
        <Trash2 size={18} />
        削除
      </button>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onClickCapture={onContentClickCapture}
        className="min-h-[56px] flex items-center px-3 gap-2 select-none"
        style={{
          transform: `translate3d(${dx}px, 0, 0)`,
          transition: dragging ? "none" : "transform 200ms ease",
          background: C.base,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <div
          className="text-sm font-mono shrink-0 w-12"
          style={{ color: C.subtext0 }}
        >
          {pad2(time.getHours())}:{pad2(time.getMinutes())}
        </div>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: c }}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className="text-sm truncate"
            style={{ color: session.scheduleItemTitle ? C.text : C.subtext0 }}
          >
            {session.scheduleItemTitle ?? "(休憩)"}
          </div>
          {hasComment && (
            <div className="text-xs truncate" style={{ color: C.subtext0 }}>
              {session.comment}
            </div>
          )}
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
          style={{ background: c, color: C.base, fontWeight: 600 }}
        >
          {sessionLabel(session.sessionType)}
        </span>
        <div
          className="text-xs font-mono shrink-0 w-10 text-right"
          style={{ color: C.subtext0 }}
        >
          {formatDurationMin(session.durationSec)}
        </div>
        {isWork && (
          <button
            type="button"
            onClick={onEditComment}
            aria-label={hasComment ? "メモを編集" : "メモを追加"}
            className="shrink-0 grid place-items-center"
            style={{
              width: 36,
              height: 36,
              color: hasComment ? C.mauve : C.overlay0,
            }}
          >
            {hasComment ? (
              <MessageSquareText size={18} />
            ) : (
              <MessageSquare size={18} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CommentEditor({
  session,
  onClose,
}: {
  session: TimerSession | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(session?.comment ?? "");
  }, [session]);

  const save = () => {
    if (session) {
      updateTimerSession(session.id, { comment: draft.trim() || undefined });
    }
    onClose();
  };

  return (
    <BottomSheet
      open={!!session}
      onClose={save}
      title="セッションのメモ"
      rightLabel="保存"
      onRightClick={save}
      snapPoints={[0.5, 0.92]}
    >
      <div className="p-3 flex flex-col gap-2">
        {session && (
          <div className="text-xs" style={{ color: C.subtext0 }}>
            {session.scheduleItemTitle ?? "(休憩)"}
          </div>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="このセッションでやったこと・気づき..."
          rows={6}
          className="w-full bg-transparent outline-none text-sm leading-relaxed p-2 rounded-md"
          style={{
            color: C.text,
            border: `1px solid ${C.surface1}`,
            background: C.crust,
            resize: "none",
            minHeight: 140,
          }}
        />
      </div>
    </BottomSheet>
  );
}

function ConfirmDeleteModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useDismissOnEscape(true, onCancel);
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label="閉じる"
        className="fixed inset-0 z-[60]"
        style={{ background: C.crust, opacity: 0.7 }}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="このセッションを削除しますか?"
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto"
          style={{ background: C.base, border: `1px solid ${C.surface1}` }}
        >
          <div className="text-sm font-medium" style={{ color: C.text }}>
            このセッションを削除しますか?
          </div>
          <div className="text-xs" style={{ color: C.subtext0 }}>
            ゴミ箱から復元できます
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-md text-sm"
              style={{ border: `1px solid ${C.surface1}`, color: C.text }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="h-10 rounded-md text-sm font-medium"
              style={{ background: C.red, color: C.base }}
            >
              削除
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

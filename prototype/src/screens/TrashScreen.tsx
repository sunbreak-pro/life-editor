import {
  Calendar as CalendarIcon,
  ChevronLeft,
  Clock,
  FileText,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useMockStore } from "../hooks/useMockStore";
import {
  getState,
  purgeAllTrash,
  purgeNote,
  purgePreset,
  purgeScheduleItem,
  purgeTimerSession,
  restoreNote,
  restorePreset,
  restoreScheduleItem,
  restoreTimerSession,
} from "../lib/mockStore";

const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay0: "#6c7086",
  mauve: "#cba6f7",
  red: "#f38ba8",
} as const;

type TrashKind = "all" | "schedule" | "note" | "daily" | "preset" | "session";

interface TrashRow {
  id: string;
  kind: TrashKind;
  title: string;
  deletedAt: number;
}

const KIND_LABEL: Record<TrashKind, string> = {
  all: "全て",
  schedule: "Sch",
  note: "Note",
  daily: "Daily",
  preset: "Preset",
  session: "Session",
};

const formatTimeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  const dt = new Date(ts);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
};

const formatDailyTitle = (date: string): string => {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
};

export function TrashScreen() {
  const nav = useNavigate();
  const [filter, setFilter] = useState<TrashKind>("all");
  const [confirmPurge, setConfirmPurge] = useState<TrashRow | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const scheduleItems = useMockStore((s) => s.scheduleItems);
  const notes = useMockStore((s) => s.notes);
  const presets = useMockStore((s) => s.presets);
  const timerSessions = useMockStore((s) => s.timerSessions);

  const rows: TrashRow[] = useMemo(() => {
    const out: TrashRow[] = [];
    for (const it of scheduleItems) {
      if (!it.isDeleted || it.deletedAt === undefined) continue;
      out.push({
        id: it.id,
        kind: "schedule",
        title: it.title,
        deletedAt: it.deletedAt,
      });
    }
    for (const n of notes) {
      if (!n.isDeleted || n.deletedAt === undefined) continue;
      out.push({
        id: n.id,
        kind: n.kind === "daily" ? "daily" : "note",
        title:
          n.kind === "daily" && n.date
            ? formatDailyTitle(n.date)
            : n.title || "(無題)",
        deletedAt: n.deletedAt,
      });
    }
    for (const p of presets) {
      if (!p.isDeleted || p.deletedAt === undefined) continue;
      out.push({
        id: p.id,
        kind: "preset",
        title: p.name,
        deletedAt: p.deletedAt,
      });
    }
    for (const s of timerSessions) {
      if (!s.isDeleted || s.deletedAt === undefined) continue;
      out.push({
        id: s.id,
        kind: "session",
        title: s.scheduleItemTitle ?? "(休憩)",
        deletedAt: s.deletedAt,
      });
    }
    return out.sort((a, b) => b.deletedAt - a.deletedAt);
  }, [scheduleItems, notes, presets, timerSessions]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.kind === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const m: Record<TrashKind, number> = {
      all: rows.length,
      schedule: 0,
      note: 0,
      daily: 0,
      preset: 0,
      session: 0,
    };
    for (const r of rows) m[r.kind]++;
    return m;
  }, [rows]);

  const handleRestore = (row: TrashRow) => {
    if (row.kind === "schedule") restoreScheduleItem(row.id);
    else if (row.kind === "note" || row.kind === "daily") {
      if (row.kind === "daily") {
        const state = getState();
        const existing = state.notes.find(
          (n) => !n.isDeleted && n.kind === "daily" && n.id === row.id,
        );
        if (existing) {
          setToast("同日の Daily が既に存在します");
          return;
        }
      }
      restoreNote(row.id);
    } else if (row.kind === "preset") restorePreset(row.id);
    else if (row.kind === "session") restoreTimerSession(row.id);
  };

  const handlePurge = (row: TrashRow) => {
    if (row.kind === "schedule") purgeScheduleItem(row.id);
    else if (row.kind === "note" || row.kind === "daily") purgeNote(row.id);
    else if (row.kind === "preset") purgePreset(row.id);
    else if (row.kind === "session") purgeTimerSession(row.id);
    setConfirmPurge(null);
  };

  return (
    <div
      className="mx-auto max-w-md h-screen flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <header
        className="h-12 flex items-center px-1 shrink-0"
        style={{
          background: C.mantle,
          borderBottom: `1px solid ${C.surface1}`,
        }}
      >
        <button
          type="button"
          onClick={() => nav("/settings")}
          aria-label="設定へ戻る"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={22} color={C.text} />
        </button>
        <h1
          className="flex-1 text-center text-base font-medium"
          style={{ color: C.text }}
        >
          ゴミ箱
        </h1>
        <button
          type="button"
          onClick={() => rows.length > 0 && setConfirmAll(true)}
          disabled={rows.length === 0}
          className="text-sm px-3 min-h-[44px] disabled:opacity-50"
          style={{ color: C.red }}
        >
          全削除
        </button>
      </header>

      <div
        className="h-10 flex items-center gap-1 px-3 shrink-0 overflow-x-auto"
        style={{ borderBottom: `1px solid ${C.surface1}` }}
      >
        {(
          [
            "all",
            "schedule",
            "note",
            "daily",
            "preset",
            "session",
          ] as TrashKind[]
        ).map((k) => {
          const active = filter === k;
          const count = counts[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className="h-8 px-3 rounded-full text-xs shrink-0 transition-transform active:scale-[0.98]"
              style={{
                background: active ? C.mauve : C.surface0,
                color: active ? C.base : C.subtext1,
                fontWeight: active ? 600 : 400,
              }}
            >
              {KIND_LABEL[k]} ({count})
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-auto p-3" style={{ background: C.base }}>
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => (
              <TrashItemRow
                key={r.id}
                row={r}
                onRestore={() => handleRestore(r)}
                onPurge={() => setConfirmPurge(r)}
              />
            ))}
          </div>
        )}
      </main>

      <BottomTabBar />

      {confirmPurge && (
        <ConfirmModal
          title="完全に削除しますか?"
          message={confirmPurge.title}
          danger
          onCancel={() => setConfirmPurge(null)}
          onConfirm={() => handlePurge(confirmPurge)}
        />
      )}
      {confirmAll && (
        <ConfirmModal
          title="ゴミ箱を空にしますか?"
          message="ゴミ箱内の全項目を完全に削除します"
          danger
          onCancel={() => setConfirmAll(false)}
          onConfirm={() => {
            purgeAllTrash();
            setConfirmAll(false);
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

function TrashItemRow({
  row,
  onRestore,
  onPurge,
}: {
  row: TrashRow;
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: C.surface0 }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 text-base font-medium" style={{ color: C.text }}>
          {row.title}
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
          style={{ background: C.surface1, color: C.subtext1 }}
        >
          {KIND_LABEL[row.kind]}
        </span>
      </div>
      <div className="text-xs" style={{ color: C.subtext0 }}>
        {formatTimeAgo(row.deletedAt)} 削除
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          type="button"
          onClick={onRestore}
          className="h-9 rounded-md text-sm font-medium"
          style={{ background: C.mauve, color: C.base }}
        >
          復元
        </button>
        <button
          type="button"
          onClick={onPurge}
          className="h-9 rounded-md text-sm"
          style={{
            background: C.surface1,
            border: `1px solid ${C.red}`,
            color: C.red,
          }}
        >
          完全削除
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-3 text-center"
      style={{ color: C.subtext0 }}
    >
      <Trash2 size={64} color={C.overlay0} />
      <div className="text-base" style={{ color: C.subtext1 }}>
        ゴミ箱は空です
      </div>
      <div className="text-xs">削除した項目はここに表示されます</div>
    </div>
  );
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), 2000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="absolute inset-x-0 bottom-20 flex justify-center pointer-events-none">
      <div
        className="px-4 py-2 rounded-md text-sm shadow-lg"
        style={{ background: C.surface0, color: C.text }}
      >
        {text}
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  message?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.7 }}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto"
          style={{ background: C.base, border: `1px solid ${C.surface1}` }}
        >
          <div className="text-sm font-medium" style={{ color: C.text }}>
            {title}
          </div>
          {message && (
            <div className="text-xs truncate" style={{ color: C.subtext0 }}>
              {message}
            </div>
          )}
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
              style={{ background: danger ? C.red : C.mauve, color: C.base }}
            >
              実行
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function BottomTabBar() {
  const tabs: { to: string; label: string; Icon: typeof CalendarIcon }[] = [
    { to: "/schedule", label: "Sch", Icon: CalendarIcon },
    { to: "/work", label: "Wrk", Icon: Clock },
    { to: "/materials", label: "Mat", Icon: FileText },
    { to: "/settings", label: "Set", Icon: SettingsIcon },
  ];
  return (
    <nav
      className="h-14 grid grid-cols-4 shrink-0"
      style={{ background: C.mantle, borderTop: `1px solid ${C.surface1}` }}
    >
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className="flex flex-col items-center justify-center gap-0.5 active:opacity-70"
          style={({ isActive }) => ({
            color: isActive || to === "/settings" ? C.mauve : C.overlay0,
          })}
        >
          <Icon size={20} />
          <span className="text-[10px]">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

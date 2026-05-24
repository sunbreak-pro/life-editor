import {
  Calendar as CalendarIcon,
  Check,
  Clock,
  FileText,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  SkipForward,
  Timer as TimerIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useMockStore } from "../hooks/useMockStore";
import {
  addPreset,
  addTimerSession,
  deletePreset,
  deleteTimerSession,
  setActivePresetId,
  setAutoStartBreaks,
  setCurrentTaskId,
  updatePreset,
  updateScheduleItem,
} from "../lib/mockStore";
import type {
  PomodoroPreset,
  ScheduleItem,
  SessionType,
  TimerSession,
  WikiTag,
} from "../lib/types";

const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay0: "#6c7086",
  mauve: "#cba6f7",
  pink: "#f5c2e7",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  sky: "#89dceb",
  red: "#f38ba8",
} as const;

type SubTab = "timer" | "history" | "settings";

const sessionColor = (t: SessionType): string =>
  t === "WORK" ? C.mauve : t === "BREAK" ? C.green : C.sky;

const sessionLabel = (t: SessionType): string =>
  t === "WORK" ? "WORK" : t === "BREAK" ? "BREAK" : "LONG BREAK";

const pad2 = (n: number): string => String(n).padStart(2, "0");

const formatCountdown = (sec: number): string => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(m)}:${pad2(ss)}`;
};

const formatDurationMin = (sec: number): string => `${Math.round(sec / 60)}m`;

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatDateLabel = (ts: number, today: Date): string => {
  const d = new Date(ts);
  const y = ymd(d);
  const t = ymd(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yes = ymd(yesterday);
  if (y === t) return "今日";
  if (y === yes) return "昨日";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const plannedSecFor = (preset: PomodoroPreset, type: SessionType): number => {
  if (type === "WORK") return preset.workMin * 60;
  if (type === "BREAK") return preset.breakMin * 60;
  return preset.longBreakMin * 60;
};

const mapTags = (tags: WikiTag[]): Map<string, WikiTag> => {
  const m = new Map<string, WikiTag>();
  for (const t of tags) m.set(t.id, t);
  return m;
};

export function WorkScreen() {
  const [tab, setTab] = useState<SubTab>("timer");
  const allPresets = useMockStore((s) => s.presets);
  const activePresetId = useMockStore((s) => s.activePresetId);
  const currentTaskId = useMockStore((s) => s.currentTaskId);
  const autoStartBreaks = useMockStore((s) => s.autoStartBreaks);
  const allScheduleItems = useMockStore((s) => s.scheduleItems);
  const allSessions = useMockStore((s) => s.timerSessions);
  const wikiTags = useMockStore((s) => s.wikiTags);
  const presets = useMemo(
    () => allPresets.filter((p) => !p.isDeleted),
    [allPresets],
  );
  const scheduleItems = useMemo(
    () => allScheduleItems.filter((i) => !i.isDeleted && i.type === "task"),
    [allScheduleItems],
  );
  const sessions = useMemo(
    () => allSessions.filter((x) => !x.isDeleted),
    [allSessions],
  );

  const activePreset =
    presets.find((p) => p.id === activePresetId) ?? presets[0] ?? null;
  const currentTask = scheduleItems.find((s) => s.id === currentTaskId) ?? null;

  return (
    <div
      className="mx-auto max-w-md h-screen flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <SubTabBar tab={tab} onChange={setTab} />
      <main className="flex-1 overflow-auto" style={{ background: C.base }}>
        {tab === "timer" && activePreset && (
          <TimerTab
            preset={activePreset}
            currentTask={currentTask}
            scheduleTasks={scheduleItems}
            wikiTags={wikiTags}
            autoStartBreaks={autoStartBreaks}
          />
        )}
        {tab === "history" && <HistoryTab sessions={sessions} />}
        {tab === "settings" && (
          <SettingsTab
            presets={presets}
            activePreset={activePreset}
            autoStartBreaks={autoStartBreaks}
          />
        )}
      </main>
      <BottomTabBar />
    </div>
  );
}

function SubTabBar({
  tab,
  onChange,
}: {
  tab: SubTab;
  onChange: (t: SubTab) => void;
}) {
  const items: { id: SubTab; label: string }[] = [
    { id: "timer", label: "Timer" },
    { id: "history", label: "History" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <div
      className="h-12 grid grid-cols-3 shrink-0"
      style={{ background: C.mantle, borderBottom: `1px solid ${C.surface1}` }}
    >
      {items.map((it) => {
        const active = it.id === tab;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className="text-sm transition active:opacity-70 flex items-center justify-center"
            style={{
              color: active ? C.text : C.overlay0,
              fontWeight: active ? 600 : 400,
              borderBottom: `2px solid ${active ? C.mauve : "transparent"}`,
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function TimerTab({
  preset,
  currentTask,
  scheduleTasks,
  wikiTags,
  autoStartBreaks,
}: {
  preset: PomodoroPreset;
  currentTask: ScheduleItem | null;
  scheduleTasks: ScheduleItem[];
  wikiTags: WikiTag[];
  autoStartBreaks: boolean;
}) {
  const [sessionType, setSessionType] = useState<SessionType>("WORK");
  const [remainingSec, setRemainingSec] = useState<number>(
    plannedSecFor(preset, "WORK"),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [completedWorks, setCompletedWorks] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [completionModal, setCompletionModal] = useState<{
    type: SessionType;
    durationSec: number;
    skipped: boolean;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskDoneAsk, setTaskDoneAsk] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);

  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const plannedRef = useRef<number>(plannedSecFor(preset, "WORK"));
  const endHandlerRef = useRef<(skipped: boolean) => void>(() => {});

  useEffect(() => {
    if (!isRunning) {
      setRemainingSec(plannedSecFor(preset, sessionType));
      plannedRef.current = plannedSecFor(preset, sessionType);
    }
  }, [preset, sessionType, isRunning]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          window.setTimeout(() => endHandlerRef.current(false), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    if (autoCountdown === null) return;
    if (autoCountdown <= 0) {
      setAutoCountdown(null);
      setSessionType("BREAK");
      setRemainingSec(plannedSecFor(preset, "BREAK"));
      plannedRef.current = plannedSecFor(preset, "BREAK");
      startedAtRef.current = Date.now();
      setIsRunning(true);
      return;
    }
    const t = window.setTimeout(
      () => setAutoCountdown((n) => (n === null ? null : n - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [autoCountdown, preset]);

  const handleSessionEnd = (skipped: boolean) => {
    setIsRunning(false);
    const planned = plannedRef.current;
    const elapsed = skipped ? Math.max(0, planned - remainingSec) : planned;
    setPulseKey((k) => k + 1);
    if (startedAtRef.current === 0) {
      startedAtRef.current = Date.now() - elapsed * 1000;
    }
    addTimerSession({
      scheduleItemId: sessionType === "WORK" ? (currentTask?.id ?? null) : null,
      scheduleItemTitle:
        sessionType === "WORK" ? (currentTask?.title ?? null) : null,
      sessionType,
      plannedSec: planned,
      durationSec: elapsed,
      startedAt: startedAtRef.current,
      completedAt: Date.now(),
    });
    if (sessionType === "WORK" && !skipped) {
      setCompletedWorks((n) => n + 1);
      if (currentTask && currentTask.status === "todo") {
        updateScheduleItem(currentTask.id, { status: "doing" });
      }
    }
    setCompletionModal({ type: sessionType, durationSec: elapsed, skipped });
  };
  endHandlerRef.current = handleSessionEnd;

  const handleStart = () => {
    startedAtRef.current = Date.now();
    plannedRef.current = plannedSecFor(preset, sessionType);
    setIsRunning(true);
  };

  const handlePause = () => setIsRunning(false);

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSec(plannedSecFor(preset, sessionType));
    plannedRef.current = plannedSecFor(preset, sessionType);
  };

  const handleSkip = () => handleSessionEnd(true);

  const handleNextSession = () => {
    if (!completionModal) return;
    const justFinished = completionModal.type;
    setCompletionModal(null);
    let nextType: SessionType;
    if (justFinished === "WORK") {
      const cycle = (completedWorks + 1) % preset.sessionsBeforeLongBreak;
      nextType = cycle === 0 ? "LONG_BREAK" : "BREAK";
    } else {
      nextType = "WORK";
    }
    setSessionType(nextType);
    setRemainingSec(plannedSecFor(preset, nextType));
    plannedRef.current = plannedSecFor(preset, nextType);
    if (justFinished === "WORK" && autoStartBreaks && nextType !== "WORK") {
      setAutoCountdown(5);
    } else {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    setCompletionModal(null);
    setRemainingSec(plannedSecFor(preset, sessionType));
  };

  const handlePickTask = (id: string | null) => {
    setCurrentTaskId(id);
    setPickerOpen(false);
  };

  const handleTaskComplete = () => {
    if (!currentTask) return;
    updateScheduleItem(currentTask.id, { status: "done" });
    setTaskDoneAsk(false);
    setCurrentTaskId(null);
  };

  const remainingColor =
    sessionType === "WORK" && remainingSec <= 5
      ? C.red
      : sessionType === "WORK" && remainingSec <= 10
        ? C.peach
        : C.text;

  const cd = formatCountdown(remainingSec);

  return (
    <div className="flex flex-col gap-4 px-3 py-4 pb-4">
      <SessionTypeTabs
        value={sessionType}
        running={isRunning}
        onChange={(t) => {
          setSessionType(t);
          setRemainingSec(plannedSecFor(preset, t));
          plannedRef.current = plannedSecFor(preset, t);
        }}
      />

      <div className="flex flex-col items-center py-4">
        <div
          key={pulseKey}
          className="font-mono font-bold tracking-tight"
          style={{ fontSize: 72, color: remainingColor, lineHeight: 1 }}
        >
          {cd.slice(0, 2)}
          <span style={{ opacity: 0.5 }}>:</span>
          {cd.slice(3)}
        </div>
        {autoCountdown !== null && (
          <div className="mt-2 text-xs" style={{ color: C.peach }}>
            {autoCountdown}秒後に休憩を開始します
          </div>
        )}
      </div>

      <SessionDots
        total={preset.sessionsBeforeLongBreak}
        completed={completedWorks % preset.sessionsBeforeLongBreak}
      />

      <div className="flex flex-col gap-2">
        <div className="text-xs" style={{ color: C.subtext0 }}>
          今選んでいるタスク
        </div>
        {currentTask ? (
          <CurrentTaskChip
            task={currentTask}
            tagById={mapTags(wikiTags)}
            onTap={() => setPickerOpen(true)}
            onClear={() => setCurrentTaskId(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="h-12 rounded-md text-sm flex items-center justify-center gap-1"
            style={{
              border: `1px dashed ${C.overlay0}`,
              color: C.subtext0,
              background: "transparent",
            }}
          >
            <Plus size={16} /> タスクを選ぶ
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_2fr_1fr] gap-2 mt-2">
        <button
          type="button"
          onClick={handleReset}
          aria-label="リセット"
          className="h-14 rounded-md flex items-center justify-center transition-transform active:scale-[0.98]"
          style={{ background: C.surface0, color: C.text }}
        >
          <RotateCcw size={18} />
        </button>
        <button
          type="button"
          onClick={isRunning ? handlePause : handleStart}
          aria-label={isRunning ? "一時停止" : "スタート"}
          className="h-14 rounded-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98] text-base font-semibold"
          style={{ background: C.mauve, color: C.base }}
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          aria-label="スキップ"
          className="h-14 rounded-md flex items-center justify-center transition-transform active:scale-[0.98]"
          style={{ background: C.surface0, color: C.text }}
        >
          <SkipForward size={18} />
        </button>
      </div>

      {currentTask && currentTask.status !== "done" && (
        <button
          type="button"
          onClick={() => setTaskDoneAsk(true)}
          className="h-12 rounded-md text-sm font-medium flex items-center justify-center gap-2"
          style={{ background: C.green, color: C.base }}
        >
          <Check size={16} /> Task 完了
        </button>
      )}

      {pickerOpen && (
        <TaskPickerModal
          tasks={scheduleTasks}
          wikiTags={wikiTags}
          selectedId={currentTask?.id ?? null}
          onClose={() => setPickerOpen(false)}
          onPick={handlePickTask}
        />
      )}

      {completionModal && (
        <SessionCompletionModal
          type={completionModal.type}
          taskTitle={currentTask?.title ?? null}
          durationSec={completionModal.durationSec}
          skipped={completionModal.skipped}
          onNext={handleNextSession}
          onStop={handleStop}
        />
      )}

      {taskDoneAsk && currentTask && (
        <ConfirmModal
          title={`「${currentTask.title}」を完了にしますか?`}
          message="完了にすると進行中タスクから外れます"
          onCancel={() => setTaskDoneAsk(false)}
          onConfirm={handleTaskComplete}
        />
      )}
    </div>
  );
}

function SessionTypeTabs({
  value,
  running,
  onChange,
}: {
  value: SessionType;
  running: boolean;
  onChange: (t: SessionType) => void;
}) {
  const items: SessionType[] = ["WORK", "BREAK", "LONG_BREAK"];
  return (
    <div
      className="h-9 grid grid-cols-3 rounded-md overflow-hidden"
      style={{
        background: C.surface0,
        opacity: running ? 0.5 : 1,
        pointerEvents: running ? "none" : "auto",
      }}
    >
      {items.map((it) => {
        const active = it === value;
        const c = sessionColor(it);
        return (
          <button
            key={it}
            type="button"
            onClick={() => onChange(it)}
            className="text-xs font-medium"
            style={{
              background: active ? c : "transparent",
              color: active ? C.base : C.subtext0,
            }}
          >
            {sessionLabel(it)}
          </button>
        );
      })}
    </div>
  );
}

function SessionDots({
  total,
  completed,
}: {
  total: number;
  completed: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: i < completed ? C.mauve : C.surface1 }}
        />
      ))}
    </div>
  );
}

function CurrentTaskChip({
  task,
  tagById,
  onTap,
  onClear,
}: {
  task: ScheduleItem;
  tagById: Map<string, WikiTag>;
  onTap: () => void;
  onClear: () => void;
}) {
  const firstTag = task.wikiTagIds.map((id) => tagById.get(id)).find(Boolean);
  return (
    <div
      className="min-h-[56px] rounded-md flex items-center px-3 gap-2"
      style={{ background: C.surface0 }}
    >
      <button
        type="button"
        onClick={onTap}
        className="flex-1 flex flex-col gap-1 items-start text-left min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0 w-full">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background:
                task.status === "doing"
                  ? C.yellow
                  : task.status === "done"
                    ? C.green
                    : (firstTag?.color ?? C.overlay0),
            }}
          />
          <span
            className="text-sm font-medium truncate"
            style={{ color: C.text }}
          >
            {task.title}
          </span>
        </div>
        {firstTag && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: `${firstTag.color}22`,
              color: firstTag.color,
            }}
          >
            #{firstTag.name}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="タスク選択を解除"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <X size={18} color={C.subtext0} />
      </button>
    </div>
  );
}

function TaskPickerModal({
  tasks,
  wikiTags,
  selectedId,
  onClose,
  onPick,
}: {
  tasks: ScheduleItem[];
  wikiTags: WikiTag[];
  selectedId: string | null;
  onClose: () => void;
  onPick: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const tagById = mapTags(wikiTags);

  const filtered = useMemo(() => {
    const q = composing ? "" : query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (!showDone && t.status === "done") return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, query, composing, showDone]);

  const groups = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const t of filtered) {
      const key = t.wikiTagIds[0] ?? "__notag__";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([tagId, items]) => ({
      tagId,
      tag: tagId === "__notag__" ? null : (tagById.get(tagId) ?? null),
      items,
    }));
  }, [filtered, tagById]);

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.6 }}
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-md h-[80%] rounded-t-xl flex flex-col"
        style={{ background: C.base, color: C.text }}
      >
        <header
          className="h-12 flex items-center px-1 shrink-0"
          style={{ borderBottom: `1px solid ${C.surface1}` }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} color={C.text} />
          </button>
          <div className="flex-1 text-sm font-medium text-center">
            タスクを選ぶ
          </div>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-[11px] px-2 min-h-[44px]"
            style={{ color: showDone ? C.mauve : C.subtext0 }}
          >
            {showDone ? "完了非表示" : "完了表示"}
          </button>
        </header>
        <div
          className="px-3 py-2 shrink-0"
          style={{
            background: C.base,
            borderBottom: `1px solid ${C.surface1}`,
          }}
        >
          <div
            className="flex items-center h-10 rounded-md px-2 gap-2"
            style={{
              background: C.surface0,
              border: `1px solid ${C.surface1}`,
            }}
          >
            <Search size={16} color={C.subtext0} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              placeholder="タスク検索"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: C.text }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="クリア"
              >
                <X size={14} color={C.subtext0} />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {groups.length === 0 && (
            <div
              className="h-full flex items-center justify-center text-sm"
              style={{ color: C.subtext0 }}
            >
              該当タスクがありません
            </div>
          )}
          {groups.map((g) => (
            <section key={g.tagId}>
              <header
                className="px-3 py-1.5 text-[11px] uppercase tracking-wider"
                style={{
                  color: g.tag?.color ?? C.subtext0,
                  background: C.crust,
                }}
              >
                #{g.tag?.name ?? "タグなし"}
              </header>
              {g.items.map((t) => {
                const selected = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onPick(t.id)}
                    className="w-full min-h-[56px] px-3 flex items-center gap-3 text-left"
                    style={{
                      background: selected ? C.surface0 : "transparent",
                      borderBottom: `1px solid ${C.surface1}`,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background:
                          t.status === "doing"
                            ? C.yellow
                            : t.status === "done"
                              ? C.green
                              : C.overlay0,
                      }}
                    />
                    <span
                      className="text-sm flex-1 truncate"
                      style={{
                        color: t.status === "done" ? C.overlay0 : C.text,
                        textDecoration:
                          t.status === "done" ? "line-through" : undefined,
                      }}
                    >
                      {t.title}
                    </span>
                    {selected && <Check size={16} color={C.mauve} />}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
        {selectedId && (
          <div
            className="p-3 shrink-0"
            style={{ borderTop: `1px solid ${C.surface1}` }}
          >
            <button
              type="button"
              onClick={() => onPick(null)}
              className="w-full h-10 rounded-md text-sm"
              style={{
                border: `1px solid ${C.surface1}`,
                color: C.subtext0,
              }}
            >
              選択を解除
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function HistoryTab({ sessions }: { sessions: TimerSession[] }) {
  const today = useMemo(() => new Date(), []);
  const [longPressTarget, setLongPressTarget] = useState<string | null>(null);
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
              onAskDelete={() => setLongPressTarget(s.id)}
            />
          ))}
        </section>
      ))}
      {longPressTarget && (
        <ConfirmModal
          title="このセッションを削除しますか?"
          danger
          onCancel={() => setLongPressTarget(null)}
          onConfirm={() => {
            deleteTimerSession(longPressTarget);
            setLongPressTarget(null);
          }}
        />
      )}
    </div>
  );
}

function SessionRow({
  session,
  onAskDelete,
}: {
  session: TimerSession;
  onAskDelete: () => void;
}) {
  const timerRef = useRef<number | null>(null);
  const startPress = () => {
    timerRef.current = window.setTimeout(onAskDelete, 600);
  };
  const cancelPress = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const c = sessionColor(session.sessionType);
  const time = new Date(session.completedAt - session.durationSec * 1000);
  return (
    <div
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      className="min-h-[56px] flex items-center px-3 gap-2 select-none"
      style={{ borderBottom: `1px solid ${C.surface1}` }}
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
      <div
        className="flex-1 text-sm truncate"
        style={{ color: session.scheduleItemTitle ? C.text : C.subtext0 }}
      >
        {session.scheduleItemTitle ?? "(休憩)"}
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
    </div>
  );
}

function SettingsTab({
  presets,
  activePreset,
  autoStartBreaks,
}: {
  presets: PomodoroPreset[];
  activePreset: PomodoroPreset | null;
  autoStartBreaks: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PomodoroPreset | null>(
    null,
  );
  const [confirmSwitch, setConfirmSwitch] = useState<PomodoroPreset | null>(
    null,
  );
  const isLast = presets.length <= 1;

  return (
    <div className="flex flex-col gap-5 px-3 py-4 pb-4">
      <section className="flex flex-col gap-2">
        <div className="text-xs" style={{ color: C.subtext0 }}>
          プリセット
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {presets.map((p) => {
            const active = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (active) return;
                  setConfirmSwitch(p);
                }}
                className="h-9 px-3 rounded-full text-xs flex items-center gap-1 transition-transform active:scale-[0.98]"
                style={{
                  background: active ? C.mauve : C.surface0,
                  color: active ? C.base : C.subtext1,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {p.name}
                {active && <Check size={12} />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-9 px-3 rounded-full text-xs flex items-center gap-1"
            style={{
              border: `1px dashed ${C.overlay0}`,
              color: C.subtext0,
            }}
          >
            <Plus size={12} /> 追加
          </button>
        </div>
      </section>

      {activePreset && (
        <section className="flex flex-col gap-2">
          <div className="text-xs" style={{ color: C.subtext0 }}>
            アクティブプリセット: {activePreset.name}
          </div>
          <div
            className="rounded-md overflow-hidden"
            style={{ background: C.surface0 }}
          >
            <SliderRow
              key={`${activePreset.id}-work`}
              label="WORK"
              value={activePreset.workMin}
              min={1}
              max={180}
              suffix="分"
              onChange={(v) => updatePreset(activePreset.id, { workMin: v })}
            />
            <SliderRow
              key={`${activePreset.id}-break`}
              label="BREAK"
              value={activePreset.breakMin}
              min={1}
              max={60}
              suffix="分"
              onChange={(v) => updatePreset(activePreset.id, { breakMin: v })}
            />
            <SliderRow
              key={`${activePreset.id}-long`}
              label="LONG BREAK"
              value={activePreset.longBreakMin}
              min={1}
              max={60}
              suffix="分"
              onChange={(v) =>
                updatePreset(activePreset.id, { longBreakMin: v })
              }
            />
            <SliderRow
              key={`${activePreset.id}-sessions`}
              label="ロングブレーク間隔"
              value={activePreset.sessionsBeforeLongBreak}
              min={1}
              max={10}
              suffix="回"
              isLast
              onChange={(v) =>
                updatePreset(activePreset.id, { sessionsBeforeLongBreak: v })
              }
            />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="text-xs" style={{ color: C.subtext0 }}>
          オプション
        </div>
        <ToggleRow
          label="休憩を自動で開始"
          value={autoStartBreaks}
          onChange={setAutoStartBreaks}
        />
      </section>

      {activePreset && (
        <button
          type="button"
          onClick={() => !isLast && setConfirmDelete(activePreset)}
          disabled={isLast}
          className="h-12 rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            border: `1px solid ${C.red}`,
            color: C.red,
            background: "transparent",
          }}
        >
          <Trash2 size={16} />
          {activePreset.name} を削除
          {isLast && (
            <span className="text-[10px] ml-1">(最後の 1 つは削除不可)</span>
          )}
        </button>
      )}

      {addOpen && (
        <AddPresetModal
          onClose={() => setAddOpen(false)}
          onSave={(input) => {
            const p = addPreset(input);
            setActivePresetId(p.id);
            setAddOpen(false);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`「${confirmDelete.name}」を削除しますか?`}
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            deletePreset(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}

      {confirmSwitch && (
        <ConfirmModal
          title={`「${confirmSwitch.name}」に切替しますか?`}
          message="Timer は停止します"
          onCancel={() => setConfirmSwitch(null)}
          onConfirm={() => {
            setActivePresetId(confirmSwitch.id);
            setConfirmSwitch(null);
          }}
        />
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix,
  isLast,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  isLast?: boolean;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const throttleRef = useRef<number | null>(null);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const handleChange = (n: number) => {
    setDraft(n);
    if (throttleRef.current !== null) clearTimeout(throttleRef.current);
    throttleRef.current = window.setTimeout(() => onChange(n), 100);
  };
  return (
    <div
      className="p-3 flex flex-col gap-1"
      style={{
        borderBottom: isLast ? undefined : `1px solid ${C.surface1}`,
      }}
    >
      <div className="flex items-center">
        <span className="text-sm" style={{ color: C.subtext1 }}>
          {label}
        </span>
        <span className="ml-auto text-base font-mono" style={{ color: C.text }}>
          {draft}
          <span className="text-xs ml-1" style={{ color: C.subtext0 }}>
            {suffix}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: C.mauve }}
      />
      <div
        className="flex justify-between text-[10px]"
        style={{ color: C.overlay0 }}
      >
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="min-h-[44px] rounded-md px-3 flex items-center"
      style={{ background: C.surface0 }}
    >
      <span className="text-sm" style={{ color: C.text }}>
        {label}
      </span>
      <span
        className="ml-auto w-10 h-6 rounded-full relative transition-colors"
        style={{ background: value ? C.mauve : C.surface1 }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
          style={{
            background: value ? C.base : C.text,
            transform: value ? "translateX(18px)" : "translateX(2px)",
          }}
        />
      </span>
    </button>
  );
}

function AddPresetModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (
    input: Omit<PomodoroPreset, "id" | "createdAt" | "updatedAt" | "isDeleted">,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [sessions, setSessions] = useState(4);
  const canSave = name.trim().length > 0;
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="fixed inset-0"
        style={{ background: C.crust, opacity: 0.6 }}
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-md rounded-t-xl"
        style={{ background: C.base, color: C.text }}
      >
        <header
          className="h-12 flex items-center px-1"
          style={{ borderBottom: `1px solid ${C.surface1}` }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} color={C.text} />
          </button>
          <div className="flex-1 text-sm font-medium text-center">
            プリセット追加
          </div>
          <button
            type="button"
            onClick={() =>
              canSave &&
              onSave({
                name: name.trim(),
                workMin,
                breakMin,
                longBreakMin,
                sessionsBeforeLongBreak: sessions,
              })
            }
            disabled={!canSave}
            className="text-sm px-3 min-h-[44px] rounded-md mr-1 disabled:opacity-50"
            style={{ background: C.mauve, color: C.base, fontWeight: 600 }}
          >
            追加
          </button>
        </header>
        <div className="p-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: C.subtext0 }}>
              名前
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Focus"
              className="h-11 rounded-md px-3 text-sm"
              style={{
                background: C.surface0,
                color: C.text,
                border: `1px solid ${C.surface1}`,
              }}
            />
          </label>
          <NumberRow
            label="WORK (分)"
            value={workMin}
            min={1}
            max={180}
            onChange={setWorkMin}
          />
          <NumberRow
            label="BREAK (分)"
            value={breakMin}
            min={1}
            max={60}
            onChange={setBreakMin}
          />
          <NumberRow
            label="LONG BREAK (分)"
            value={longBreakMin}
            min={1}
            max={60}
            onChange={setLongBreakMin}
          />
          <NumberRow
            label="ロングブレーク間隔 (回)"
            value={sessions}
            min={1}
            max={10}
            onChange={setSessions}
          />
        </div>
      </div>
    </>
  );
}

function NumberRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="text-sm flex-1" style={{ color: C.subtext1 }}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        className="w-20 h-10 rounded-md px-2 text-sm font-mono text-right"
        style={{
          background: C.surface0,
          color: C.text,
          border: `1px solid ${C.surface1}`,
        }}
      />
    </label>
  );
}

function SessionCompletionModal({
  type,
  taskTitle,
  durationSec,
  skipped,
  onNext,
  onStop,
}: {
  type: SessionType;
  taskTitle: string | null;
  durationSec: number;
  skipped: boolean;
  onNext: () => void;
  onStop: () => void;
}) {
  const c = sessionColor(type);
  return (
    <>
      <div className="fixed inset-0" style={{ background: C.crust }} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: C.surface0 }}
        >
          <span
            className="self-start text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: c, color: C.base, fontWeight: 600 }}
          >
            {sessionLabel(type)}
          </span>
          <div className="text-base font-semibold" style={{ color: C.text }}>
            {skipped ? "セッションをスキップしました" : "セッション完了!"}
          </div>
          {taskTitle && (
            <div className="text-xs truncate" style={{ color: C.subtext0 }}>
              {taskTitle}
            </div>
          )}
          <div
            className="font-mono text-3xl text-center"
            style={{ color: C.text }}
          >
            {formatCountdown(durationSec)}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={onStop}
              className="h-10 rounded-md text-sm"
              style={{ background: C.surface1, color: C.text }}
            >
              やめる
            </button>
            <button
              type="button"
              onClick={onNext}
              className="h-10 rounded-md text-sm font-medium"
              style={{ background: C.mauve, color: C.base }}
            >
              次へ
            </button>
          </div>
        </div>
      </div>
    </>
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
            <div className="text-xs" style={{ color: C.subtext0 }}>
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
            color: isActive ? C.mauve : C.overlay0,
          })}
        >
          <Icon size={20} />
          <span className="text-[10px]">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

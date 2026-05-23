import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar,
  Clock,
  FileText,
  Settings as SettingsIcon,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Check,
  ChevronDown,
  Menu,
  X,
  Search,
  Folder,
  FolderOpen,
  SkipForward,
  Minus,
  Trash2,
  History,
  Timer as TimerIcon,
  Sparkles,
  ListTodo,
  CheckCircle2,
  Coffee,
} from "lucide-react";

// =============================================
// Catppuccin Mocha palette
// =============================================
const C = {
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  overlay0: "#6c7086",
  overlay1: "#7f849c",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  mauve: "#cba6f7",
  pink: "#f5c2e7",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  sky: "#89dceb",
  blue: "#89b4fa",
  red: "#f38ba8",
};

// =============================================
// Types
// =============================================
type SessionType = "WORK" | "BREAK" | "LONG_BREAK";
type SubTab = "timer" | "history" | "settings";
type BottomTab = "schedule" | "work" | "materials" | "settings";
type FolderKey = "dev" | "biz" | "personal";

type Preset = {
  id: string;
  name: string;
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  sessionsBeforeLongBreak: number;
};

type Task = {
  id: string;
  title: string;
  folder: FolderKey;
  done: boolean;
};

type CompletedSession = {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  sessionType: SessionType;
  durationSec: number;
  plannedSec: number;
  startedAt: string; // ISO
  completedAt: string; // ISO
};

// =============================================
// Initial data
// =============================================
const INITIAL_PRESETS: Preset[] = [
  {
    id: "classic",
    name: "Classic",
    workMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    sessionsBeforeLongBreak: 4,
  },
  {
    id: "long-focus",
    name: "Long Focus",
    workMin: 50,
    breakMin: 10,
    longBreakMin: 20,
    sessionsBeforeLongBreak: 3,
  },
  {
    id: "short-burst",
    name: "Short Burst",
    workMin: 15,
    breakMin: 3,
    longBreakMin: 10,
    sessionsBeforeLongBreak: 4,
  },
];

const MOCK_TASKS: Task[] = [
  // dev (7)
  { id: "t1", title: "life-editor 仕様レビュー", folder: "dev", done: false },
  { id: "t2", title: "MCP Server の検証", folder: "dev", done: false },
  { id: "t3", title: "Tauri 2.0 移行", folder: "dev", done: false },
  { id: "t4", title: "Rust 学習(rusqlite)", folder: "dev", done: false },
  { id: "t5", title: "D1 同期テスト", folder: "dev", done: true },
  { id: "t6", title: "統合版デモ作成", folder: "dev", done: false },
  { id: "t7", title: "バグ修正(W-1 透過)", folder: "dev", done: true },
  // biz (6)
  { id: "t8", title: "請求書作成(4月分)", folder: "biz", done: false },
  { id: "t9", title: "経費精算", folder: "biz", done: false },
  { id: "t10", title: "クライアント返信", folder: "biz", done: false },
  { id: "t11", title: "提案書ドラフト", folder: "biz", done: false },
  { id: "t12", title: "月次レポート", folder: "biz", done: false },
  { id: "t13", title: "ミーティング準備", folder: "biz", done: true },
  // personal (7)
  {
    id: "t14",
    title: "読書(Clean Architecture)",
    folder: "personal",
    done: false,
  },
  { id: "t15", title: "ランニング計画", folder: "personal", done: false },
  { id: "t16", title: "引越し準備", folder: "personal", done: false },
  { id: "t17", title: "確定申告", folder: "personal", done: true },
  { id: "t18", title: "写真整理", folder: "personal", done: false },
  { id: "t19", title: "家計簿", folder: "personal", done: false },
  { id: "t20", title: "旅行計画(夏)", folder: "personal", done: false },
];

const FOLDER_LABEL: Record<FolderKey, string> = {
  dev: "dev",
  biz: "biz",
  personal: "personal",
};

const FOLDER_COLOR: Record<FolderKey, string> = {
  dev: C.mauve,
  biz: C.peach,
  personal: C.sky,
};

// Mock completed sessions: directly past 3 days
function buildMockSessions(): CompletedSession[] {
  const now = new Date();
  const mk = (
    daysAgo: number,
    hour: number,
    minute: number,
    type: SessionType,
    minutes: number,
    taskId: string | null,
    taskTitle: string | null,
  ): CompletedSession => {
    const completed = new Date(now);
    completed.setDate(completed.getDate() - daysAgo);
    completed.setHours(hour, minute, 0, 0);
    const started = new Date(completed.getTime() - minutes * 60 * 1000);
    return {
      id: `s-${daysAgo}-${hour}-${minute}-${type}`,
      taskId,
      taskTitle,
      sessionType: type,
      durationSec: minutes * 60,
      plannedSec: minutes * 60,
      startedAt: started.toISOString(),
      completedAt: completed.toISOString(),
    };
  };

  return [
    // today
    mk(0, 11, 25, "WORK", 25, "t6", "統合版デモ作成"),
    mk(0, 10, 55, "BREAK", 5, null, null),
    mk(0, 10, 25, "WORK", 25, "t6", "統合版デモ作成"),
    mk(0, 9, 30, "WORK", 25, "t1", "life-editor 仕様レビュー"),
    // yesterday
    mk(1, 16, 50, "WORK", 50, "t3", "Tauri 2.0 移行"),
    mk(1, 15, 30, "LONG_BREAK", 20, null, null),
    mk(1, 14, 55, "WORK", 25, "t2", "MCP Server の検証"),
    mk(1, 11, 0, "WORK", 25, null, null),
    mk(1, 10, 25, "WORK", 25, "t4", "Rust 学習(rusqlite)"),
    // 2 days ago
    mk(2, 17, 30, "WORK", 25, "t11", "提案書ドラフト"),
    mk(2, 17, 0, "BREAK", 5, null, null),
    mk(2, 16, 30, "WORK", 25, "t11", "提案書ドラフト"),
    mk(2, 10, 30, "WORK", 25, "t1", "life-editor 仕様レビュー"),
  ];
}

// =============================================
// Utility functions
// =============================================
function formatMMSS(totalSec: number): { m: string; s: string } {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return { m, s };
}

function formatHM(totalSec: number): string {
  const totalMin = Math.floor(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "今日";
  if (sameDay(d, yesterday)) return "昨日";
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${M}月${D}日(${wd})`;
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function sessionTypeLabel(t: SessionType): string {
  if (t === "WORK") return "WORK";
  if (t === "BREAK") return "休憩";
  return "長休憩";
}

function sessionTypeColor(t: SessionType): string {
  if (t === "WORK") return C.mauve;
  if (t === "BREAK") return C.green;
  return C.sky;
}

function getPlannedSec(p: Preset, t: SessionType): number {
  if (t === "WORK") return p.workMin * 60;
  if (t === "BREAK") return p.breakMin * 60;
  return p.longBreakMin * 60;
}

// =============================================
// Root
// =============================================
export function WorkScreen() {
  // Bottom tab: Work fixed active (other tabs are no-op per requirement)
  const [bottomTab] = useState<BottomTab>("work");

  // Sub tab within Work
  const [subTab, setSubTab] = useState<SubTab>("timer");

  // Presets
  const [presets, setPresets] = useState<Preset[]>(INITIAL_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string>("classic");
  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? presets[0],
    [presets, activePresetId],
  );

  // Timer state
  const [sessionType, setSessionType] = useState<SessionType>("WORK");
  const [remainingSec, setRemainingSec] = useState<number>(
    INITIAL_PRESETS[0].workMin * 60,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessionCount, setCompletedSessionCount] = useState(0);
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(
    null,
  );
  const [pulseKey, setPulseKey] = useState(0);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);

  // History
  const [completedSessions, setCompletedSessions] =
    useState<CompletedSession[]>(buildMockSessions());

  // Modals
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completedSessionMeta, setCompletedSessionMeta] = useState<{
    sessionType: SessionType;
    taskTitle: string | null;
    durationSec: number;
  } | null>(null);
  const [taskCompleteConfirmOpen, setTaskCompleteConfirmOpen] = useState(false);
  const [presetSwitchPending, setPresetSwitchPending] = useState<string | null>(
    null,
  );
  const [addPresetOpen, setAddPresetOpen] = useState(false);
  const [deletePresetConfirmOpen, setDeletePresetConfirmOpen] = useState(false);

  // Session started timestamp (for completion record)
  const sessionStartedAtRef = useRef<string | null>(null);

  // Timer tick interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ------------------- effects -------------------
  // Main tick
  useEffect(() => {
    if (isRunning && autoStartCountdown === null) {
      // record start timestamp on first tick of a fresh segment
      if (!sessionStartedAtRef.current) {
        sessionStartedAtRef.current = new Date().toISOString();
      }
      intervalRef.current = setInterval(() => {
        setRemainingSec((r) => {
          if (r <= 1) {
            // session reaches 0 — handled below
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, autoStartCountdown]);

  // Auto-detect session end (remainingSec hit 0 while running)
  useEffect(() => {
    if (isRunning && remainingSec === 0) {
      handleSessionEnd(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, isRunning]);

  // Auto-start countdown
  useEffect(() => {
    if (autoStartCountdown === null) return;
    if (autoStartCountdown === 0) {
      setAutoStartCountdown(null);
      setIsRunning(true);
      return;
    }
    const t = setTimeout(() => {
      setAutoStartCountdown((c) => (c === null ? null : c - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [autoStartCountdown]);

  // When sessionType / activePreset changes while NOT running, sync remainingSec
  useEffect(() => {
    if (!isRunning && autoStartCountdown === null) {
      setRemainingSec(getPlannedSec(activePreset, sessionType));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionType,
    activePreset.id,
    activePreset.workMin,
    activePreset.breakMin,
    activePreset.longBreakMin,
  ]);

  // ------------------- timer actions -------------------
  function togglePlayPause() {
    if (autoStartCountdown !== null) {
      // cancel auto start
      setAutoStartCountdown(null);
      return;
    }
    setIsRunning((r) => !r);
  }

  function resetTimer() {
    setIsRunning(false);
    setAutoStartCountdown(null);
    setRemainingSec(getPlannedSec(activePreset, sessionType));
    sessionStartedAtRef.current = null;
  }

  function addTime(deltaSec: number) {
    setRemainingSec((r) => {
      const next = r + deltaSec;
      // clamp 1sec - 99min
      if (next < 1) return 1;
      if (next > 99 * 60) return 99 * 60;
      return next;
    });
  }

  function handleSessionComplete() {
    // Session Complete button (manual mid-session end)
    handleSessionEnd(true);
  }

  function handleSessionEnd(manual: boolean) {
    setIsRunning(false);
    const plannedSec = getPlannedSec(activePreset, sessionType);
    const durationSec = manual ? plannedSec - remainingSec : plannedSec;
    const startedAt =
      sessionStartedAtRef.current ??
      new Date(Date.now() - durationSec * 1000).toISOString();
    const completedAt = new Date().toISOString();

    // Record session
    const record: CompletedSession = {
      id: `s-${Date.now()}`,
      taskId: currentTask?.id ?? null,
      taskTitle: currentTask?.title ?? null,
      sessionType,
      durationSec,
      plannedSec,
      startedAt,
      completedAt,
    };
    setCompletedSessions((prev) => [record, ...prev]);
    sessionStartedAtRef.current = null;

    // Pulse animation
    setPulseKey((k) => k + 1);

    if (sessionType === "WORK") {
      // Increment completed session count and open modal
      setCompletedSessionCount((c) => c + 1);
      setCompletedSessionMeta({
        sessionType: "WORK",
        taskTitle: currentTask?.title ?? null,
        durationSec,
      });
      setCompletionModalOpen(true);
    } else {
      // Break / Long break: no modal. autoStartBreaks may trigger next WORK
      if (autoStartBreaks) {
        setSessionType("WORK");
        // remainingSec sync via useEffect
        setAutoStartCountdown(3);
      } else {
        // wait state — switch to WORK silently
        setSessionType("WORK");
      }
    }
  }

  // ------------------- session modal actions -------------------
  function modalStartBreak() {
    // Determine next session type
    const next: SessionType =
      completedSessionCount % activePreset.sessionsBeforeLongBreak === 0
        ? "LONG_BREAK"
        : "BREAK";
    setSessionType(next);
    setCompletionModalOpen(false);
    setCompletedSessionMeta(null);
    // sync remainingSec via useEffect
    if (autoStartBreaks) {
      setAutoStartCountdown(3);
    }
  }

  function modalSameSession() {
    // Repeat same WORK session: reset to full WORK duration and immediately start
    setSessionType("WORK");
    setRemainingSec(getPlannedSec(activePreset, "WORK"));
    setCompletionModalOpen(false);
    setCompletedSessionMeta(null);
    sessionStartedAtRef.current = null;
    setIsRunning(true);
  }

  function modalCompleteTask() {
    setTaskCompleteConfirmOpen(true);
  }

  function confirmTaskComplete() {
    if (currentTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === currentTask.id ? { ...t, done: true } : t)),
      );
      setCurrentTask(null);
    }
    setTaskCompleteConfirmOpen(false);
    // Continue to break
    modalStartBreak();
  }

  function modalClose() {
    // Close without transitioning. User decides next action manually.
    setCompletionModalOpen(false);
    setCompletedSessionMeta(null);
  }

  // ------------------- session type switching -------------------
  function switchSessionType(next: SessionType) {
    if (next === sessionType) return; // W-2: no toggle
    if (isRunning) {
      // confirm via simple inline approach: reset + switch
      const ok = window.confirm(
        `タイマー動作中です。${sessionTypeLabel(next)}に切替するとリセットされます。続行しますか?`,
      );
      if (!ok) return;
      setIsRunning(false);
      sessionStartedAtRef.current = null;
    }
    setAutoStartCountdown(null);
    setSessionType(next);
  }

  // ------------------- task picker actions -------------------
  function selectTask(t: Task) {
    setCurrentTask(t);
    setPickerOpen(false);
    setPickerSearchQuery("");
  }

  function selectFreeSession() {
    setCurrentTask(null);
    setPickerOpen(false);
    setPickerSearchQuery("");
  }

  // ------------------- preset actions -------------------
  function tryActivatePreset(presetId: string) {
    if (presetId === activePresetId) return;
    if (
      isRunning ||
      remainingSec !== getPlannedSec(activePreset, sessionType)
    ) {
      setPresetSwitchPending(presetId);
      return;
    }
    setActivePresetId(presetId);
  }

  function confirmPresetSwitch() {
    if (presetSwitchPending) {
      setActivePresetId(presetSwitchPending);
      setIsRunning(false);
      setAutoStartCountdown(null);
      // remainingSec syncs via effect
      sessionStartedAtRef.current = null;
    }
    setPresetSwitchPending(null);
  }

  function cancelPresetSwitch() {
    setPresetSwitchPending(null);
  }

  function updateActivePreset(field: keyof Preset, value: number) {
    setPresets((prev) =>
      prev.map((p) => (p.id === activePresetId ? { ...p, [field]: value } : p)),
    );
  }

  function addPreset(name: string) {
    const id = `p-${Date.now()}`;
    const newPreset: Preset = {
      id,
      name: name.trim() || "New Preset",
      workMin: 25,
      breakMin: 5,
      longBreakMin: 15,
      sessionsBeforeLongBreak: 4,
    };
    setPresets((prev) => [...prev, newPreset]);
    setActivePresetId(id);
    setAddPresetOpen(false);
  }

  function deleteActivePreset() {
    if (presets.length <= 1) return;
    const remaining = presets.filter((p) => p.id !== activePresetId);
    setPresets(remaining);
    setActivePresetId(remaining[0].id);
    setDeletePresetConfirmOpen(false);
  }

  // ------------------- derived state -------------------
  const plannedSec = getPlannedSec(activePreset, sessionType);
  const progress = plannedSec > 0 ? 1 - remainingSec / plannedSec : 0;
  const { m, s } = formatMMSS(remainingSec);
  const sessionsInCycle = activePreset.sessionsBeforeLongBreak;
  const currentDotIndex = completedSessionCount % sessionsInCycle; // 0..N-1 for next-to-be-completed

  // ------------------- render -------------------
  return (
    <div
      className="min-h-screen mx-auto max-w-md flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text, minHeight: 812 }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 pt-6 pb-3"
        style={{ background: C.base }}
      >
        <button
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: C.surface0 }}
          onClick={() => {}}
          aria-label="メニュー"
        >
          <Menu size={18} color={C.subtext1} />
        </button>
        <div className="text-center">
          <div
            className="text-[28px] font-bold leading-none"
            style={{ color: C.text }}
          >
            Work
          </div>
          <div
            className="text-[11px] mt-1 uppercase tracking-widest"
            style={{ color: C.overlay0 }}
          >
            フォーカス
          </div>
        </div>
        <div className="w-9 h-9" />
      </header>

      {/* SubTab */}
      <div className="px-5 pt-2 pb-3">
        <SubTabBar value={subTab} onChange={setSubTab} />
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {subTab === "timer" && (
          <TimerTab
            sessionType={sessionType}
            onSwitchSessionType={switchSessionType}
            currentTask={currentTask}
            onOpenPicker={() => setPickerOpen(true)}
            sessionsInCycle={sessionsInCycle}
            currentDotIndex={currentDotIndex}
            remainingSec={remainingSec}
            plannedSec={plannedSec}
            mm={m}
            ss={s}
            progress={progress}
            isRunning={isRunning}
            onTogglePlayPause={togglePlayPause}
            onReset={resetTimer}
            onSessionComplete={handleSessionComplete}
            onAddTime={addTime}
            autoStartCountdown={autoStartCountdown}
            pulseKey={pulseKey}
          />
        )}

        {subTab === "history" && <HistoryTab sessions={completedSessions} />}

        {subTab === "settings" && (
          <SettingsTab
            presets={presets}
            activePresetId={activePresetId}
            onActivatePreset={tryActivatePreset}
            onUpdatePreset={updateActivePreset}
            onAddPreset={() => setAddPresetOpen(true)}
            onRequestDeletePreset={() => setDeletePresetConfirmOpen(true)}
            autoStartBreaks={autoStartBreaks}
            onToggleAutoStart={() => setAutoStartBreaks((v) => !v)}
            canDelete={presets.length > 1}
          />
        )}
      </main>

      {/* Bottom tab */}
      <BottomTabBar active={bottomTab} />

      {/* Modals */}
      {pickerOpen && (
        <TaskPickerModal
          tasks={tasks}
          searchQuery={pickerSearchQuery}
          onSearchQueryChange={setPickerSearchQuery}
          onSelectTask={selectTask}
          onSelectFreeSession={selectFreeSession}
          onClose={() => {
            setPickerOpen(false);
            setPickerSearchQuery("");
          }}
        />
      )}

      {completionModalOpen && completedSessionMeta && (
        <SessionCompletionModal
          meta={completedSessionMeta}
          nextIsLongBreak={
            completedSessionCount % activePreset.sessionsBeforeLongBreak === 0
          }
          onCompleteTask={modalCompleteTask}
          onStartBreak={modalStartBreak}
          onSameSession={modalSameSession}
          onClose={modalClose}
        />
      )}

      {taskCompleteConfirmOpen && (
        <ConfirmModal
          title="タスク完了"
          message="このタスクを完了しますか?"
          confirmLabel="完了"
          confirmColor={C.green}
          onConfirm={confirmTaskComplete}
          onCancel={() => setTaskCompleteConfirmOpen(false)}
        />
      )}

      {presetSwitchPending && (
        <ConfirmModal
          title="プリセット切替"
          message="変更を適用するとタイマーがリセットされます。続行しますか?"
          confirmLabel="続行"
          confirmColor={C.mauve}
          onConfirm={confirmPresetSwitch}
          onCancel={cancelPresetSwitch}
        />
      )}

      {addPresetOpen && (
        <AddPresetModal
          onConfirm={addPreset}
          onCancel={() => setAddPresetOpen(false)}
        />
      )}

      {deletePresetConfirmOpen && (
        <ConfirmModal
          title="プリセットを削除"
          message={`「${activePreset.name}」を削除しますか?`}
          confirmLabel="削除"
          confirmColor={C.red}
          onConfirm={deleteActivePreset}
          onCancel={() => setDeletePresetConfirmOpen(false)}
        />
      )}
    </div>
  );
}

// =============================================
// Sub Tab Bar (Timer / History / Settings)
// =============================================
function SubTabBar({
  value,
  onChange,
}: {
  value: SubTab;
  onChange: (v: SubTab) => void;
}) {
  const items: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: "timer", label: "Timer", icon: <TimerIcon size={14} /> },
    { key: "history", label: "History", icon: <History size={14} /> },
    { key: "settings", label: "Settings", icon: <SettingsIcon size={14} /> },
  ];
  return (
    <div
      className="flex items-center p-1 rounded-full"
      style={{ background: C.surface0 }}
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full transition-all duration-300 text-xs font-medium"
            style={{
              background: active ? C.mauve : "transparent",
              color: active ? C.base : C.subtext1,
            }}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================
// Timer Tab
// =============================================
function TimerTab(props: {
  sessionType: SessionType;
  onSwitchSessionType: (t: SessionType) => void;
  currentTask: Task | null;
  onOpenPicker: () => void;
  sessionsInCycle: number;
  currentDotIndex: number;
  remainingSec: number;
  plannedSec: number;
  mm: string;
  ss: string;
  progress: number;
  isRunning: boolean;
  onTogglePlayPause: () => void;
  onReset: () => void;
  onSessionComplete: () => void;
  onAddTime: (sec: number) => void;
  autoStartCountdown: number | null;
  pulseKey: number;
}) {
  const {
    sessionType,
    onSwitchSessionType,
    currentTask,
    onOpenPicker,
    sessionsInCycle,
    currentDotIndex,
    remainingSec,
    plannedSec,
    mm,
    ss,
    progress,
    isRunning,
    onTogglePlayPause,
    onReset,
    onSessionComplete,
    onAddTime,
    autoStartCountdown,
    pulseKey,
  } = props;
  const sessionCompleteDisabled = !isRunning && remainingSec === plannedSec;

  const arcColor = sessionTypeColor(sessionType);
  const R = 110;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - progress);

  return (
    <div className="flex flex-col px-5">
      {/* Top row: SessionTypeTabs (W-3: NOT above arc, but at top-right of content area) */}
      <div className="flex justify-end mb-3">
        <SessionTypeTabs value={sessionType} onChange={onSwitchSessionType} />
      </div>

      {/* Current task chip */}
      <button
        onClick={onOpenPicker}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4 transition-all active:scale-[0.99]"
        style={{ background: C.surface0 }}
      >
        <ListTodo size={16} color={C.subtext0} />
        <div
          className="flex-1 text-left text-sm truncate"
          style={{ color: currentTask ? C.text : C.overlay0 }}
        >
          {currentTask ? currentTask.title : "タスク未選択 (フリーセッション)"}
        </div>
        {currentTask && (
          <span
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              background: FOLDER_COLOR[currentTask.folder] + "33",
              color: FOLDER_COLOR[currentTask.folder],
            }}
          >
            {FOLDER_LABEL[currentTask.folder]}
          </span>
        )}
        <ChevronDown size={14} color={C.subtext0} />
      </button>

      {/* Session progress (N/M + dots) */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs tabular-nums" style={{ color: C.overlay0 }}>
          {Math.min(currentDotIndex + 1, sessionsInCycle)} / {sessionsInCycle}
        </span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: sessionsInCycle }).map((_, i) => {
            const completed = i < currentDotIndex;
            const current = i === currentDotIndex;
            return (
              <span
                key={i}
                className="block rounded-full transition-all duration-300"
                style={{
                  width: 8,
                  height: 8,
                  background: completed ? arcColor : "transparent",
                  border: `1.5px solid ${completed ? arcColor : current ? arcColor : C.surface2}`,
                  opacity: completed || current ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Circular timer */}
      <div className="flex flex-col items-center mt-2">
        <div
          key={pulseKey}
          className="relative"
          style={{
            width: 260,
            height: 260,
            animation: pulseKey > 0 ? "workPulse 600ms ease-out" : undefined,
          }}
        >
          <svg width={260} height={260} className="-rotate-90">
            <circle
              cx={130}
              cy={130}
              r={R}
              fill="none"
              stroke={C.surface0}
              strokeWidth={10}
            />
            <circle
              cx={130}
              cy={130}
              r={R}
              fill="none"
              stroke={arcColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              style={{
                transition:
                  "stroke-dashoffset 1s linear, stroke 300ms ease-out",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {autoStartCountdown !== null ? (
              <>
                <div
                  className="text-7xl font-light tabular-nums"
                  style={{ color: arcColor }}
                >
                  {autoStartCountdown === 0 ? "GO" : autoStartCountdown}
                </div>
                <div
                  className="text-[10px] uppercase tracking-widest mt-2"
                  style={{ color: C.overlay0 }}
                >
                  AUTO START
                </div>
              </>
            ) : (
              <>
                <CountdownDigits mm={mm} ss={ss} />
                <div
                  className="text-[11px] uppercase tracking-widest mt-2"
                  style={{ color: C.overlay0 }}
                >
                  {isRunning
                    ? "IN PROGRESS"
                    : remainingSec === 0
                      ? "COMPLETED"
                      : sessionTypeLabel(sessionType) + " READY"}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ±5 min row (visible only when paused & not running & countdown null) */}
        {!isRunning && autoStartCountdown === null && (
          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={() => onAddTime(-5 * 60)}
              className="px-3 py-1.5 rounded-full flex items-center gap-1 text-xs transition-all active:scale-95"
              style={{ background: C.surface0, color: C.subtext1 }}
            >
              <Minus size={12} />
              5分
            </button>
            <button
              onClick={() => onAddTime(5 * 60)}
              className="px-3 py-1.5 rounded-full flex items-center gap-1 text-xs transition-all active:scale-95"
              style={{ background: C.surface0, color: C.subtext1 }}
            >
              <Plus size={12} />
              5分
            </button>
          </div>
        )}

        {/* Control bar */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onReset}
            className="w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-95"
            style={{
              borderColor: C.surface1,
              color: C.subtext1,
              background: "transparent",
            }}
            aria-label="リセット"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={onTogglePlayPause}
            className="px-8 h-14 rounded-full flex items-center gap-2 font-semibold transition-transform active:scale-95"
            style={{ background: arcColor, color: C.base }}
          >
            {isRunning || autoStartCountdown !== null ? (
              <>
                <Pause size={18} strokeWidth={2.5} fill={C.base} />
                {autoStartCountdown !== null ? "キャンセル" : "一時停止"}
              </>
            ) : (
              <>
                <Play size={18} strokeWidth={2.5} fill={C.base} />
                開始
              </>
            )}
          </button>
          <button
            onClick={onSessionComplete}
            disabled={sessionCompleteDisabled}
            className="w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-95"
            style={{
              borderColor: C.surface1,
              color: sessionCompleteDisabled ? C.overlay0 : C.subtext1,
              background: "transparent",
              opacity: sessionCompleteDisabled ? 0.4 : 1,
            }}
            aria-label="Session Complete"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes workPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function CountdownDigits({ mm, ss }: { mm: string; ss: string }) {
  const text = `${mm}:${ss}`;
  return (
    <div
      className="flex items-baseline"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {text.split("").map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className="inline-block text-6xl font-light tracking-tight"
          style={{ color: C.text, animation: "liedFade 300ms ease-out" }}
        >
          {ch}
        </span>
      ))}
      <style>{`
        @keyframes liedFade {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// =============================================
// Session Type Tabs (top-right, W-3)
// =============================================
function SessionTypeTabs({
  value,
  onChange,
}: {
  value: SessionType;
  onChange: (t: SessionType) => void;
}) {
  const items: { key: SessionType; label: string }[] = [
    { key: "WORK", label: "WORK" },
    { key: "BREAK", label: "休憩" },
    { key: "LONG_BREAK", label: "長休憩" },
  ];
  return (
    <div
      className="inline-flex items-center p-0.5 rounded-full"
      style={{ background: C.surface0 }}
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300"
            style={{
              background: active ? sessionTypeColor(it.key) : "transparent",
              color: active ? C.base : C.subtext0,
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================
// History Tab
// =============================================
function HistoryTab({ sessions }: { sessions: CompletedSession[] }) {
  // Only last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = sessions.filter(
    (s) => new Date(s.completedAt) >= sevenDaysAgo,
  );

  const totalSec = recent.reduce((acc, s) => acc + s.durationSec, 0);
  const workCount = recent.filter((s) => s.sessionType === "WORK").length;

  // Group by date
  const groups: Record<string, CompletedSession[]> = {};
  recent.forEach((s) => {
    const key = formatDateLabel(s.completedAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  // sort keys by most recent first
  const keys = Object.keys(groups).sort((a, b) => {
    const da = new Date(groups[a][0].completedAt).getTime();
    const db = new Date(groups[b][0].completedAt).getTime();
    return db - da;
  });

  return (
    <div className="px-5 space-y-6">
      {/* Summary cards */}
      <div>
        <div
          className="text-[10px] uppercase tracking-widest font-semibold mb-2"
          style={{ color: C.overlay0 }}
        >
          直近 7 日間
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: C.surface0 }}>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: C.overlay0 }}
            >
              累計時間
            </div>
            <div
              className="text-2xl font-bold mt-1 tabular-nums"
              style={{ color: C.green }}
            >
              {formatHM(totalSec)}
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: C.surface0 }}>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: C.overlay0 }}
            >
              セッション数
            </div>
            <div
              className="text-2xl font-bold mt-1 tabular-nums"
              style={{ color: C.mauve }}
            >
              {workCount}
            </div>
          </div>
        </div>
      </div>

      {/* Session list */}
      <div>
        <div
          className="text-[10px] uppercase tracking-widest font-semibold mb-2"
          style={{ color: C.overlay0 }}
        >
          セッション一覧
        </div>
        {recent.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center text-sm"
            style={{ background: C.surface0, color: C.subtext0 }}
          >
            セッション記録はまだありません。
            <br />
            タイマーを開始して作業時間を追跡しましょう。
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k}>
                <div
                  className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 px-2 py-1 rounded inline-block"
                  style={{ background: C.mantle, color: C.subtext0 }}
                >
                  {k}
                </div>
                <div className="space-y-1.5">
                  {groups[k].map((s) => (
                    <SessionListRow key={s.id} session={s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionListRow({ session }: { session: CompletedSession }) {
  const color = sessionTypeColor(session.sessionType);
  const minutes = Math.round(session.durationSec / 60);
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl"
      style={{ background: C.surface0 }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span
        className="text-[11px] tabular-nums w-10 flex-shrink-0"
        style={{ color: C.subtext0 }}
      >
        {formatHHMM(session.completedAt)}
      </span>
      <span
        className="text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ background: color + "33", color }}
      >
        {sessionTypeLabel(session.sessionType)}
      </span>
      <span className="flex-1 text-xs truncate" style={{ color: C.text }}>
        {session.taskTitle ?? (
          <span style={{ color: C.overlay0 }}>フリーセッション</span>
        )}
      </span>
      <span className="text-[10px] tabular-nums" style={{ color: C.subtext0 }}>
        {minutes}m
      </span>
    </div>
  );
}

// =============================================
// Settings Tab
// =============================================
function SettingsTab(props: {
  presets: Preset[];
  activePresetId: string;
  onActivatePreset: (id: string) => void;
  onUpdatePreset: (field: keyof Preset, value: number) => void;
  onAddPreset: () => void;
  onRequestDeletePreset: () => void;
  autoStartBreaks: boolean;
  onToggleAutoStart: () => void;
  canDelete: boolean;
}) {
  const {
    presets,
    activePresetId,
    onActivatePreset,
    onUpdatePreset,
    onAddPreset,
    onRequestDeletePreset,
    autoStartBreaks,
    onToggleAutoStart,
    canDelete,
  } = props;
  const active = presets.find((p) => p.id === activePresetId) ?? presets[0];

  return (
    <div className="px-5 space-y-6">
      {/* Presets */}
      <div>
        <div
          className="text-[10px] uppercase tracking-widest font-semibold mb-2"
          style={{ color: C.overlay0 }}
        >
          プリセット
        </div>
        <div
          className="flex items-center gap-1 p-1 rounded-full overflow-x-auto"
          style={{ background: C.surface0 }}
        >
          {presets.map((p) => {
            const isActive = p.id === activePresetId;
            return (
              <button
                key={p.id}
                onClick={() => onActivatePreset(p.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300"
                style={{
                  background: isActive ? C.mauve : "transparent",
                  color: isActive ? C.base : C.subtext1,
                }}
              >
                {p.name}
              </button>
            );
          })}
          <button
            onClick={onAddPreset}
            className="px-2 py-1.5 rounded-full transition-all active:scale-95 flex-shrink-0"
            style={{ color: C.subtext0 }}
            aria-label="プリセット追加"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Sliders */}
        <div
          className="rounded-xl p-4 mt-3 space-y-4"
          style={{ background: C.surface0 }}
        >
          <SliderRow
            label="作業時間"
            value={active.workMin}
            min={1}
            max={90}
            unit="分"
            color={C.mauve}
            onChange={(v) => onUpdatePreset("workMin", v)}
          />
          <SliderRow
            label="短い休憩"
            value={active.breakMin}
            min={1}
            max={30}
            unit="分"
            color={C.green}
            onChange={(v) => onUpdatePreset("breakMin", v)}
          />
          <SliderRow
            label="長い休憩"
            value={active.longBreakMin}
            min={1}
            max={60}
            unit="分"
            color={C.sky}
            onChange={(v) => onUpdatePreset("longBreakMin", v)}
          />
          <SliderRow
            label="長休憩まで"
            value={active.sessionsBeforeLongBreak}
            min={2}
            max={8}
            unit="回"
            color={C.peach}
            onChange={(v) => onUpdatePreset("sessionsBeforeLongBreak", v)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onRequestDeletePreset}
            disabled={!canDelete}
            className="flex-1 py-2 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
            style={{
              background: "transparent",
              border: `1px solid ${C.surface1}`,
              color: canDelete ? C.red : C.overlay0,
              opacity: canDelete ? 1 : 0.4,
            }}
          >
            <Trash2 size={12} />
            削除
          </button>
          <button
            onClick={onAddPreset}
            className="flex-1 py-2 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
            style={{ background: C.surface0, color: C.subtext1 }}
          >
            <Plus size={12} />
            プリセット追加
          </button>
        </div>
      </div>

      {/* Behavior */}
      <div>
        <div
          className="text-[10px] uppercase tracking-widest font-semibold mb-2"
          style={{ color: C.overlay0 }}
        >
          動作
        </div>
        <div className="rounded-xl p-4" style={{ background: C.surface0 }}>
          <ToggleRow
            label="自動休憩開始"
            description="3秒カウントダウン後に次セッションを自動開始"
            value={autoStartBreaks}
            onChange={onToggleAutoStart}
          />
        </div>
      </div>

      {/* Footer hint */}
      <div className="text-[10px] text-center" style={{ color: C.overlay0 }}>
        変更はリアルタイムで反映されます (永続化なし)
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: C.subtext1 }}>
          {label}
        </span>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full appearance-none h-1 rounded-full"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${
            ((value - min) / (max - min)) * 100
          }%, ${C.surface2} ${((value - min) / (max - min)) * 100}%, ${C.surface2} 100%)`,
          accentColor: color,
        }}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 pr-3">
        <div className="text-sm font-medium" style={{ color: C.text }}>
          {label}
        </div>
        {description && (
          <div className="text-[10px] mt-0.5" style={{ color: C.overlay0 }}>
            {description}
          </div>
        )}
      </div>
      <button
        onClick={onChange}
        className="relative w-11 h-6 rounded-full transition-all duration-300"
        style={{ background: value ? C.green : C.surface2 }}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300"
          style={{
            left: value ? 22 : 2,
            background: C.text,
          }}
        />
      </button>
    </div>
  );
}

// =============================================
// Task Picker Modal
// =============================================
function TaskPickerModal({
  tasks,
  searchQuery,
  onSearchQueryChange,
  onSelectTask,
  onSelectFreeSession,
  onClose,
}: {
  tasks: Task[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectTask: (t: Task) => void;
  onSelectFreeSession: () => void;
  onClose: () => void;
}) {
  // Folder expand state
  const [expanded, setExpanded] = useState<Record<FolderKey, boolean>>({
    dev: true,
    biz: true,
    personal: true,
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  const grouped = useMemo(() => {
    const g: Record<FolderKey, Task[]> = { dev: [], biz: [], personal: [] };
    filtered.forEach((t) => g[t.folder].push(t));
    // sort: incomplete first, completed last (faded)
    Object.keys(g).forEach((k) => {
      const key = k as FolderKey;
      g[key].sort((a, b) => Number(a.done) - Number(b.done));
    });
    return g;
  }, [filtered]);

  const folders: FolderKey[] = ["dev", "biz", "personal"];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: C.base }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-6 pb-3"
        style={{ background: C.base }}
      >
        <div className="text-lg font-bold" style={{ color: C.text }}>
          タスクを選択
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: C.surface0 }}
          aria-label="閉じる"
        >
          <X size={18} color={C.subtext1} />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: C.surface0 }}
        >
          <Search size={14} color={C.subtext0} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="タスクを検索..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: C.text }}
          />
          {searchQuery && (
            <button onClick={() => onSearchQueryChange("")} aria-label="クリア">
              <X size={14} color={C.subtext0} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {/* Free session option */}
        <button
          onClick={onSelectFreeSession}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-3 transition-all active:scale-[0.99]"
          style={{ background: C.surface0, border: `1px dashed ${C.surface2}` }}
        >
          <Sparkles size={16} color={C.peach} />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium" style={{ color: C.text }}>
              フリーセッション
            </div>
            <div className="text-[10px]" style={{ color: C.overlay0 }}>
              タスクを選ばずに開始
            </div>
          </div>
        </button>

        {/* Folder list */}
        <div className="space-y-3">
          {folders.map((fk) => {
            const items = grouped[fk];
            if (items.length === 0 && searchQuery) return null;
            const isOpen = expanded[fk];
            return (
              <div key={fk}>
                <button
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [fk]: !prev[fk] }))
                  }
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left"
                >
                  {isOpen ? (
                    <FolderOpen size={14} color={FOLDER_COLOR[fk]} />
                  ) : (
                    <Folder size={14} color={FOLDER_COLOR[fk]} />
                  )}
                  <span
                    className="text-[11px] uppercase tracking-widest font-semibold"
                    style={{ color: C.subtext1 }}
                  >
                    {FOLDER_LABEL[fk]}
                  </span>
                  <span className="text-[10px]" style={{ color: C.overlay0 }}>
                    ({items.length})
                  </span>
                  <ChevronDown
                    size={14}
                    color={C.subtext0}
                    style={{
                      transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 200ms",
                      marginLeft: "auto",
                    }}
                  />
                </button>
                {isOpen && (
                  <div className="space-y-1 mt-1 pl-2">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onSelectTask(t)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all active:scale-[0.99]"
                        style={{
                          background: C.surface0,
                          opacity: t.done ? 0.5 : 1,
                        }}
                      >
                        {t.done ? (
                          <CheckCircle2 size={14} color={C.green} />
                        ) : (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              border: `1.5px solid ${C.subtext0}`,
                            }}
                          />
                        )}
                        <span
                          className="flex-1 text-left text-sm truncate"
                          style={{
                            color: t.done ? C.subtext0 : C.text,
                            textDecoration: t.done ? "line-through" : "none",
                          }}
                        >
                          {t.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && searchQuery && (
          <div
            className="rounded-xl p-6 text-center text-sm mt-4"
            style={{ background: C.surface0, color: C.subtext0 }}
          >
            「{searchQuery}」に一致するタスクが見つかりません
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================
// Session Completion Modal
// =============================================
function SessionCompletionModal({
  meta,
  nextIsLongBreak,
  onCompleteTask,
  onStartBreak,
  onSameSession,
  onClose,
}: {
  meta: {
    sessionType: SessionType;
    taskTitle: string | null;
    durationSec: number;
  };
  nextIsLongBreak: boolean;
  onCompleteTask: () => void;
  onStartBreak: () => void;
  onSameSession: () => void;
  onClose: () => void;
}) {
  const minutes = Math.round(meta.durationSec / 60);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(17, 17, 27, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5"
        style={{ background: C.mantle, border: `1px solid ${C.surface1}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: C.green + "33" }}
            >
              <Check size={20} color={C.green} strokeWidth={3} />
            </div>
            <div>
              <div className="text-base font-bold" style={{ color: C.text }}>
                セッション完了
              </div>
              <div
                className="text-[10px] uppercase tracking-wider"
                style={{ color: C.overlay0 }}
              >
                {minutes}分 の WORK セッション
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: C.surface0 }}
          >
            <X size={16} color={C.subtext0} />
          </button>
        </div>

        {meta.taskTitle && (
          <div
            className="rounded-xl p-3 mb-4"
            style={{ background: C.surface0 }}
          >
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: C.overlay0 }}
            >
              対象タスク
            </div>
            <div
              className="text-sm font-medium mt-0.5"
              style={{ color: C.text }}
            >
              {meta.taskTitle}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {meta.taskTitle && (
            <button
              onClick={onCompleteTask}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: C.green, color: C.base }}
            >
              <CheckCircle2 size={16} strokeWidth={2.5} />
              タスクを完了にする
            </button>
          )}
          <button
            onClick={onStartBreak}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: C.mauve, color: C.base }}
          >
            <Coffee size={16} strokeWidth={2.5} />
            {nextIsLongBreak ? "長休憩を始める" : "休憩を始める"}
          </button>
          <button
            onClick={onSameSession}
            className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: "transparent",
              border: `1px solid ${C.surface1}`,
              color: C.subtext1,
            }}
          >
            <RotateCcw size={16} />
            もう一度同じセッション
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Confirm Modal (generic)
// =============================================
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "rgba(17, 17, 27, 0.7)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: C.mantle, border: `1px solid ${C.surface1}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-bold mb-2" style={{ color: C.text }}>
          {title}
        </div>
        <div className="text-sm mb-4" style={{ color: C.subtext1 }}>
          {message}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95"
            style={{
              background: "transparent",
              border: `1px solid ${C.surface1}`,
              color: C.subtext1,
            }}
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
            style={{ background: confirmColor, color: C.base }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Add Preset Modal
// =============================================
function AddPresetModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "rgba(17, 17, 27, 0.7)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: C.mantle, border: `1px solid ${C.surface1}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-bold mb-3" style={{ color: C.text }}>
          新規プリセット
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="プリセット名 (例: Deep Focus)"
          autoFocus
          className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-2"
          style={{
            background: C.surface0,
            color: C.text,
            border: `1px solid ${C.surface1}`,
          }}
        />
        <div className="text-[10px] mb-4" style={{ color: C.overlay0 }}>
          初期値: 作業 25分 / 休憩 5分 / 長休憩 15分 / 4回ごと
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95"
            style={{
              background: "transparent",
              border: `1px solid ${C.surface1}`,
              color: C.subtext1,
            }}
          >
            キャンセル
          </button>
          <button
            onClick={() => onConfirm(name)}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95"
            style={{
              background: name.trim() ? C.mauve : C.surface1,
              color: name.trim() ? C.base : C.overlay0,
            }}
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Bottom Tab Bar (Work fixed; others tappable but no-op per spec)
// =============================================
function BottomTabBar({ active }: { active: BottomTab }) {
  const items: { key: BottomTab; label: string; icon: React.ReactNode }[] = [
    { key: "schedule", label: "Schedule", icon: <Calendar size={18} /> },
    { key: "work", label: "Work", icon: <Clock size={18} /> },
    { key: "materials", label: "Materials", icon: <FileText size={18} /> },
    { key: "settings", label: "Settings", icon: <SettingsIcon size={18} /> },
  ];
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-3 pointer-events-none">
      <div
        className="rounded-full flex items-center justify-around px-2 py-2 pointer-events-auto shadow-lg"
        style={{
          background: C.mantle,
          border: `1px solid ${C.surface1}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
      >
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <button
              key={it.key}
              onClick={() => {
                // out of scope: only Work is interactive per spec
              }}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-300"
              style={{
                color: isActive ? C.mauve : C.overlay0,
                background: isActive ? C.surface0 : "transparent",
              }}
            >
              {it.icon}
              <span className="text-[9px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

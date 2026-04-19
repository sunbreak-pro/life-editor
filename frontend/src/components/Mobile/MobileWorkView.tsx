import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  ChevronRight,
  Zap,
  Check,
} from "lucide-react";
import { useTimerContext } from "../../hooks/useTimerContext";
import { getDataService } from "../../services/dataServiceFactory";
import type { TaskNode } from "../../types/taskTree";
import type { SessionType } from "../../types/timer";

// --- Session segmented pill ---

interface SessionTabsProps {
  value: SessionType;
  onChange: (v: SessionType) => void;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
}

function SessionTabs({
  value,
  onChange,
  workMinutes,
  breakMinutes,
  longBreakMinutes,
}: SessionTabsProps) {
  const { t } = useTranslation();
  const tabs: Array<{ id: SessionType; label: string; sub: string }> = [
    {
      id: "WORK",
      label: t("mobile.work.session.work", "Focus"),
      sub: t("mobile.work.sessionSub.work", "{{minutes}} min", {
        minutes: workMinutes,
      }),
    },
    {
      id: "BREAK",
      label: t("mobile.work.session.break", "Break"),
      sub: t("mobile.work.sessionSub.break", "{{minutes}} min", {
        minutes: breakMinutes,
      }),
    },
    {
      id: "LONG_BREAK",
      label: t("mobile.work.session.longBreak", "Long break"),
      sub: t("mobile.work.sessionSub.longBreak", "{{minutes}} min", {
        minutes: longBreakMinutes,
      }),
    },
  ];
  return (
    <div className="mx-auto flex w-fit gap-1 rounded-xl bg-notion-bg-secondary p-1">
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex min-w-[56px] flex-col items-center gap-px rounded-[9px] px-3.5 py-1.5 ${
              on
                ? "bg-notion-bg shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                : "bg-transparent"
            }`}
          >
            <span
              className={`text-xs font-semibold ${
                on ? "text-notion-text" : "text-notion-text-secondary"
              }`}
            >
              {tab.label}
            </span>
            <span className="text-[9.5px] font-medium text-notion-text-secondary opacity-80">
              {tab.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- Active task chip (card) ---

function ActiveTaskChip({
  title,
  onChange,
}: {
  title: string | null;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onChange}
      className="flex w-[calc(100%-32px)] max-w-[360px] items-center gap-2.5 rounded-xl border border-notion-border bg-notion-bg px-3.5 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="w-1 self-stretch rounded-[2px] bg-notion-accent" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-px">
        <div className="text-[10px] font-medium uppercase tracking-wider text-notion-text-secondary">
          {t("mobile.work.activeTaskLabel", "IN PROGRESS")}
        </div>
        <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-notion-text">
          {title ?? t("mobile.work.selectTask", "Select a task...")}
        </div>
      </div>
      <ChevronRight size={14} className="shrink-0 text-notion-text-secondary" />
    </button>
  );
}

// --- Timer ring ---

interface TimerRingProps {
  progress: number; // 0..1
  size?: number;
  strokeColor: string;
  running: boolean;
  children: React.ReactNode;
}

function TimerRing({
  progress,
  size = 280,
  strokeColor,
  running,
  children,
}: TimerRingProps) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - progress);
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div
        className="pointer-events-none absolute rounded-full transition-opacity duration-500"
        style={{
          inset: -18,
          background: `radial-gradient(circle, ${strokeColor}33 0%, transparent 60%)`,
          filter: "blur(8px)",
          opacity: running ? 1 : 0.4,
        }}
      />
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={6}
          className="text-notion-border"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">{children}</div>
    </div>
  );
}

// --- Session dots (today progress) ---

interface SessionDotsProps {
  done: number;
  total: number;
  color: string;
}

function SessionDots({ done, total, color }: SessionDotsProps) {
  const dots = Array.from({ length: Math.max(1, total) });
  return (
    <div className="flex items-center justify-center gap-1.5">
      {dots.map((_, i) => {
        const filled = i < done;
        return (
          <div
            key={i}
            className="h-1.5 rounded-[3px] transition-all duration-200"
            style={{
              width: filled ? 18 : 6,
              background: filled ? color : "var(--color-notion-border)",
            }}
          />
        );
      })}
    </div>
  );
}

// --- Control dock ---

interface ControlDockProps {
  running: boolean;
  color: string;
  onReset: () => void;
  onToggleRun: () => void;
  onSkip: () => void;
}

function ControlDock({
  running,
  color,
  onReset,
  onToggleRun,
  onSkip,
}: ControlDockProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-[22px] pt-1">
      <button
        onClick={onReset}
        aria-label={t("mobile.work.controls.reset", "Reset")}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-notion-border bg-notion-bg shadow-[0_1px_2px_rgba(15,23,42,0.05)] active:opacity-80"
      >
        <RotateCcw size={18} className="text-notion-text-secondary" />
      </button>
      <button
        onClick={onToggleRun}
        aria-label={running ? "Pause" : "Start"}
        className="flex h-[76px] w-[76px] items-center justify-center rounded-full active:opacity-90"
        style={{
          background: running ? "var(--color-notion-text)" : color,
          boxShadow: `0 12px 28px ${color}55, 0 4px 8px rgba(15,23,42,0.10)`,
        }}
      >
        {running ? (
          <Pause size={30} className="text-white" />
        ) : (
          <Play size={30} className="ml-1 text-white" />
        )}
      </button>
      <button
        onClick={onSkip}
        aria-label={t("mobile.work.controls.skip", "Skip")}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-notion-border bg-notion-bg shadow-[0_1px_2px_rgba(15,23,42,0.05)] active:opacity-80"
      >
        <SkipForward size={18} className="text-notion-text-secondary" />
      </button>
    </div>
  );
}

// --- Main view ---

export function MobileWorkView() {
  const { t, i18n } = useTranslation();
  const timer = useTimerContext();
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);

  const sessionColor =
    timer.sessionType === "WORK"
      ? "var(--color-notion-accent)"
      : "var(--color-notion-success)";

  const sessionLabel =
    timer.sessionType === "WORK"
      ? t("mobile.work.sessionLabel.work", "FOCUS SESSION")
      : timer.sessionType === "BREAK"
        ? t("mobile.work.sessionLabel.break", "BREAK")
        : t("mobile.work.sessionLabel.longBreak", "LONG BREAK");

  // Header subtitle: "2026年4月18日 · 土" / "Sat, Apr 18, 2026"
  const todayLabel = useMemo(() => {
    const d = new Date();
    if (i18n.language === "ja") {
      const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${dow}`;
    }
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [i18n.language]);

  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const remainingLabel = t(
    "mobile.work.remaining",
    "{{minutes}} min {{seconds}} sec left",
    {
      minutes,
      seconds,
    },
  );

  const onSwitchSession = (next: SessionType) => {
    if (next === timer.sessionType) return;
    // Skip forward / back via the existing reducer path — mirrors segmented-pill intent.
    if (timer.isRunning) timer.pause();
    // Trick: change durations through existing setters doesn't rewind, so use
    // startRest for WORK→BREAK and dismiss for BREAK→WORK as best-effort.
    if (next === "WORK") {
      timer.dismissCompletionModal();
      timer.reset();
    } else {
      timer.startRest();
    }
  };

  const handleSkip = () => {
    // On WORK: complete current session by starting rest. On BREAK: go back to work.
    if (timer.sessionType === "WORK") {
      timer.startRest();
    } else {
      timer.dismissCompletionModal();
      timer.reset();
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-notion-bg">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-[18px] pb-1 pt-6">
        <div>
          <div className="text-[11px] font-medium text-notion-text-secondary">
            {todayLabel}
          </div>
          <div className="text-[22px] font-bold tracking-tight text-notion-text">
            {t("mobile.work.focusTitle", "Focus")}
          </div>
        </div>
      </div>

      {/* Session pill */}
      <div className="shrink-0 pb-1.5 pt-3.5">
        <SessionTabs
          value={timer.sessionType}
          onChange={onSwitchSession}
          workMinutes={timer.workDurationMinutes}
          breakMinutes={timer.breakDurationMinutes}
          longBreakMinutes={timer.longBreakDurationMinutes}
        />
      </div>

      {/* Active task chip */}
      <div className="flex shrink-0 justify-center pt-3.5">
        <ActiveTaskChip
          title={timer.activeTask?.title ?? null}
          onChange={() => setTaskSelectorOpen(true)}
        />
      </div>

      {/* Timer */}
      <div className="relative flex flex-1 flex-col items-center justify-center pt-2">
        <TimerRing
          progress={timer.progress}
          strokeColor={sessionColor as string}
          running={timer.isRunning}
        >
          <div
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[1px]"
            style={{ color: sessionColor }}
          >
            <Zap size={14} style={{ color: sessionColor }} />
            <span>{sessionLabel}</span>
          </div>
          <div
            className="text-[64px] font-extralight leading-none tracking-tighter tabular-nums text-notion-text"
            style={{ marginTop: 8 }}
          >
            {timer.formatTime(timer.remainingSeconds)}
          </div>
          <div className="mt-2 text-xs font-medium text-notion-text-secondary">
            {remainingLabel}
          </div>
        </TimerRing>

        <div className="mt-6">
          <SessionDots
            done={timer.completedSessions}
            total={timer.targetSessions}
            color={sessionColor as string}
          />
        </div>
        <div className="mt-1.5 text-[11px] text-notion-text-secondary">
          {t(
            "mobile.work.dotsProgress",
            "Today {{done}} / {{total}} sessions",
            {
              done: timer.completedSessions,
              total: timer.targetSessions,
            },
          )}
        </div>
      </div>

      {/* Control dock */}
      <div className="shrink-0 pb-6 pt-1">
        <ControlDock
          running={timer.isRunning}
          color={sessionColor as string}
          onReset={timer.reset}
          onToggleRun={timer.isRunning ? timer.pause : timer.start}
          onSkip={handleSkip}
        />
      </div>

      {/* Session completion modal */}
      {timer.showCompletionModal && timer.completedSessionType && (
        <MobileSessionCompletionModal
          completedSessionType={timer.completedSessionType}
          onExtend={() => timer.extendWork(5)}
          onStartRest={timer.startRest}
          onStartWork={() => {
            timer.dismissCompletionModal();
            timer.start();
          }}
          onDismiss={timer.dismissCompletionModal}
        />
      )}

      {/* Task selector bottom sheet */}
      {taskSelectorOpen && (
        <MobileTaskSelector
          activeTaskId={timer.activeTask?.id ?? null}
          onSelect={(task) => {
            timer.startForTask(task.id, task.title);
            setTaskSelectorOpen(false);
          }}
          onClear={() => {
            timer.clearTask();
            setTaskSelectorOpen(false);
          }}
          onClose={() => setTaskSelectorOpen(false)}
        />
      )}
    </div>
  );
}

// --- Session completion modal (unchanged from previous version) ---

function MobileSessionCompletionModal({
  completedSessionType,
  onExtend,
  onStartRest,
  onStartWork,
  onDismiss,
}: {
  completedSessionType: "WORK" | "REST";
  onExtend: () => void;
  onStartRest: () => void;
  onStartWork: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const isWork = completedSessionType === "WORK";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-t-2xl bg-notion-bg p-6 pb-10">
        <h3 className="mb-1 text-center text-lg font-semibold text-notion-text">
          {isWork
            ? t("timer.sessionComplete", "Session Complete!")
            : t("timer.breakOver", "Break Over!")}
        </h3>
        <p className="mb-6 text-center text-sm text-notion-text-secondary">
          {isWork
            ? t("timer.takeBreak", "Time for a break")
            : t("timer.backToWork", "Ready to focus again?")}
        </p>

        <div className="space-y-3">
          {isWork ? (
            <>
              <button
                onClick={onStartRest}
                className="w-full rounded-xl bg-notion-accent py-3 text-sm font-medium text-white active:opacity-80"
              >
                {t("timer.startBreak", "Start Break")}
              </button>
              <button
                onClick={onExtend}
                className="w-full rounded-xl border border-notion-border py-3 text-sm font-medium text-notion-text active:bg-notion-hover"
              >
                {t("timer.extend5min", "Extend +5 min")}
              </button>
            </>
          ) : (
            <button
              onClick={onStartWork}
              className="w-full rounded-xl bg-notion-accent py-3 text-sm font-medium text-white active:opacity-80"
            >
              {t("timer.startWork", "Start Work")}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="w-full py-2 text-center text-sm text-notion-text-secondary active:opacity-60"
          >
            {t("common.dismiss", "Dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Task selector bottom sheet (unchanged from previous version) ---

function MobileTaskSelector({
  activeTaskId,
  onSelect,
  onClear,
  onClose,
}: {
  activeTaskId: string | null;
  onSelect: (task: TaskNode) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const ds = getDataService();

  useEffect(() => {
    (async () => {
      try {
        const tree = await ds.fetchTaskTree();
        setTasks(
          tree.filter(
            (t) => t.type === "task" && !t.isDeleted && t.status !== "DONE",
          ),
        );
      } catch (e) {
        console.error("Failed to load tasks:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [ds]);

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl bg-notion-bg"
        style={{ maxHeight: "70dvh" }}
      >
        <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
          <h3 className="text-sm font-semibold text-notion-text">
            {t("mobile.work.selectTask", "Select a task")}
          </h3>
          <button
            onClick={onClose}
            className="text-sm text-notion-text-secondary active:opacity-60"
          >
            {t("common.close", "Close")}
          </button>
        </div>

        <div className="border-b border-notion-border px-4 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("mobile.work.searchTask", "Search tasks...")}
            className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-notion-text placeholder:text-notion-text-secondary/50 focus:border-notion-accent focus:outline-none"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTaskId && (
            <button
              onClick={onClear}
              className="flex w-full items-center gap-3 border-b border-notion-border px-4 py-3 text-left text-sm text-notion-text-secondary active:bg-notion-hover"
            >
              {t("mobile.work.clearTask", "Clear selected task")}
            </button>
          )}
          {loading ? (
            <div className="p-4 text-center text-sm text-notion-text-secondary">
              {t("common.loading", "Loading...")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-notion-text-secondary">
              {t("mobile.work.noTasks", "No tasks found")}
            </div>
          ) : (
            filtered.map((task) => (
              <button
                key={task.id}
                onClick={() => onSelect(task)}
                className="flex w-full items-center gap-3 border-b border-notion-border px-4 py-3 text-left active:bg-notion-hover"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-notion-text">
                  {task.title}
                </span>
                {task.id === activeTaskId && (
                  <Check size={16} className="shrink-0 text-notion-accent" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

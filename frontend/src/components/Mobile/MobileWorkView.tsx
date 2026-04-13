import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, RotateCcw, ChevronDown, Check } from "lucide-react";
import { useTimerContext } from "../../hooks/useTimerContext";
import { getDataService } from "../../services/dataServiceFactory";
import type { TaskNode } from "../../types/taskTree";

export function MobileWorkView() {
  const { t } = useTranslation();
  const timer = useTimerContext();
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);

  const progressPercent = timer.progress * 100;
  const sessionLabel =
    timer.sessionType === "WORK"
      ? t("timer.work", "Work")
      : timer.sessionType === "BREAK"
        ? t("timer.shortBreak", "Break")
        : t("timer.longBreak", "Long Break");

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      {/* Session type label */}
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-notion-text-secondary">
        {sessionLabel} &middot; {timer.completedSessions}/{timer.targetSessions}
      </div>

      {/* Timer circle */}
      <div className="relative mb-8 flex h-56 w-56 items-center justify-center">
        {/* Background circle */}
        <svg className="absolute inset-0" viewBox="0 0 224 224">
          <circle
            cx="112"
            cy="112"
            r="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-notion-border"
          />
          {/* Progress arc */}
          <circle
            cx="112"
            cy="112"
            r="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className={
              timer.sessionType === "WORK"
                ? "text-notion-accent"
                : "text-notion-success"
            }
            strokeDasharray={`${2 * Math.PI * 100}`}
            strokeDashoffset={`${2 * Math.PI * 100 * (1 - progressPercent / 100)}`}
            transform="rotate(-90 112 112)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>

        {/* Time display */}
        <div className="z-10 flex flex-col items-center">
          <span className="text-5xl font-light tabular-nums text-notion-text-primary">
            {timer.formatTime(timer.remainingSeconds)}
          </span>
        </div>
      </div>

      {/* Active task */}
      <button
        onClick={() => setTaskSelectorOpen(true)}
        className="mb-6 flex max-w-full items-center gap-2 rounded-lg border border-notion-border px-4 py-2.5 active:bg-notion-hover"
      >
        <span className="truncate text-sm text-notion-text">
          {timer.activeTask
            ? timer.activeTask.title
            : t("mobile.work.selectTask", "Select a task...")}
        </span>
        <ChevronDown
          size={14}
          className="shrink-0 text-notion-text-secondary"
        />
      </button>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={timer.reset}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-notion-border active:bg-notion-hover"
          aria-label={t("timer.reset", "Reset")}
        >
          <RotateCcw size={20} className="text-notion-text-secondary" />
        </button>
        <button
          onClick={timer.isRunning ? timer.pause : timer.start}
          className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg active:opacity-80 ${
            timer.isRunning ? "bg-notion-text-secondary" : "bg-notion-accent"
          }`}
          aria-label={
            timer.isRunning
              ? t("timer.pause", "Pause")
              : t("timer.start", "Start")
          }
        >
          {timer.isRunning ? (
            <Pause size={28} className="text-white" />
          ) : (
            <Play size={28} className="ml-1 text-white" />
          )}
        </button>
        <div className="h-12 w-12" /> {/* Spacer for symmetry */}
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

// --- Session completion modal ---

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
      <div className="w-full max-w-lg rounded-t-2xl bg-notion-bg-primary p-6 pb-10">
        <h3 className="mb-1 text-center text-lg font-semibold text-notion-text-primary">
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

// --- Task selector bottom sheet ---

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
        className="flex w-full max-w-lg flex-col rounded-t-2xl bg-notion-bg-primary"
        style={{ maxHeight: "70dvh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
          <h3 className="text-sm font-semibold text-notion-text-primary">
            {t("mobile.work.selectTask", "Select a task")}
          </h3>
          <button
            onClick={onClose}
            className="text-sm text-notion-text-secondary active:opacity-60"
          >
            {t("common.close", "Close")}
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-notion-border px-4 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("mobile.work.searchTask", "Search tasks...")}
            className="w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-notion-text-primary placeholder:text-notion-text-secondary/50 focus:border-notion-accent focus:outline-none"
            autoFocus
          />
        </div>

        {/* Task list */}
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
                <span className="min-w-0 flex-1 truncate text-sm text-notion-text-primary">
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

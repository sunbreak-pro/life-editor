import {
  Check,
  Clock,
  History as HistoryIcon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../components/BottomSheet";
import { Drawer } from "../components/Drawer";
import { SessionHistoryList } from "../components/SessionHistoryList";
import { useShell } from "../context/ShellContext";
import { useDismissOnEscape } from "../hooks/useDismissOnEscape";
import { useMockStore } from "../hooks/useMockStore";
import { useTimer } from "../hooks/useTimer";
import {
  addPreset,
  deletePreset,
  setActivePresetId,
  setAutoStartBreaks,
  updatePreset,
  updateScheduleItem,
} from "../lib/mockStore";
import {
  activateHeldTimer,
  changePreset,
  changeSessionType,
  keepAndSwitchTask,
  MAX_PARALLEL_TIMERS,
  nextSession,
  pauseTimer,
  resetTimer,
  setDraftComment,
  skipTimer,
  startTimer,
  stopCompletion,
  switchTask,
} from "../lib/timerEngine";
import type { HeldTimer } from "../lib/timerEngine";
import { C } from "../lib/theme";
import type {
  PomodoroPreset,
  ScheduleItem,
  SessionType,
  TimerSession,
  WikiTag,
} from "../lib/types";

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

const mapTags = (tags: WikiTag[]): Map<string, WikiTag> => {
  const m = new Map<string, WikiTag>();
  for (const t of tags) m.set(t.id, t);
  return m;
};

export function WorkScreen() {
  const { sidebarOpen, closeSidebar } = useShell();
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
  const isRunning = useTimer((s) => s.isRunning);
  const hasStarted = useTimer((s) => s.hasStarted);
  const activeSessionType = useTimer((s) => s.sessionType);
  const activeRemainingSec = useTimer((s) => s.remainingSec);
  const heldTimers = useTimer((s) => s.heldTimers);
  // 稼働中にサイドバーでプリセットを切り替えようとしたときの確認対象 (#4)。
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{ background: C.base, color: C.text }}
    >
      <SubTabBar tab={tab} onChange={setTab} />
      <main
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ background: C.base }}
      >
        {tab === "timer" && activePreset && (
          <TimerTab
            preset={activePreset}
            currentTask={currentTask}
            scheduleTasks={scheduleItems}
            wikiTags={wikiTags}
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

      <Drawer open={sidebarOpen} onClose={closeSidebar} title="作業">
        <WorkSidebarContent
          presets={presets}
          activePresetId={activePresetId}
          heldTimers={heldTimers}
          activeWork={
            hasStarted && activeSessionType === "WORK"
              ? {
                  title: currentTask?.title ?? "(タスクなし)",
                  remainingSec: activeRemainingSec,
                  isRunning,
                }
              : null
          }
          onActivateHeld={(id) => {
            activateHeldTimer(id);
            closeSidebar();
          }}
          onPickPreset={(id) => {
            if (id === activePresetId) {
              closeSidebar();
              return;
            }
            // 進行中(稼働 or PAUSE)はタイマーを破棄する確認を挟む。停止中は即切替。
            if (hasStarted) {
              setPendingPreset(id);
              closeSidebar();
            } else {
              changePreset(id);
              closeSidebar();
            }
          }}
          onJump={(t) => {
            setTab(t);
            closeSidebar();
          }}
        />
      </Drawer>

      {pendingPreset && (
        <ConfirmModal
          title="プリセットを切り替えますか?"
          message={`進行中のタイマーは破棄され、「${
            presets.find((p) => p.id === pendingPreset)?.name ?? ""
          }」の最初から始まります`}
          onCancel={() => setPendingPreset(null)}
          onConfirm={() => {
            changePreset(pendingPreset);
            setPendingPreset(null);
          }}
        />
      )}
    </div>
  );
}

function WorkSidebarContent({
  presets,
  activePresetId,
  heldTimers,
  activeWork,
  onActivateHeld,
  onPickPreset,
  onJump,
}: {
  presets: PomodoroPreset[];
  activePresetId: string | null;
  heldTimers: HeldTimer[];
  activeWork: {
    title: string;
    remainingSec: number;
    isRunning: boolean;
  } | null;
  onActivateHeld: (id: string) => void;
  onPickPreset: (id: string) => void;
  onJump: (tab: SubTab) => void;
}) {
  const parallelCount = (activeWork ? 1 : 0) + heldTimers.length;
  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-3">
      {parallelCount > 0 && (
        <section className="flex flex-col gap-2">
          <div
            className="text-xs flex items-center gap-1"
            style={{ color: C.subtext0 }}
          >
            <span className="flex-1">進行中タイマー</span>
            <span>
              {parallelCount}/{MAX_PARALLEL_TIMERS}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {activeWork && (
              <div
                className="min-h-[44px] px-3 rounded-md flex items-center gap-2"
                style={{ background: C.surface1, color: C.text }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: activeWork.isRunning ? C.green : C.overlay0,
                  }}
                />
                <span className="text-sm flex-1 truncate">
                  {activeWork.title}
                </span>
                <span
                  className="text-xs font-mono"
                  style={{ color: C.subtext0 }}
                >
                  {formatCountdown(activeWork.remainingSec)}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: C.mauve,
                    color: C.base,
                    fontWeight: 600,
                  }}
                >
                  現在
                </span>
              </div>
            )}
            {heldTimers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onActivateHeld(t.id)}
                aria-label={`${t.taskTitle ?? "(タスクなし)"} のタイマーに切替`}
                className="min-h-[44px] px-3 rounded-md flex items-center gap-2 text-left transition active:scale-[0.99]"
                style={{ background: C.surface0, color: C.subtext1 }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: t.isRunning ? C.green : C.overlay0 }}
                />
                <span
                  className="text-sm flex-1 truncate"
                  style={{ color: C.text }}
                >
                  {t.taskTitle ?? "(タスクなし)"}
                </span>
                <span
                  className="text-xs font-mono"
                  style={{ color: C.subtext0 }}
                >
                  {formatCountdown(t.remainingSec)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <div className="text-xs" style={{ color: C.subtext0 }}>
          プリセット切替
        </div>
        <div className="flex flex-col gap-1">
          {presets.map((p) => {
            const active = p.id === activePresetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickPreset(p.id)}
                className="min-h-[44px] px-3 rounded-md flex items-center gap-2 text-left transition active:scale-[0.99]"
                style={{
                  background: active ? C.surface1 : C.surface0,
                  color: active ? C.text : C.subtext1,
                }}
              >
                <Clock size={16} color={active ? C.mauve : C.subtext0} />
                <span
                  className="text-sm flex-1 truncate"
                  style={{ fontWeight: active ? 600 : 400 }}
                >
                  {p.name}
                </span>
                <span className="text-[10px]" style={{ color: C.subtext0 }}>
                  {p.workMin}/{p.breakMin}
                </span>
                {active && <Check size={16} color={C.mauve} />}
              </button>
            );
          })}
          {presets.length === 0 && (
            <div className="text-xs" style={{ color: C.subtext0 }}>
              プリセットがありません
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-xs" style={{ color: C.subtext0 }}>
          移動
        </div>
        <button
          type="button"
          onClick={() => onJump("history")}
          className="min-h-[44px] px-3 rounded-md flex items-center gap-2 text-left"
          style={{ background: C.surface0, color: C.text }}
        >
          <HistoryIcon size={16} color={C.subtext0} />
          <span className="text-sm">履歴</span>
        </button>
        <button
          type="button"
          onClick={() => onJump("settings")}
          className="min-h-[44px] px-3 rounded-md flex items-center gap-2 text-left"
          style={{ background: C.surface0, color: C.text }}
        >
          <SettingsIcon size={16} color={C.subtext0} />
          <span className="text-sm">設定</span>
        </button>
      </section>
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
      role="tablist"
      aria-label="作業"
      style={{ background: C.mantle, borderBottom: `1px solid ${C.surface1}` }}
    >
      {items.map((it) => {
        const active = it.id === tab;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
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
}: {
  preset: PomodoroPreset;
  currentTask: ScheduleItem | null;
  scheduleTasks: ScheduleItem[];
  wikiTags: WikiTag[];
}) {
  // タイマー実行状態はモジュール singleton (timerEngine) が保持する。セクション間を
  // 移動して TimerTab が unmount されても動き続け、remainingSec を読むここだけが
  // 250ms ごとに再描画される。
  const sessionType = useTimer((s) => s.sessionType);
  const remainingSec = useTimer((s) => s.remainingSec);
  const isRunning = useTimer((s) => s.isRunning);
  const completedWorks = useTimer((s) => s.completedWorks);
  const pulseKey = useTimer((s) => s.pulseKey);
  const autoCountdown = useTimer((s) => s.autoCountdown);
  const completionModal = useTimer((s) => s.completionModal);
  const draftComment = useTimer((s) => s.draftComment);
  const hasStarted = useTimer((s) => s.hasStarted);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskDoneAsk, setTaskDoneAsk] = useState(false);
  // セッション種別を稼働中に切り替えようとしたときの確認対象 (#3)。
  const [pendingType, setPendingType] = useState<SessionType | null>(null);
  // タスク切替時の保持/破棄ダイアログ対象 (#multi-timer)。
  const [pendingTaskSwitch, setPendingTaskSwitch] = useState<{
    id: string | null;
  } | null>(null);
  const [taskLimitNote, setTaskLimitNote] = useState(false);

  // 現在のアクティブタイマーは「保持」できるか (WORK かつ開始済み = 稼働 or PAUSE)。
  const canHold = sessionType === "WORK" && hasStarted;

  const handleSessionTypeTap = (t: SessionType) => {
    if (t === sessionType) return;
    if (isRunning) {
      setPendingType(t); // 稼働中は確認ダイアログを挟む
    } else {
      changeSessionType(t);
    }
  };

  // タスク切替の起点。進行中なら保持/破棄ダイアログ、そうでなければ即切替。
  const requestSwitchTask = (id: string | null) => {
    setPickerOpen(false);
    if (id === (currentTask?.id ?? null)) return;
    if (canHold) {
      setTaskLimitNote(false);
      setPendingTaskSwitch({ id });
    } else {
      switchTask(id);
    }
  };

  const handleTaskComplete = () => {
    if (!currentTask) return;
    updateScheduleItem(currentTask.id, { status: "done" });
    setTaskDoneAsk(false);
    switchTask(null); // 完了したタスクのアクティブタイマーは破棄
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
      <SessionTypeTabs value={sessionType} onChange={handleSessionTypeTap} />
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
            onClear={() => requestSwitchTask(null)}
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
      {sessionType === "WORK" && (
        <div className="flex flex-col gap-1">
          <div className="text-xs" style={{ color: C.subtext0 }}>
            このセッションのメモ
          </div>
          <textarea
            value={draftComment}
            onChange={(e) => setDraftComment(e.target.value)}
            placeholder="やったこと・気づきをメモ... (完了すると履歴に残ります)"
            rows={2}
            className="w-full bg-transparent outline-none text-sm p-2 rounded-md"
            style={{
              color: C.text,
              border: `1px solid ${C.surface1}`,
              background: C.crust,
              resize: "none",
            }}
          />
        </div>
      )}
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-2 mt-2">
        <button
          type="button"
          onClick={resetTimer}
          aria-label="リセット"
          className="h-14 rounded-md flex items-center justify-center transition-transform active:scale-[0.98]"
          style={{ background: C.surface0, color: C.text }}
        >
          <RotateCcw size={18} />
        </button>
        <button
          type="button"
          onClick={isRunning ? pauseTimer : startTimer}
          aria-label={isRunning ? "一時停止" : "スタート"}
          className="h-14 rounded-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98] text-base font-semibold"
          style={{ background: C.mauve, color: C.base }}
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
          {isRunning ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={skipTimer}
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
      <TaskPickerModal
        open={pickerOpen}
        tasks={scheduleTasks}
        wikiTags={wikiTags}
        selectedId={currentTask?.id ?? null}
        onClose={() => setPickerOpen(false)}
        onPick={requestSwitchTask}
      />
      {completionModal && (
        <SessionCompletionModal
          type={completionModal.type}
          taskTitle={currentTask?.title ?? null}
          durationSec={completionModal.durationSec}
          skipped={completionModal.skipped}
          onNext={nextSession}
          onStop={stopCompletion}
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
      {pendingType && (
        <ConfirmModal
          title="セッションを切り替えますか?"
          message="進行中のタイマーは破棄され、選んだセッションの最初から始まります"
          onCancel={() => setPendingType(null)}
          onConfirm={() => {
            changeSessionType(pendingType);
            setPendingType(null);
          }}
        />
      )}
      {pendingTaskSwitch && (
        <TaskSwitchModal
          fromTitle={currentTask?.title ?? "(タスクなし)"}
          toTitle={
            pendingTaskSwitch.id
              ? (scheduleTasks.find((t) => t.id === pendingTaskSwitch.id)
                  ?.title ?? "(タスク)")
              : "(タスクなし)"
          }
          limitReached={taskLimitNote}
          onKeep={() => {
            const ok = keepAndSwitchTask(pendingTaskSwitch.id);
            if (!ok) {
              setTaskLimitNote(true); // 上限。ダイアログは開いたまま
              return;
            }
            setPendingTaskSwitch(null);
          }}
          onDiscard={() => {
            switchTask(pendingTaskSwitch.id);
            setPendingTaskSwitch(null);
          }}
          onCancel={() => setPendingTaskSwitch(null)}
        />
      )}
    </div>
  );
}

function TaskSwitchModal({
  fromTitle,
  toTitle,
  limitReached,
  onKeep,
  onDiscard,
  onCancel,
}: {
  fromTitle: string;
  toTitle: string;
  limitReached: boolean;
  onKeep: () => void;
  onDiscard: () => void;
  onCancel: () => void;
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
          aria-label="タスクを切り替えますか?"
          className="w-full max-w-xs rounded-2xl p-4 flex flex-col gap-3 pointer-events-auto"
          style={{ background: C.base, border: `1px solid ${C.surface1}` }}
        >
          <div className="text-sm font-medium" style={{ color: C.text }}>
            タスクを切り替えますか?
          </div>
          <div className="text-xs" style={{ color: C.subtext0 }}>
            「{fromTitle}」のタイマーを保持したまま「{toTitle}
            」へ切り替えられます。
          </div>
          {limitReached && (
            <div
              className="text-xs rounded-md px-2 py-1.5"
              style={{ background: `${C.red}22`, color: C.red }}
            >
              保持できるタイマーは最大 {MAX_PARALLEL_TIMERS}{" "}
              つまでです。破棄して切り替えるか、進行中タイマーを整理してください。
            </div>
          )}
          <div className="flex flex-col gap-2 mt-1">
            <button
              type="button"
              onClick={onKeep}
              className="h-10 rounded-md text-sm font-medium"
              style={{ background: C.mauve, color: C.base }}
            >
              保持して切替
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="h-10 rounded-md text-sm font-medium"
              style={{ background: C.surface1, color: C.text }}
            >
              破棄して切替
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-md text-sm"
              style={{ border: `1px solid ${C.surface1}`, color: C.subtext1 }}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SessionTypeTabs({
  value,
  onChange,
}: {
  value: SessionType;
  onChange: (t: SessionType) => void;
}) {
  // 稼働中でも押せる。切替の確認は呼び出し側 (handleSessionTypeTap) が担当する。
  const items: SessionType[] = ["WORK", "BREAK", "LONG_BREAK"];
  return (
    <div
      className="h-9 grid grid-cols-3 rounded-md overflow-hidden"
      role="radiogroup"
      aria-label="セッション種別"
      style={{ background: C.surface0 }}
    >
      {items.map((it) => {
        const active = it === value;
        const c = sessionColor(it);
        return (
          <button
            key={it}
            type="button"
            role="radio"
            aria-checked={active}
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
  open,
  tasks,
  wikiTags,
  selectedId,
  onClose,
  onPick,
}: {
  open: boolean;
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
    <BottomSheet
      open={open}
      onClose={onClose}
      title="タスクを選択"
      rightLabel={showDone ? "完了非表示" : "完了表示"}
      onRightClick={() => setShowDone((v) => !v)}
      initialSnapIndex={1}
    >
      <div className="flex flex-col" style={{ color: C.text }}>
        <div
          className="px-3 py-2 shrink-0 sticky top-0 z-10"
          style={{
            background: C.mantle,
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
        <div className="flex-1">
          {groups.length === 0 && (
            <div
              className="flex items-center justify-center text-sm py-10"
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
            className="p-3 shrink-0 sticky bottom-0"
            style={{
              borderTop: `1px solid ${C.surface1}`,
              background: C.mantle,
            }}
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
    </BottomSheet>
  );
}

function HistoryTab({ sessions }: { sessions: TimerSession[] }) {
  return <SessionHistoryList sessions={sessions} />;
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

      <AddPresetModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(input) => {
          const p = addPreset(input);
          setActivePresetId(p.id);
          setAddOpen(false);
        }}
      />

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
        aria-label={label}
        aria-valuetext={`${draft}${suffix}`}
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
      role="switch"
      aria-checked={value}
      aria-label={label}
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
  open,
  onClose,
  onSave,
}: {
  open: boolean;
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
    <BottomSheet
      open={open}
      onClose={onClose}
      title="プリセットを追加"
      rightLabel="追加"
      onRightClick={() => {
        if (!canSave) return;
        onSave({
          name: name.trim(),
          workMin,
          breakMin,
          longBreakMin,
          sessionsBeforeLongBreak: sessions,
        });
      }}
    >
      <div className="p-3 flex flex-col gap-3" style={{ color: C.text }}>
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
    </BottomSheet>
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
  useDismissOnEscape(true, onCancel);
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
          role="dialog"
          aria-modal="true"
          aria-label={title}
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

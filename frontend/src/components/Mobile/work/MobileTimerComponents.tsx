import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  ClipboardList,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionType } from "../../../types/timer";
import { FolderBreadcrumb } from "./MobileTaskSelector";

// --- Session segmented pill ---

interface SessionTabsProps {
  value: SessionType;
  onChange: (v: SessionType) => void;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
}

export function SessionTabs({
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

// --- Active task chip (Free default / Task selected) ---

interface ActiveTaskChipProps {
  title: string | null;
  folderPath: string[];
  onOpenPicker: () => void;
  onClear: () => void;
}

export function ActiveTaskChip({
  title,
  folderPath,
  onOpenPicker,
  onClear,
}: ActiveTaskChipProps) {
  const { t } = useTranslation();
  const hasTask = title !== null;
  const accentColor = hasTask
    ? "var(--color-notion-accent)"
    : "var(--color-notion-text-secondary)";

  return (
    <div className="flex w-[calc(100%-32px)] max-w-[360px] items-center gap-2.5 rounded-xl border border-notion-border bg-notion-bg px-3.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div
        className="w-1 self-stretch rounded-[2px]"
        style={{ background: accentColor }}
      />
      <button
        onClick={onOpenPicker}
        aria-label={t("mobile.work.selectTaskAria", "Select task")}
        className="flex min-w-0 flex-1 flex-col items-start gap-px text-left active:opacity-70"
      >
        {hasTask ? (
          <>
            <FolderBreadcrumb path={folderPath} className="max-w-full" />
            <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-notion-text">
              {title}
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] font-medium uppercase tracking-wider text-notion-text-secondary">
              {t("mobile.work.freeSessionLabel", "FREE SESSION")}
            </div>
            <div className="text-sm font-semibold text-notion-text">
              {t("mobile.work.freeSessionTitle", "Focus only")}
            </div>
          </>
        )}
      </button>
      {hasTask ? (
        <button
          onClick={onClear}
          aria-label={t("mobile.work.clearTaskAria", "Clear task")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-notion-text-secondary active:bg-notion-hover"
        >
          <X size={16} />
        </button>
      ) : (
        <button
          onClick={onOpenPicker}
          aria-label={t("mobile.work.selectTaskAria", "Select task")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-notion-text-secondary active:bg-notion-hover"
        >
          <ClipboardList size={18} />
        </button>
      )}
    </div>
  );
}

// --- Timer arc (270° fan, matches desktop TimerCircularProgress) ---

interface TimerArcProps {
  progress: number; // 0..1
  size?: number;
  strokeColor: string;
  running: boolean;
  children: React.ReactNode;
}

const ARC_ANGLE = 270;
const START_ROTATION = 135;

export function TimerArc({
  progress,
  size = 280,
  strokeColor,
  running,
  children,
}: TimerArcProps) {
  const r = (size - 24) / 2;
  const circumference = 2 * Math.PI * r;
  const arcLength = (ARC_ANGLE / 360) * circumference;
  const gapLength = circumference - arcLength;
  const clamped = Math.min(1, Math.max(0, progress));
  const progressLength = clamped * arcLength;

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
          strokeLinecap="round"
          className="text-notion-border"
          stroke="currentColor"
          strokeDasharray={`${arcLength} ${gapLength}`}
          transform={`rotate(${START_ROTATION} ${size / 2} ${size / 2})`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${progressLength} ${circumference - progressLength}`}
          transform={`rotate(${START_ROTATION} ${size / 2} ${size / 2})`}
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

export function SessionDots({ done, total, color }: SessionDotsProps) {
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

export function ControlDock({
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

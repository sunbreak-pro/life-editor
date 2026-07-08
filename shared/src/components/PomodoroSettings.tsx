import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "./Input";
import { cn } from "./cn";

/*
 * Pomodoro settings + preset editor (target-IA import, design 361-407 / 1102).
 * Pure primitive — lumen-* tokens, opaque surfaces (§5), all copy injected
 * (§6.4). Rendered inside the shell's rightSidebar (Desktop) / left drawer
 * (Mobile) via RightSidebarPortal, so it drops the Card chrome and lays out as
 * two bordered blocks:
 *   1. Timer settings — 2-col grid of 5 numeric fields + an autoStart switch.
 *   2. Presets — apply/delete rows (or an empty box) + a save form.
 * Durations are edited in MINUTES. The host supplies values + mutators; this
 * component owns only the transient preset-name input.
 */

export interface PomodoroPresetOption {
  id: number;
  name: string;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

export interface PomodoroSettingsLabels {
  /** Heading for the timer-settings block. */
  settingsHeading: string;
  workDuration: string;
  breakDuration: string;
  longBreakDuration: string;
  sessionsPerSet: string;
  targetSessions: string;
  autoStartBreaks: string;
  /** Heading for the presets block. */
  presets: string;
  presetsEmpty: string;
  presetNamePlaceholder: string;
  saveAsPreset: string;
  apply: string;
  deletePreset: string;
}

export interface PomodoroSettingsProps {
  workDurationMinutes: number;
  breakDurationMinutes: number;
  longBreakDurationMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  targetSessions: number;
  presets: readonly PomodoroPresetOption[];
  labels: PomodoroSettingsLabels;
  onWorkDurationChange: (min: number) => void;
  onBreakDurationChange: (min: number) => void;
  onLongBreakDurationChange: (min: number) => void;
  onSessionsBeforeLongBreakChange: (count: number) => void;
  onAutoStartBreaksChange: (enabled: boolean) => void;
  onTargetSessionsChange: (count: number) => void;
  onApplyPreset: (preset: PomodoroPresetOption) => void;
  onCreatePreset: (name: string) => void;
  onDeletePreset: (id: number) => void;
}

const BLOCK =
  "flex flex-col gap-3 rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary p-3";
const BLOCK_HEADING = "text-[13px] font-semibold text-lumen-text-secondary";

export function PomodoroSettings(props: PomodoroSettingsProps) {
  const { labels, presets } = props;
  const [presetName, setPresetName] = useState("");

  const submitPreset = () => {
    const name = presetName.trim();
    if (!name) return;
    props.onCreatePreset(name);
    setPresetName("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={BLOCK}>
        <h3 className={BLOCK_HEADING}>{labels.settingsHeading}</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={labels.workDuration}
            value={props.workDurationMinutes}
            min={1}
            max={240}
            onChange={props.onWorkDurationChange}
          />
          <NumberField
            label={labels.breakDuration}
            value={props.breakDurationMinutes}
            min={1}
            max={60}
            onChange={props.onBreakDurationChange}
          />
          <NumberField
            label={labels.longBreakDuration}
            value={props.longBreakDurationMinutes}
            min={1}
            max={60}
            onChange={props.onLongBreakDurationChange}
          />
          <NumberField
            label={labels.sessionsPerSet}
            value={props.sessionsBeforeLongBreak}
            min={1}
            max={20}
            onChange={props.onSessionsBeforeLongBreakChange}
          />
          <NumberField
            label={labels.targetSessions}
            value={props.targetSessions}
            min={1}
            max={20}
            onChange={props.onTargetSessionsChange}
          />
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-sm text-lumen-text">
            {labels.autoStartBreaks}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={props.autoStartBreaks}
            aria-label={labels.autoStartBreaks}
            onClick={() =>
              props.onAutoStartBreaksChange(!props.autoStartBreaks)
            }
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              props.autoStartBreaks
                ? "bg-lumen-accent"
                : "bg-lumen-border-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-lumen-on-accent transition-all",
                props.autoStartBreaks ? "right-0.5" : "left-0.5",
              )}
            />
          </button>
        </div>
      </div>

      <div className={BLOCK}>
        <h3 className={BLOCK_HEADING}>{labels.presets}</h3>
        {presets.length === 0 ? (
          <div className="rounded-lumen-md border border-dashed border-lumen-border-strong p-4 text-center text-[13px] text-lumen-text-tertiary">
            {labels.presetsEmpty}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {presets.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lumen-md border border-lumen-border px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-lumen-text">
                    {p.name}
                  </div>
                  <div className="truncate font-mono text-xs text-lumen-text-tertiary">
                    {p.workDuration}·{p.breakDuration}·{p.longBreakDuration}·×
                    {p.sessionsBeforeLongBreak}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => props.onApplyPreset(p)}
                  className="shrink-0 text-[13px] font-semibold text-lumen-accent hover:opacity-80"
                >
                  {labels.apply}
                </button>
                <button
                  type="button"
                  aria-label={labels.deletePreset}
                  onClick={() => props.onDeletePreset(p.id)}
                  className="shrink-0 text-lumen-text-tertiary hover:text-lumen-danger"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={presetName}
            placeholder={labels.presetNamePlaceholder}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button
            type="button"
            onClick={submitPreset}
            disabled={presetName.trim().length === 0}
            className="shrink-0 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3.5 py-2 text-[13px] font-semibold text-lumen-text hover:bg-lumen-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {labels.saveAsPreset}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
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
    <label className="flex flex-col gap-1">
      <span className="text-xs text-lumen-text-tertiary">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

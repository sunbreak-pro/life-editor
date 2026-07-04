import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { IconButton } from "./IconButton";

/*
 * Pomodoro settings + preset editor (W3-B). Pure primitive — lumen-* tokens,
 * opaque container (§5), all copy injected (§6.4). Durations are edited in
 * MINUTES (matching the 0018 columns + domain TimerSettings). The host (which
 * reads useTimerContext) supplies the current values + the mutators; this
 * component owns only the transient preset-name input. IME: bare-key handling
 * isn't needed here (numeric inputs + a plain text field that submits on the
 * Save button, not on Enter), so no isComposing guard is required.
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
  workDuration: string;
  breakDuration: string;
  longBreakDuration: string;
  sessionsPerSet: string;
  autoStartBreaks: string;
  targetSessions: string;
  minutesUnit: string;
  presets: string;
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
    <Card padding="md" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={labels.workDuration}
          unit={labels.minutesUnit}
          value={props.workDurationMinutes}
          min={1}
          max={240}
          onChange={props.onWorkDurationChange}
        />
        <NumberField
          label={labels.breakDuration}
          unit={labels.minutesUnit}
          value={props.breakDurationMinutes}
          min={1}
          max={60}
          onChange={props.onBreakDurationChange}
        />
        <NumberField
          label={labels.longBreakDuration}
          unit={labels.minutesUnit}
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

      <label className="flex items-center justify-between gap-2 text-sm text-lumen-text">
        <span>{labels.autoStartBreaks}</span>
        <input
          type="checkbox"
          checked={props.autoStartBreaks}
          onChange={(e) => props.onAutoStartBreaksChange(e.target.checked)}
          className="h-4 w-4 accent-lumen-accent"
        />
      </label>

      <div className="flex flex-col gap-2 border-t border-lumen-border pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-lumen-text-secondary">
          {labels.presets}
        </h3>
        <ul className="flex flex-col gap-1">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md bg-lumen-bg-secondary px-3 py-1.5"
            >
              <span className="truncate text-sm text-lumen-text">
                {p.name}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => props.onApplyPreset(p)}
                >
                  {labels.apply}
                </Button>
                <IconButton
                  icon={<Trash2 size={15} />}
                  label={labels.deletePreset}
                  variant="danger"
                  size="sm"
                  onClick={() => props.onDeletePreset(p.id)}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Input
            value={presetName}
            placeholder={labels.presetNamePlaceholder}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Plus size={16} />}
            onClick={submitPreset}
            disabled={presetName.trim().length === 0}
          >
            {labels.saveAsPreset}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NumberField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-lumen-text">
      <span className="text-xs text-lumen-text-secondary">
        {label}
        {unit ? ` (${unit})` : ""}
      </span>
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

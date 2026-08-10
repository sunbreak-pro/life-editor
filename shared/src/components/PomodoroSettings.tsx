import { useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "./Input";
import { Modal } from "./Modal";
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
 * component owns only the transient preset-name input and which numeric fields
 * the user has blanked out.
 *
 * #624 — the blank state is why those fields are not plain controlled inputs.
 * They used to render String(value) and commit Number(e.target.value) on every
 * keystroke; clearing one sent Number("") === 0, the host's clampMinutes floored
 * that to the minimum, and the field re-rendered with "1" before the next
 * keystroke landed. Deleting the last digit was impossible, and retyping 50 on
 * top of the resurrected 1 produced 150. Blanking is now a state of its own
 * (`cleared`): the input shows "", NOTHING is committed, and the stored value
 * stays untouched until a real number arrives. Leaving a field blank raises the
 * "enter a number" dialog, and dismissing it restores every blank field to its
 * stored value — the alternative (keeping them blank) traps the user, since the
 * blur that fires when they reach for the nav would re-open the dialog forever.
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
  /** Dismiss button of the blank-field dialog (#624). */
  emptyValueConfirm: string;
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
  /**
   * Formats the blank-field dialog copy for the field the user left empty
   * (#624) — e.g. `(field) => t("pomodoro.emptyValue", { field })`. A function
   * rather than a finished string because the field name is only known when the
   * dialog opens, and interpolating it here would mean re-implementing i18n
   * inside a pure primitive (§6.4). Mirrors EventEditorPane's formatDuration.
   */
  formatEmptyValueMessage: (fieldLabel: string) => string;
}

const BLOCK =
  "flex flex-col gap-3 rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary p-3";
const BLOCK_HEADING = "text-sm font-semibold text-lumen-text-secondary";

export function PomodoroSettings(props: PomodoroSettingsProps) {
  const { labels, presets } = props;
  const [presetName, setPresetName] = useState("");
  // Blanked-out numeric fields, keyed by a stable field id → that field's
  // label. The label rides along because it is what the dialog has to name, and
  // reading it back out of props at dialog time would mean a second lookup
  // table. Empty object = every field holds a number.
  const [cleared, setCleared] = useState<Record<string, string>>({});
  // Label of the field the dialog is complaining about (null = closed).
  const [blankField, setBlankField] = useState<string | null>(null);

  const markCleared = useCallback(
    (key: string, label: string, isCleared: boolean) => {
      setCleared((prev) => {
        if (isCleared === (prev[key] !== undefined)) return prev;
        if (!isCleared) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: label };
      });
    },
    [],
  );

  // Dismissing the dialog re-fills every blank field from its stored value.
  // See the header comment: leaving them blank would re-trigger the dialog on
  // the next blur and the user could never reach the nav.
  const closeBlankDialog = () => {
    setCleared({});
    setBlankField(null);
  };

  const submitPreset = () => {
    // A preset saves the CURRENT settings, so a blank field would silently
    // store the pre-edit number under a name the user thinks describes what
    // they just typed.
    const firstBlank = Object.values(cleared)[0];
    if (firstBlank !== undefined) {
      setBlankField(firstBlank);
      return;
    }
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
            fieldKey="workDuration"
            label={labels.workDuration}
            value={props.workDurationMinutes}
            cleared={cleared.workDuration !== undefined}
            min={1}
            max={240}
            onChange={props.onWorkDurationChange}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="breakDuration"
            label={labels.breakDuration}
            value={props.breakDurationMinutes}
            cleared={cleared.breakDuration !== undefined}
            min={1}
            max={60}
            onChange={props.onBreakDurationChange}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="longBreakDuration"
            label={labels.longBreakDuration}
            value={props.longBreakDurationMinutes}
            cleared={cleared.longBreakDuration !== undefined}
            min={1}
            max={60}
            onChange={props.onLongBreakDurationChange}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="sessionsPerSet"
            label={labels.sessionsPerSet}
            value={props.sessionsBeforeLongBreak}
            cleared={cleared.sessionsPerSet !== undefined}
            min={1}
            max={20}
            onChange={props.onSessionsBeforeLongBreakChange}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="targetSessions"
            label={labels.targetSessions}
            value={props.targetSessions}
            cleared={cleared.targetSessions !== undefined}
            min={1}
            max={20}
            onChange={props.onTargetSessionsChange}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
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
          <div className="rounded-lumen-md border border-dashed border-lumen-border-strong p-4 text-center text-sm text-lumen-text-tertiary">
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
                  className="shrink-0 text-sm font-semibold text-lumen-accent hover:opacity-80"
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
            className="shrink-0 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3.5 py-2 text-sm font-semibold text-lumen-text hover:bg-lumen-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {labels.saveAsPreset}
          </button>
        </div>
      </div>

      {/* Blank-field dialog (#624). The message IS the heading — an alert with
          one sentence and an OK gains nothing from a separate title, and Modal
          uses `title` for its accessible name. */}
      <Modal
        open={blankField !== null}
        onClose={closeBlankDialog}
        title={props.formatEmptyValueMessage(blankField ?? "")}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeBlankDialog}
            className="rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3.5 py-2 text-sm font-semibold text-lumen-text hover:bg-lumen-hover"
          >
            {labels.emptyValueConfirm}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/*
 * One numeric setting. Still controlled by the host's value — `cleared` is the
 * single escape hatch that lets the box show "" while the stored number stays
 * put (#624). Keeping the value authoritative is what makes clamping visible:
 * type 500 into a max-240 field and the host's clamp still paints 240 back.
 */
function NumberField({
  fieldKey,
  label,
  value,
  cleared,
  min,
  max,
  onChange,
  onClearedChange,
  onBlankBlur,
}: {
  fieldKey: string;
  label: string;
  value: number;
  cleared: boolean;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onClearedChange: (key: string, label: string, isCleared: boolean) => void;
  onBlankBlur: (label: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-lumen-text-tertiary">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={cleared ? "" : String(value)}
        invalid={cleared}
        onChange={(e) => {
          const raw = e.target.value;
          // "" is what an emptied box reports — and also what a type="number"
          // input reports mid-way through an unparseable entry ("-", "1e").
          // Either way there is no number to store yet, so store nothing.
          if (raw.trim() === "") {
            onClearedChange(fieldKey, label, true);
            return;
          }
          onClearedChange(fieldKey, label, false);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          if (cleared) onBlankBlur(label);
        }}
      />
    </label>
  );
}

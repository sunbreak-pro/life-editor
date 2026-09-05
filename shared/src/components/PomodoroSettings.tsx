import { useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { DISABLED_FILLED_BTN, FOCUS_RING_ON_ACCENT } from "./styleTokens";
import { cn } from "./cn";

/*
 * Pomodoro settings + preset editor (target-IA import, design 361-407 / 1102).
 * Pure primitive — lumen-* tokens, opaque surfaces (§5), all copy injected
 * (§6.4). Rendered inside the shell's rightSidebar (Desktop) / left drawer
 * (Mobile) via RightSidebarPortal, so it drops the Card chrome and lays out as
 * two bordered blocks:
 *   1. Timer settings — 2-col grid of 5 numeric fields + an autoStart switch
 *      + the save footer.
 *   2. Presets — apply/delete rows (or an empty box) + a save form.
 * Durations are edited in MINUTES.
 *
 * SAVE BUTTON (#714, Epic #627 — ユーザー裁定 D-20260810-sched-1 = A, the model
 * PR #681 shipped for EventEditorPane). The 5 numeric fields are a DRAFT and
 * nothing reaches the host until the save button is pressed. They used to
 * commit on every keystroke, so a number tried out on the way to another one
 * was already the stored setting. The panel's own preset-name form was already
 * a save button, which left two commit models inside one panel; now there is
 * one.
 *
 * NOT drafted, and deliberately so: the autoStart switch, Apply and Delete.
 * Those are discrete acts rather than field edits (nothing about them is "half
 * typed") — the same line Epic #627 draws when it leaves the status toggles
 * out. Apply additionally CLEARS the draft: it commits all four durations, so
 * a leftover overlay would keep showing numbers the preset just replaced.
 *
 * The saved patch carries only what moved, in ONE call, so the host writes one
 * row per press no matter how many fields changed.
 *
 * #624 — the blank state is why those fields are not plain controlled inputs.
 * They used to render String(value) and commit Number(e.target.value) on every
 * keystroke; clearing one sent Number("") === 0, the host's clampMinutes floored
 * that to the minimum, and the field re-rendered with "1" before the next
 * keystroke landed. Deleting the last digit was impossible, and retyping 50 on
 * top of the resurrected 1 produced 150. Blanking is a state of its own
 * (`cleared`): the input shows "", NOTHING is recorded, and the value behind it
 * stays untouched until a real number arrives. Leaving a field blank raises the
 * "enter a number" dialog, and dismissing it puts every blank field back to the
 * value the panel is holding — the alternative (keeping them blank) traps the
 * user, since the blur that fires when they reach for the nav would re-open the
 * dialog forever.
 */

export interface PomodoroPresetOption {
  id: number;
  name: string;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

/** The durations a preset stores — what one "save as preset" captures. */
export interface PomodoroPresetValues {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
}

/**
 * What one press of the save button changes (#714). Only the fields that
 * actually moved are present, so an untouched setting is never rewritten with
 * the value it already had.
 */
export interface PomodoroSettingsPatch {
  workDuration?: number;
  breakDuration?: number;
  longBreakDuration?: number;
  sessionsBeforeLongBreak?: number;
  targetSessions?: number;
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
  /** Primary action of the settings block — "保存" (#714). */
  save: string;
  /** Shown beside the button while nothing is pending — "保存済み" (#714). */
  saved: string;
  /** Shown beside the button while a draft is pending — "未保存" (#714). */
  unsaved: string;
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
  /**
   * Commit the pending numeric draft (#714). Fires only from the save button,
   * only when something changed, and exactly ONCE per press carrying every
   * changed field — five separate writes would mean five rows and five undo
   * entries for one gesture.
   */
  onSaveSettings: (patch: PomodoroSettingsPatch) => void;
  /** An act, not a field — commits on click (see the header comment). */
  onAutoStartBreaksChange: (enabled: boolean) => void;
  onApplyPreset: (preset: PomodoroPresetOption) => void;
  /**
   * Store the on-screen durations under `name`. The values travel with the
   * name because the panel is what holds them now: an unsaved draft and the
   * host's stored settings can differ, and a preset named after numbers the
   * user is looking at must not capture the ones underneath them (#714).
   */
  onCreatePreset: (name: string, values: PomodoroPresetValues) => void;
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

const SAVE_BTN = cn(
  "shrink-0 rounded-lumen-md bg-lumen-accent px-3.5 py-2 text-sm font-semibold text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover",
  FOCUS_RING_ON_ACCENT,
  // This is the button #1474 was reported against. It does not go through the
  // shared <Button>, so fixing the variant map alone would have left the
  // reported screen exactly as it was.
  DISABLED_FILLED_BTN,
);

/** The five numeric settings, keyed the way `cleared` keys them. */
interface PomodoroNumbers {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  targetSessions: number;
}

type PomodoroNumberKey = keyof PomodoroNumbers;

/**
 * The fields the user has actually typed into. Everything absent here keeps
 * following the host.
 *
 * A draft seeded once and then left alone would turn every EXTERNAL change
 * into a fake pending edit: another tab (or the same account on a phone)
 * rewrites the settings row, this panel goes on showing what it opened with,
 * the button lights up calling them unsaved — and pressing it pushes the stale
 * numbers back over the remote ones. Overlaying only what was typed keeps
 * untouched fields live.
 */
type PomodoroEdits = Partial<PomodoroNumbers>;

function storedNumbers(props: PomodoroSettingsProps): PomodoroNumbers {
  return {
    workDuration: props.workDurationMinutes,
    breakDuration: props.breakDurationMinutes,
    longBreakDuration: props.longBreakDurationMinutes,
    sessionsBeforeLongBreak: props.sessionsBeforeLongBreak,
    targetSessions: props.targetSessions,
  };
}

/**
 * What the save button would write — and, by being empty, whether there is
 * anything to write at all. Dirty state and the payload come from this ONE
 * function on purpose: derive them separately and the button eventually lights
 * up for a change it then declines to send.
 */
function buildPatch(
  stored: PomodoroNumbers,
  draft: PomodoroNumbers,
): PomodoroSettingsPatch {
  const patch: PomodoroSettingsPatch = {};
  if (draft.workDuration !== stored.workDuration)
    patch.workDuration = draft.workDuration;
  if (draft.breakDuration !== stored.breakDuration)
    patch.breakDuration = draft.breakDuration;
  if (draft.longBreakDuration !== stored.longBreakDuration)
    patch.longBreakDuration = draft.longBreakDuration;
  if (draft.sessionsBeforeLongBreak !== stored.sessionsBeforeLongBreak)
    patch.sessionsBeforeLongBreak = draft.sessionsBeforeLongBreak;
  if (draft.targetSessions !== stored.targetSessions)
    patch.targetSessions = draft.targetSessions;
  return patch;
}

export function PomodoroSettings(props: PomodoroSettingsProps) {
  const { labels, presets } = props;
  const [presetName, setPresetName] = useState("");
  const [edits, setEdits] = useState<PomodoroEdits>({});
  // Blanked-out numeric fields, keyed by a stable field id → that field's
  // label. The label rides along because it is what the dialog has to name, and
  // reading it back out of props at dialog time would mean a second lookup
  // table. Empty object = every field holds a number.
  const [cleared, setCleared] = useState<
    Partial<Record<PomodoroNumberKey, string>>
  >({});
  // Label of the field the dialog is complaining about (null = closed).
  const [blankField, setBlankField] = useState<string | null>(null);

  // Host values underneath, the user's own edits on top (see PomodoroEdits).
  const stored = storedNumbers(props);
  const draft: PomodoroNumbers = { ...stored, ...edits };
  const patch = buildPatch(stored, draft);
  const dirty = Object.keys(patch).length > 0;
  /** Label of the first blank field, or null while every field holds a number. */
  const blankLabel = Object.values(cleared)[0] ?? null;

  const editNumber = useCallback((key: PomodoroNumberKey, value: number) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }, []);

  const markCleared = useCallback(
    (key: PomodoroNumberKey, label: string, isCleared: boolean) => {
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

  // Dismissing the dialog re-fills every blank field from the value the panel
  // is holding (the pending edit if there is one, otherwise the host's). See
  // the header comment: leaving them blank would re-trigger the dialog on the
  // next blur and the user could never reach the nav.
  const closeBlankDialog = () => {
    setCleared({});
    setBlankField(null);
  };

  const saveSettings = () => {
    // A blank field has no number to save, and saving around it would write
    // the value the user just deleted.
    if (blankLabel !== null) {
      setBlankField(blankLabel);
      return;
    }
    if (!dirty) return;
    props.onSaveSettings(patch);
    // Drop the overlay so the fields follow the host again. That is also what
    // keeps clamping visible: type 500 into a max-240 field and the saved
    // value paints 240 back.
    setEdits({});
  };

  const applyPreset = (preset: PomodoroPresetOption) => {
    // Apply commits all four durations, so the pending overlay has to go —
    // keeping it would leave the panel showing numbers the preset replaced.
    setEdits({});
    setCleared({});
    props.onApplyPreset(preset);
  };

  const submitPreset = () => {
    // A preset stores the numbers on screen, so a blank field would silently
    // store the pre-edit number under a name the user thinks describes what
    // they just typed.
    if (blankLabel !== null) {
      setBlankField(blankLabel);
      return;
    }
    const name = presetName.trim();
    if (!name) return;
    props.onCreatePreset(name, {
      workDuration: draft.workDuration,
      breakDuration: draft.breakDuration,
      longBreakDuration: draft.longBreakDuration,
      sessionsBeforeLongBreak: draft.sessionsBeforeLongBreak,
    });
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
            value={draft.workDuration}
            cleared={cleared.workDuration !== undefined}
            min={1}
            max={240}
            onChange={editNumber}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="breakDuration"
            label={labels.breakDuration}
            value={draft.breakDuration}
            cleared={cleared.breakDuration !== undefined}
            min={1}
            max={60}
            onChange={editNumber}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="longBreakDuration"
            label={labels.longBreakDuration}
            value={draft.longBreakDuration}
            cleared={cleared.longBreakDuration !== undefined}
            min={1}
            max={60}
            onChange={editNumber}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="sessionsBeforeLongBreak"
            label={labels.sessionsPerSet}
            value={draft.sessionsBeforeLongBreak}
            cleared={cleared.sessionsBeforeLongBreak !== undefined}
            min={1}
            max={20}
            onChange={editNumber}
            onClearedChange={markCleared}
            onBlankBlur={setBlankField}
          />
          <NumberField
            fieldKey="targetSessions"
            label={labels.targetSessions}
            value={draft.targetSessions}
            cleared={cleared.targetSessions !== undefined}
            min={1}
            max={20}
            onChange={editNumber}
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

        {/* Save footer (#714) — the only commit for the five fields above.
            Disabled while there is nothing to write (a control that is
            pressable and does nothing is worse than one that is visibly off),
            with the state spelled out beside it so "why can I not press this"
            has an answer on screen rather than only in the button's opacity. */}
        <div className="flex items-center justify-end gap-3 border-t border-lumen-border pt-3">
          <span
            aria-live="polite"
            className={cn(
              "text-xs",
              dirty ? "text-lumen-accent" : "text-lumen-text-secondary",
            )}
          >
            {dirty ? labels.unsaved : labels.saved}
          </span>
          <button
            type="button"
            onClick={saveSettings}
            disabled={!dirty}
            className={SAVE_BTN}
          >
            {labels.save}
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
                  onClick={() => applyPreset(p)}
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
 * One numeric setting. Controlled by the DRAFT value the pane passes down —
 * `cleared` is the single escape hatch that lets the box show "" while the
 * number behind it stays put (#624). Since #714 a keystroke lands in the
 * draft rather than in the host, so the host's clamp becomes visible when the
 * save button drops the draft: type 500 into a max-240 field and the saved
 * value paints 240 back.
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
  fieldKey: PomodoroNumberKey;
  label: string;
  value: number;
  cleared: boolean;
  min: number;
  max: number;
  onChange: (key: PomodoroNumberKey, value: number) => void;
  onClearedChange: (
    key: PomodoroNumberKey,
    label: string,
    isCleared: boolean,
  ) => void;
  onBlankBlur: (label: string) => void;
}) {
  return (
    // #946 — the inputs of one grid row have to line up even when the two
    // labels wrap to different heights ("Long break duration between sets"
    // takes three lines beside a one-line "Sessions per set", and ja wraps at
    // different widths again). `h-full` makes the field as tall as its row and
    // `grow` on the caption hands the leftover height to the LABEL, so the
    // input is pushed to the bottom of every cell — labels top-aligned, inputs
    // bottom-aligned, in any language and at any drawer width. A fixed offset
    // or min-height would only hold for the one string it was measured on.
    <label className="flex h-full flex-col gap-1">
      <span className="grow text-xs text-lumen-text-tertiary">{label}</span>
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
          if (Number.isFinite(n)) onChange(fieldKey, n);
        }}
        onBlur={() => {
          if (cleared) onBlankBlur(label);
        }}
      />
    </label>
  );
}

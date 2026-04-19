import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../../hooks/useTimerContext";
import { SettingsSection } from "./MobileSettingsPrimitives";

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: SliderRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-[12px] text-notion-text-secondary">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-notion-accent disabled:opacity-50"
      />
      <span
        className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-notion-text"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}m
      </span>
    </div>
  );
}

export function MobileTimerSection() {
  const { t } = useTranslation();
  const {
    workDurationMinutes,
    breakDurationMinutes,
    longBreakDurationMinutes,
    setWorkDurationMinutes,
    setBreakDurationMinutes,
    setLongBreakDurationMinutes,
    isRunning,
  } = useTimerContext();

  return (
    <SettingsSection title={t("mobile.settings.timer.title", "Timer defaults")}>
      <div className="space-y-2 px-4 py-2.5">
        <SliderRow
          label={t("mobile.settings.timer.workDuration", "Work")}
          value={workDurationMinutes}
          min={5}
          max={120}
          step={5}
          onChange={setWorkDurationMinutes}
          disabled={isRunning}
        />
        <SliderRow
          label={t("mobile.settings.timer.breakDuration", "Break")}
          value={breakDurationMinutes}
          min={1}
          max={30}
          step={1}
          onChange={setBreakDurationMinutes}
          disabled={isRunning}
        />
        <SliderRow
          label={t("mobile.settings.timer.longBreakDuration", "Long break")}
          value={longBreakDurationMinutes}
          min={5}
          max={60}
          step={5}
          onChange={setLongBreakDurationMinutes}
          disabled={isRunning}
        />
        {isRunning && (
          <p className="text-[10px] text-notion-text-secondary/70">
            {t(
              "mobile.settings.timer.runningNote",
              "Stop the timer to adjust defaults.",
            )}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

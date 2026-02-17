import { DurationPicker } from '../shared/DurationPicker';

interface DurationSelectorProps {
  workDurationMinutes: number;
  onChangeDuration: (min: number) => void;
  disabled: boolean;
}

export function DurationSelector({ workDurationMinutes, onChangeDuration, disabled }: DurationSelectorProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <DurationPicker
        value={workDurationMinutes}
        onChange={onChangeDuration}
        disabled={disabled}
      />
    </div>
  );
}

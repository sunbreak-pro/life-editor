import { RotateCcw } from "lucide-react";
import { Button } from "./Button";

export interface SettingsResetProps {
  /**
   * Fired when the user presses the reset button. The HOST owns the actual
   * confirm dialog + resetLocalPreferences() call (a destructive, reload-side
   * effect stays out of this pure primitive — CLAUDE.md §6.4).
   */
  onReset: () => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    button: string;
  };
}

/*
 * Reset settings card (§216 lightweight prefs). Pure / props-injected: renders
 * the destructive "reset preferences" affordance and raises onReset; the host
 * confirms and performs the clear-and-reload. lumen-* tokens only, opaque
 * surface (CLAUDE.md §5 / §6.4). The button uses the danger variant to signal
 * the destructive nature.
 */
export function SettingsReset({ onReset, labels }: SettingsResetProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="reset">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <RotateCcw size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>
      <div>
        <Button variant="danger" onClick={onReset}>
          {labels.button}
        </Button>
      </div>
    </div>
  );
}

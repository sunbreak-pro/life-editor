import { GraduationCap } from "lucide-react";
import { Button } from "./Button";

export interface SettingsTutorialProps {
  /**
   * Fired when the user asks for the tour again. The HOST calls the tour's
   * `restart()` — this primitive never reads context (CLAUDE.md §6.4).
   */
  onRestart: () => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    button: string;
  };
}

/*
 * Tutorial re-run card (#1123 — the Settings half of #1121's tour).
 *
 * The tour offers itself once, on first run, and never again after it is
 * finished or skipped (TourContext's auto-start gate). That makes this card
 * the ONLY way back to it, which is why it is a plain always-present row
 * rather than something that appears only while a tour is unfinished: a
 * control the user cannot find is the same as no control at all.
 *
 * `secondary` rather than `danger`: restarting discards the tour's own
 * position and nothing else, so it does not belong in the same visual class as
 * the Reset card below it.
 */
export function SettingsTutorial({ onRestart, labels }: SettingsTutorialProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="tutorial">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <GraduationCap size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>
      <div>
        {/* Called, not forwarded: `onRestart` is a zero-arg callback, and
            handing the Button's own reference over would deliver the click
            event as its first argument. */}
        <Button variant="secondary" onClick={() => onRestart()}>
          {labels.button}
        </Button>
      </div>
    </div>
  );
}

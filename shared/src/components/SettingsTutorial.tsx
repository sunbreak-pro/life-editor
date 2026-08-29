import { GraduationCap } from "lucide-react";
import { Button } from "./Button";

export interface SettingsTutorialProps {
  /**
   * Fired when the user asks for the tutorial. The HOST opens the launcher
   * modal from here — this primitive never reads context (CLAUDE.md §6.4).
   */
  onOpen: () => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    button: string;
  };
}

/*
 * Tutorial card (#1123, re-pointed by #1194).
 *
 * The tour offers itself once, on first run, and never again after it is
 * finished or skipped (TourContext's auto-start gate). That makes this card
 * the ONLY way back to it, which is why it is a plain always-present row
 * rather than something that appears only while a tour is unfinished: a
 * control the user cannot find is the same as no control at all.
 *
 * The button used to BE the restart — one press, back to step one, every
 * section again. #1194 put a launcher in front of it instead: the same press
 * now opens a modal that explains the app and lets the user pick a section,
 * with "walk the whole thing" still on the menu. The card keeps its shape
 * because the change is in what the door opens onto, not in where the door is.
 *
 * `secondary` rather than `danger`: opening the tutorial costs the user
 * nothing, so it does not belong in the same visual class as the Reset card
 * below it.
 */
export function SettingsTutorial({ onOpen, labels }: SettingsTutorialProps) {
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
        {/* Called, not forwarded: `onOpen` is a zero-arg callback, and handing
            the Button's own reference over would deliver the click event as
            its first argument. */}
        <Button variant="secondary" onClick={() => onOpen()}>
          {labels.button}
        </Button>
      </div>
    </div>
  );
}

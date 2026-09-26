import { LifeBuoy } from "lucide-react";
import { Button } from "./Button";
import { CARD_BTN_TAP } from "./styleTokens";

export interface SettingsHelpProps {
  /** Opens the help dialog. The HOST owns the dialog and its contents. */
  onOpen: () => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    button: string;
  };
}

/*
 * Help and contact card (#1989).
 *
 * Until this card the only way to reach the operator was a URL inside the
 * terms, and nobody opens the terms to ask a question. One press opens the
 * help dialog; the contact links are its last section, so a question is two
 * presses from Settings.
 *
 * `secondary` like the Legal card beside it: reading help costs nothing.
 */
export function SettingsHelp({ onOpen, labels }: SettingsHelpProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="help">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <LifeBuoy size={16} className="text-lumen-text-secondary" />
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
        <Button
          variant="secondary"
          className={CARD_BTN_TAP}
          onClick={() => onOpen()}
        >
          {labels.button}
        </Button>
      </div>
    </div>
  );
}

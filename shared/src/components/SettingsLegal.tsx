import { ScrollText } from "lucide-react";
import { Button } from "./Button";

export interface SettingsLegalProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    privacy: string;
    terms: string;
  };
}

/*
 * Policy + terms card (#1251).
 *
 * The documents shipped with #1198 but only the sign-in screen linked them,
 * so from the moment an account existed they were unreachable — which is
 * backwards: the reason to check what you agreed to arrives long after you
 * agreed to it. Settings is where a signed-in user looks for anything about
 * their account, so the door goes here.
 *
 * `secondary` on both: reading a document costs the user nothing, and this
 * card sits in the same column as Delete account. Nothing here should carry
 * the visual weight of something destructive.
 */
export function SettingsLegal({
  onOpenPrivacy,
  onOpenTerms,
  labels,
}: SettingsLegalProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="legal">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <ScrollText size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Called, not forwarded: these are zero-arg callbacks, and handing
            the Button's own reference over would deliver the click event as
            its first argument. */}
        <Button variant="secondary" onClick={() => onOpenPrivacy()}>
          {labels.privacy}
        </Button>
        <Button variant="secondary" onClick={() => onOpenTerms()}>
          {labels.terms}
        </Button>
      </div>
    </div>
  );
}

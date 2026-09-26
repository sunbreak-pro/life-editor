import { Download } from "lucide-react";
import { Button } from "./Button";
import { CARD_BTN_TAP } from "./styleTokens";

export interface SettingsDataExportProps {
  /** Fired by the button. The HOST reads the data and saves the file. */
  onExport: () => void;
  /** True while the read is in flight — the button spins and cannot be re-pressed. */
  busy: boolean;
  /** A finished-run line ("1,204 rows saved to …"), or null. */
  notice: string | null;
  /** A failed-run line, or null. Wins over `notice` when both are set. */
  error: string | null;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    heading: string;
    description: string;
    button: string;
    busy: string;
  };
}

/*
 * "Download all my data" card (#1988).
 *
 * The terms ask users to keep their own copy, account deletion is immediate
 * and final, and the free-tier project has no point-in-time restore — so
 * until this card existed, every road to losing data had no user-side
 * answer. One press, one JSON file.
 *
 * `secondary`: taking a copy costs the user nothing and changes nothing, and
 * the card sits in the same column as Delete account, so it must not borrow
 * that card's weight. The result line is `role="status"` so a screen reader
 * hears the outcome of a press whose visible effect is a file elsewhere.
 */
export function SettingsDataExport({
  onExport,
  busy,
  notice,
  error,
  labels,
}: SettingsDataExportProps) {
  return (
    <div className="flex flex-col gap-3" data-section-id="data-export">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <Download size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>
      <div>
        {/* Called, not forwarded: `onExport` is a zero-arg callback, and
            handing the Button's own reference over would deliver the click
            event as its first argument. */}
        <Button
          variant="secondary"
          className={CARD_BTN_TAP}
          busy={busy}
          busyLabel={labels.busy}
          onClick={() => onExport()}
        >
          {labels.button}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-lumen-danger">
          {error}
        </p>
      ) : notice ? (
        <p role="status" className="text-sm text-lumen-text-secondary">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

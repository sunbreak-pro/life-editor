import { useId, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "../Button";
import { cn } from "../cn";
import { FOCUS_RING } from "../styleTokens";
import { blockText, type MergeHunk } from "../../utils/blockMerge";

/*
 * The "this note was changed somewhere else" banner (#2057 D-2 / NOTE-SYNC-3).
 *
 * Shown above the note body when the user has unsaved typing and the stored
 * body moved under it (an MCP `update_note`, another device). Saving is held
 * until a choice is made; typing is not, so the banner stays up and the text
 * keeps growing until then.
 *
 * The difference view is block-level (D-3): only the stretches that differ
 * are listed, each with "yours" and "the other place's" side by side, and a
 * stretch both sides changed is flagged — that is the one "keep both" lists
 * twice. Text only: a block with no text (an image, a divider) says so.
 *
 * Copy comes in through `labels` (§6.4 — no useTranslation in shared).
 */

export interface NoteConflictBannerLabels {
  message: string;
  showDiff: string;
  hideDiff: string;
  keepMine: string;
  takeTheirs: string;
  keepBoth: string;
  mineHeading: string;
  theirsHeading: string;
  /** Per-stretch captions, by who changed it. */
  changedByMine: string;
  changedByTheirs: string;
  changedByBoth: string;
  changedAlike: string;
  emptyBlock: string;
  noTextDiff: string;
}

export interface NoteConflictBannerProps {
  hunks: MergeHunk[];
  labels: NoteConflictBannerLabels;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
  onKeepBoth: () => void;
}

/** Narrow screens: every control reaches the 44px touch target (#1512). */
const TAP = "max-md:min-h-11";

export function NoteConflictBanner({
  hunks,
  labels,
  onKeepMine,
  onTakeTheirs,
  onKeepBoth,
}: NoteConflictBannerProps) {
  const [open, setOpen] = useState(false);
  const diffId = useId();
  const changed = hunks.filter(
    (h): h is Exclude<MergeHunk, { kind: "same" }> => h.kind !== "same",
  );

  const caption = (kind: Exclude<MergeHunk["kind"], "same">) =>
    kind === "mine"
      ? labels.changedByMine
      : kind === "theirs"
        ? labels.changedByTheirs
        : kind === "conflict"
          ? labels.changedByBoth
          : labels.changedAlike;

  return (
    <div
      role="alert"
      data-testid="note-conflict-banner"
      className="mb-3 rounded-lumen-md border border-lumen-warning bg-lumen-warning-subtle p-3 text-sm text-lumen-text"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-lumen-warning"
        />
        <p className="min-w-0 flex-1">{labels.message}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          className={TAP}
          onClick={onKeepMine}
        >
          {labels.keepMine}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className={TAP}
          onClick={onTakeTheirs}
        >
          {labels.takeTheirs}
        </Button>
        <Button
          variant="primary"
          size="sm"
          className={TAP}
          onClick={onKeepBoth}
        >
          {labels.keepBoth}
        </Button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={diffId}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "ml-auto rounded-lumen-sm px-2 text-lumen-accent underline-offset-2 hover:underline",
            TAP,
            FOCUS_RING,
          )}
        >
          {open ? labels.hideDiff : labels.showDiff}
        </button>
      </div>

      {open && (
        <div id={diffId} className="mt-3 flex flex-col gap-3">
          {changed.length === 0 ? (
            <p className="text-lumen-text-secondary">{labels.noTextDiff}</p>
          ) : (
            changed.map((hunk, i) => (
              <section
                key={i}
                data-hunk-kind={hunk.kind}
                className="rounded-lumen-sm border border-lumen-border bg-lumen-bg p-2"
              >
                <p className="mb-2 text-xs font-medium text-lumen-text-secondary">
                  {caption(hunk.kind)}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <DiffColumn
                    heading={labels.mineHeading}
                    blocks={hunk.mine}
                    emptyBlock={labels.emptyBlock}
                  />
                  <DiffColumn
                    heading={labels.theirsHeading}
                    blocks={hunk.theirs}
                    emptyBlock={labels.emptyBlock}
                  />
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DiffColumn({
  heading,
  blocks,
  emptyBlock,
}: {
  heading: string;
  blocks: Exclude<MergeHunk, { kind: "same" }>["mine"];
  emptyBlock: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs text-lumen-text-secondary">{heading}</p>
      {blocks.length === 0 ? (
        <p className="text-lumen-text-tertiary">{emptyBlock}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {blocks.map((block, i) => {
            const text = blockText(block);
            return (
              <li
                key={i}
                className="whitespace-pre-wrap break-words rounded-lumen-sm bg-lumen-bg-secondary px-2 py-1"
              >
                {text === "" ? (
                  <span className="text-lumen-text-tertiary">{emptyBlock}</span>
                ) : (
                  text
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useState } from "react";
import { Button } from "../Button";
import { cn } from "../cn";
import { Modal } from "../Modal";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import type { TagHubTagSummary } from "./types";

/*
 * Fold one tag into another (#1644). Opened from the rail's "…" → "Merge into
 * another tag…" (brief §4.1), because the working reason to merge is the one
 * the redefinition report measured: a handful of near-duplicate and never-used
 * tags that can only be deleted or renamed today.
 *
 * Two steps in one dialog: pick where the items go, then read what that will
 * do — how many items move and that the source tag is deleted — before the
 * button that does it. The design never drew it, so the brief's wording is the
 * spec ("統合先のタグを選び、件数の移動を確認する").
 *
 * The write order and the partial-failure rule are the hook's (mergeTags);
 * this only reports the choice. Opaque Modal (§5), copy injected (§6.4).
 */

export interface TagMergeDialogLabels {
  /** "Merge “{source}” into…" */
  formatTitle: (sourceName: string) => string;
  /** The candidate list's accessible name. */
  targetsLabel: string;
  /** Shown until a target is picked. */
  pickHint: string;
  /** "{count} items move to “{target}”, and “{source}” is deleted." */
  formatSummary: (count: number, targetName: string) => string;
  /** Shown when there is no other tag to merge into. */
  noTargets: string;
  confirm: string;
  cancel: string;
}

export interface TagMergeDialogProps {
  /** The tag being merged away; null keeps the dialog closed. */
  source: TagHubTagSummary | null;
  /** Every live tag; the source is left out here. */
  tags: readonly TagHubTagSummary[];
  onMerge: (sourceId: string, targetId: string) => void;
  onCancel: () => void;
  labels: TagMergeDialogLabels;
}

export function TagMergeDialog({
  source,
  tags,
  onMerge,
  onCancel,
  labels,
}: TagMergeDialogProps) {
  // Keyed on the source by the host (`key={source.id}`), so a fresh dialog
  // starts with nothing picked rather than the last merge's target.
  const [targetId, setTargetId] = useState<string | null>(null);
  if (!source) return null;

  const targets = tags.filter((tag) => tag.id !== source.id);
  const target = targets.find((tag) => tag.id === targetId) ?? null;
  const title = labels.formatTitle(source.name);

  return (
    <Modal open onClose={onCancel} title={title} size="sm">
      {targets.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">{labels.noTargets}</p>
      ) : (
        <ul
          role="radiogroup"
          aria-label={labels.targetsLabel}
          className="flex max-h-64 flex-col gap-0.5 overflow-y-auto"
        >
          {targets.map((tag) => {
            const checked = tag.id === targetId;
            return (
              <li key={tag.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setTargetId(tag.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lumen-md px-2 py-1.5 text-left text-sm text-lumen-text",
                    "transition-colors max-md:min-h-11",
                    checked ? "bg-lumen-accent-subtle" : "hover:bg-lumen-hover",
                    FOCUS_RING_TIGHT,
                  )}
                >
                  <TagHeadingIcon icon={tag.icon} color={tag.color} />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p
        aria-live="polite"
        className="mt-3 text-sm leading-relaxed text-lumen-text-secondary"
      >
        {target
          ? labels.formatSummary(source.count, target.name)
          : labels.pickHint}
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="max-md:min-h-11"
          onClick={onCancel}
        >
          {labels.cancel}
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="max-md:min-h-11"
          disabled={!target}
          onClick={() => target && onMerge(source.id, target.id)}
        >
          {labels.confirm}
        </Button>
      </div>
    </Modal>
  );
}

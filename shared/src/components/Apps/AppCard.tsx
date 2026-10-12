import { createElement } from "react";
import { BarChart3, Blocks, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "../Button";
import { Card } from "../Card";
import { CARD_BTN_TAP } from "../styleTokens";
import { resolveTagIcon } from "../tagIcon";
import { daysSince } from "./appsModel";
import type { AppCardLabels, AppsListEntry } from "./types";

/*
 * One registered extension app (#2165): who it is, where it lives, and what
 * its records say, with the way into Analytics' Records tab.
 *
 * The URL is a plain `<a target="_blank">`. The Desktop shell already routes a
 * new-window request to the system browser (desktop/src/main/index.ts —
 * `setWindowOpenHandler` → `shell.openExternal`), and the ledger only stores
 * http(s) URLs (extensionAppProblems), so nothing else can reach the href.
 *
 * The icon comes from the curated tag-icon set (#1114 — never the lucide
 * registry object); a name outside it, or none, draws Blocks, the section's
 * own glyph.
 */

export interface AppCardProps {
  app: AppsListEntry;
  labels: AppCardLabels;
  /** Epoch ms the "n days ago" line counts from. */
  now: number;
  onShowRecords: (slug: string) => void;
  /** Omitted on the narrow layout, where the ledger is read-only (Phase 1). */
  onEdit?: (slug: string) => void;
  onDelete?: (slug: string) => void;
}

export function AppCard({
  app,
  labels,
  now,
  onShowRecords,
  onEdit,
  onDelete,
}: AppCardProps) {
  const activity =
    app.lastRecordAt == null
      ? labels.noRecords
      : `${labels.lastRecord(daysSince(app.lastRecordAt, now))} · ${labels.recordsLast30Days(app.recordsLast30Days)}`;

  return (
    <Card padding="md" className="flex flex-col gap-3" data-app-slug={app.slug}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lumen-bg-secondary text-lumen-text-secondary"
        >
          {createElement(resolveTagIcon(app.icon) ?? Blocks, { size: 18 })}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-lumen-text">
            {app.name}
          </h3>
          <p className="truncate text-xs text-lumen-text-tertiary">
            {app.slug}
          </p>
          {app.description && (
            <p className="mt-1 text-[12.5px] leading-relaxed text-lumen-text-secondary">
              {app.description}
            </p>
          )}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={labels.openUrl(app.name)}
              className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-lumen-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
            >
              <span className="truncate">{app.url}</span>
              <ExternalLink size={12} aria-hidden="true" className="shrink-0" />
            </a>
          )}
          <p className="mt-1 text-xs tabular-nums text-lumen-text-secondary">
            {activity}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          className={CARD_BTN_TAP}
          leadingIcon={<BarChart3 size={14} />}
          onClick={() => onShowRecords(app.slug)}
        >
          {labels.showRecords}
        </Button>
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className={CARD_BTN_TAP}
            leadingIcon={<Pencil size={14} />}
            onClick={() => onEdit(app.slug)}
          >
            {labels.edit}
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className={CARD_BTN_TAP}
            leadingIcon={<Trash2 size={14} />}
            onClick={() => onDelete(app.slug)}
          >
            {labels.delete}
          </Button>
        )}
      </div>
    </Card>
  );
}

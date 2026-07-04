import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";

/*
 * Cross-platform Trash view (W2). PURE PRESENTATION — the frontend Tauri
 * TrashView could not be reused (it depended on legacy contexts removed in
 * DU-G + called getDataService directly). This rewrite takes all data +
 * actions via props (CLAUDE.md §6.4): the host (web TrashScreen) fetches
 * the soft-deleted rows for every category and resolves i18n, this part
 * only renders + emits restore / permanentDelete intents. lumen-* tokens
 * only; Card/Modal panels are opaque (§5).
 */

/** The five soft-delete categories surfaced in the web build (W2 scope). */
export type TrashCategory =
  | "tasks"
  | "notes"
  | "dailies"
  | "routines"
  | "events";

export interface TrashItem {
  id: string;
  /** Already-resolved display label (host falls back to "Untitled"). */
  label: string;
}

export interface TrashGroup {
  category: TrashCategory;
  /** Already-translated section heading (e.g. "Tasks"). */
  title: string;
  items: TrashItem[];
}

export interface TrashViewLabels {
  /** Screen heading. */
  title: string;
  /** Shown when every category is empty. */
  empty: string;
  /** Per-category empty-state line. */
  emptyCategory: string;
  /** Restore button / aria label. */
  restore: string;
  /** Permanent delete button / aria label. */
  deletePermanently: string;
  /** Confirm-dialog body. `{name}` is substituted with the item label. */
  confirmMessage: string;
  /** Confirm-dialog cancel button. */
  cancel: string;
}

export interface TrashViewProps {
  groups: TrashGroup[];
  onRestore: (category: TrashCategory, id: string) => void;
  onPermanentDelete: (category: TrashCategory, id: string) => void;
  labels: TrashViewLabels;
  /** Whether an action is in flight (disables buttons). */
  busy?: boolean;
}

interface PendingDelete {
  category: TrashCategory;
  item: TrashItem;
}

export function TrashView({
  groups,
  onRestore,
  onPermanentDelete,
  labels,
  busy = false,
}: TrashViewProps) {
  const [pending, setPending] = useState<PendingDelete | null>(null);

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  const confirmDelete = () => {
    if (pending) {
      onPermanentDelete(pending.category, pending.item.id);
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-lumen-text">
        {labels.title}
      </h2>

      {totalCount === 0 ? (
        <Card className="text-center text-sm text-lumen-text-secondary">
          {labels.empty}
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-lumen-text-secondary">
              {group.title}
            </h3>
            {group.items.length === 0 ? (
              <p className="px-1 text-sm text-lumen-text-secondary">
                {labels.emptyCategory}
              </p>
            ) : (
              <Card padding="none">
                <ul className="divide-y divide-lumen-border">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <span className="flex-1 truncate text-sm text-lumen-text">
                        {item.label}
                      </span>
                      <IconButton
                        icon={<RotateCcw size={16} />}
                        label={labels.restore}
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRestore(group.category, item.id)}
                      />
                      <IconButton
                        icon={<Trash2 size={16} />}
                        label={labels.deletePermanently}
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setPending({ category: group.category, item })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        ))
      )}

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={labels.deletePermanently}
      >
        <p className="mb-4 text-sm text-lumen-text">
          {pending
            ? labels.confirmMessage.replace("{name}", pending.item.label)
            : ""}
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPending(null)}
          >
            {labels.cancel}
          </Button>
          <Button variant="danger" size="sm" onClick={confirmDelete}>
            {labels.deletePermanently}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

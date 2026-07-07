import { useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Modal } from "./Modal";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "./cn";

/*
 * Cross-platform Trash view (target IA / ClaudeDesign import 2026-07-05,
 * project ea99bd45 Trash.dc.html). PURE PRESENTATION — all data + actions
 * come via props (CLAUDE.md §6.4); the host (web TrashScreen) fetches the
 * soft-deleted rows and resolves i18n.
 *
 * Danger asymmetry (brief §3): restore is the labeled primary affordance,
 * permanent delete stays an icon-only danger button one step quieter, and
 * always passes through an explicit confirm step (Modal on wide, BottomSheet
 * on narrow — same 768px switch as AppShell). Empty categories collapse
 * entirely instead of stacking five empty sections. A row-level `busy`
 * marker replaces the old global boolean so the in-flight row shows its own
 * spinner while every action stays disabled (no double submit).
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

export type TrashBusyAction = "restore" | "delete";

/** The single in-flight action — pins the spinner to its row. */
export interface TrashBusy {
  category: TrashCategory;
  id: string;
  action: TrashBusyAction;
}

export interface TrashViewLabels {
  /** Screen heading. */
  title: string;
  /** Header sub-line ("items can be restored from here…"). */
  description: string;
  /** Header total-count template. `{count}` is substituted. */
  totalCount: string;
  /** Shown when every category is empty. */
  empty: string;
  /** Sub-line under the global empty state. */
  emptyDescription: string;
  /** Restore button label. */
  restore: string;
  /** In-flight restore label (row spinner). */
  restoring: string;
  /** In-flight permanent-delete label (row spinner). */
  deleting: string;
  /** Permanent delete button / aria label / confirm title. */
  deletePermanently: string;
  /** Confirm-dialog body. `{name}` is substituted with the item label. */
  confirmMessage: string;
  /** Cascade note inside the confirm dialog (children / tag links). */
  cascadeWarning: string;
  /** Confirm-dialog cancel button. */
  cancel: string;
}

export interface TrashViewProps {
  groups: TrashGroup[];
  onRestore: (category: TrashCategory, id: string) => void;
  onPermanentDelete: (category: TrashCategory, id: string) => void;
  labels: TrashViewLabels;
  /** The in-flight action, if any. Disables every action while set. */
  busy?: TrashBusy | null;
  /** Wide↔narrow switch — mirrors AppShell's default breakpoint. */
  wideQuery?: string;
}

interface PendingDelete {
  category: TrashCategory;
  item: TrashItem;
}

function RowSpinner() {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-3.5 w-3.5 animate-spin rounded-lumen-full border-2",
        "border-lumen-border-strong border-t-lumen-accent",
      )}
    />
  );
}

export function TrashView({
  groups,
  onRestore,
  onPermanentDelete,
  labels,
  busy = null,
  wideQuery = "(min-width: 768px)",
}: TrashViewProps) {
  const wide = useMediaQuery(wideQuery, true);
  const [pending, setPending] = useState<PendingDelete | null>(null);

  const visibleGroups = groups.filter((group) => group.items.length > 0);
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  const anyBusy = busy !== null;

  const closeConfirm = () => setPending(null);
  const confirmDelete = () => {
    if (pending) {
      onPermanentDelete(pending.category, pending.item.id);
      setPending(null);
    }
  };

  // Shared confirm body — the outer chrome differs (Modal vs BottomSheet)
  // but the message, cascade note and button pair stay identical. DOM
  // order on wide puts Cancel first so the Modal's first-focusable focus
  // lands on the safe action (design 1c).
  const confirmContent = (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-lumen-text">
        {pending
          ? labels.confirmMessage.replace("{name}", pending.item.label)
          : ""}
      </p>
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lumen-md",
          "bg-lumen-chip-progress-bg p-3",
        )}
      >
        <AlertTriangle
          size={16}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-lumen-warning"
        />
        <span className="text-sm leading-relaxed text-lumen-text-secondary">
          {labels.cascadeWarning}
        </span>
      </div>
      {wide ? (
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={closeConfirm}>
            {labels.cancel}
          </Button>
          <Button variant="danger" size="sm" onClick={confirmDelete}>
            {labels.deletePermanently}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" size="lg" onClick={confirmDelete}>
            {labels.deletePermanently}
          </Button>
          <Button variant="secondary" size="lg" onClick={closeConfirm}>
            {labels.cancel}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-xl font-semibold text-lumen-text">
            {labels.title}
          </h1>
          <p className="text-sm leading-relaxed text-lumen-text-secondary">
            {labels.description}
          </p>
        </div>
        {totalCount > 0 ? (
          <span
            className={cn(
              "mt-1 shrink-0 whitespace-nowrap text-sm tabular-nums",
              "text-lumen-text-secondary",
            )}
          >
            {labels.totalCount.replace("{count}", String(totalCount))}
          </span>
        ) : null}
      </header>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Trash2
            size={44}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-lumen-text-tertiary"
          />
          <p className="text-base font-semibold text-lumen-text">
            {labels.empty}
          </p>
          <p className="max-w-xs text-sm text-lumen-text-secondary">
            {labels.emptyDescription}
          </p>
        </div>
      ) : (
        visibleGroups.map((group) => (
          <section
            key={group.category}
            aria-label={group.title}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 px-0.5">
              <h2
                className={cn(
                  "text-xs font-semibold tracking-wide",
                  "text-lumen-text-secondary",
                )}
              >
                {group.title}
              </h2>
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center",
                  "rounded-lumen-full bg-lumen-bg-secondary px-1.5 py-px",
                  "text-xs font-semibold tabular-nums",
                  "text-lumen-text-secondary",
                )}
              >
                {group.items.length}
              </span>
            </div>
            <ul
              className={cn(
                "divide-y divide-lumen-border overflow-hidden",
                "rounded-lumen-lg border border-lumen-border bg-lumen-bg",
                "shadow-lumen-sm",
              )}
            >
              {group.items.map((item) => {
                const rowBusy =
                  busy !== null &&
                  busy.category === group.category &&
                  busy.id === item.id
                    ? busy
                    : null;
                return (
                  <li
                    key={item.id}
                    aria-busy={rowBusy ? true : undefined}
                    className={cn(
                      "flex items-center",
                      wide ? "gap-3 py-2 pl-4 pr-3" : "gap-2 py-1.5 pl-3.5 pr-1.5",
                      rowBusy && "bg-lumen-bg-subsidebar",
                      anyBusy && !rowBusy && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        rowBusy
                          ? "text-lumen-text-tertiary"
                          : "text-lumen-text",
                      )}
                    >
                      {item.label}
                    </span>
                    {rowBusy ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lumen-sm",
                          "bg-lumen-bg-secondary px-2.5 text-xs font-medium",
                          "text-lumen-text-secondary",
                          wide ? "h-7" : "h-9",
                        )}
                      >
                        <RowSpinner />
                        {rowBusy.action === "restore"
                          ? labels.restoring
                          : labels.deleting}
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size={wide ? "sm" : "md"}
                        disabled={anyBusy}
                        leadingIcon={<RotateCcw size={14} aria-hidden="true" />}
                        onClick={() => onRestore(group.category, item.id)}
                      >
                        {labels.restore}
                      </Button>
                    )}
                    <IconButton
                      icon={<Trash2 size={wide ? 16 : 18} />}
                      label={labels.deletePermanently}
                      variant="danger"
                      size={wide ? "md" : "lg"}
                      disabled={anyBusy}
                      onClick={() =>
                        setPending({ category: group.category, item })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {wide ? (
        <Modal
          open={pending !== null}
          onClose={closeConfirm}
          title={labels.deletePermanently}
        >
          {confirmContent}
        </Modal>
      ) : (
        <BottomSheet
          open={pending !== null}
          onClose={closeConfirm}
          title={labels.deletePermanently}
        >
          {confirmContent}
        </BottomSheet>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Trash2, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { WIDE_QUERY } from "../constants/breakpoints";
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
 * Layout Standard v2: the shell's standard SectionHeader owns the section
 * title, so this view renders no in-body heading — content starts at the
 * category groups (per-group counts stay as badges).
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
  "todos" | "notes" | "dailies" | "routines" | "events";

export interface TrashItem {
  id: string;
  /** Already-resolved display label (host falls back to "Untitled"). */
  label: string;
}

export interface TrashGroup {
  category: TrashCategory;
  /** Already-translated section heading (e.g. "Todos"). */
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

/** One row, addressed the way the host's restore / delete switches want it. */
export interface TrashRef {
  category: TrashCategory;
  id: string;
}

/*
 * A row's identity ACROSS categories (#1294).
 *
 * `id` is unique repo-wide (CLAUDE.md §4: "id は role を跨いで一意"), but the
 * selection is keyed by category too — the set is read back per group while
 * rendering, and pairing the two makes that lookup say what it means instead
 * of relying on an invariant declared three files away.
 */
const refKey = (category: TrashCategory, id: string) => `${category}:${id}`;

export interface TrashViewLabels {
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
  /** Name for the confirm sheet's close button on narrow (#525). */
  close: string;

  /* ── Multi-select (#1294) ─────────────────────────────────────────── */
  /** Row checkbox accessible name. `{name}` → the item label. */
  selectItem: string;
  /** Group-heading checkbox accessible name. `{name}` → the group title. */
  selectGroup: string;
  /** Toolbar count. `{count}` → how many rows are selected. */
  selectedCount: string;
  /** Clears the selection without acting on it. */
  clearSelection: string;
  /** Restores every selected row. */
  restoreSelected: string;
  /** Permanently deletes every selected row. */
  deleteSelected: string;
  /** Empties the whole trash — the one button that needs no selection. */
  emptyTrash: string;
  /** Confirm body for a selection. `{count}` → how many rows. */
  confirmSelectionMessage: string;
  /** Confirm body for emptying the trash. `{count}` → everything in it. */
  confirmEmptyMessage: string;
  /** Toolbar spinner label while a bulk restore runs. */
  restoringMany: string;
  /** Toolbar spinner label while a bulk delete runs. */
  deletingMany: string;
}

export interface TrashViewProps {
  groups: TrashGroup[];
  onRestore: (category: TrashCategory, id: string) => void;
  onPermanentDelete: (category: TrashCategory, id: string) => void;
  /** Restores every row in one press (#1294). Host walks the categories. */
  onRestoreMany: (refs: TrashRef[]) => void;
  /** Permanently deletes every row in one press (#1294). Confirmed first. */
  onPermanentDeleteMany: (refs: TrashRef[]) => void;
  labels: TrashViewLabels;
  /** The in-flight action, if any. Disables every action while set. */
  busy?: TrashBusy | null;
  /**
   * A bulk run in flight (#1294). Nothing is per-row about it, so it disables
   * the whole view and spins in the toolbar instead of on a line.
   */
  bulkBusy?: TrashBusyAction | null;
  /** Wide↔narrow switch — mirrors AppShell's default breakpoint. */
  wideQuery?: string;
}

/*
 * What the confirm dialog is currently asking about.
 *
 * One shape, three questions: a single row still names the item, a selection
 * and an empty-the-trash name a count. They share the dialog because they
 * share the consequence — nothing here can be undone — and differ only in the
 * sentence above the buttons.
 */
type PendingDelete =
  | { kind: "one"; category: TrashCategory; item: TrashItem }
  | { kind: "selection"; refs: TrashRef[] }
  | { kind: "all"; refs: TrashRef[] };

/*
 * The selection checkbox (#1294).
 *
 * A real <input type="checkbox"> inside a <label>, not a styled button: the
 * row already carries two buttons, and a third one that toggles state would be
 * announced the same way they are. The label is what gives it the 44px touch
 * target on narrow (mobile-scope) without inflating the row's own height.
 */
function SelectBox({
  checked,
  onChange,
  label,
  disabled,
  wide,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled: boolean;
  wide: boolean;
}) {
  return (
    <label
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center",
        disabled && "cursor-not-allowed opacity-60",
        wide ? "h-6 w-6" : "min-h-11 min-w-11",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className={cn(
          "h-4 w-4 cursor-pointer rounded-lumen-sm border border-lumen-border-strong",
          "accent-lumen-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          disabled && "cursor-not-allowed",
        )}
      />
    </label>
  );
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
  onRestoreMany,
  onPermanentDeleteMany,
  labels,
  busy = null,
  bulkBusy = null,
  wideQuery = WIDE_QUERY,
}: TrashViewProps) {
  const wide = useMediaQuery(wideQuery, true);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  /** Selected rows, keyed `category:id` (#1294). */
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const visibleGroups = groups.filter((group) => group.items.length > 0);
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  const anyBusy = busy !== null || bulkBusy !== null;

  /*
   * Every row still in the trash, flattened.
   *
   * The selection is also filtered THROUGH this list rather than read out of
   * the set directly: a restore or a cascading delete removes rows while their
   * keys are still selected, and acting on a key whose row is gone would ask
   * the host to delete something that no longer exists.
   */
  const allRefs = useMemo<TrashRef[]>(
    () =>
      groups.flatMap((g) =>
        g.items.map((item) => ({ category: g.category, id: item.id })),
      ),
    [groups],
  );
  const selectedRefs = useMemo(
    () => allRefs.filter((r) => selected.has(refKey(r.category, r.id))),
    [allRefs, selected],
  );

  const toggleOne = (category: TrashCategory, id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const key = refKey(category, id);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  /** Group header checkbox: all-on unless the group is already all-on. */
  const toggleGroup = (group: TrashGroup, allSelected: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of group.items) {
        const key = refKey(group.category, item.id);
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const closeConfirm = () => setPending(null);
  const confirmDelete = () => {
    if (!pending) return;
    if (pending.kind === "one") {
      onPermanentDelete(pending.category, pending.item.id);
    } else {
      onPermanentDeleteMany(pending.refs);
      // The rows are on their way out, so nothing they were selected FOR is
      // left; keeping the keys would carry a stale selection into the reload.
      clearSelection();
    }
    setPending(null);
  };

  const restoreSelected = () => {
    onRestoreMany(selectedRefs);
    clearSelection();
  };

  // Shared confirm body — the outer chrome differs (Modal vs BottomSheet)
  // but the message, cascade note and button pair stay identical. DOM
  // order on wide puts Cancel first so the Modal's first-focusable focus
  // lands on the safe action (design 1c).
  const confirmMessage = (() => {
    if (!pending) return "";
    if (pending.kind === "one")
      return labels.confirmMessage.replace("{name}", pending.item.label);
    const template =
      pending.kind === "all"
        ? labels.confirmEmptyMessage
        : labels.confirmSelectionMessage;
    return template.replace("{count}", String(pending.refs.length));
  })();

  const confirmContent = (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-lumen-text">
        {confirmMessage}
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

  /*
   * The action bar (#1294).
   *
   * One bar, two faces. With nothing selected it holds only "empty the trash"
   * — the one press that needs no selection, kept at the far right and quiet
   * (`ghost`) because it is also the most destructive thing on the screen and
   * should not read as the obvious next move. With rows selected it becomes a
   * count plus the two bulk actions, and the danger asymmetry the row actions
   * already use holds here too: restore is labelled and ordinary, delete is
   * `danger` and goes through the same confirm a single delete does.
   */
  const actionBar = totalCount > 0 && (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lumen-lg",
        "border border-lumen-border bg-lumen-bg px-3 py-2 shadow-lumen-sm",
      )}
    >
      {selectedRefs.length > 0 ? (
        <>
          <span
            role="status"
            className="text-sm font-medium tabular-nums text-lumen-text"
          >
            {labels.selectedCount.replace(
              "{count}",
              String(selectedRefs.length),
            )}
          </span>
          {bulkBusy !== null && (
            <span className="inline-flex items-center gap-1.5 text-xs text-lumen-text-secondary">
              <RowSpinner />
              {bulkBusy === "restore"
                ? labels.restoringMany
                : labels.deletingMany}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size={wide ? "sm" : "md"}
              disabled={anyBusy}
              leadingIcon={<RotateCcw size={14} aria-hidden="true" />}
              onClick={restoreSelected}
            >
              {labels.restoreSelected}
            </Button>
            <Button
              variant="danger"
              size={wide ? "sm" : "md"}
              disabled={anyBusy}
              leadingIcon={<Trash2 size={14} aria-hidden="true" />}
              onClick={() =>
                setPending({ kind: "selection", refs: selectedRefs })
              }
            >
              {labels.deleteSelected}
            </Button>
            <IconButton
              icon={<X size={wide ? 16 : 18} />}
              label={labels.clearSelection}
              variant="ghost"
              size={wide ? "md" : "lg"}
              disabled={anyBusy}
              onClick={clearSelection}
            />
          </div>
        </>
      ) : (
        <Button
          className="ml-auto"
          variant="ghost"
          size={wide ? "sm" : "md"}
          disabled={anyBusy}
          leadingIcon={<Trash2 size={14} aria-hidden="true" />}
          onClick={() => setPending({ kind: "all", refs: allRefs })}
        >
          {labels.emptyTrash}
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {actionBar}
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
        visibleGroups.map((group) => {
          const groupAllSelected = group.items.every((item) =>
            selected.has(refKey(group.category, item.id)),
          );
          return (
          <section
            key={group.category}
            aria-label={group.title}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 px-0.5">
              <SelectBox
                checked={groupAllSelected}
                onChange={() => toggleGroup(group, groupAllSelected)}
                label={labels.selectGroup.replace("{name}", group.title)}
                disabled={anyBusy}
                wide
              />
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
                      wide
                        ? "gap-3 py-2 pl-4 pr-3"
                        : "gap-2 py-1.5 pl-3.5 pr-1.5",
                      rowBusy && "bg-lumen-bg-subsidebar",
                      anyBusy && !rowBusy && "opacity-60",
                    )}
                  >
                    <SelectBox
                      checked={selected.has(refKey(group.category, item.id))}
                      onChange={() => toggleOne(group.category, item.id)}
                      label={labels.selectItem.replace("{name}", item.label)}
                      disabled={anyBusy}
                      wide={wide}
                    />
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
                        setPending({
                          kind: "one",
                          category: group.category,
                          item,
                        })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>
          );
        })
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
          closeLabel={labels.close}
        >
          {confirmContent}
        </BottomSheet>
      )}
    </div>
  );
}

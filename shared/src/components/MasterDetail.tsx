import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { BottomSheet } from "./BottomSheet";
import { cn } from "./cn";

export interface MasterDetailProps {
  /** Left/primary slot — the list (e.g. a note tree). */
  master: ReactNode;
  /** Right/secondary slot — the detail (e.g. an editor). */
  detail: ReactNode;
  /** Whether a row is selected. Drives the narrow sheet's open state and,
   *  on wide, whether `detail` or `emptyDetail` is shown. */
  detailOpen: boolean;
  /** Close the narrow detail sheet (host clears its selection). */
  onCloseDetail: () => void;
  /** Wide-layout placeholder shown in the right pane when nothing is
   *  selected. Already-translated copy injected by the host (§6.4). */
  emptyDetail?: ReactNode;
  /** Already-translated accessible title for the narrow sheet (§6.4). */
  detailTitle?: string;
  /** Already-translated aria-label for the narrow sheet's close button. */
  closeLabel?: string;
  /** min-width for the wide (2-column) layout. Default Tailwind `md`. */
  wideQuery?: string;
  className?: string;
}

/*
 * Master-Detail layout primitive (W6). One component renders the
 * "list + detail" pair responsively via useMediaQuery (which falls back
 * to wide under jsdom):
 *
 *   wide (≥ md)   — `master` and `detail` side by side; the right pane
 *                   shows `emptyDetail` until a row is selected.
 *   narrow (< md) — `master` fills the column; selecting a row slides the
 *                   `detail` up as a near-full-height BottomSheet.
 *
 * Pure presentation: DataService-free (§3.1), no useTranslation — copy
 * (emptyDetail / detailTitle / closeLabel) is injected by the host (§6.4).
 * Selection lives with the host section (NOT lifted to the shell): this
 * primitive only takes `detailOpen` + `onCloseDetail`. notion-* tokens
 * only; the sheet panel is opaque (§5, backdrop bg-black/40 is BottomSheet's
 * allowed overlay exception).
 */
export function MasterDetail({
  master,
  detail,
  detailOpen,
  onCloseDetail,
  emptyDetail,
  detailTitle,
  closeLabel,
  wideQuery = "(min-width: 768px)",
  className,
}: MasterDetailProps) {
  const isWide = useMediaQuery(wideQuery, true);

  if (isWide) {
    return (
      <div
        className={cn(
          "grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]",
          className,
        )}
      >
        <section className="min-w-0">{master}</section>
        <section className="min-w-0">
          {detailOpen ? (
            detail
          ) : (
            <div className="rounded-md border border-notion-border bg-notion-bg-secondary px-4 py-6 text-sm text-notion-text-secondary">
              {emptyDetail}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {master}
      <BottomSheet
        open={detailOpen}
        onClose={onCloseDetail}
        title={detailTitle}
        // Near-full-height detail overlay (the editor needs room), with the
        // home-indicator inset honoured so content clears the safe area.
        className="flex max-h-[92svh] min-h-[92svh] max-w-2xl flex-col overflow-hidden pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onCloseDetail}
            aria-label={closeLabel}
            className="rounded-md p-1 text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent focus-visible:ring-offset-2 focus-visible:ring-offset-notion-bg"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
      </BottomSheet>
    </div>
  );
}

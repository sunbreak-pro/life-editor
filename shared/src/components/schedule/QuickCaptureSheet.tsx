import { BottomSheet } from "../BottomSheet";
import {
  EventCreateFields,
  type EventCreateFieldsLabels,
} from "./EventCreateFields";

/*
 * QuickCaptureSheet — the Mobile quick-capture form (title + start/end time)
 * inside a BottomSheet. Since #299 it is a thin frame around the shared
 * <EventCreateFields> (the same fields back the Desktop creation overlay).
 * Pure presentation (§3.1 / §6.4): copy injected already translated, the single
 * mutation is the onAdd callback; lumen-* tokens only (§5). Enter submits (IME
 * composition respected — §frontend gotcha); a blank title is a no-op.
 *
 * `initialStart` / `initialEnd` prefill the times (#299): the FAB opens with the
 * defaults, an empty-slot tap opens with the tapped slot's time. The BottomSheet
 * unmounts its children when closed, so the form re-seeds on every open.
 */

export type QuickCaptureLabels = EventCreateFieldsLabels;

export interface QuickCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, start: string, end: string) => void;
  /** Create, then open the new item's detail editor (#354). */
  onAddAndOpen: (title: string, start: string, end: string) => void;
  /** Prefill for the start-time field (HH:MM). Default 09:00. */
  initialStart?: string;
  /** Prefill for the end-time field (HH:MM). Default 10:00. */
  initialEnd?: string;
  labels: QuickCaptureLabels;
}

export function QuickCaptureSheet({
  open,
  onClose,
  onAdd,
  onAddAndOpen,
  initialStart,
  initialEnd,
  labels,
}: QuickCaptureSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={labels.title}>
      <EventCreateFields
        initialStart={initialStart}
        initialEnd={initialEnd}
        onSubmit={(title, start, end) => {
          onAdd(title, start, end);
          onClose();
        }}
        onSubmitAndOpen={(title, start, end) => {
          onAddAndOpen(title, start, end);
          onClose();
        }}
        labels={labels}
      />
    </BottomSheet>
  );
}

import { BottomSheet } from "../BottomSheet";
import {
  ItemCreatePanel,
  type ItemCreatePanelProps,
  type ItemCreatePanelLabels,
} from "./ItemCreatePanel";

/*
 * QuickCaptureSheet — the Mobile quick-capture form inside a BottomSheet. Since
 * #299 it is a thin frame around the shared creation fields; since #376 those
 * fields are the unified <ItemCreatePanel> (event / todo tabs), so the Mobile
 * FAB reaches everything the Desktop overlay does.
 *
 * The frame owns nothing but the sheet: every prop below is forwarded verbatim
 * (pure presentation — §3.1 / §6.4, lumen-* tokens only — §5). Closing is the
 * host's job: its submit handlers clear the open-panel state, which flips
 * `open` here, so the sheet does not double-close.
 *
 * `initialStart` / `initialEnd` prefill the times (#299): the FAB opens with the
 * defaults, an empty-slot tap opens with the tapped slot's time. The BottomSheet
 * unmounts its children when closed, so the form re-seeds on every open.
 */

export type QuickCaptureLabels = ItemCreatePanelLabels;

export interface QuickCaptureSheetProps extends ItemCreatePanelProps {
  open: boolean;
  onClose: () => void;
  /**
   * Already-translated BottomSheet header. Separate from `labels.title` (the
   * title input's aria-label) since #376: the sheet now holds more than one
   * kind of item, so its heading names the panel, not the event.
   */
  sheetTitle: string;
  /** Already-translated name for the sheet's close button (§6.4, #525). */
  closeLabel: string;
}

export function QuickCaptureSheet({
  open,
  onClose,
  sheetTitle,
  closeLabel,
  ...panel
}: QuickCaptureSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      closeLabel={closeLabel}
    >
      <ItemCreatePanel {...panel} />
    </BottomSheet>
  );
}

import type { ReactNode } from "react";
import { BottomSheet } from "../../BottomSheet";

interface GraphSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  /** already-translated sheet title (§6.4) */
  title: string;
  /**
   * The graph-settings body — the SAME <GraphControlPanel> node the Desktop
   * rightSidebar renders, passed in by ConnectGraphView so search / type / tag
   * / display / force controls are wired once (no Mobile re-implementation).
   */
  children: ReactNode;
}

/*
 * Mobile graph-settings MODAL bottom sheet. Thin wrapper over the shared
 * <BottomSheet> (portal to <body>, backdrop scrim, grab handle, Escape close —
 * §5 allows the backdrop's translucency). Caps height and scrolls the body so
 * the full control stack (search → node types → tags → display → forces) stays
 * reachable on short viewports.
 */
export function GraphSettingsSheet({
  open,
  onClose,
  title,
  children,
}: GraphSettingsSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="max-h-[68vh] overflow-y-auto">{children}</div>
    </BottomSheet>
  );
}

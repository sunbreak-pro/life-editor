import { useRef, type ReactNode } from "react";
import { useClickOutside } from "../../../../hooks/useClickOutside";

interface BasePreviewPopupProps {
  position: { x: number; y: number };
  barColor?: string;
  onClose: () => void;
  disableClickOutside?: boolean;
  /** extra bottom clearance for position clamping (default 280) */
  bottomClearance?: number;
  footer: ReactNode;
  children: ReactNode;
}

export function BasePreviewPopup({
  position,
  barColor,
  onClose,
  disableClickOutside,
  bottomClearance = 280,
  footer,
  children,
}: BasePreviewPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, !disableClickOutside);

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - bottomClearance - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
      style={{ left, top }}
    >
      <div className="p-3 space-y-2">
        {barColor && (
          <div
            className="w-full h-1 rounded-full"
            style={{ backgroundColor: barColor }}
          />
        )}
        {children}
      </div>
      <div className="border-t border-notion-border flex">{footer}</div>
    </div>
  );
}

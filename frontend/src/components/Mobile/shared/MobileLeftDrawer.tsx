import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface MobileLeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  widthPct?: number;
}

const SWIPE_CLOSE_THRESHOLD_PX = 60;

export const MobileLeftDrawer = forwardRef<
  HTMLDivElement,
  MobileLeftDrawerProps
>(function MobileLeftDrawer(
  { isOpen, onClose, children, widthPct = 82 },
  contentRef,
) {
  const touchRef = useRef<{
    startX: number;
    startY: number;
    locked: boolean | null;
  }>({ startX: 0, startY: 0, locked: null });
  const [dragOffset, setDragOffset] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: null,
    };
    setDragOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchRef.current.startX;
    const dy = touch.clientY - touchRef.current.startY;

    if (touchRef.current.locked === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        touchRef.current.locked = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!touchRef.current.locked) return;

    const clamped = Math.min(0, dx);
    setDragOffset(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (
      touchRef.current.locked === true &&
      dragOffset <= -SWIPE_CLOSE_THRESHOLD_PX
    ) {
      onClose();
    }
    setDragOffset(0);
    touchRef.current.locked = null;
  }, [dragOffset, onClose]);

  // Drawer is always present in DOM; visibility is controlled by translate +
  // backdrop opacity. This avoids the cascading-render lint warning that
  // came with the previous mount/unmount setTimeout pattern, and the cost is
  // marginal (a single hidden aside) since CSS handles the animation.
  const translate =
    isOpen && dragOffset === 0
      ? "translate-x-0"
      : isOpen
        ? ""
        : "-translate-x-full";

  const inlineTransform =
    isOpen && dragOffset !== 0
      ? { transform: `translateX(${dragOffset}px)` }
      : undefined;

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        tabIndex={isOpen ? 0 : -1}
        className={`absolute inset-0 bg-black transition-opacity duration-200 ${
          isOpen ? "opacity-40" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Drawer */}
      <aside
        ref={contentRef}
        className={`absolute inset-y-0 left-0 flex flex-col bg-notion-bg shadow-xl transition-transform duration-200 ease-out ${translate}`}
        style={{
          width: `${widthPct}%`,
          maxWidth: 380,
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          ...inlineTransform,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </aside>
    </div>
  );
});

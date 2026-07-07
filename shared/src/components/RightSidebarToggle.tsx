import { Menu, PanelRight } from "lucide-react";
import { cn } from "./cn";
import { useRightSidebarContext } from "../hooks/useRightSidebarContext";

/*
 * RightSidebarToggle — opens/closes the detail panel (App Shell Turn 2).
 *
 *  variant "panel"     — Desktop: sits at the right end of the header-tab row
 *                        (PanelRight, 28×28). Open = accent text + accent-subtle
 *                        fill; closed = neutral with a hover surface.
 *  variant "hamburger" — Mobile: sits at the left end of the segment row
 *                        (Menu, 36×36, bordered) and opens the left drawer.
 *
 * aria-expanded reflects isOpen, and the aria-label flips with it (open ↔
 * close action) so the announced action always matches what a click will do.
 * Copy injected already-translated (§6.4). lumen-* tokens only (§5).
 */
export type RightSidebarToggleVariant = "panel" | "hamburger";

export interface RightSidebarToggleProps {
  /** Already-translated accessible name while closed (action: open). */
  openLabel: string;
  /** Already-translated accessible name while open (action: close). */
  closeLabel: string;
  variant?: RightSidebarToggleVariant;
  className?: string;
}

export function RightSidebarToggle({
  openLabel,
  closeLabel,
  variant = "panel",
  className,
}: RightSidebarToggleProps) {
  const { isOpen, toggle } = useRightSidebarContext();
  const label = isOpen ? closeLabel : openLabel;

  if (variant === "hamburger") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={isOpen}
        className={cn(
          "grid h-9 w-9 flex-shrink-0 place-items-center rounded-lumen-md",
          "border border-lumen-border bg-lumen-bg text-lumen-text-secondary",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          className,
        )}
      >
        <Menu size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={isOpen}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lumen-sm",
        "transition-colors focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-lumen-accent",
        isOpen
          ? "bg-lumen-accent-subtle text-lumen-accent"
          : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
        className,
      )}
    >
      <PanelRight size={18} />
    </button>
  );
}

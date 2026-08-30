import { PanelRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "./cn";
import { TAP_TARGET_TALL } from "./styleTokens";
import { useRightSidebarContext } from "../hooks/useRightSidebarContext";

/*
 * RightSidebarToggle — opens/closes the detail panel (App Shell Turn 2).
 *
 *  variant "panel"     — Desktop: sits at the right end of the header-tab row
 *                        (28×28). Open = accent text + accent-subtle fill;
 *                        closed = neutral with a hover surface. The GLYPH
 *                        flips with the state (#1284), mirroring what the left
 *                        sidebar's collapse button has always done (SidebarNav:
 *                        PanelLeftOpen while collapsed, PanelLeftClose while
 *                        expanded) — so both ends of the shell answer "what
 *                        will this click do?" the same way. Since #1284 it is
 *                        also the panel's ONLY close affordance on Desktop.
 *  variant "hamburger" — Mobile: sits at the left end of the segment row
 *                        (PanelRight, 32×32, bordered) and opens the drawer.
 *                        Static glyph on purpose — the drawer is modal and
 *                        covers this button, so there is no open state for it
 *                        to reflect (the variant name is kept to avoid churn
 *                        at the call sites).
 *                        It shares the row's height with the segmented
 *                        control, so it came down from 36 with it (#1039) and
 *                        carries the same invisible 44px hit area — the row
 *                        is what got shorter, not the target.
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
          "grid h-8 w-8 flex-shrink-0 place-items-center rounded-lumen-md",
          TAP_TARGET_TALL,
          "border border-lumen-border bg-lumen-bg text-lumen-text-secondary",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          className,
        )}
      >
        <PanelRight size={18} />
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
      {isOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
    </button>
  );
}

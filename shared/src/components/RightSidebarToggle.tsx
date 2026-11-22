import { PanelRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "./cn";
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
 *                        (PanelRight, bordered) and opens the drawer.
 *                        Static glyph on purpose — the drawer is modal and
 *                        covers this button, so there is no open state for it
 *                        to reflect (the variant name is kept to avoid churn
 *                        at the call sites).
 *                        Floored to the 44px touch target (#1512). It used to
 *                        be a 2rem box carrying TAP_TARGET_TALL, which bought
 *                        the height but not the WIDTH — inset-x-0 holds that
 *                        pseudo-element to the control's own 2rem, so a thumb
 *                        still had a 36px-wide strip to find. The box itself
 *                        is the target now, and TAP_TARGET_TALL came off
 *                        because it would be exactly the height the box
 *                        already has.
 *                        This is the branch that sets the narrow row's height
 *                        together with Undo/Redo; #1039's shorter SEGMENT
 *                        BAND is untouched and still reads as the smaller
 *                        furniture it was shrunk to be.
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
          // min-* rather than h-11/w-11: `cn` is a plain string join, so two
          // utilities for the SAME property would be resolved by Tailwind's
          // emit order and not by call order (#830). A min floor is a
          // different property, and it also lets a caller's className still
          // grow the button.
          "grid min-h-lumen-tap-touch min-w-lumen-tap-touch flex-shrink-0 place-items-center rounded-lumen-md",
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

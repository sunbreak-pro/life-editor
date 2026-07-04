import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type SidebarItemTone = "default" | "mint";

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Already-translated a11y label for the nav landmark (§6). */
  label?: string;
  children: ReactNode;
}

export interface SidebarItemProps {
  /** Already-sized leading icon. Omitted for tone="mint" (a dot is shown). */
  icon?: ReactNode;
  /** Already-translated label (§6). */
  label: string;
  active?: boolean;
  /** "mint" tints the row with the secondary accent (positive / habit rows). */
  tone?: SidebarItemTone;
  /** Optional trailing node (count badge, hint) rendered in the tertiary tone. */
  trailing?: ReactNode;
  onClick: () => void;
  className?: string;
}

/*
 * Lumen sidebar container (ClaudeDesign catalog: components/nav.html). An
 * OPAQUE grouped nav surface (bg-lumen-bg-secondary, §3.5) holding SidebarItem
 * rows. Distinct from the app-shell SidebarNav (which is the full collapsible
 * chrome rail): this is the reusable Lumen nav grouping primitive. lumen-*
 * tokens only (§3.1); the a11y label is injected (§6).
 */
export function Sidebar({ label, className, children, ...rest }: SidebarProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-col gap-0.5 rounded-lumen-lg border border-lumen-border",
        "bg-lumen-bg-secondary p-1.5",
        className,
      )}
      {...rest}
    >
      {children}
    </nav>
  );
}

/*
 * Sidebar nav row with the four Lumen states: default / hover / selected /
 * mint. Selected uses the OPAQUE accent-subtle wash + accent text + a 3px
 * cobalt indicator bar on the leading edge (§3.5 — no transparency on the
 * container). Copy is injected (§6); state + click are props (§3.1).
 */
export function SidebarItem({
  icon,
  label,
  active = false,
  tone = "default",
  trailing,
  onClick,
  className,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 w-full items-center gap-2.5 rounded-lumen-md px-2.5",
        "text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        active
          ? "bg-lumen-accent-subtle font-semibold text-lumen-accent"
          : tone === "mint"
            ? "text-lumen-chip-mint-fg hover:bg-lumen-hover"
            : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
        className,
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-lumen-full bg-lumen-accent"
        />
      ) : null}
      {tone === "mint" && !active ? (
        <span
          aria-hidden="true"
          className="ml-0.5 h-2 w-2 shrink-0 rounded-full bg-lumen-accent-secondary"
        />
      ) : icon ? (
        <span
          aria-hidden="true"
          className={cn("shrink-0", active && "text-lumen-accent")}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {trailing ? (
        <span className="ml-auto shrink-0 text-xs text-lumen-text-tertiary">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

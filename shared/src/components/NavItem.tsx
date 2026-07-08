import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Row emphasis. `default` = mainline nav rows; `muted` = the utility group
 * (Settings / Trash) which sits sunk below the mainline via a lighter text
 * token (§ target-IA: utility枠 は本流から分離して沈める).
 */
export type NavItemTone = "default" | "muted";

export interface NavItemProps {
  /** Already-sized icon node (e.g. a lucide-react icon). */
  icon: ReactNode;
  /** Already-translated label (props-injected i18n, §6.4). */
  label: string;
  active?: boolean;
  /** Icon-only mode (collapsed sidebar). Label is kept as a11y name + tooltip. */
  collapsed?: boolean;
  /** Row emphasis; `muted` sinks utility rows below the mainline. */
  tone?: NavItemTone;
  onClick: () => void;
  className?: string;
}

/*
 * Sidebar navigation row primitive (W5 app shell). Icon + label, with a
 * collapsed (icon-only) variant for the narrow sidebar. lumen-* tokens
 * only (§6.4); the active row uses the accent-subtle surface + accent
 * icon/label + a 3px left accent bar (no transparency on the container,
 * §5). Copy is injected as `label` (no useTranslation here).
 */
export function NavItem({
  icon,
  label,
  active = false,
  collapsed = false,
  tone = "default",
  onClick,
  className,
}: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-lumen-accent",
        collapsed && "justify-center px-0",
        active
          ? "bg-lumen-accent-subtle font-medium text-lumen-accent"
          : tone === "muted"
            ? "text-lumen-text-tertiary hover:bg-lumen-hover hover:text-lumen-text-secondary"
            : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
        className,
      )}
    >
      {/* 3px left accent bar marks the active row (inset 7px top/bottom,
          right-rounded only) — matches the collapsed rail too. */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute bottom-[7px] left-0 top-[7px] w-[3px] rounded-r-[2px] bg-lumen-accent"
        />
      )}
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

import type { ReactNode } from "react";
import { cn } from "./cn";
import { Button } from "./Button";

export interface EmptyStateProps {
  /** Host-injected glyph (e.g. a lucide-react icon). Sized to 28px here. */
  icon?: ReactNode;
  /** Already-translated single-line message (§6.4). */
  message: string;
  /** Optional accent call-to-action, rendered with the primary Button (sm). */
  cta?: { label: string; onClick: () => void };
  className?: string;
}

/*
 * Brief-standard empty state — a centered vertical stack of icon + one-line
 * message + optional accent CTA. Pure presentation: copy is props-injected
 * (no useTranslation, §6.4), lumen-* tokens only, opaque surface (§5). The
 * icon color is driven here (text-tertiary) so hosts pass a plain glyph.
 */
export function EmptyState({ icon, message, cta, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {icon != null && (
        <span
          aria-hidden="true"
          className="text-lumen-text-tertiary [&>svg]:h-7 [&>svg]:w-7"
        >
          {icon}
        </span>
      )}
      <p className="text-[12.5px] leading-relaxed text-lumen-text-secondary">
        {message}
      </p>
      {cta && (
        <Button variant="primary" size="sm" onClick={cta.onClick}>
          {cta.label}
        </Button>
      )}
    </div>
  );
}

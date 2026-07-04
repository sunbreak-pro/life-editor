import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Padding scale. `none` lets the caller fully control inner spacing. */
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

/*
 * Surface container. Opaque bg-lumen-bg per §5 (primary container — no
 * transparency / no backdrop-blur). lumen-* tokens only.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = "md", className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-lumen-border bg-lumen-bg",
        PADDING_CLASSES[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

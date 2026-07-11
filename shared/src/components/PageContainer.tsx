import type { ReactNode } from "react";
import { cn } from "./cn";

/** Page width variant — the single knob a host picks per section. */
export type PageContainerWidth = "reading" | "data" | "fluid" | "full";

export interface PageContainerProps {
  /**
   * Content width contract:
   *   - "reading": document-style centered column (max-w-lumen-reading, 768px)
   *     — the default for text surfaces.
   *   - "data": wide dashboard column (max-w-lumen-data, 1000px) — analytics.
   *   - "fluid": no centering/scroll wrapper; the child owns its full-bleed
   *     h-full layout + self-scroll (canvas / board / calendar surfaces).
   *   - "full": full-width column that KEEPS the gutter + self-scroll wrapper
   *     (Layout Standard v2 §5 — the standard wide document surface; unlike
   *     fluid, the child stays a normal scrolled document).
   */
  width: PageContainerWidth;
  /**
   * Optional tab band / toolbar row rendered full-width ABOVE the (possibly
   * centered) body — see the header slot note below.
   */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/*
 * Layout Standard v1 (Issue #180) standard page frame. The single owner of a
 * section's content width and page gutter — sections must not hardcode page
 * widths or horizontal padding. The header slot renders OUTSIDE the centering
 * wrapper (full-width), so every section's tab band / toolbar shares the exact
 * same left offset regardless of the body's width variant. Replaces the old
 * AppShell max-w-3xl centering wrapper and MainScreen's hand-written fluid
 * wrappers, unifying both under one contract.
 *
 * Pure presentation: DataService-free (§3.1), no i18n — copy lives in whatever
 * the host slots into `header` / `children`.
 */
export function PageContainer({
  width,
  header,
  children,
  className,
}: PageContainerProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {header && (
        <div className="shrink-0 px-lumen-gutter pt-3 md:px-lumen-gutter-wide md:pt-4">
          {header}
        </div>
      )}
      {width === "fluid" ? (
        <div className="min-h-0 flex-1">{children}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className={cn(
              "mx-auto w-full px-lumen-gutter py-4 md:px-lumen-gutter-wide md:py-6",
              width === "reading" && "max-w-lumen-reading",
              width === "data" && "max-w-lumen-data",
              // "full" sets no max-w — gutter-padded full width.
            )}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

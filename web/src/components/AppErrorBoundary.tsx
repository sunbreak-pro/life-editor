import { ErrorBoundary, useTranslation } from "@life-editor/shared";
import type { ReactNode } from "react";

export interface AppErrorBoundaryProps {
  children: ReactNode;
  /** `page` covers the whole tree; `section` wraps one section body. */
  variant?: "page" | "section";
  /** Passed through — a change clears a caught error (the section id). */
  resetKey?: string | number;
}

/*
 * Translation adapter for the shared ErrorBoundary (#1199).
 *
 * The boundary itself takes copy as props (§6.4), so somebody has to read the
 * catalog for it. Doing that here rather than in shared keeps the class free
 * of a hook it cannot call anyway — and puts both mount sites (main.tsx above
 * the app, MainScreen around the section body) on the same wording.
 *
 * It must stay INSIDE I18nProvider. A crash in the Provider itself is
 * therefore uncaught, which is the honest trade: the fallback would have no
 * catalog to render from either.
 */
export function AppErrorBoundary({
  children,
  variant = "page",
  resetKey,
}: AppErrorBoundaryProps) {
  const { t } = useTranslation();
  const isPage = variant === "page";
  return (
    <ErrorBoundary
      variant={variant}
      resetKey={resetKey}
      labels={{
        title: isPage
          ? t("errorBoundary.appTitle")
          : t("errorBoundary.sectionTitle"),
        description: isPage
          ? t("errorBoundary.appDescription")
          : t("errorBoundary.sectionDescription"),
        retry: t("errorBoundary.retry"),
        reload: t("errorBoundary.reload"),
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

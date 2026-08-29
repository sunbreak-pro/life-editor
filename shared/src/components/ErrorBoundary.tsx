import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

export interface ErrorBoundaryLabels {
  /** Headline, e.g. "Something went wrong". */
  title: string;
  /** One line telling the user what they can do about it. */
  description: string;
  /** Primary action of the section variant: re-render the subtree. */
  retry: string;
  /** Full page reload — the last resort both variants offer. */
  reload: string;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Already-translated copy (§6.4 — no useTranslation inside shared). */
  labels: ErrorBoundaryLabels;
  /**
   * `page` fills the viewport and offers a reload only; `section` sits inside
   * the shell (nav still usable) and offers retry before reload.
   */
  variant?: "page" | "section";
  /**
   * Change this to clear a caught error — the section boundary passes the
   * active section id, so navigating away from a crashed screen heals it
   * without a reload.
   */
  resetKey?: string | number;
  /** Reporting hook; defaults to console.error. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Mirror of the last `resetKey` seen, so the reset is derived, not an effect. */
  seenResetKey: string | number | undefined;
}

/*
 * The one place a render-time throw stops instead of blanking the app (#1199).
 *
 * A class is not a style choice here: React exposes componentDidCatch /
 * getDerivedStateFromError on classes only, so the hooks-first rule in
 * CLAUDE.md §6 cannot apply to this file.
 *
 * Two boundaries are mounted (web/src/components/AppErrorBoundary.tsx):
 * a `page` one above the whole tree and a `section` one around the section
 * body, so a crash inside one screen leaves the nav alive and the user can
 * simply walk to another section. Note what a boundary does NOT catch —
 * event handlers, async callbacks and anything thrown after the commit — so
 * this is a floor under rendering, not a global try/catch.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, seenResetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey === state.seenResetKey) return null;
    // A new key means the host swapped the subtree out; whatever the old one
    // threw no longer describes what is on screen.
    return { error: null, seenResetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError) this.props.onError(error, info);
    else console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { children, labels, variant = "page" } = this.props;
    const { error } = this.state;
    if (!error) return children;

    const isPage = variant === "page";
    // The message is the only part of an Error we show. A stack would say
    // nothing to this user and, on a minified bundle, nothing to anyone.
    const summary = error.message?.trim();

    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-4 text-center",
          isPage
            ? "min-h-screen bg-lumen-bg px-6 py-12"
            : "min-h-[240px] px-4 py-10",
        )}
      >
        <TriangleAlert aria-hidden className="h-8 w-8 text-lumen-danger" />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-lumen-text">
            {labels.title}
          </h2>
          <p className="max-w-md text-sm text-lumen-text-secondary">
            {labels.description}
          </p>
        </div>
        {summary ? (
          <p className="max-w-md break-words rounded-lumen-md border border-lumen-border bg-lumen-surface-sunken px-3 py-2 font-mono text-xs text-lumen-text-secondary">
            {summary}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {isPage ? null : (
            <Button variant="primary" onClick={this.handleRetry}>
              {labels.retry}
            </Button>
          )}
          <Button
            variant={isPage ? "primary" : "secondary"}
            onClick={this.handleReload}
          >
            {labels.reload}
          </Button>
        </div>
      </div>
    );
  }
}

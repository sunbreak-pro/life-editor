import { useId, useState } from "react";
import { ChevronDown, Sparkles, Terminal } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./Button";
import { Input } from "./Input";
import { toolArgNames, type McpToolCatalogEntry } from "../generated";

export interface SettingsAiIntegrationLabels {
  heading: string;
  description: string;
  activityHeading: string;
  /** Shown while the daily list is still being read. */
  activityLoading: string;
  /** Why the date below is a "last seen", not a log. */
  activityCaveat: string;
  toolsHeading: string;
  /** Already-interpolated count, e.g. "35 tools". */
  toolsCount: string;
  show: string;
  hide: string;
  argsLabel: string;
  argsNone: string;
  /** Heading of the launcher block (#1211). */
  launchHeading: string;
  /** Why the folder matters — it is what decides the MCP connection. */
  launchDescription: string;
  pathLabel: string;
  pathPlaceholder: string;
  launchButton: string;
  /** Button copy while the spawn is in flight. */
  launching: string;
  /** Confirmation after a terminal actually opened. */
  launched: string;
  /** Shown INSTEAD of the field on web / mobile, where there is no CLI. */
  desktopOnly: string;
}

/**
 * The desktop-only half of the card (#1211). Absent on web and mobile, which
 * is the whole gate: no host without the Electron bridge can pass one, so the
 * block below falls back to `labels.desktopOnly` rather than rendering a
 * button that could not work.
 */
export interface SettingsAiIntegrationLauncher {
  /**
   * Value of the folder field. Owned by the HOST, not by this component: the
   * saved folder arrives from an async bridge read, and a component holding
   * its own copy would either render empty forever or have to reconcile a
   * prop it already turned into state.
   */
  projectPath: string;
  onProjectPathChange: (value: string) => void;
  /**
   * Launch with the current `projectPath`, resolving to an ALREADY-TRANSLATED
   * error sentence or null when a terminal opened. The host translates the
   * failure code (§6.4) — this component never learns which one it was.
   */
  onLaunch: () => Promise<string | null>;
}

export interface SettingsAiIntegrationProps {
  /** The generated catalog (MCP_TOOL_CATALOG), injected so suites can shrink it. */
  tools: McpToolCatalogEntry[];
  /**
   * One already-translated sentence about the most recent AI write, or `null`
   * while the host is still reading it. The host decides between the
   * "last written on X" and "nothing yet" wordings — this stays pure (§6.4).
   */
  lastActivity: string | null;
  /** Omit on web / mobile — see SettingsAiIntegrationLauncher. */
  launcher?: SettingsAiIntegrationLauncher;
  labels: SettingsAiIntegrationLabels;
}

/*
 * AI integration card (#1210, plan 2026-08-29-ai-integration-visibility).
 *
 * The app had no trace of Claude anywhere in its UI, while an MCP server was
 * reading and writing the same database the screens do. This card is the
 * place that says so — under the $0 rule, which means it calls no API and
 * infers everything from what is already on disk:
 *
 *   what the integration IS — one paragraph, static.
 *   what it CAN DO — the tool catalog, generated from the registry at build
 *     time (shared/src/generated) rather than retyped here, so the list is the
 *     server's own and cannot quietly go stale.
 *   whether it has RUN — the last day a briefing section exists for. That is
 *     evidence, not a log: the user can type into the same section by hand, so
 *     the copy says "last seen" and the caveat says why.
 *
 * The catalog starts COLLAPSED. Thirty-odd rows of tool names is reference
 * material, and this card sits in a column someone opened to change a font
 * size; the count on the button is what most readers actually want from it.
 *
 * #1211 adds the other direction — a launch button, so the card that explains
 * the integration is also where you start it. The folder field is part of the
 * button, not a detail: `claude` finds this app's MCP server through the
 * repo's `.mcp.json`, so a launch from the wrong folder opens a Claude that
 * cannot see any of the data this card is describing.
 */
export function SettingsAiIntegration({
  tools,
  lastActivity,
  launcher,
  labels,
}: SettingsAiIntegrationProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const pathId = useId();
  const [launching, setLaunching] = useState(false);
  // null = nothing tried yet. A string = the sentence to show; `failed` says
  // which colour it gets, because "a terminal opened" and "no such folder"
  // are both statuses and only one of them is an error.
  const [status, setStatus] = useState<{
    message: string;
    failed: boolean;
  } | null>(null);

  const launch = () => {
    if (!launcher || launching) return;
    setLaunching(true);
    setStatus(null);
    launcher
      .onLaunch()
      .then((error) =>
        setStatus(
          error === null
            ? { message: labels.launched, failed: false }
            : { message: error, failed: true },
        ),
      )
      // The host is supposed to resolve either way — it owns the copy for
      // every failure (§6.4). One that rejects anyway must not throw out of a
      // click handler as an unhandled rejection, and must not leave the button
      // stuck on "Starting…" with no way to retry.
      .catch(() => setStatus(null))
      .finally(() => setLaunching(false));
  };

  return (
    <div className="flex flex-col gap-4" data-section-id="ai-integration">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
          <Sparkles size={16} className="text-lumen-text-secondary" />
          <span>{labels.heading}</span>
        </h3>
        <p className="text-sm leading-relaxed text-lumen-text-secondary">
          {labels.description}
        </p>
      </div>

      {/* Last AI activity — inferred, so it is annotated as inferred. */}
      <div className="rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-lumen-text-secondary">
          {labels.activityHeading}
        </p>
        <p className="mt-1 text-sm text-lumen-text">
          {lastActivity ?? labels.activityLoading}
        </p>
        <p className="mt-1 text-xs text-lumen-text-secondary">
          {labels.activityCaveat}
        </p>
      </div>

      {/* Launcher (#1211) — desktop only. */}
      <div className="flex flex-col gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-lumen-text">
          <Terminal
            size={14}
            aria-hidden="true"
            className="text-lumen-text-secondary"
          />
          <span>{labels.launchHeading}</span>
        </p>
        {launcher ? (
          <>
            <p className="text-xs leading-relaxed text-lumen-text-secondary">
              {labels.launchDescription}
            </p>
            <label
              htmlFor={pathId}
              className="text-xs font-medium text-lumen-text-secondary"
            >
              {labels.pathLabel}
            </label>
            {/* No <form>: Enter would submit mid-IME-composition (§Gotchas),
                and a path field has exactly one action anyway. */}
            <div className="flex flex-wrap items-end gap-2">
              <Input
                id={pathId}
                value={launcher.projectPath}
                onChange={(e) => launcher.onProjectPathChange(e.target.value)}
                placeholder={labels.pathPlaceholder}
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1"
              />
              <Button
                onClick={launch}
                disabled={launching}
                leadingIcon={<Terminal size={14} aria-hidden="true" />}
              >
                {launching ? labels.launching : labels.launchButton}
              </Button>
            </div>
            {status && (
              <p
                role="status"
                className={cn(
                  "text-xs",
                  status.failed ? "text-lumen-danger" : "text-lumen-text",
                )}
              >
                {status.message}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs leading-relaxed text-lumen-text-secondary">
            {labels.desktopOnly}
          </p>
        )}
      </div>

      {/* Tool catalog. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-lumen-text">
            {labels.toolsHeading}
            <span className="ml-2 text-xs font-normal text-lumen-text-secondary">
              {labels.toolsCount}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
              "text-lumen-text transition-colors hover:bg-lumen-hover",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            {open ? labels.hide : labels.show}
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        </div>

        {open && (
          <ul
            id={listId}
            className="flex flex-col divide-y divide-lumen-border rounded-lumen-md border border-lumen-border"
          >
            {tools.map((tool) => {
              const args = toolArgNames(tool);
              return (
                <li key={tool.name} className="flex flex-col gap-1 px-4 py-3">
                  <code className="text-xs font-semibold text-lumen-text">
                    {tool.name}
                  </code>
                  <p className="text-xs leading-relaxed text-lumen-text-secondary">
                    {tool.description}
                  </p>
                  <p className="text-xs text-lumen-text-secondary">
                    <span className="font-medium">{labels.argsLabel}</span>{" "}
                    {args.length > 0 ? args.join(" ・ ") : labels.argsNone}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

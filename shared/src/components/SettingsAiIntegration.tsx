import { useId, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "./cn";
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
 */
export function SettingsAiIntegration({
  tools,
  lastActivity,
  labels,
}: SettingsAiIntegrationProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();

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

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SettingsAiIntegration,
  MCP_TOOL_CATALOG,
  toolArgNames,
  type McpToolCatalogEntry,
} from "../src";

/*
 * AI integration card (#1210).
 *
 * The card exists to tell the user something true about a connection they
 * cannot otherwise see, so the things worth pinning are the ones that could
 * quietly become false: that the catalog it shows is the GENERATED one and not
 * a list retyped in the component, that the reference material stays folded
 * away until asked for, and that "still checking" and "nothing yet" do not
 * collapse into the same sentence — the second is a fact about the data, the
 * first is a fact about the fetch.
 */
const LABELS = {
  heading: "AI integration",
  description: "Claude Code connects straight to this database.",
  activityHeading: "Last briefing",
  activityLoading: "Checking…",
  activityCaveat: "Read from the Briefing heading in your dailies.",
  toolsHeading: "Tools Claude Code can use",
  toolsCount: "2 tools",
  show: "Show the list",
  hide: "Hide the list",
  argsLabel: "Arguments:",
  argsNone: "none",
};

const TOOLS: McpToolCatalogEntry[] = [
  {
    name: "list_todos",
    description: "List todos.",
    inputSchema: {
      type: "object",
      properties: { status: {}, parent_id: {} },
      required: ["parent_id"],
    },
  },
  {
    name: "write_briefing",
    description: "Write the morning briefing.",
    inputSchema: { type: "object" },
  },
];

const renderCard = (lastActivity: string | null = "A briefing exists.") =>
  render(
    <SettingsAiIntegration
      tools={TOOLS}
      lastActivity={lastActivity}
      labels={LABELS}
    />,
  );

describe("SettingsAiIntegration", () => {
  it("renders the injected copy and the resolved activity sentence", () => {
    renderCard();
    expect(screen.getByText(LABELS.heading)).toBeInTheDocument();
    expect(screen.getByText(LABELS.description)).toBeInTheDocument();
    expect(screen.getByText("A briefing exists.")).toBeInTheDocument();
    expect(screen.getByText(LABELS.activityCaveat)).toBeInTheDocument();
  });

  it("says it is still checking rather than 'nothing yet' while lastActivity is null", () => {
    renderCard(null);
    expect(screen.getByText(LABELS.activityLoading)).toBeInTheDocument();
  });

  it("keeps the catalog collapsed until asked", () => {
    renderCard();
    expect(screen.queryByText("list_todos")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /Show the list/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("list_todos")).toBeInTheDocument();
    expect(screen.getByText("Write the morning briefing.")).toBeInTheDocument();
  });

  it("lists a tool's arguments required-first, and says so when it has none", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Show the list/ }));
    // parent_id is required and status is not, so it leads regardless of the
    // order `properties` declares them in.
    expect(screen.getByText(/parent_id ・ status/)).toBeInTheDocument();
    expect(screen.getByText(/none/)).toBeInTheDocument();
  });

  it("folds the list away again", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Show the list/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hide the list/ }));
    expect(screen.queryByText("list_todos")).not.toBeInTheDocument();
  });
});

/*
 * The generated catalog itself. Its agreement with the MCP registry is pinned
 * on the other side of the package line (mcp-server/tests/
 * toolCatalogFreshness.test.ts, which can see `TOOLS`); what shared can check
 * is that the file it imports is a usable catalog at all — non-empty, and
 * shaped the way the card reads it.
 */
describe("MCP_TOOL_CATALOG", () => {
  it("is a non-empty list of named, described tools", () => {
    expect(MCP_TOOL_CATALOG.length).toBeGreaterThan(0);
    for (const tool of MCP_TOOL_CATALOG) {
      expect(tool.name).not.toBe("");
      expect(tool.description).not.toBe("");
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("names every argument of a real tool", () => {
    const listTodos = MCP_TOOL_CATALOG.find((t) => t.name === "list_todos");
    expect(listTodos).toBeDefined();
    expect(toolArgNames(listTodos as McpToolCatalogEntry)).toContain("status");
  });
});

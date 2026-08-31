import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  SettingsAiIntegration,
  MCP_TOOL_CATALOG,
  toolArgNames,
  type McpToolCatalogEntry,
  type SettingsAiIntegrationLauncher,
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
  launchHeading: "Start Claude Code",
  launchDescription: "The folder decides the connection.",
  pathLabel: "Project folder",
  pathPlaceholder: "Full path",
  launchButton: "Start",
  launching: "Starting…",
  launched: "A terminal opened.",
  desktopOnly: "Available in the desktop app.",
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

const renderCard = (
  lastActivity: string | null = "A briefing exists.",
  launcher?: SettingsAiIntegrationLauncher,
) =>
  render(
    <SettingsAiIntegration
      tools={TOOLS}
      lastActivity={lastActivity}
      launcher={launcher}
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
 * The launcher half (#1211).
 *
 * The card is the only place the launcher's failures are ever seen, and the
 * two ways it could mislead are both about honesty rather than wiring: telling
 * a web user to press a button that cannot work, and reporting a launch that
 * did not happen. Everything below is one of those two.
 */
describe("SettingsAiIntegration launcher (#1211)", () => {
  const launcherWith = (
    onLaunch: SettingsAiIntegrationLauncher["onLaunch"],
    projectPath = "/home/u/life-editor",
  ): SettingsAiIntegrationLauncher => ({
    projectPath,
    onProjectPathChange: vi.fn(),
    onLaunch,
  });

  it("offers no button off the desktop shell, and says why", () => {
    // No launcher prop is how web and mobile arrive here. A button rendered
    // anyway would be one whose CLI does not exist on the device.
    renderCard("A briefing exists.");
    expect(screen.getByText(LABELS.desktopOnly)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: LABELS.launchButton }),
    ).not.toBeInTheDocument();
  });

  it("shows the folder field on the desktop shell", () => {
    renderCard("A briefing exists.", launcherWith(vi.fn()));
    expect(screen.queryByText(LABELS.desktopOnly)).not.toBeInTheDocument();
    expect(screen.getByLabelText(LABELS.pathLabel)).toHaveValue(
      "/home/u/life-editor",
    );
  });

  it("hands typing straight back to the host", () => {
    // The field is controlled by the host because the saved folder arrives
    // from an async bridge read — the card must not keep a private copy.
    const onProjectPathChange = vi.fn();
    renderCard("A briefing exists.", {
      projectPath: "/a",
      onProjectPathChange,
      onLaunch: vi.fn(),
    });
    fireEvent.change(screen.getByLabelText(LABELS.pathLabel), {
      target: { value: "/b" },
    });
    expect(onProjectPathChange).toHaveBeenCalledWith("/b");
  });

  it("confirms only after the launch resolves", async () => {
    const onLaunch = vi.fn().mockResolvedValue(null);
    renderCard("A briefing exists.", launcherWith(onLaunch));

    fireEvent.click(screen.getByRole("button", { name: LABELS.launchButton }));

    expect(onLaunch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(LABELS.launched)).toBeInTheDocument(),
    );
  });

  it("shows the host's sentence when the launch failed", async () => {
    // The code -> sentence mapping is the host's (§6.4); what the card owes is
    // that a failure never reads like the success line.
    const onLaunch = vi.fn().mockResolvedValue("No folder at that path.");
    renderCard("A briefing exists.", launcherWith(onLaunch));

    fireEvent.click(screen.getByRole("button", { name: LABELS.launchButton }));

    await waitFor(() =>
      expect(screen.getByText("No folder at that path.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(LABELS.launched)).not.toBeInTheDocument();
  });

  it("frees the button again after a rejecting bridge", async () => {
    // An older desktop build rejects the invoke. Leaving the button stuck on
    // "Starting…" would strand the user with no way to retry.
    const onLaunch = vi.fn().mockRejectedValue(new Error("no handler"));
    renderCard("A briefing exists.", launcherWith(onLaunch));

    const button = screen.getByRole("button", { name: LABELS.launchButton });
    fireEvent.click(button);

    await waitFor(() => expect(button).not.toBeDisabled());
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

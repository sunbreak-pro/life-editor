import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagGroupsPanel, type TagGroupsPanelGroup } from "../src/components";

/*
 * Materials mini-plan Step 5 — Tags group management (rightSidebar, Desktop).
 * Pure presentation: the heading + "+ group" button + group cards render from
 * props, member chips expose a remove button, and the dashed "+ tag" pill
 * toggles a candidate picker whose rows fire onAddMember. Group creation is a
 * host-injected callback (the host owns the prompt). rightSidebar plumbing is
 * covered elsewhere and deliberately not re-tested here.
 */

const GROUPS: TagGroupsPanelGroup[] = [
  {
    id: "g-work",
    name: "Work",
    members: [{ tagId: "t-acct", name: "acct", color: "#2563eb" }],
    candidates: [{ tagId: "t-ui", name: "ui", color: null }],
  },
  {
    id: "g-life",
    name: "Life",
    members: [],
    candidates: [],
  },
];

const LABELS = {
  heading: "Groups (2)",
  createGroupLabel: "Group",
  addTagLabel: "Add tag",
  addTagSearchPlaceholder: "Search tags…",
  removeMemberLabel: "Remove from group",
  noCandidatesLabel: "No more tags to add",
  emptyLabel: "No groups yet",
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof TagGroupsPanel>> = {},
) {
  const props: React.ComponentProps<typeof TagGroupsPanel> = {
    groups: GROUPS,
    onCreateGroup: () => {},
    onAddMember: () => {},
    onRemoveMember: () => {},
    ...LABELS,
    ...overrides,
  };
  return render(<TagGroupsPanel {...props} />);
}

describe("TagGroupsPanel", () => {
  it("renders the heading, group names and member chips", () => {
    renderPanel();
    expect(screen.getByText("Groups (2)")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Life")).toBeInTheDocument();
    expect(screen.getByText("acct")).toBeInTheDocument();
  });

  it("fires onCreateGroup on the create button click", () => {
    const onCreateGroup = vi.fn();
    renderPanel({ onCreateGroup });
    fireEvent.click(screen.getByRole("button", { name: "Group" }));
    expect(onCreateGroup).toHaveBeenCalledTimes(1);
  });

  it("fires onRemoveMember with the group + tag ids on chip remove", () => {
    const onRemoveMember = vi.fn();
    renderPanel({ onRemoveMember });
    fireEvent.click(
      screen.getByRole("button", { name: "Remove from group: acct" }),
    );
    expect(onRemoveMember).toHaveBeenCalledWith("g-work", "t-acct");
  });

  it("opens the candidate picker and fires onAddMember on candidate click", () => {
    const onAddMember = vi.fn();
    renderPanel({ onAddMember });
    // The first "Add tag" pill belongs to the Work group.
    fireEvent.click(screen.getAllByRole("button", { name: "Add tag" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "ui" }));
    expect(onAddMember).toHaveBeenCalledWith("g-work", "t-ui");
  });

  it("shows the no-candidates line for a group with an empty pool", () => {
    renderPanel();
    // The Life group (index 1) has no candidates.
    fireEvent.click(screen.getAllByRole("button", { name: "Add tag" })[1]);
    expect(screen.getByText("No more tags to add")).toBeInTheDocument();
  });

  it("renders the empty label when there are no groups", () => {
    renderPanel({ groups: [] });
    expect(screen.getByText("No groups yet")).toBeInTheDocument();
    expect(screen.queryByText("Work")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  SettingsAiCustomization,
  type SettingsAiCustomizationProps,
} from "../src";
import type { AiMemory, AiSkill } from "../src/types/aiCustomization";

/*
 * Claude customization editor (#2119). The screen is the same on Desktop and
 * Mobile, so the suite pins what the user does on either: create, edit and
 * delete each of the three kinds, the refusals the 0037 limits imply (shown
 * before any write), and that a delete — which has no Trash to come back
 * from — asks first and does nothing on Cancel.
 */

const LABELS: SettingsAiCustomizationProps["labels"] = {
  back: "Back",
  heading: "What Claude gets",
  description: "Rules, memories and skills.",
  tabsLabel: "Kind",
  tabRules: "Rules",
  tabMemories: "Memories",
  tabSkills: "Skills",
  loading: "Loading…",
  rulesDescription: "Written out as CLAUDE.md.",
  rulesPlaceholder: "Rules",
  memoriesDescription: "One item each.",
  memoriesEmpty: "No memories yet.",
  memoryPlaceholder: "New memory",
  addMemory: "Add",
  skillsDescription: "Written out as SKILL.md.",
  skillsEmpty: "No skills yet.",
  newSkill: "New skill",
  skillSlug: "Name",
  skillSlugHint: "kebab-case",
  skillDescription: "Description",
  skillBody: "Body",
  skillBodyPlaceholder: "Markdown",
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
  cancel: "Cancel",
  edit: "Edit",
  delete: "Delete",
  counter: (n, max) => `${n}/${max}`,
  confirmDeleteMemory: "Delete this memory?",
  confirmDeleteSkill: (slug) => `Delete ${slug}?`,
  issues: {
    empty: "Required.",
    tooLong: "Too long.",
    multiline: "One line only.",
    badSlug: "Use kebab-case.",
    taken: "Name in use.",
  },
};

const memory = (id: string, body: string): AiMemory => ({
  id,
  body,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
});

const skill = (id: string, slug: string): AiSkill => ({
  id,
  slug,
  description: `about ${slug}`,
  body: `body of ${slug}`,
  createdAt: "",
  updatedAt: "",
});

function setup(overrides: Partial<SettingsAiCustomizationProps> = {}) {
  const ok = () => vi.fn(async () => null as string | null);
  const props: SettingsAiCustomizationProps = {
    data: {
      rule: { body: "be brief", createdAt: "", updatedAt: "t1" },
      memories: [memory("m1", "likes tea")],
      skills: [skill("s1", "review")],
    },
    onBack: vi.fn(),
    onSaveRule: ok(),
    onCreateMemory: ok(),
    onUpdateMemory: ok(),
    onDeleteMemory: ok(),
    onCreateSkill: ok(),
    onUpdateSkill: ok(),
    onDeleteSkill: ok(),
    labels: LABELS,
    ...overrides,
  };
  const view = render(<SettingsAiCustomization {...props} />);
  return { props, view };
}

const tab = (name: string) =>
  fireEvent.click(screen.getByRole("radio", { name }));

describe("SettingsAiCustomization", () => {
  it("shows a loading line until the data arrives, and the error when the read failed", () => {
    const { view } = setup({ data: null });
    expect(screen.getByText("Loading…")).toBeTruthy();
    view.unmount();
    setup({ data: null, loadError: "Could not read." });
    expect(screen.getByRole("alert").textContent).toBe("Could not read.");
  });

  it("goes back", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(props.onBack).toHaveBeenCalled();
  });

  describe("rules", () => {
    it("saves the edited rules and says so", async () => {
      const { props } = setup();
      const field = screen.getByRole("textbox", { name: "Rules" });
      const save = screen.getByRole("button", { name: "Save" });
      // Nothing to save until it changes.
      expect((save as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(field, { target: { value: "be brief and kind" } });
      fireEvent.click(save);
      await waitFor(() =>
        expect(props.onSaveRule).toHaveBeenCalledWith("be brief and kind"),
      );
      expect(await screen.findByText("Saved.")).toBeTruthy();
    });

    it("refuses an oversized body before writing", () => {
      const { props } = setup();
      fireEvent.change(screen.getByRole("textbox", { name: "Rules" }), {
        target: { value: "x".repeat(40_001) },
      });
      expect(screen.getByText("Too long.")).toBeTruthy();
      const save = screen.getByRole("button", { name: "Save" });
      expect((save as HTMLButtonElement).disabled).toBe(true);
      expect(props.onSaveRule).not.toHaveBeenCalled();
    });

    it("shows the host's sentence when the save is refused", async () => {
      setup({ onSaveRule: vi.fn(async () => "Could not save.") });
      fireEvent.change(screen.getByRole("textbox", { name: "Rules" }), {
        target: { value: "new" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Could not save.")).toBeTruthy();
    });
  });

  describe("memories", () => {
    it("adds, edits and deletes (after confirming) a memory", async () => {
      const { props } = setup();
      tab("Memories");
      expect(screen.getByText("likes tea")).toBeTruthy();

      fireEvent.change(screen.getByRole("textbox", { name: "New memory" }), {
        target: { value: "works mornings" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() =>
        expect(props.onCreateMemory).toHaveBeenCalledWith("works mornings"),
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Edit" }), {
        target: { value: "likes green tea" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(props.onUpdateMemory).toHaveBeenCalledWith(
          "m1",
          "likes green tea",
        ),
      );

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(await screen.findByText("Delete this memory?")).toBeTruthy();
      fireEvent.click(
        screen.getAllByRole("button", { name: "Delete" }).at(-1)!,
      );
      await waitFor(() =>
        expect(props.onDeleteMemory).toHaveBeenCalledWith("m1"),
      );
    });

    it("keeps the memory when the delete is cancelled", async () => {
      const { props } = setup();
      tab("Memories");
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        expect(screen.queryByText("Delete this memory?")).toBeNull(),
      );
      expect(props.onDeleteMemory).not.toHaveBeenCalled();
    });

    it("will not add a blank memory", () => {
      setup();
      tab("Memories");
      const add = screen.getByRole("button", { name: "Add" });
      expect((add as HTMLButtonElement).disabled).toBe(true);
    });

    it("says so when there are none", () => {
      setup({ data: { rule: null, memories: [], skills: [] } });
      tab("Memories");
      expect(screen.getByText("No memories yet.")).toBeTruthy();
    });
  });

  describe("skills", () => {
    it("creates a skill from name, description and body", async () => {
      const { props } = setup();
      tab("Skills");
      fireEvent.click(screen.getByRole("button", { name: "New skill" }));
      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "write-tests" },
      });
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "How tests are written" },
      });
      fireEvent.change(screen.getByLabelText("Body"), {
        target: { value: "# Steps" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(props.onCreateSkill).toHaveBeenCalledWith({
          slug: "write-tests",
          description: "How tests are written",
          body: "# Steps",
        }),
      );
      // Back on the list once it landed.
      expect(
        await screen.findByRole("button", { name: "New skill" }),
      ).toBeTruthy();
    });

    it("refuses a name that is not kebab-case", () => {
      const { props } = setup();
      tab("Skills");
      fireEvent.click(screen.getByRole("button", { name: "New skill" }));
      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "Write Tests" },
      });
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "d" },
      });
      expect(screen.getByText("Use kebab-case.")).toBeTruthy();
      const save = screen.getByRole("button", { name: "Save" });
      expect((save as HTMLButtonElement).disabled).toBe(true);
      expect(props.onCreateSkill).not.toHaveBeenCalled();
    });

    it("keeps the description on one line", () => {
      // A single-line <input>: a pasted line break never reaches the value,
      // so the 0037 one-line CHECK cannot be tripped from this screen.
      setup();
      tab("Skills");
      fireEvent.click(screen.getByRole("button", { name: "New skill" }));
      const field = screen.getByLabelText("Description") as HTMLInputElement;
      fireEvent.change(field, { target: { value: "two\nlines" } });
      expect(field.value).not.toContain("\n");
      expect(screen.queryByText("One line only.")).toBeNull();
    });

    it("stays in the form and shows the host's sentence when the name is taken", async () => {
      setup({ onCreateSkill: vi.fn(async () => "Name in use.") });
      tab("Skills");
      fireEvent.click(screen.getByRole("button", { name: "New skill" }));
      fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "review" },
      });
      fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "d" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Name in use.")).toBeTruthy();
      expect(screen.getByLabelText("Name")).toBeTruthy();
    });

    it("edits a skill", async () => {
      const { props } = setup();
      tab("Skills");
      fireEvent.click(screen.getByRole("button", { name: "Edit: review" }));
      expect((screen.getByLabelText("Body") as HTMLTextAreaElement).value).toBe(
        "body of review",
      );
      fireEvent.change(screen.getByLabelText("Body"), {
        target: { value: "v2" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(props.onUpdateSkill).toHaveBeenCalledWith("s1", {
          slug: "review",
          description: "about review",
          body: "v2",
        }),
      );
    });

    it("names the skill in the delete question and deletes on confirm", async () => {
      const { props } = setup();
      tab("Skills");
      fireEvent.click(screen.getByRole("button", { name: "Delete: review" }));
      expect(await screen.findByText("Delete review?")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      await waitFor(() =>
        expect(props.onDeleteSkill).toHaveBeenCalledWith("s1"),
      );
    });

    it("keeps the skill when the delete is cancelled", async () => {
      const { props } = setup();
      tab("Skills");
      fireEvent.click(screen.getByRole("button", { name: "Delete: review" }));
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        expect(screen.queryByText("Delete review?")).toBeNull(),
      );
      expect(props.onDeleteSkill).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  useWikiTagsUnifiedContext,
  WikiTagsUnifiedProvider,
  type DataService,
} from "@life-editor/shared";
import { createBumpableSync, stubDataService } from "./helpers";
import { TagPicker } from "../src/wikitag/TagPicker";
import { useHeaderTagEdit } from "../src/notes/useHeaderTagEdit";

/*
 * #2395 — a save in the header's tag panel reaches everything drawn from the
 * tag, not just the panel's own idea of it.
 *
 * The real WikiTagsUnifiedProvider is mounted, so the write travels the path a
 * real one does: panel -> drafts -> context -> DataService, and back through the
 * cache every reader shares. The list below stands in for the Notes sidebar,
 * which reads the same `allTags`. Connect mounts its own Provider and reads the
 * tag afresh on arrival, so it needs no case here.
 */

const TAG = {
  id: "tag-work",
  name: "Work",
  color: null,
  icon: null,
  isDeleted: false,
};

function Host() {
  const edit = useHeaderTagEdit({ enabled: true });
  const { allTags } = useWikiTagsUnifiedContext();
  return (
    <>
      <TagPicker itemId="note-a" onTagContextMenu={edit.onTagContextMenu} />
      <ul aria-label="sidebar">
        {allTags.map((tag) => (
          <li key={tag.id}>{tag.name}</li>
        ))}
      </ul>
      {edit.panel}
    </>
  );
}

async function renderHost() {
  const updateWikiTagUnified = vi.fn(
    async (id: string, patch: Record<string, unknown>) => ({
      ...TAG,
      id,
      ...patch,
    }),
  );
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [{ ...TAG }],
    listAllTagConnections: async () => [],
    listAllTagAssignments: async () => [
      { id: "asg-1", itemId: "note-a", tagId: TAG.id, isDeleted: false },
    ],
    updateWikiTagUnified,
  }) as DataService;
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={ds}>
        <Host />
      </WikiTagsUnifiedProvider>
    </SyncWrapper>,
  );
  await waitFor(() => {
    if (!document.querySelector('[data-tag-id="tag-work"]')) {
      throw new Error("the chip has not landed yet");
    }
  });
  return { updateWikiTagUnified };
}

describe("The header tag panel — what a save reaches (#2395)", () => {
  it("renames the chip and the sidebar's row with one write", async () => {
    const { updateWikiTagUnified } = await renderHost();
    const chip = document.querySelector<HTMLElement>(
      '[data-tag-id="tag-work"]',
    );
    if (!chip) throw new Error("no chip");

    fireEvent(chip, createEvent.contextMenu(chip));
    const panel = screen.getByRole("dialog");
    fireEvent.change(within(panel).getByRole("textbox"), {
      target: { value: "Work log" },
    });
    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: "Save" }));
    });

    expect(updateWikiTagUnified).toHaveBeenCalledExactlyOnceWith("tag-work", {
      name: "Work log",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      document.querySelector('[data-tag-id="tag-work"]')?.textContent,
    ).toContain("Work log");
    within(screen.getByRole("list", { name: "sidebar" })).getByText("Work log");
  });
});

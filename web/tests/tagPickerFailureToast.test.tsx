import { describe, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  ToastProvider,
  WikiTagsUnifiedProvider,
  type DataService,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { TagPicker } from "../src/wikitag/TagPicker";

/*
 * #1667 — a tag write that fails has to show on screen.
 *
 * The picker used to log the error and stop, so a failed click looked exactly
 * like a click that never happened. The real Provider is mounted so the throw
 * travels the same path a network failure would: DataService → hook →
 * picker's catch → toast.
 */

const { wrapper: SyncWrapper } = createBumpableSync();

const ITEM = "event-1";
const TAG = { id: "tag-work", name: "Work", color: "#1e3a8a", icon: null };

function renderPicker(fns: Record<string, unknown>) {
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [{ ...TAG }],
    listAllTagConnections: async () => [],
    ...fns,
  }) as DataService;
  render(
    <SyncWrapper>
      <ToastProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <TagPicker itemId={ITEM} />
        </WikiTagsUnifiedProvider>
      </ToastProvider>
    </SyncWrapper>,
  );
}

describe("TagPicker failure toast (#1667)", () => {
  it("shows an error when adding a tag fails", async () => {
    renderPicker({
      listAllTagAssignments: async () => [],
      assignTagToItem: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fireEvent.click(await screen.findByRole("button", { name: "Add tag" }));
    await act(async () => {
      fireEvent.click(await screen.findByText("Work"));
    });
    await screen.findByText("Couldn't add the tag.");
    spy.mockRestore();
  });

  it("shows an error when removing a tag fails", async () => {
    renderPicker({
      listAllTagAssignments: async () => [
        {
          id: "assign-work",
          itemId: ITEM,
          tagId: TAG.id,
          createdAt: "2026-09-17T00:00:00.000Z",
          updatedAt: "2026-09-17T00:00:00.000Z",
          isDisplayColor: false,
          isDeleted: false,
        },
      ],
      unassignTagFromItem: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const remove = await screen.findByRole("button", {
      name: "Remove tag Work",
    });
    await act(async () => {
      fireEvent.click(remove);
    });
    await waitFor(() => screen.getByText("Couldn't remove the tag."));
    spy.mockRestore();
  });
});

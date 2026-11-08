import { describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  ResponsiveDetailFrame,
  ToastProvider,
  WikiTagsUnifiedProvider,
  type DataService,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { TagPicker } from "../src/wikitag/TagPicker";

/*
 * #2448 — the tag picker menu did not close on a press outside it in the
 * Desktop event editor.
 *
 * The editor sits in <Modal>, whose panel stops `mousedown` from reaching the
 * backdrop's close. React dispatches portal events from the portal container
 * (document.body), so that stopPropagation also kept the native event from
 * ever reaching `document`, where the picker listened in the bubble phase. The
 * phone sheet had the same hole and fixed it in its own frame (#470). The
 * picker now listens in the capture phase, which runs before the panel's
 * handler can stop anything.
 *
 * The real frame on its Desktop branch, which is the <Modal>.
 */

const { wrapper: SyncWrapper } = createBumpableSync();

const TAG = { id: "tag-work", name: "Work", color: "#1e3a8a", icon: null };

function renderInFrame(onClose: () => void) {
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [{ ...TAG }],
    listAllTagConnections: async () => [],
    listAllTagAssignments: async () => [],
  }) as DataService;
  render(
    <SyncWrapper>
      <ToastProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <ResponsiveDetailFrame
            wide
            open
            title="event"
            closeLabel="close"
            onClose={onClose}
          >
            <p>empty space</p>
            <TagPicker itemId="event-1" itemRole="event" />
          </ResponsiveDetailFrame>
        </WikiTagsUnifiedProvider>
      </ToastProvider>
    </SyncWrapper>,
  );
}

async function openPicker() {
  const trigger = await screen.findByRole("button", { name: "Add tag" });
  await act(async () => {
    fireEvent.click(trigger);
  });
}

const menu = () => screen.queryByRole("dialog", { name: "Tag picker" });

describe("TagPicker closes on an outside press inside the Desktop frame (#2448)", () => {
  it("closes the menu and leaves the editor open", async () => {
    const onClose = vi.fn();
    renderInFrame(onClose);
    await openPicker();
    expect(menu()).not.toBeNull();

    fireEvent.mouseDown(screen.getByText("empty space"));

    await waitFor(() => expect(menu()).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open for a press inside the menu", async () => {
    renderInFrame(vi.fn());
    await openPicker();

    fireEvent.mouseDown(screen.getByPlaceholderText("Search or create a tag"));

    expect(menu()).not.toBeNull();
  });
});

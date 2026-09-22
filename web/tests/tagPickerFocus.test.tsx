import { describe, it, expect, vi } from "vitest";
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
 * #1841 — where the focus is after the tag picker has been used.
 *
 * Creating a tag by CLICKING "Create …" left `document.activeElement` on
 * <body>: the browser moves the focus onto a button it is pressing, and
 * creating clears the query, which is the condition that draws that row — so
 * the element holding the focus unmounted under it. Escape then closed
 * nothing, because the only Escape handler is the field's. Creating with Enter
 * never moved the focus and never showed the bug.
 *
 * The real Provider is mounted, the way the failure-toast suite next door does
 * it, so the create travels the path a real one would: DataService → hook →
 * picker. `@testing-library/user-event` is not a dependency here, so the
 * browser's own "focus the button you pressed" step is written out by hand,
 * guarded by whether the component let the mousedown default happen.
 */

const { wrapper: SyncWrapper } = createBumpableSync();

const ITEM = "event-1";
const TAG = { id: "tag-work", name: "Work", color: "#1e3a8a", icon: null };

function renderPicker(fns: Record<string, unknown> = {}) {
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [{ ...TAG }],
    listAllTagConnections: async () => [],
    listAllTagAssignments: async () => [],
    ...fns,
  }) as DataService;
  render(
    <SyncWrapper>
      <ToastProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <button type="button">elsewhere</button>
          <TagPicker itemId={ITEM} />
        </WikiTagsUnifiedProvider>
      </ToastProvider>
    </SyncWrapper>,
  );
}

/** What a browser does on a press: focus the target, unless it was stopped. */
function pressWithFocus(button: HTMLElement) {
  const notPrevented = fireEvent.mouseDown(button);
  if (notPrevented) button.focus();
  return notPrevented;
}

async function openPicker() {
  const trigger = await screen.findByRole("button", { name: "Add tag" });
  fireEvent.click(trigger);
  return { trigger, field: screen.getByRole("textbox") };
}

describe("TagPicker focus (#1841)", () => {
  it("keeps the focus in the field when a tag is created by click", async () => {
    renderPicker({
      createWikiTagUnified: vi.fn(async () => ({
        id: "tag-new",
        name: "newtag",
        color: null,
        icon: null,
      })),
      assignTagToItem: vi.fn(async () => ({})),
    });
    const { field } = await openPicker();
    fireEvent.change(field, { target: { value: "newtag" } });

    const create = screen.getByText(/Create/).closest("button");
    if (!create) throw new Error("no create row");
    // The press must not move the focus in the first place — the row it would
    // move it to is about to unmount.
    expect(pressWithFocus(create)).toBe(false);
    await act(async () => {
      fireEvent.click(create);
    });

    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it("keeps the focus in the field when a candidate is clicked", async () => {
    // Same shape: assigning drops the tag out of the candidate list, so the
    // row that was pressed unmounts.
    renderPicker({ assignTagToItem: vi.fn(async () => ({})) });
    const { field } = await openPicker();

    const candidate = (await screen.findByText("Work")).closest("button");
    if (!candidate) throw new Error("no candidate row");
    expect(pressWithFocus(candidate)).toBe(false);
    await act(async () => {
      fireEvent.click(candidate);
    });

    expect(document.activeElement).toBe(field);
  });

  it("hands the focus back to the trigger when Escape closes it", async () => {
    renderPicker();
    const { trigger, field } = await openPicker();

    fireEvent.keyDown(field, { key: "Escape" });

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("leaves a focus that has already landed somewhere else alone", async () => {
    // Closing by clicking outside means the user is looking at whatever they
    // clicked. Pulling the focus back to the trigger would take it from them.
    renderPicker();
    await openPicker();
    const elsewhere = screen.getByRole("button", { name: "elsewhere" });
    elsewhere.focus();

    fireEvent.mouseDown(document);

    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(document.activeElement).toBe(elsewhere);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import {
  TagHubEditBlock,
  TagHubTagRail,
  useTagEditDrafts,
  type TagHubTagSummary,
} from "../src/components";
import { TAG_HUB_LABELS, formatCount, formatUnusedTags } from "./tagHubLabels";

/*
 * #1847 — creating or renaming a tag onto a name another tag already has.
 *
 * The unique constraint answers with a 409, and nothing on screen said so: the
 * add row emptied itself exactly as on success, and the edit block fell back
 * to "Unsaved" with no reason. A duplicate is now refused before sending, a
 * failed write is reported, and in both cases the typed name stays.
 */

const tag = (id: string, name: string, count = 1): TagHubTagSummary => ({
  id,
  name,
  color: null,
  icon: null,
  count,
  isUntagged: false,
});

const WORK = tag("t-work", "Work");
const IDLE = tag("t-idle", "Idle", 0);

function renderRail(onCreateTag: (name: string) => void | Promise<unknown>) {
  render(
    <TagHubTagRail
      tags={[WORK]}
      visibleTags={[WORK]}
      unusedTags={[IDLE]}
      selectedId={null}
      onSelect={vi.fn()}
      query=""
      onQueryChange={vi.fn()}
      formatCount={formatCount}
      formatUnusedTags={formatUnusedTags}
      onCreateTag={onCreateTag}
      wide
      labels={TAG_HUB_LABELS}
    />,
  );
  const field = screen.getByRole("textbox", {
    name: TAG_HUB_LABELS.addPlaceholder,
  }) as HTMLInputElement;
  const add = (name: string) => {
    fireEvent.change(field, { target: { value: name } });
    fireEvent.click(
      screen.getByRole("button", { name: TAG_HUB_LABELS.addButton }),
    );
  };
  return { field, add };
}

beforeEach(cleanup);

describe("the rail's add row (#1847)", () => {
  it("refuses a name a tag already has, before sending, and keeps it", () => {
    const onCreateTag = vi.fn();
    const { field, add } = renderRail(onCreateTag);

    // Case and surrounding space do not make it a different tag — and the
    // unused tags, folded away, count too.
    add("  idle ");

    expect(onCreateTag).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      TAG_HUB_LABELS.duplicateName,
    );
    expect(field.value).toBe("  idle ");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the message as soon as the name is edited", () => {
    const { field, add } = renderRail(vi.fn());
    add("Work");
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.change(field, { target: { value: "Work log" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the name and says so when the create fails", async () => {
    const onCreateTag = vi.fn(() => Promise.reject(new Error("409")));
    const { field, add } = renderRail(onCreateTag);

    add("Reading");

    expect(onCreateTag).toHaveBeenCalledWith("Reading");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        TAG_HUB_LABELS.createFailed,
      ),
    );
    expect(field.value).toBe("Reading");
  });

  it("empties the field once the create lands", async () => {
    const onCreateTag = vi.fn(() => Promise.resolve({ id: "t-new" }));
    const { field, add } = renderRail(onCreateTag);

    add("Reading");

    await waitFor(() => expect(field.value).toBe(""));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("useTagEditDrafts — a save that does not land (#1847)", () => {
  const TAGS = [
    { id: "t-work", name: "Work", color: null, icon: null },
    { id: "t-idle", name: "Idle", color: null, icon: null },
  ];
  const writers = () => ({
    setTagName: vi.fn(async () => undefined),
    setTagIcon: vi.fn(async () => undefined),
    setTagColor: vi.fn(async () => undefined),
  });

  it("refuses another tag's name before writing anything", async () => {
    const w = writers();
    const { result } = renderHook(() => useTagEditDrafts(TAGS, w));

    act(() =>
      result.current.edit("t-work", { name: "IDLE", color: "#e11d48" }),
    );
    let ok = true;
    await act(async () => {
      ok = await result.current.save("t-work");
    });

    expect(ok).toBe(false);
    expect(result.current.errorFor("t-work")).toBe("duplicate");
    // Nothing half-applied: the colour waits with the name.
    expect(w.setTagName).not.toHaveBeenCalled();
    expect(w.setTagColor).not.toHaveBeenCalled();
    // The draft survives, so the user can fix the name rather than retype.
    expect(result.current.editsFor("t-work").name).toBe("IDLE");
  });

  it("reports a failed write and keeps the draft", async () => {
    const w = writers();
    w.setTagName.mockRejectedValueOnce(new Error("409"));
    const { result } = renderHook(() => useTagEditDrafts(TAGS, w));

    act(() => result.current.edit("t-work", { name: "Work log" }));
    let ok = true;
    await act(async () => {
      ok = await result.current.save("t-work");
    });

    expect(ok).toBe(false);
    expect(result.current.errorFor("t-work")).toBe("failed");
    expect(result.current.isDirty("t-work")).toBe(true);
  });

  it("forgets the error on the next edit, and saves cleanly after", async () => {
    const w = writers();
    const { result } = renderHook(() => useTagEditDrafts(TAGS, w));

    act(() => result.current.edit("t-work", { name: "Idle" }));
    await act(async () => {
      await result.current.save("t-work");
    });
    act(() => result.current.edit("t-work", { name: "Work log" }));
    expect(result.current.errorFor("t-work")).toBeNull();

    let ok = false;
    await act(async () => {
      ok = await result.current.save("t-work");
    });
    expect(ok).toBe(true);
    expect(w.setTagName).toHaveBeenCalledWith("t-work", "Work log");
  });

  it("lets a tag keep its own name in another case", async () => {
    const w = writers();
    const { result } = renderHook(() => useTagEditDrafts(TAGS, w));

    act(() => result.current.edit("t-work", { name: "work" }));
    await act(async () => {
      await result.current.save("t-work");
    });
    expect(result.current.errorFor("t-work")).toBeNull();
    expect(w.setTagName).toHaveBeenCalledWith("t-work", "work");
  });
});

describe("TagHubEditBlock — the reason under the fields (#1847)", () => {
  it("announces the error and ties it to the name field", () => {
    render(
      <TagHubEditBlock
        tag={WORK}
        edits={{ name: "Idle" }}
        dirty
        onEdit={vi.fn()}
        onDropEdit={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        error={TAG_HUB_LABELS.edit.duplicateName}
        labels={TAG_HUB_LABELS.edit}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(TAG_HUB_LABELS.edit.duplicateName);
    const name = screen.getByLabelText(TAG_HUB_LABELS.edit.nameLabel);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", alert.id);
  });

  it("draws no alert without an error", () => {
    render(
      <TagHubEditBlock
        tag={WORK}
        edits={{}}
        dirty={false}
        onEdit={vi.fn()}
        onDropEdit={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        labels={TAG_HUB_LABELS.edit}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

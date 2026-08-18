import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  EventEditorPane,
  type EventEditorItem,
  type EventEditorLabels,
} from "../src/components";

/*
 * EventEditorPane — the selected-event editor.
 *
 * Issue 017 / #279 action gating: a routine item offers Dismiss AND Delete (the
 * host routes Delete into the this/future/all scope dialog, whose "this only"
 * performs a revival-safe Dismiss); a manual item offers plain Delete only, no
 * Dismiss.
 *
 * #628 (ユーザー裁定 D-20260810-sched-1 = A): every field is a draft and the
 * save button is the ONLY commit. Blur writes nothing, the date's old unmount
 * flush is gone, and one press sends one patch carrying everything that moved
 * — a routine occurrence's scope dialog must not be asked twice for a single
 * gesture (#553).
 */

const LABELS: EventEditorLabels = {
  complete: "Mark complete",
  statusLabels: {
    notStarted: "Not started",
    inProgress: "In progress",
    done: "Done",
  },
  title: "Title",
  date: "Date",
  allDay: "All-day",
  startTime: "Start",
  endTime: "End",
  memo: "Memo",
  save: "Save",
  saved: "Saved",
  unsaved: "Unsaved",
  originRoutine: "Generated from routine",
  originEvent: "Event",
  skipThisDay: "Skip this day",
  delete: "Delete",
};

const routineItem: EventEditorItem = {
  id: "r1",
  title: "Gym",
  date: "2026-07-30",
  isAllDay: false,
  startTime: "19:00",
  endTime: "20:30",
  completed: false,
  status: "notStarted",
  memo: "",
  isRoutine: true,
};

const manualItem: EventEditorItem = {
  ...routineItem,
  id: "m1",
  title: "Dentist",
  isRoutine: false,
};

/**
 * #893 folded the pane's props into bundles (`handlers` / `options` /
 * `repeat`). The cases below still describe their setup in flat terms and are
 * unchanged from before that refactor — the folding happens here, which is
 * what keeps "same cases, same assertions, still green" a usable
 * no-behaviour-change proof.
 */
function renderPane(
  item: EventEditorItem,
  props?: {
    labels?: EventEditorLabels;
    tagSlot?: ReactNode;
    onDirtyChange?: (dirty: boolean) => void;
    canEditDate?: boolean;
    canEditAllDay?: boolean;
    /** #998: render the narrow sheet's Event -> Todo action. */
    convert?: boolean;
  },
) {
  const fns = {
    onSave: vi.fn(),
    onToggleComplete: vi.fn(),
    onDismiss: vi.fn(),
    onDelete: vi.fn(),
  };
  const onConvert = vi.fn();
  render(
    <EventEditorPane
      item={item}
      labels={props?.labels ?? LABELS}
      handlers={{ ...fns, onDirtyChange: props?.onDirtyChange }}
      options={{
        canEditDate: props?.canEditDate,
        canEditAllDay: props?.canEditAllDay,
      }}
      convert={
        props?.convert ? { label: CONVERT_LABEL, onConvert } : undefined
      }
      tagSlot={props?.tagSlot}
    />,
  );
  return { ...fns, onConvert };
}

/** #998: the narrow sheet's Event -> Todo action. */
const CONVERT_LABEL = "Convert to Todo";
const convertButton = () =>
  screen.getByRole("button", { name: CONVERT_LABEL });

const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("EventEditorPane — Issue 017 / #279 action gating", () => {
  it("shows Dismiss and Delete for a routine item (#279 scope dialog entry)", () => {
    const { onDelete } = renderPane(routineItem);
    expect(screen.getByText("Skip this day")).toBeInTheDocument();
    const del = screen.getByText("Delete");
    expect(del).toBeInTheDocument();
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith("r1");
  });

  it("shows Delete and hides Dismiss for a manual item", () => {
    renderPane(manualItem);
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.queryByText("Skip this day")).toBeNull();
  });
});

describe("EventEditorPane — Event -> Todo entry (#998)", () => {
  it("renders the action when the host supplies the bundle", () => {
    renderPane(manualItem, { convert: true });
    expect(convertButton()).toBeInTheDocument();
  });

  it("hands the id to the host on press", () => {
    const { onConvert } = renderPane(manualItem, { convert: true });
    fireEvent.click(convertButton());
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onConvert).toHaveBeenCalledWith("m1");
  });

  it("renders nothing without it — Desktop keeps its bubble", () => {
    renderPane(manualItem);
    expect(screen.queryByRole("button", { name: CONVERT_LABEL })).toBeNull();
  });

  it("stays ENABLED on a routine occurrence (D-20260810-sched-5)", () => {
    // The ruling is explicit: do not grey it out, let the press ANSWER with
    // the reason. A future "just disable it for routines" fails here.
    const { onConvert } = renderPane(routineItem, { convert: true });
    expect(convertButton()).toBeEnabled();
    fireEvent.click(convertButton());
    expect(onConvert).toHaveBeenCalledWith("r1");
  });
});

describe("EventEditorPane — save button is the only commit (#628)", () => {
  it("starts clean: the button is disabled and says so", () => {
    renderPane(manualItem);
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("writes nothing on blur — the draft just waits", () => {
    const { onSave } = renderPane(manualItem, { canEditDate: true });
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "Dentist checkup" } });
    fireEvent.blur(title);
    const memo = screen.getByLabelText("Memo");
    fireEvent.change(memo, { target: { value: "bring the card" } });
    fireEvent.blur(memo);
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, { target: { value: "2026-08-03" } });
    fireEvent.blur(date);
    const start = screen.getByLabelText("Start");
    fireEvent.change(start, { target: { value: "20:00" } });
    fireEvent.blur(start);
    // Not one write so far — that was the whole point of the change.
    expect(onSave).not.toHaveBeenCalled();
    // …and the pane says so out loud, rather than leaving "did that stick?"
    // to the user's imagination.
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });

  it("commits every changed field in ONE patch when pressed", () => {
    const { onSave } = renderPane(manualItem, {
      canEditDate: true,
      canEditAllDay: true,
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dentist checkup" },
    });
    fireEvent.change(screen.getByLabelText("Memo"), {
      target: { value: "bring the card" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-08-03" },
    });
    // Grabbed before the change: typing opens the option list, which carries
    // the same accessible name.
    const start = screen.getByLabelText("Start");
    fireEvent.change(start, { target: { value: "20:00" } });
    fireEvent.blur(start);
    fireEvent.click(saveButton());
    // ONE call: a routine occurrence's scope dialog (#279) is raised per write,
    // so a save that fanned out into four would ask four times.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("m1", {
      title: "Dentist checkup",
      memo: "bring the card",
      date: "2026-08-03",
      // The pair travels together even though only the start moved (#553): the
      // range is one value, and half of it would leave the host guessing.
      startTime: "20:00",
      endTime: "20:30",
    });
  });

  it("sends only what changed, and goes quiet once the item catches up", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <EventEditorPane
        item={manualItem}
        labels={LABELS}
        handlers={{ onSave, onToggleComplete: vi.fn() }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Memo"), {
      target: { value: "bring the card" },
    });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith("m1", { memo: "bring the card" });
    // The host's write lands and comes back as new props: the draft now agrees
    // with the item, so the button falls back to disabled.
    rerender(
      <EventEditorPane
        item={{ ...manualItem, memo: "bring the card" }}
        labels={LABELS}
        handlers={{ onSave, onToggleComplete: vi.fn() }}
      />,
    );
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("stays disabled — and silent — while nothing has changed", () => {
    const { onSave } = renderPane(manualItem);
    fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not treat a typed-then-reverted field as pending", () => {
    renderPane(manualItem);
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "Dentis" } });
    expect(saveButton()).toBeEnabled();
    fireEvent.change(title, { target: { value: "Dentist" } });
    // Back to the stored value: pressing now would write nothing, so the
    // control must not be pressable (#434 S-1).
    expect(saveButton()).toBeDisabled();
  });

  it("saves on Enter in the title (IME composition excepted)", () => {
    const { onSave } = renderPane(manualItem);
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "Dentist checkup" } });
    // A composition-confirming Enter is the IME accepting 漢字, not a command.
    fireEvent.keyDown(title, { key: "Enter", isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
    // #737: WebKit — the project's main target — reports that same confirming
    // Enter with `isComposing: false` and keyCode 229. Reading only the flag
    // let exactly the worst keypress through.
    fireEvent.keyDown(title, { key: "Enter", keyCode: 229 });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(title, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("m1", { title: "Dentist checkup" });
  });

  it("drops the pending draft on unmount instead of flushing it (#628)", () => {
    const onSave = vi.fn();
    const { unmount } = render(
      <EventEditorPane
        item={manualItem}
        labels={LABELS}
        handlers={{ onSave, onToggleComplete: vi.fn() }}
        options={{ canEditDate: true }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-08-03" },
    });
    // The date used to flush itself on unmount, because blur was the commit and
    // Esc fires none. Under "the button is the only commit" that flush would be
    // a second, invisible write path — the host guards the close instead.
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("EventEditorPane — external updates while editing (#628)", () => {
  /** A Realtime push / another device rewriting the row under the editor. */
  const rerenderWith = (
    rerender: (ui: React.ReactElement) => void,
    next: EventEditorItem,
    onSave = vi.fn(),
  ) =>
    rerender(
      <EventEditorPane
        item={next}
        labels={LABELS}
        handlers={{ onSave, onToggleComplete: vi.fn() }}
      />,
    );

  it("follows the item on fields the user has not touched", () => {
    const { rerender } = render(
      <EventEditorPane
        item={manualItem}
        labels={LABELS}
        handlers={{ onSave: vi.fn(), onToggleComplete: vi.fn() }}
      />,
    );
    rerenderWith(rerender, { ...manualItem, title: "Dentist (moved)" });
    // Seed the draft once and this shows the stale title while claiming to be
    // unsaved — and saving would push the old value back over the remote one.
    expect(screen.getByLabelText("Title")).toHaveValue("Dentist (moved)");
    expect(saveButton()).toBeDisabled();
  });

  it("keeps the user's own edit when a different field changes remotely", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <EventEditorPane
        item={manualItem}
        labels={LABELS}
        handlers={{ onSave, onToggleComplete: vi.fn() }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Memo"), {
      target: { value: "bring the card" },
    });
    rerenderWith(rerender, { ...manualItem, title: "Dentist (moved)" }, onSave);
    expect(screen.getByLabelText("Memo")).toHaveValue("bring the card");
    expect(screen.getByLabelText("Title")).toHaveValue("Dentist (moved)");
    fireEvent.click(saveButton());
    // Only the field the user actually typed in is written — the remote title
    // is not quietly reverted on its way past.
    expect(onSave).toHaveBeenCalledWith("m1", { memo: "bring the card" });
  });

  it("goes clean when the remote change matches what was typed", () => {
    const { rerender } = render(
      <EventEditorPane
        item={manualItem}
        labels={LABELS}
        handlers={{ onSave: vi.fn(), onToggleComplete: vi.fn() }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dentist checkup" },
    });
    expect(saveButton()).toBeEnabled();
    rerenderWith(rerender, { ...manualItem, title: "Dentist checkup" });
    expect(saveButton()).toBeDisabled();
  });
});

describe("EventEditorPane — dirty reporting for the close guard (#628)", () => {
  it("reports the pending draft, and takes it back when it is undone", () => {
    const onDirtyChange = vi.fn();
    renderPane(manualItem, { onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dentist checkup" },
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dentist" },
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("clears the flag on unmount so a closed editor cannot stay 'dirty'", () => {
    const onDirtyChange = vi.fn();
    const { unmount } = render(
      <EventEditorPane
        item={manualItem}
        labels={LABELS}
        handlers={{
          onSave: vi.fn(),
          onToggleComplete: vi.fn(),
          onDirtyChange,
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dentist checkup" },
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    unmount();
    // A host parking this in a ref would otherwise confirm-on-close forever,
    // for a draft that no longer exists.
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

describe("EventEditorPane — date + all-day (#469 → #628 drafts)", () => {
  it("never counts a cleared date as a change", () => {
    const { onSave } = renderPane(manualItem, { canEditDate: true });
    const date = screen.getByLabelText("Date");
    // A cleared input reports "" — never save that as a day.
    fireEvent.change(date, { target: { value: "" } });
    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("puts the stored day back when the field is left empty", () => {
    renderPane(manualItem, { canEditDate: true });
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, { target: { value: "" } });
    // Blank on screen + "Saved" beside the button is the pane showing one thing
    // and meaning another; the empty box is what has to give.
    fireEvent.blur(date);
    expect(date).toHaveValue("2026-07-30");
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("commits a date once no matter how many segment steps it took", () => {
    const { onSave } = renderPane(manualItem, { canEditDate: true });
    const date = screen.getByLabelText("Date");
    // A date input steps its value once per arrow press on a segment, each a
    // complete value; typing a year walks through 2 / 20 / 202 on the way to
    // 2026. Only the last one is the answer.
    fireEvent.change(date, { target: { value: "0002-08-03" } });
    fireEvent.change(date, { target: { value: "0020-08-03" } });
    fireEvent.change(date, { target: { value: "2026-08-03" } });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("m1", { date: "2026-08-03" });
  });

  it("renders the date read-only and hides the switch when not permitted", () => {
    renderPane(manualItem);
    expect(screen.getByLabelText("Date")).toHaveAttribute("readonly");
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("flips all-day inside the draft, hiding the times until saved", () => {
    const { onSave } = renderPane(manualItem, { canEditAllDay: true });
    const sw = screen.getByRole("switch", { name: "All-day" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    // The switch answers immediately even though nothing is written yet — the
    // draft is what the pane draws.
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByLabelText("Start")).toBeNull();
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith("m1", { isAllDay: true });
  });

  it("hands back a usable span when all-day is turned OFF", () => {
    // A row created as all-day can carry no times at all, and a blank start
    // leaves it unrenderable on the time grid — so the draft fills the span in
    // rather than saving an all-day-less row with nothing to draw.
    const { onSave } = renderPane(
      { ...manualItem, isAllDay: true, startTime: "", endTime: "" },
      { canEditAllDay: true },
    );
    fireEvent.click(screen.getByRole("switch", { name: "All-day" }));
    expect(screen.getByLabelText("Start")).toHaveValue("09:00");
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith("m1", {
      isAllDay: false,
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("keeps the other pending edits when all-day is flipped", () => {
    // The pane used to remount on the all-day flip (it was part of the key), so
    // under drafts that would have quietly eaten whatever else was typed.
    const { onSave } = renderPane(manualItem, { canEditAllDay: true });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Dentist checkup" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "All-day" }));
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith("m1", {
      title: "Dentist checkup",
      isAllDay: true,
    });
  });
});

describe("EventEditorPane — series hint (#469 小粒)", () => {
  const hint = "Title and time edits ask about the series.";

  it("shows the hint on a routine occurrence when the host supplies it", () => {
    renderPane(routineItem, { labels: { ...LABELS, seriesHint: hint } });
    expect(screen.getByText(hint)).toBeInTheDocument();
  });

  it("never shows it on a manual item, or when the label is omitted", () => {
    renderPane(manualItem, { labels: { ...LABELS, seriesHint: hint } });
    expect(screen.queryByText(hint)).toBeNull();
    renderPane(routineItem);
    expect(screen.queryByText(hint)).toBeNull();
  });
});

describe("EventEditorPane — tag slot (#468)", () => {
  const slot = <p>TAG SLOT</p>;

  it("renders the host's tag row on a manual event", () => {
    renderPane(manualItem, { tagSlot: slot });
    expect(screen.getByText("TAG SLOT")).toBeInTheDocument();
  });

  it("renders it on a routine occurrence too", () => {
    // The routine branch draws a different origin block, and the slot sits
    // right after it — a tag row that appeared only on one-off events would
    // leave repeats unfileable, which is the case the lens most needs.
    renderPane(routineItem, { tagSlot: slot });
    expect(screen.getByText("TAG SLOT")).toBeInTheDocument();
  });

  it("renders nothing extra when the host supplies no slot", () => {
    // The pane is pure presentation: the tag layer talks to a context, so a
    // host without one (or a surface that should not offer tagging) simply
    // omits the prop.
    renderPane(manualItem);
    expect(screen.queryByText("TAG SLOT")).toBeNull();
  });
});

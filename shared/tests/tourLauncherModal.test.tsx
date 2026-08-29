import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  TourLauncherModal,
  type TourLauncherLabels,
  type TourLauncherModalProps,
  type TourLauncherSection,
} from "../src/components/tour";

/*
 * The tutorial launcher's two pages (#1194).
 *
 * What is worth pinning is the FLOW and the gate, not the layout: which page
 * is showing, which press moves between them, and — the one that costs a user
 * something — that a section the tour cannot teach is visible but unpressable.
 * Hiding it would teach the wrong map of the app; making it pressable would
 * open a section and show nothing, which is indistinguishable from the tour
 * being broken.
 *
 * Copy is injected already-translated (§6.4), so the strings below stand in
 * for the catalog and the assertions read as the words the user sees.
 */

const LABELS: TourLauncherLabels = {
  title: "Welcome",
  intro: "What this app is",
  sectionsHeading: "Each section",
  next: "Choose what to learn",
  pickerTitle: "What shall I show you",
  pickerIntro: "Pick one",
  back: "Back",
  close: "Close",
  full: "Walk it all",
  fullDescription: "Every section in order",
  comingSoon: "Not ready yet",
};

const SECTIONS: readonly TourLauncherSection[] = [
  {
    id: "briefing",
    label: "Briefing",
    summary: "The day on one page",
    icon: null,
    hasSteps: true,
  },
  {
    id: "materials",
    label: "Materials",
    summary: "Notes and dailies",
    icon: null,
    hasSteps: true,
  },
  {
    id: "work",
    label: "Work",
    summary: "A focus timer",
    icon: null,
    hasSteps: false,
  },
];

function setup(overrides: Partial<TourLauncherModalProps> = {}) {
  const onClose = vi.fn();
  const onSelectSection = vi.fn();
  const onStartFull = vi.fn();
  const props: TourLauncherModalProps = {
    open: true,
    onClose,
    sections: SECTIONS,
    onSelectSection,
    onStartFull,
    labels: LABELS,
    ...overrides,
  };
  const view = render(<TourLauncherModal {...props} />);
  return { view, props, onClose, onSelectSection, onStartFull };
}

/** Overview → picker, the press every picker test starts with. */
const toPicker = () => fireEvent.click(screen.getByText(LABELS.next));

describe("the overview page", () => {
  it("says what the app is and what every section is for", () => {
    setup();

    screen.getByRole("dialog", { name: LABELS.title });
    screen.getByText(LABELS.intro);
    for (const section of SECTIONS) {
      screen.getByText(section.label);
      screen.getByText(section.summary);
    }
  });

  it("chooses nothing on its own", () => {
    const { onSelectSection, onStartFull } = setup();

    // The first page is reading material. A section named here is not a
    // button yet — that is what the second page is for.
    expect(onSelectSection).not.toHaveBeenCalled();
    expect(onStartFull).not.toHaveBeenCalled();
    expect(screen.queryByText(LABELS.full)).toBeNull();
  });

  it("shows nothing while closed", () => {
    setup({ open: false });

    expect(screen.queryByText(LABELS.title)).toBeNull();
  });
});

describe("the picker page", () => {
  it("hands back the section the user pressed", () => {
    const { onSelectSection } = setup();

    toPicker();
    screen.getByRole("dialog", { name: LABELS.pickerTitle });
    fireEvent.click(screen.getByRole("button", { name: /Materials/ }));

    expect(onSelectSection.mock.calls).toEqual([["materials"]]);
  });

  it("keeps the walk-it-all door the picker replaced", () => {
    const { onStartFull, onSelectSection } = setup();

    toPicker();
    fireEvent.click(screen.getByRole("button", { name: /Walk it all/ }));

    // #1123's "Run the tutorial again" is still reachable — it became one of
    // the choices rather than being traded for them.
    expect(onStartFull).toHaveBeenCalledTimes(1);
    expect(onSelectSection).not.toHaveBeenCalled();
  });

  it("offers a section with no steps, but will not start it", () => {
    const { onSelectSection } = setup();

    toPicker();
    const work = screen.getByRole("button", { name: /Work/ });

    // The badge is TEXT inside the button, so it is part of the accessible
    // name: "you cannot pick this" survives being read aloud, which a colour
    // or an opacity would not.
    expect(work.textContent).toContain(LABELS.comingSoon);
    expect((work as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(work);
    expect(onSelectSection).not.toHaveBeenCalled();
  });

  it("goes back to the overview without deciding anything", () => {
    const { onClose, onSelectSection } = setup();

    toPicker();
    fireEvent.click(screen.getByText(LABELS.back));

    screen.getByRole("dialog", { name: LABELS.title });
    expect(onClose).not.toHaveBeenCalled();
    expect(onSelectSection).not.toHaveBeenCalled();
  });

  it("offers a way out that is not the Back button", () => {
    const { onClose } = setup();

    toPicker();
    fireEvent.click(screen.getByText(LABELS.close));

    // Page two is where someone decides they did not want this after all;
    // making them walk back to page one to leave is a worse answer.
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("reopening", () => {
  it("comes back on the overview rather than mid-flow", () => {
    const { view, props } = setup();

    toPicker();
    screen.getByRole("dialog", { name: LABELS.pickerTitle });
    fireEvent.click(screen.getByText(LABELS.close));

    // The host takes it down and puts it back up; the component was never
    // unmounted, so `page` would otherwise still be sitting on the picker.
    view.rerender(<TourLauncherModal {...props} open={false} />);
    view.rerender(<TourLauncherModal {...props} open />);

    screen.getByRole("dialog", { name: LABELS.title });
  });

  it("rewinds after a pick too, not only after a dismissal", () => {
    const { view, props } = setup();

    toPicker();
    fireEvent.click(screen.getByRole("button", { name: /Materials/ }));
    view.rerender(<TourLauncherModal {...props} open={false} />);
    view.rerender(<TourLauncherModal {...props} open />);

    // Starting a section closes the dialog by taking the user elsewhere, so
    // that path has to rewind as well or the launcher reopens on the picker.
    screen.getByRole("dialog", { name: LABELS.title });
  });
});

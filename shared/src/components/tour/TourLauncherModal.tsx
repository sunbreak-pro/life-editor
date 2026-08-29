import { useState, type ReactNode } from "react";
import { Button } from "../Button";
import { Modal } from "../Modal";
import { cn } from "../cn";
import type { SectionId } from "../../sections";

/*
 * Tutorial launcher (#1194).
 *
 * The tour used to have exactly one door: "Run the tutorial again", which
 * always started at step one and walked every section. That is a recipe book
 * with no table of contents — fine the first time, useless when what you want
 * is the tagging bit again. This modal is the contents page.
 *
 * TWO PAGES, one flow. The first says what the app is and what each section is
 * for; the second turns that same list into choices. Splitting them is what
 * lets the first page be READ — a picker with six paragraphs in it is a wall,
 * and a picker without them assumes the reader already knows what "Materials"
 * means, which is exactly what a first-run tutorial cannot assume.
 *
 * A SECTION WITH NO STEPS IS STILL LISTED, disabled and badged. Hiding it
 * would make the menu a different shape from the app, so a reader would learn
 * the wrong map; showing it as pressable would be a dead end. `hasSteps` comes
 * from the host, which derives it from the registry (TOUR_SECTION_IDS) rather
 * than from a hand-kept list — the menu can therefore never claim a section
 * the tour cannot actually teach.
 *
 * PURE primitive (§6.4): every string arrives already translated, every glyph
 * already sized, and the section list already assembled. It calls no context
 * and no DataService — the host wires `onSelectSection` to the tour's
 * `startSection` and `onStartFull` to its `restart`.
 */

/** Which page of the launcher is showing. */
export type TourLauncherPage = "overview" | "picker";

export interface TourLauncherSection {
  readonly id: SectionId;
  /** Already-translated section name (§6.4). */
  readonly label: string;
  /** Already-translated one-liner describing what the section is for. */
  readonly summary: string;
  /** Already-sized glyph (e.g. `<Sunrise size={18} />`). */
  readonly icon: ReactNode;
  /**
   * The tour has at least one step here. False = listed but not startable:
   * picking it would open a section and show nothing.
   */
  readonly hasSteps: boolean;
}

export interface TourLauncherLabels {
  /** Heading of the overview page — `tour.launcher.title`. */
  title: string;
  /** What the app is, in a sentence or two — `tour.launcher.intro`. */
  intro: string;
  /** Heading above the section list — `tour.launcher.sectionsHeading`. */
  sectionsHeading: string;
  /** Advance to the picker — `tour.launcher.next`. */
  next: string;
  /** Heading of the picker page — `tour.launcher.pickerTitle`. */
  pickerTitle: string;
  /** How the picker works — `tour.launcher.pickerIntro`. */
  pickerIntro: string;
  /** Back to the overview — `tour.launcher.back`. */
  back: string;
  /** Dismiss the launcher — `common.close`. */
  close: string;
  /** Walk every section from step one — `tour.launcher.full`. */
  full: string;
  /** What that choice does — `tour.launcher.fullDescription`. */
  fullDescription: string;
  /** Badge on a section the tour cannot teach yet — `tour.launcher.comingSoon`. */
  comingSoon: string;
}

export interface TourLauncherModalProps {
  open: boolean;
  onClose: () => void;
  /** Every section worth describing, in the order to list them. */
  sections: readonly TourLauncherSection[];
  /** Start the tour at this section. The host closes the modal first. */
  onSelectSection: (section: SectionId) => void;
  /** Start the whole walkthrough from step one (the old `restart` door). */
  onStartFull: () => void;
  labels: TourLauncherLabels;
}

/** One section, as read-only prose on the overview page. */
function SectionRow({ section }: { section: TourLauncherSection }) {
  return (
    <div className="flex gap-3 rounded-md px-2 py-2">
      <span className="mt-0.5 shrink-0 text-lumen-text-secondary">
        {section.icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-lumen-text">{section.label}</p>
        <p className="text-sm text-lumen-text-secondary">{section.summary}</p>
      </div>
    </div>
  );
}

export function TourLauncherModal({
  open,
  onClose,
  sections,
  onSelectSection,
  onStartFull,
  labels,
}: TourLauncherModalProps) {
  const [page, setPage] = useState<TourLauncherPage>("overview");
  const overview = page === "overview";

  /*
   * The flow rewinds on the way OUT, not on the way in.
   *
   * This component is not unmounted while closed, so `page` outlives a
   * dismissal: without a rewind, a user who reached the picker, closed, and
   * came back would land mid-flow on a page whose "Back" is the only
   * explanation of where they are. Doing it here rather than in an effect
   * keyed on `open` is what keeps it out of a cascading render (and past the
   * `set-state-in-effect` lint rule) — and every way out really does pass
   * through one of these three: the Close button, `Modal`'s own Escape and
   * backdrop (both call `onClose`), and the two choices, which close the
   * dialog by starting a tour.
   */
  const close = () => {
    setPage("overview");
    onClose();
  };
  const selectSection = (section: SectionId) => {
    setPage("overview");
    onSelectSection(section);
  };
  const startFull = () => {
    setPage("overview");
    onStartFull();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={overview ? labels.title : labels.pickerTitle}
      size="full"
      // Width and padding come from `size` / `padded` — this is height and
      // layout only, which is what `className` is for (see Modal.tsx).
      className="flex h-full flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <p className="text-sm text-lumen-text-secondary">
          {overview ? labels.intro : labels.pickerIntro}
        </p>

        {overview ? (
          <div className="flex flex-col gap-1">
            <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-lumen-text-secondary">
              {labels.sectionsHeading}
            </h3>
            {sections.map((section) => (
              <SectionRow key={section.id} section={section} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                disabled={!section.hasSteps}
                onClick={() => selectSection(section.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-lumen-accent",
                  section.hasSteps
                    ? "border-lumen-border bg-lumen-bg hover:bg-lumen-hover"
                    : "cursor-not-allowed border-lumen-border bg-lumen-bg-secondary opacity-60",
                )}
              >
                <span className="mt-0.5 shrink-0 text-lumen-text-secondary">
                  {section.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-lumen-text">
                      {section.label}
                    </span>
                    {/* Text, not a colour: "you cannot pick this" has to
                        survive being read aloud, and a disabled button's
                        accessible name is the only place it can. */}
                    {section.hasSteps ? null : (
                      <span className="rounded-full bg-lumen-bg px-2 py-0.5 text-xs text-lumen-text-secondary">
                        {labels.comingSoon}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-lumen-text-secondary">
                    {section.summary}
                  </span>
                </span>
              </button>
            ))}

            {/* The old door, kept as a choice rather than replaced by the
                picker: "show me everything in order" is still the right answer
                on a first run. */}
            <button
              type="button"
              onClick={startFull}
              className={cn(
                "mt-2 flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-left",
                "border-lumen-accent bg-lumen-accent-subtle text-lumen-text",
                "transition-colors hover:bg-lumen-hover focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-lumen-accent",
              )}
            >
              <span className="text-sm font-medium">{labels.full}</span>
              <span className="text-sm text-lumen-text-secondary">
                {labels.fullDescription}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Close sits on BOTH pages: page two is where a user decides they did
          not want this after all, and "Back, then Close" is a worse answer to
          that than a way out where they stand. */}
      <div className="mt-4 flex shrink-0 items-center justify-end gap-2">
        {overview ? null : (
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() => setPage("overview")}
          >
            {labels.back}
          </Button>
        )}
        <Button variant="secondary" onClick={close}>
          {labels.close}
        </Button>
        {overview ? (
          <Button variant="primary" onClick={() => setPage("picker")}>
            {labels.next}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

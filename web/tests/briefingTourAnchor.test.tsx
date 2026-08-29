import { describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";
import {
  HeaderTabs,
  SegmentedControl,
  resolveTourAnchor,
  TOUR_ANCHORS,
  TOUR_STEPS,
} from "@life-editor/shared";
import { useShellChrome } from "../src/hooks/useShellChrome";

/*
 * The tour's Briefing step has an anchor that exists (#1201).
 *
 * The registry has always opened on Briefing, but it pointed at
 * `briefing-today` — a `data-tour-id` no component ever carried — so step one
 * spent its 2.5s deadline and was skipped on every run since #1122. Nobody
 * ever saw it, and nothing failed: a missing anchor is a HANDLED case.
 *
 * Which is why this suite exists on the web side. shared/tests/tourRegistry
 * asserts the registry names TOUR_ANCHORS.briefingMorningTab; only here can
 * anyone check that a real component wears it, and that is the half that was
 * missing. The band is rendered for real and the anchor is looked up with the
 * tour's OWN resolver, so a change to either end fails this.
 *
 * Both widths, separately: AppShell renders its header slot (HeaderTabs) only
 * when wide and the segmented control only when narrow, and one def list feeds
 * both. A tourId that reached only one of them would leave the step working on
 * a laptop and skipped on a phone.
 *
 * `useTranslation` echoes its key, the way scheduleTourTodos.test.tsx does —
 * the labels are not what is under test.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

function briefingTabDefs() {
  const { result } = renderHook(() =>
    useShellChrome({ setSection: vi.fn(), setMaterialsTab: vi.fn() }),
  );
  return result.current.briefingTabDefs;
}

/** The step the registry starts on, read as the real thing. */
const briefingStep = TOUR_STEPS[0];

describe("the Briefing tab band carries the tour's first anchor (#1201)", () => {
  it("puts the anchor on the 朝刊 tab and on nothing else", () => {
    // `resolveTourAnchor` takes the FIRST match in the document, so a second
    // carrier would not fail loudly — it would just make which element the
    // spotlight lands on depend on render order.
    const carriers = briefingTabDefs()
      .filter((d) => d.tourId)
      .map((d) => [d.id, d.tourId]);

    expect(carriers).toEqual([["morning", TOUR_ANCHORS.briefingMorningTab]]);
  });

  it("resolves from the wide header band", () => {
    render(
      <HeaderTabs
        tabs={briefingTabDefs()}
        activeTab="morning"
        onSelect={vi.fn()}
      />,
    );

    expect(resolveTourAnchor(briefingStep.anchor)).not.toBeNull();
  });

  it("resolves from the narrow segmented control", () => {
    render(
      <SegmentedControl
        options={briefingTabDefs()}
        value="morning"
        onChange={vi.fn()}
      />,
    );

    expect(resolveTourAnchor(briefingStep.anchor)).not.toBeNull();
  });

  it("resolves while 夕刊 is the active tab", () => {
    // The tab defaults to evening after 17:00 (defaultBriefingTab), and the
    // evening view has no masthead at all. Anchoring inside the page would
    // have made the step land or skip depending on the time of day; the band
    // draws both tabs whichever is selected.
    render(
      <HeaderTabs
        tabs={briefingTabDefs()}
        activeTab="evening"
        onSelect={vi.fn()}
      />,
    );

    expect(resolveTourAnchor(briefingStep.anchor)).not.toBeNull();
  });
});

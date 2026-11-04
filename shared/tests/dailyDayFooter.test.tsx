import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DailyDayFooter } from "../src/components";

/*
 * #2123 — the block under the Daily body. Pure presentation: the host
 * decides what a star press means and hands the figures in as strings, so
 * what is pinned here is the drawing and the press forwarding.
 */

const LABELS = {
  moodGroup: "気分",
  moodStars: [1, 2, 3, 4, 5].map((n) => `気分 ${n}/5`),
  figuresGroup: "この日の数字",
};

const FIGURES = [
  { id: "events", label: "予定", value: "2" },
  { id: "todos", label: "Todo", value: "1/2" },
  { id: "work", label: "作業", value: "1時間30分" },
  { id: "goals", label: "進んだ目標", value: "1" },
];

describe("DailyDayFooter", () => {
  it("presses the stored mood's star and forwards a press", () => {
    const onSelectMood = vi.fn();
    render(
      <DailyDayFooter
        mood={3}
        onSelectMood={onSelectMood}
        figures={FIGURES}
        labels={LABELS}
      />,
    );

    const group = screen.getByRole("group", { name: "気分" });
    const stars = within(group).getAllByRole("button");
    expect(stars.map((s) => s.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
      "false",
      "false",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "気分 5/5" }));
    expect(onSelectMood).toHaveBeenCalledExactlyOnceWith(5);
  });

  it("lists the four figures in the order given", () => {
    render(
      <DailyDayFooter
        mood={null}
        onSelectMood={() => {}}
        figures={FIGURES}
        labels={LABELS}
      />,
    );

    expect(screen.getAllByRole("term").map((el) => el.textContent)).toEqual([
      "予定",
      "Todo",
      "作業",
      "進んだ目標",
    ]);
    expect(
      screen.getAllByRole("definition").map((el) => el.textContent),
    ).toEqual(["2", "1/2", "1時間30分", "1"]);
  });

  it("leaves the figures out while there are none", () => {
    render(
      <DailyDayFooter
        mood={null}
        onSelectMood={() => {}}
        figures={[]}
        labels={LABELS}
      />,
    );
    expect(screen.queryAllByRole("term")).toHaveLength(0);
    // The stars are drawn regardless — a blank day can still be rated.
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  /*
   * #2593 — pointing at a star lights 1..n, the way the press would leave
   * them, and leaving the row puts the stored mood back. Only the drawing
   * moves: aria-pressed keeps naming the stored mood, and nothing is saved.
   */
  describe("hover preview (#2593)", () => {
    // jsdom ships no PointerEvent, so Testing Library falls back to a plain
    // Event and drops `pointerType` — the one field the touch case turns on.
    const hadPointerEvent = "PointerEvent" in window;
    beforeAll(() => {
      if (hadPointerEvent) return;
      class TestPointerEvent extends MouseEvent {
        pointerType: string;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerType = init.pointerType ?? "mouse";
        }
      }
      Object.defineProperty(window, "PointerEvent", {
        value: TestPointerEvent,
        configurable: true,
        writable: true,
      });
    });
    afterAll(() => {
      if (!hadPointerEvent) Reflect.deleteProperty(window, "PointerEvent");
    });

    function litStars(): boolean[] {
      const group = screen.getByRole("group", { name: "気分" });
      return within(group)
        .getAllByRole("button")
        .map((b) => b.classList.contains("text-lumen-briefing-shu"));
    }

    function filledStars(): (string | null)[] {
      const group = screen.getByRole("group", { name: "気分" });
      return within(group)
        .getAllByRole("button")
        .map((b) => b.querySelector("svg")?.getAttribute("fill") ?? null);
    }

    it("lights every star up to the hovered one and restores on leave", () => {
      const onSelectMood = vi.fn();
      render(
        <DailyDayFooter
          mood={2}
          onSelectMood={onSelectMood}
          figures={[]}
          labels={LABELS}
        />,
      );
      expect(litStars()).toEqual([true, true, false, false, false]);

      fireEvent.pointerEnter(screen.getByRole("button", { name: "気分 4/5" }));
      expect(litStars()).toEqual([true, true, true, true, false]);
      expect(filledStars()).toEqual([
        "currentColor",
        "currentColor",
        "currentColor",
        "currentColor",
        "none",
      ]);
      // The stored mood is still the pressed one, and nothing was saved.
      expect(
        screen
          .getByRole("button", { name: "気分 2/5" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(onSelectMood).not.toHaveBeenCalled();

      // Lower than the stored mood lights fewer stars, as the press would.
      fireEvent.pointerEnter(screen.getByRole("button", { name: "気分 1/5" }));
      expect(litStars()).toEqual([true, false, false, false, false]);

      fireEvent.pointerLeave(screen.getByRole("group", { name: "気分" }));
      expect(litStars()).toEqual([true, true, false, false, false]);
    });

    it("previews from an empty day and still saves on press", () => {
      const onSelectMood = vi.fn();
      render(
        <DailyDayFooter
          mood={null}
          onSelectMood={onSelectMood}
          figures={[]}
          labels={LABELS}
        />,
      );
      expect(litStars()).toEqual([false, false, false, false, false]);

      const fourth = screen.getByRole("button", { name: "気分 4/5" });
      fireEvent.pointerEnter(fourth);
      expect(litStars()).toEqual([true, true, true, true, false]);
      fireEvent.click(fourth);
      expect(onSelectMood).toHaveBeenCalledExactlyOnceWith(4);
    });

    it("ends the preview on a press, so clearing the lit star goes dark", () => {
      const onSelectMood = vi.fn();
      const { rerender } = render(
        <DailyDayFooter
          mood={3}
          onSelectMood={onSelectMood}
          figures={[]}
          labels={LABELS}
        />,
      );
      const third = screen.getByRole("button", { name: "気分 3/5" });
      fireEvent.pointerEnter(third);
      fireEvent.click(third);
      expect(onSelectMood).toHaveBeenCalledExactlyOnceWith(3);

      // The host clears the mood; the pointer has not left the row.
      rerender(
        <DailyDayFooter
          mood={null}
          onSelectMood={onSelectMood}
          figures={[]}
          labels={LABELS}
        />,
      );
      expect(litStars()).toEqual([false, false, false, false, false]);
    });

    it("ignores a touch, which has no hover to preview", () => {
      render(
        <DailyDayFooter
          mood={null}
          onSelectMood={() => {}}
          figures={[]}
          labels={LABELS}
        />,
      );
      fireEvent.pointerEnter(screen.getByRole("button", { name: "気分 3/5" }), {
        pointerType: "touch",
      });
      expect(litStars()).toEqual([false, false, false, false, false]);
    });

    // jsdom runs no transitions, so the classes that ask for one are what can
    // be pinned here.
    it("eases the colour over 150ms", () => {
      render(
        <DailyDayFooter
          mood={null}
          onSelectMood={() => {}}
          figures={[]}
          labels={LABELS}
        />,
      );
      for (const star of screen.getAllByRole("button")) {
        expect(star).toHaveClass("transition-colors", "duration-150");
      }
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DailyDayFooter, DailyMorningNote } from "../src/components";

/*
 * #2123 — the two blocks around the Daily body. Pure presentation: the host
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
});

describe("DailyMorningNote", () => {
  const labels = {
    region: "朝の記録",
    comment: "朝刊のひとこと",
    intention: "宣言",
  };

  it("prints the comment paragraphs and the 宣言 lines", () => {
    render(
      <DailyMorningNote
        comment={["一文目", "二文目"]}
        intention={"早く寝る\n\n歩く"}
        labels={labels}
      />,
    );

    const region = screen.getByRole("region", { name: "朝の記録" });
    within(region).getByText("朝刊のひとこと");
    within(region).getByText("一文目");
    within(region).getByText("二文目");
    within(region).getByText("早く寝る");
    within(region).getByText("歩く");
  });

  it("drops the half that is empty", () => {
    render(<DailyMorningNote comment={[]} intention="歩く" labels={labels} />);
    expect(screen.queryByText("朝刊のひとこと")).toBeNull();
    screen.getByText("宣言");
  });
});

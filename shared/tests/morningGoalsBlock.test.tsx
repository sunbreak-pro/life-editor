import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  MorningGoalsBlock,
  PeriodEndReviewCard,
  type MorningGoalsLabels,
  type PeriodEndReviewLabels,
} from "../src/components/briefing/MorningGoalsBlock";
import { GOAL_CHIP_UNACHIEVED } from "../src/components/briefing/GoalProgressDelta";
import type {
  MorningGoalLine,
  MorningGoals,
} from "../src/components/briefing/morningGoals";

/*
 * #2106 — the morning paper's goals block and the period-end review card
 * (design M1–M8 / P1 / P2). Pinned here: this week's rows say their state in
 * words as well as colour, an empty week asks for goals, the add field is
 * IME-safe and keeps the words when the write fails, the limit replaces the
 * field, and the review's four answers reach the host.
 */

const LABELS: MorningGoalsLabels = {
  title: "これからの目標",
  periods: {
    week: "今週 9/27 – 10/3",
    month: "今月 9月",
    year: "今年 2026年",
  },
  prompt: "今週の目標を立てましょう",
  achieved: "達成",
  unconnected: "未接続",
  linkTodos: "Todo をつなぐ",
  linkTodosFor: (title) => `Todo をつなぐ: ${title}`,
  addLabel: "目標を立てる",
  addPlaceholder: "届きたいところを書きます",
  add: "追加",
  adding: "保存中…",
  limit: "今週の目標は 3 つまでです。",
  openInConnect: "目標と Todo で開く",
};

const line = (
  id: string,
  title: string,
  progress: Partial<MorningGoalLine["progress"]> = {},
): MorningGoalLine => ({
  id,
  title,
  progress: {
    done: 0,
    total: 0,
    achieved: false,
    connected: false,
    ...progress,
  },
});

const ACHIEVED = line("w-run", "3 回走る", {
  done: 2,
  total: 2,
  achieved: true,
  connected: true,
});
const OPEN = line("w-plan", "企画書を通す", {
  done: 2,
  total: 4,
  connected: true,
});
const LOOSE = line("w-book", "本を 1 冊読み切る");

const goalsOf = (over: Partial<MorningGoals> = {}): MorningGoals => ({
  periodKeys: { week: "2026-09-27", month: "2026-09", year: "2026" },
  year: [],
  month: [],
  week: [],
  ...over,
});

function renderBlock(
  goals: MorningGoals,
  opts: {
    onCreate?: (title: string) => Promise<boolean>;
    onOpenGoals?: () => void;
  } = {},
) {
  const onLinkTodos = vi.fn();
  const onCreateWeekGoal = vi.fn(opts.onCreate ?? (async () => true));
  const result = render(
    <MorningGoalsBlock
      goals={goals}
      labels={LABELS}
      onLinkTodos={onLinkTodos}
      onCreateWeekGoal={onCreateWeekGoal}
      onOpenGoals={opts.onOpenGoals}
    />,
  );
  return { ...result, onLinkTodos, onCreateWeekGoal };
}

const field = () => screen.getByRole("textbox", { name: LABELS.addLabel });

describe("MorningGoalsBlock", () => {
  it("asks for this week's goals when there are none", () => {
    const { container } = renderBlock(goalsOf());
    expect(screen.getByText(LABELS.prompt)).toBeInTheDocument();
    expect(field()).toBeInTheDocument();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("says each state in words, with the bar on connected goals", () => {
    renderBlock(goalsOf({ week: [ACHIEVED, OPEN, LOOSE] }));

    const achievedChip = screen.getByText(LABELS.achieved);
    expect(achievedChip.className).toContain("bg-lumen-chip-mint-bg");
    const achievedBar = screen.getByRole("progressbar", { name: "3 回走る" });
    expect(achievedBar.className).toContain("bg-lumen-chip-mint-bg");
    expect(achievedBar.firstElementChild?.className).toContain(
      "bg-lumen-accent-secondary",
    );

    const openBar = screen.getByRole("progressbar", { name: "企画書を通す" });
    expect(openBar.getAttribute("aria-valuenow")).toBe("2");
    expect(openBar.getAttribute("aria-valuemax")).toBe("4");
    expect(openBar.getAttribute("aria-valuetext")).toBe("2/4");
    expect(openBar.className).toContain("bg-lumen-briefing-shu-subtle");
    expect(openBar.firstElementChild?.className).toContain(
      "bg-lumen-briefing-shu",
    );

    expect(screen.getByText(LABELS.unconnected)).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: "本を 1 冊読み切る" }),
    ).toBeNull();
  });

  // Review fix: a period-end「達成にする」fills the bar over 1/2, and the
  // bar's ARIA says the same as its fill rather than "half done".
  it("reports an achieved-by-decision bar as full to assistive tech", () => {
    renderBlock(
      goalsOf({
        week: [
          line("w-half", "半分の目標", {
            done: 1,
            total: 2,
            achieved: true,
            connected: true,
          }),
        ],
      }),
    );
    const bar = screen.getByRole("progressbar", { name: "半分の目標" });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("100%");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuetext")).toBe("達成 1/2");
  });

  it("prints a month / year line only for a period with goals", () => {
    const { rerender } = renderBlock(goalsOf({ week: [OPEN] }));
    expect(screen.queryByText(LABELS.periods.month)).toBeNull();
    expect(screen.queryByText(LABELS.periods.year)).toBeNull();

    rerender(
      <MorningGoalsBlock
        goals={goalsOf({
          week: [OPEN],
          month: [
            line("m-deal", "秋の新規案件を受注する", {
              done: 1,
              total: 2,
              connected: true,
            }),
          ],
          year: [
            line("y-run", "10 km を 60 分以内で走る", {
              achieved: true,
              connected: true,
              done: 1,
              total: 1,
            }),
          ],
        })}
        labels={LABELS}
        onLinkTodos={vi.fn()}
        onCreateWeekGoal={vi.fn()}
      />,
    );
    expect(screen.getByText(LABELS.periods.month)).toBeInTheDocument();
    expect(screen.getByText("秋の新規案件を受注する")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText(LABELS.periods.year)).toBeInTheDocument();
  });

  // Review fix: a month / year goal with nothing linked is its own kind on
  // the line too, drawn as the week rows draw it — not as tertiary「1/2」text.
  it("draws an unconnected month goal as the week rows' outline chip", () => {
    renderBlock(
      goalsOf({ week: [OPEN], month: [line("m-loose", "引っ越しを決める")] }),
    );
    const chip = screen.getByText(LABELS.unconnected);
    expect(chip.className).toContain("border-lumen-border");
    expect(chip.className).toContain("rounded-full");
  });

  // Review fix: a review answer in flight holds the add field, so the two
  // cannot both count the same free slot of the week.
  it("waits for another goal write before adding", () => {
    const onCreateWeekGoal = vi.fn(async () => true);
    render(
      <MorningGoalsBlock
        goals={goalsOf()}
        labels={LABELS}
        onLinkTodos={vi.fn()}
        onCreateWeekGoal={onCreateWeekGoal}
        writing
      />,
    );
    fireEvent.change(field(), { target: { value: "走る" } });
    expect(screen.getByRole("button", { name: LABELS.add })).toBeDisabled();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCreateWeekGoal).not.toHaveBeenCalled();
  });

  it("swaps the add field for the limit once the week is full", () => {
    renderBlock(goalsOf({ week: [ACHIEVED, OPEN, LOOSE] }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(LABELS.limit)).toBeInTheDocument();
  });

  it("opens the linking screen for the row's goal", () => {
    const { onLinkTodos } = renderBlock(goalsOf({ week: [OPEN] }));
    fireEvent.click(
      screen.getByRole("button", { name: "Todo をつなぐ: 企画書を通す" }),
    );
    expect(onLinkTodos).toHaveBeenCalledWith("w-plan");
  });

  it("does not submit while the IME is composing", () => {
    const { onCreateWeekGoal } = renderBlock(goalsOf());
    fireEvent.change(field(), { target: { value: "走る" } });
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    expect(onCreateWeekGoal).not.toHaveBeenCalled();
  });

  it("submits the trimmed title and clears the field once it exists", async () => {
    const { onCreateWeekGoal } = renderBlock(goalsOf());
    fireEvent.change(field(), { target: { value: "  走る  " } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCreateWeekGoal).toHaveBeenCalledWith("走る");
    await waitFor(() => expect((field() as HTMLInputElement).value).toBe(""));
  });

  it("keeps the words when the write fails, and never sends a blank title", async () => {
    const { onCreateWeekGoal } = renderBlock(goalsOf(), {
      onCreate: async () => false,
    });
    fireEvent.change(field(), { target: { value: "   " } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCreateWeekGoal).not.toHaveBeenCalled();

    fireEvent.change(field(), { target: { value: "走る" } });
    fireEvent.click(screen.getByRole("button", { name: LABELS.add }));
    await waitFor(() => expect(onCreateWeekGoal).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: LABELS.add })).toBeEnabled(),
    );
    expect((field() as HTMLInputElement).value).toBe("走る");
  });

  it("links to Connect only when the host can go there", () => {
    renderBlock(goalsOf());
    expect(
      screen.queryByRole("button", { name: LABELS.openInConnect }),
    ).toBeNull();
  });

  it("calls the host from the Connect link", () => {
    const onOpenGoals = vi.fn();
    renderBlock(goalsOf(), { onOpenGoals });
    fireEvent.click(screen.getByRole("button", { name: LABELS.openInConnect }));
    expect(onOpenGoals).toHaveBeenCalledTimes(1);
  });

  it("gives every control the 44px floor below md", () => {
    renderBlock(goalsOf({ week: [OPEN] }), { onOpenGoals: vi.fn() });
    for (const name of [
      "Todo をつなぐ: 企画書を通す",
      LABELS.add,
      LABELS.openInConnect,
    ]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "max-md:min-h-11",
      );
    }
    expect(
      screen.getByRole("textbox", { name: LABELS.addLabel }).className,
    ).toContain("max-md:min-h-11");
  });
});

const REVIEW_LABELS: PeriodEndReviewLabels = {
  title: "終わった期間の目標",
  remaining: "残り 2 件",
  periodLabel: "週 · 9/20 – 9/26",
  question: "この目標は、達成しないまま期間が終わりました。どうしますか。",
  progress: "未接続",
  carry: "持ち越す",
  drop: "やめる",
  achieve: "達成にする",
  later: "あとで聞く",
  carryBlocked: "今週の目標は 3 つまでです。",
  saving: "保存中…",
};

function renderCard(
  over: Partial<{
    canCarry: boolean;
    connected: boolean;
    busy: "carried" | "dropped" | "achieved" | null;
  }> = {},
) {
  const onDecide = vi.fn();
  const onLater = vi.fn();
  render(
    <PeriodEndReviewCard
      goalTitle="部屋の模様替えを決める"
      connected={over.connected ?? false}
      canCarry={over.canCarry ?? true}
      busy={over.busy ?? null}
      labels={REVIEW_LABELS}
      onDecide={onDecide}
      onLater={onLater}
    />,
  );
  return { onDecide, onLater };
}

describe("PeriodEndReviewCard", () => {
  it("sends each answer to the host", () => {
    const { onDecide, onLater } = renderCard();
    expect(screen.getByText("部屋の模様替えを決める")).toBeInTheDocument();
    expect(screen.getByText(REVIEW_LABELS.remaining)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: REVIEW_LABELS.carry }));
    fireEvent.click(screen.getByRole("button", { name: REVIEW_LABELS.drop }));
    fireEvent.click(
      screen.getByRole("button", { name: REVIEW_LABELS.achieve }),
    );
    fireEvent.click(screen.getByRole("button", { name: REVIEW_LABELS.later }));
    expect(onDecide.mock.calls.map((c) => c[0])).toEqual([
      "carried",
      "dropped",
      "achieved",
    ]);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it("says why carrying is off when the period is full", () => {
    renderCard({ canCarry: false });
    const carry = screen.getByRole("button", { name: REVIEW_LABELS.carry });
    expect(carry).toBeDisabled();
    const reason = document.getElementById(
      carry.getAttribute("aria-describedby") ?? "",
    );
    expect(reason?.textContent).toBe(REVIEW_LABELS.carryBlocked);
  });

  it("keeps「未接続」its own kind — 朱 only for a connected goal left short", () => {
    renderCard({ connected: false });
    expect(screen.getByText(REVIEW_LABELS.progress).className).not.toBe(
      GOAL_CHIP_UNACHIEVED,
    );
  });

  it("draws a connected goal's progress in the not-yet chip", () => {
    render(
      <PeriodEndReviewCard
        goalTitle="企画書を通す"
        connected
        canCarry
        busy={null}
        labels={{ ...REVIEW_LABELS, progress: "1/2" }}
        onDecide={vi.fn()}
        onLater={vi.fn()}
      />,
    );
    expect(screen.getByText("1/2").className).toBe(GOAL_CHIP_UNACHIEVED);
  });

  it("holds every answer while one is being written", () => {
    renderCard({ busy: "dropped" });
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(screen.getByText(REVIEW_LABELS.saving)).toBeInTheDocument();
  });

  it("holds every answer while the add field's write is out", () => {
    render(
      <PeriodEndReviewCard
        goalTitle="部屋の模様替えを決める"
        connected={false}
        canCarry
        busy={null}
        locked
        labels={REVIEW_LABELS}
        onDecide={vi.fn()}
        onLater={vi.fn()}
      />,
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    // Waiting, not saving: no answer of the card's own is being written.
    expect(screen.queryByText(REVIEW_LABELS.saving)).toBeNull();
  });

  it("gives every answer the 44px floor below md", () => {
    renderCard();
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("max-md:min-h-11");
    }
  });
});

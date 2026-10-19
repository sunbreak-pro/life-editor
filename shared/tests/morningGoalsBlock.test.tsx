import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MorningGoalsBlock,
  PeriodEndReviewCard,
  type MorningGoalsLabels,
  type PeriodEndReviewLabels,
} from "../src/components/briefing/MorningGoalsBlock";
import { MorningGoalsPanel } from "../src/components/briefing/MorningGoalsPanel";
import { GOAL_CHIP_UNACHIEVED } from "../src/components/briefing/GoalProgressDelta";
import type {
  MorningGoalLine,
  MorningGoals,
} from "../src/components/briefing/morningGoals";

/*
 * #2106 → #2286 — the morning paper's goals: the block is one line per
 * period (first goal,「その他 N」at the right edge, the period's progress)
 * and a「目標」button; the panel it opens lists each goal with its progress,
 * its linking and the way into its own panel, and holds this week's add
 * field. Pinned here: states say themselves in words as well as colour, a
 * phone drops the bar and the counts, the add field is IME-safe and keeps
 * the words when the write fails, the limit replaces the field, and the
 * review's four answers reach the host.
 */

const LABELS: MorningGoalsLabels = {
  title: "これからの目標",
  periodNames: { week: "今週", month: "今月", year: "今年" },
  periods: {
    week: "今週 9/27 – 10/3",
    month: "今月 9月",
    year: "今年 2026年",
  },
  open: "目標",
  more: (count) => `その他 ${count}`,
  unset: "未設定",
  reviewNotice: (count) => `終わった期間の目標が ${count} 件あります`,
  prompt: "今週の目標を立てましょう",
  achieved: "達成",
  unconnected: "未接続",
  linkTodos: "Todo をつなぐ",
  linkTodosFor: (title) => `Todo をつなぐ: ${title}`,
  openGoalFor: (title) => `${title} を開く`,
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
  opts: { compact?: boolean; reviewCount?: number } = {},
) {
  const onOpen = vi.fn();
  const result = render(
    <MorningGoalsBlock
      goals={goals}
      labels={LABELS}
      compact={opts.compact}
      reviewCount={opts.reviewCount}
      onOpen={onOpen}
    />,
  );
  return { ...result, onOpen };
}

/** The summary row a period's name heads. */
const row = (name: string): HTMLElement =>
  screen.getByText(name).closest("li") as HTMLElement;

const follows = (a: Node, b: Node): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("MorningGoalsBlock", () => {
  it("draws one line per period: first goal, then「その他 N」at the right edge", () => {
    renderBlock(
      goalsOf({
        week: [OPEN, ACHIEVED, LOOSE],
        month: [line("m-deal", "秋の新規案件を受注する")],
      }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    const week = row("今週");
    const title = within(week).getByText("企画書を通す");
    const more = within(week).getByText("その他 2");
    // The title takes the slack, so「その他 N」sits against the right edge,
    // with only the progress after it.
    expect(title).toHaveClass("flex-1", "truncate");
    expect(more).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(follows(title, more)).toBe(true);
    expect(
      follows(more, within(week).getByRole("progressbar", { name: "今週" })),
    ).toBe(true);
    expect(within(week).queryByText("3 回走る")).toBeNull();

    const month = row("今月");
    expect(within(month).getByText("秋の新規案件を受注する")).toBeTruthy();
    expect(within(month).queryByText(/その他/)).toBeNull();
  });

  it("says「未設定」for a period with no goal, and opens the panel from it", () => {
    const { onOpen } = renderBlock(goalsOf({ week: [OPEN] }));
    const unset = screen.getAllByRole("button", { name: LABELS.unset });
    expect(unset).toHaveLength(2);
    fireEvent.click(unset[0] as HTMLElement);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("sums a period's progress over its goals on a wide screen", () => {
    renderBlock(goalsOf({ week: [ACHIEVED, OPEN, LOOSE] }));
    const bar = screen.getByRole("progressbar", { name: "今週" });
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
    expect(bar.getAttribute("aria-valuemax")).toBe("6");
    expect(bar.getAttribute("aria-valuetext")).toBe("4/6");
    expect(bar.className).toContain("bg-lumen-briefing-shu-subtle");
    expect(within(row("今週")).getByText("4/6")).toBeTruthy();
  });

  it("calls a period achieved only once every goal in it is", () => {
    renderBlock(goalsOf({ week: [ACHIEVED] }));
    const bar = screen.getByRole("progressbar", { name: "今週" });
    expect(bar.getAttribute("aria-valuetext")).toBe("達成 2/2");
    expect(within(row("今週")).getByText(LABELS.achieved)).toBeTruthy();
  });

  it("draws a period with nothing linked as the outline chip", () => {
    renderBlock(goalsOf({ month: [line("m-loose", "引っ越しを決める")] }));
    const chip = within(row("今月")).getByText(LABELS.unconnected);
    expect(chip.className).toContain("border-lumen-border");
    expect(chip.className).toContain("rounded-full");
  });

  it("drops the bar and every count / chip on a phone", () => {
    renderBlock(
      goalsOf({
        week: [ACHIEVED, OPEN],
        month: [line("m-loose", "引っ越しを決める")],
      }),
      { compact: true },
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(LABELS.unconnected)).toBeNull();
    expect(screen.queryByText(LABELS.achieved)).toBeNull();
    expect(screen.queryByText(/\d+\/\d+/)).toBeNull();
    // The titles and「その他 N」stay.
    expect(screen.getByText("3 回走る")).toBeTruthy();
    expect(screen.getByText("その他 1")).toBeTruthy();
  });

  it("opens the panel from the「目標」button, which never wraps", () => {
    const { onOpen } = renderBlock(goalsOf());
    const open = screen.getByRole("button", { name: LABELS.open });
    expect(open).toHaveClass(
      "shrink-0",
      "whitespace-nowrap",
      "max-md:min-h-11",
    );
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("puts ended periods' goals in a one-line notice above the rows", () => {
    const { onOpen, rerender } = renderBlock(goalsOf({ week: [OPEN] }), {
      reviewCount: 2,
    });
    const notice = screen.getByRole("button", {
      name: "終わった期間の目標が 2 件あります",
    });
    expect(follows(notice, screen.getByRole("list"))).toBe(true);
    fireEvent.click(notice);
    expect(onOpen).toHaveBeenCalledTimes(1);

    rerender(
      <MorningGoalsBlock
        goals={goalsOf({ week: [OPEN] })}
        labels={LABELS}
        reviewCount={0}
        onOpen={onOpen}
      />,
    );
    expect(screen.queryByText(/終わった期間/)).toBeNull();
  });
});

function renderPanel(
  goals: MorningGoals,
  opts: {
    onCreate?: (title: string) => Promise<boolean>;
    onOpenGoals?: () => void;
    writing?: boolean;
    review?: React.ReactNode;
  } = {},
) {
  const onLinkTodos = vi.fn();
  const onSelectGoal = vi.fn();
  const onCreateWeekGoal = vi.fn(opts.onCreate ?? (async () => true));
  const result = render(
    <MorningGoalsPanel
      goals={goals}
      labels={LABELS}
      onLinkTodos={onLinkTodos}
      onSelectGoal={onSelectGoal}
      onCreateWeekGoal={onCreateWeekGoal}
      writing={opts.writing}
      onOpenGoals={opts.onOpenGoals}
      review={opts.review}
    />,
  );
  return { ...result, onLinkTodos, onSelectGoal, onCreateWeekGoal };
}

const field = () => screen.getByRole("textbox", { name: LABELS.addLabel });

describe("MorningGoalsPanel", () => {
  it("asks for this week's goals and says「未設定」for the other periods", () => {
    renderPanel(goalsOf());
    expect(screen.getByText(LABELS.prompt)).toBeInTheDocument();
    expect(screen.getAllByText(LABELS.unset)).toHaveLength(2);
    expect(field()).toBeInTheDocument();
  });

  it("says each goal's state in words, with the bar on connected goals", () => {
    renderPanel(goalsOf({ week: [ACHIEVED, OPEN, LOOSE] }));

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

    expect(screen.getByText(LABELS.unconnected)).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: "本を 1 冊読み切る" }),
    ).toBeNull();
  });

  // Review fix (#2106): a period-end「達成にする」fills the bar over 1/2,
  // and the bar's ARIA says the same as its fill rather than "half done".
  it("reports an achieved-by-decision bar as full to assistive tech", () => {
    renderPanel(
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

  it("lists every period's goals under its own heading", () => {
    renderPanel(
      goalsOf({
        week: [OPEN],
        month: [line("m-deal", "秋の新規案件を受注する")],
        year: [line("y-run", "10 km を 60 分以内で走る")],
      }),
    );
    for (const [period, title] of [
      [LABELS.periods.year, "10 km を 60 分以内で走る"],
      [LABELS.periods.month, "秋の新規案件を受注する"],
      [LABELS.periods.week, "企画書を通す"],
    ] as const) {
      const region = screen.getByRole("region", { name: period });
      expect(within(region).getByText(title)).toBeTruthy();
    }
  });

  it("opens a goal's own panel from its title, and its linking from the row", () => {
    const { onSelectGoal, onLinkTodos } = renderPanel(
      goalsOf({ month: [line("m-deal", "秋の新規案件")], week: [OPEN] }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "秋の新規案件 を開く" }),
    );
    expect(onSelectGoal).toHaveBeenCalledWith("m-deal");
    fireEvent.click(
      screen.getByRole("button", { name: "Todo をつなぐ: 企画書を通す" }),
    );
    expect(onLinkTodos).toHaveBeenCalledWith("w-plan");
  });

  it("draws the period-end review above the periods", () => {
    renderPanel(goalsOf(), { review: <p>REVIEW</p> });
    expect(
      follows(
        screen.getByText("REVIEW"),
        screen.getByRole("region", { name: LABELS.periods.year }),
      ),
    ).toBe(true);
  });

  // Review fix (#2106): a review answer in flight holds the add field, so
  // the two cannot both count the same free slot of the week.
  it("waits for another goal write before adding", () => {
    const { onCreateWeekGoal } = renderPanel(goalsOf(), { writing: true });
    fireEvent.change(field(), { target: { value: "走る" } });
    expect(screen.getByRole("button", { name: LABELS.add })).toBeDisabled();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCreateWeekGoal).not.toHaveBeenCalled();
  });

  it("swaps the add field for the limit once the week is full", () => {
    renderPanel(goalsOf({ week: [ACHIEVED, OPEN, LOOSE] }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(LABELS.limit)).toBeInTheDocument();
  });

  it("does not submit while the IME is composing", () => {
    const { onCreateWeekGoal } = renderPanel(goalsOf());
    fireEvent.change(field(), { target: { value: "走る" } });
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    expect(onCreateWeekGoal).not.toHaveBeenCalled();
  });

  it("submits the trimmed title and clears the field once it exists", async () => {
    const { onCreateWeekGoal } = renderPanel(goalsOf());
    fireEvent.change(field(), { target: { value: "  走る  " } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCreateWeekGoal).toHaveBeenCalledWith("走る");
    await waitFor(() => expect((field() as HTMLInputElement).value).toBe(""));
  });

  it("keeps the words when the write fails, and never sends a blank title", async () => {
    const { onCreateWeekGoal } = renderPanel(goalsOf(), {
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
    renderPanel(goalsOf());
    expect(
      screen.queryByRole("button", { name: LABELS.openInConnect }),
    ).toBeNull();
  });

  it("calls the host from the Connect link", () => {
    const onOpenGoals = vi.fn();
    renderPanel(goalsOf(), { onOpenGoals });
    fireEvent.click(screen.getByRole("button", { name: LABELS.openInConnect }));
    expect(onOpenGoals).toHaveBeenCalledTimes(1);
  });

  it("gives every control the 44px floor below md", () => {
    renderPanel(goalsOf({ week: [OPEN] }), { onOpenGoals: vi.fn() });
    for (const name of [
      "企画書を通す を開く",
      "Todo をつなぐ: 企画書を通す",
      LABELS.add,
      LABELS.openInConnect,
    ]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "max-md:min-h-11",
      );
    }
    expect(field().className).toContain("max-md:min-h-11");
  });

  // #2213 — the field took the row and squeezed the button until「追加」
  // wrapped onto two lines. jsdom has no layout, so the class is the pin.
  it("keeps the add button from shrinking or wrapping its label", () => {
    renderPanel(goalsOf());
    const add = screen.getByRole("button", { name: LABELS.add });
    expect(add).toHaveClass("shrink-0", "whitespace-nowrap", "max-md:min-h-11");
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

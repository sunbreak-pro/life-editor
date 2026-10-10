import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  GoalTodoLinkScreen,
  type GoalLinkTodoOption,
  type GoalTodoLinkScreenLabels,
} from "../src/components/briefing/GoalTodoLinkScreen";
import { sampleState } from "./fixtures/goalLinkState";

/*
 * #2109 — linking todos from the goal's side (design L1 / L2). Pinned here:
 * the numbers a save would move are on screen BEFORE the save, the save sends
 * exactly the diff, the 「達成が外れました」chip appears in this screen after
 * a save that took an achievement off (S1 / S2), and an empty pool draws a
 * sentence rather than an empty frame.
 */

const LABELS: GoalTodoLinkScreenLabels = {
  heading: "Todo をつなぐ",
  periodLabel: "今週 9/27 – 10/3",
  search: "Todo を検索",
  listLabel: "つなぐ Todo",
  empty: "つなげる Todo はまだありません。",
  noMatch: "一致する Todo はありません。",
  done: "完了",
  previewHeading: "保存すると変わる数字",
  achievementLost: "達成が外れました",
  save: "保存",
  saving: "保存中…",
  cancel: "キャンセル",
  saveFailed: "保存できませんでした",
  unconnected: "未接続",
  achieved: "達成",
  becomesAchieved: "達成になります",
  losesAchievement: "達成が外れます",
};

const TODOS: GoalLinkTodoOption[] = [
  { id: "t-free", title: "住民票を取りに行く", done: false },
  { id: "t-freedone", title: "経費精算を出す", done: true },
  { id: "t-plan1", title: "企画書の初稿を仕上げる", done: true },
  { id: "t-plan2", title: "構成を決める", done: true },
  { id: "t-plan3", title: "見積もりのたたき台を作る", done: false },
  { id: "t-plan4", title: "先方に送る", done: false },
  { id: "t-run1", title: "5 km ジョグ", done: true },
  { id: "t-run2", title: "インターバル走", done: true },
];

function renderScreen(
  goalId: string,
  opts: {
    todos?: GoalLinkTodoOption[];
    onSave?: () => Promise<void>;
  } = {},
) {
  const onSave = vi.fn(opts.onSave ?? (async () => {}));
  render(
    <GoalTodoLinkScreen
      goalId={goalId}
      state={sampleState()}
      todos={opts.todos ?? TODOS}
      onSave={onSave}
      onClose={() => {}}
      labels={LABELS}
    />,
  );
  return { onSave };
}

const row = (name: string) =>
  screen.getByRole("checkbox", { name: new RegExp(name) });

describe("GoalTodoLinkScreen", () => {
  it("shows the goal, its period and its progress, with its todos checked", () => {
    renderScreen("w-plan");
    expect(
      screen.getByRole("heading", { name: "企画書を通す" }),
    ).toBeInTheDocument();
    expect(screen.getByText(LABELS.periodLabel)).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(row("見積もりのたたき台を作る")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(row("住民票を取りに行く")).toHaveAttribute("aria-checked", "false");
    // A done todo says so in words, not only with a strike-through.
    expect(row("経費精算を出す")).toHaveTextContent(LABELS.done);
  });

  it("shows the numbers a save will change before saving, and saves the diff", async () => {
    const { onSave } = renderScreen("w-plan");
    expect(screen.queryByText(LABELS.previewHeading)).toBeNull();
    expect(screen.getByRole("button", { name: LABELS.save })).toBeDisabled();

    fireEvent.click(row("経費精算を出す"));
    expect(screen.getByText(LABELS.previewHeading)).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: LABELS.save }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ link: ["t-freedone"], unlink: [] }),
    );
  });

  it("warns before, and says after, that a save takes an achievement off (S1 / S2)", async () => {
    const { onSave } = renderScreen("w-run");
    fireEvent.click(row("住民票を取りに行く"));
    // The week, its month and its year all lose it.
    expect(screen.getAllByText(LABELS.losesAchievement)).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: LABELS.save }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(LABELS.achievementLost);
    expect(notice).toHaveTextContent("3 回走る");
    expect(notice).toHaveTextContent("10 km を 60 分以内で走る");
  });

  it("keeps the draft and says so when the save fails", async () => {
    renderScreen("w-plan", {
      onSave: async () => {
        throw new Error("offline");
      },
    });
    fireEvent.click(row("住民票を取りに行く"));
    fireEvent.click(screen.getByRole("button", { name: LABELS.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      LABELS.saveFailed,
    );
    expect(row("住民票を取りに行く")).toHaveAttribute("aria-checked", "true");
  });

  it("does not unlink a todo another device linked while the draft was open", async () => {
    const onSave = vi.fn(async () => {});
    const screenFor = (state: ReturnType<typeof sampleState>) => (
      <GoalTodoLinkScreen
        goalId="w-plan"
        state={state}
        todos={TODOS}
        onSave={onSave}
        labels={LABELS}
      />
    );
    const view = render(screenFor(sampleState()));
    fireEvent.click(row("住民票を取りに行く"));
    // Meanwhile, elsewhere: 経費精算を出す is linked to the same goal.
    const moved = sampleState();
    view.rerender(
      screenFor({
        ...moved,
        links: [
          ...moved.links,
          { goalId: "w-plan", todoId: "t-freedone", isDeleted: false },
        ],
      }),
    );
    expect(row("経費精算を出す")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: LABELS.save }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ link: ["t-free"], unlink: [] }),
    );
  });

  it("freezes the rows while a save is in flight", async () => {
    let finish: () => void = () => {};
    renderScreen("w-plan", {
      onSave: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    fireEvent.click(row("住民票を取りに行く"));
    fireEvent.click(screen.getByRole("button", { name: LABELS.save }));
    expect(row("経費精算を出す")).toBeDisabled();
    finish();
    await waitFor(() => expect(row("経費精算を出す")).not.toBeDisabled());
  });

  it("filters by the search and says when nothing matches", () => {
    renderScreen("w-plan");
    fireEvent.change(screen.getByRole("textbox", { name: LABELS.search }), {
      target: { value: "ジョグ" },
    });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox", { name: LABELS.search }), {
      target: { value: "存在しない" },
    });
    expect(screen.getByText(LABELS.noMatch)).toBeInTheDocument();
  });

  it("draws a sentence, not an empty list or preview frame, with nothing to link", () => {
    renderScreen("w-book", { todos: [] });
    expect(screen.getByText(LABELS.empty)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: LABELS.listLabel })).toBeNull();
    expect(screen.queryByText(LABELS.previewHeading)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    // An unconnected goal reads 未接続, not 0/0.
    expect(screen.getByText(LABELS.unconnected)).toBeInTheDocument();
  });

  it("renders nothing for a goal that is gone", () => {
    const { container } = render(
      <GoalTodoLinkScreen
        goalId="missing"
        state={sampleState()}
        todos={TODOS}
        onSave={async () => {}}
        labels={LABELS}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

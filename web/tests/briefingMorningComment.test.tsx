import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  SyncContext,
  SYNC_DOMAINS,
  todayDateKey,
  type DailyNode,
  type DataService,
  type SyncDomain,
  type WebSyncContextValue,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { BriefingScreen } from "../src/briefing/BriefingScreen";

/*
 * 「昨日へのひとこと」after D-20261007-briefing-1. Claude's comment no longer
 * lives in the Daily body: MCP write_briefing puts it in `morning_comment`
 * (0035), and an older day still carries it as the body's 朝刊 section. The
 * paper reads the column first and the section second; with neither it has
 * no comment block at all — never an empty frame.
 *
 * And, as before, opening the paper writes nothing: the comment is read-only
 * on this side, and an old day's section is not copied into the column.
 */

const TODAY = todayDateKey();

const syncValue: WebSyncContextValue = {
  syncVersion: 0,
  domainVersions: Object.fromEntries(SYNC_DOMAINS.map((d) => [d, 0])) as Record<
    SyncDomain,
    number
  >,
  triggerSync: async () => undefined,
};

const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const head = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const docOf = (...nodes: unknown[]) =>
  JSON.stringify({ type: "doc", content: nodes });

// The comment of the design brief §11.
const C1 =
  "今週の『企画書を通す』は残り 2 件です。初稿を午前に送れば、明日の見積もりに回せます。";
const C2 =
  "午後は歯科検診で抜けるので、集中が要る作業は午前に寄せるのがよさそうです。";

const AI_TITLE = "A WORD ON YESTERDAY";

function daily(content: string, over: Partial<DailyNode> = {}) {
  return {
    id: `daily-${TODAY}`,
    date: TODAY,
    content,
    isDeleted: false,
    eveningPublishedAt: null,
    eveningNotes: null,
    morningComment: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  } satisfies DailyNode;
}

/** Every write the paper could make on open, as spies — none may fire. */
const WRITES = [
  "upsertDailyByDateUnified",
  "updateDailyUnified",
  "createDailyUnified",
  "updateTodo",
  "createNoteUnified",
  "updateNoteUnified",
  "restoreNoteUnified",
  "createGoal",
  "updateGoal",
] as const;

function makeDS(today: DailyNode | null) {
  const writes = Object.fromEntries(
    WRITES.map((name) => [name, vi.fn().mockResolvedValue(undefined)]),
  ) as Record<(typeof WRITES)[number], ReturnType<typeof vi.fn>>;
  const ds: DataService = stubDataService({
    fetchScheduleItemsByDate: vi.fn().mockResolvedValue([]),
    fetchTodoTree: vi.fn().mockResolvedValue([]),
    fetchTimerSessions: vi.fn().mockResolvedValue([]),
    getDailyByDateUnified: vi.fn(async () => today),
    listNotesUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    listDailiesUnified: vi.fn(async () => (today ? [today] : [])),
    // No goals and no `note-goals` / focus note: nothing on the paper has a
    // reason of its own to write.
    fetchGoalsForDate: vi.fn().mockResolvedValue([]),
    fetchGoals: vi.fn().mockResolvedValue([]),
    fetchGoalTodoLinks: vi.fn().mockResolvedValue([]),
    getNoteUnified: vi.fn().mockResolvedValue(null),
    ...writes,
  });
  return { ds, writes };
}

function renderMorning(ds: DataService) {
  return render(
    <SyncContext.Provider value={syncValue}>
      <BriefingScreen
        dataService={ds}
        onNavigate={vi.fn()}
        tab="morning"
        key={TODAY}
      />
    </SyncContext.Provider>,
  );
}

/** The masthead shows only once the reads have landed; then let effects settle. */
async function settle() {
  await screen.findByText("LIFE EDITOR BRIEFING");
  for (let i = 0; i < 5; i++) await act(async () => undefined);
}

describe("「昨日へのひとこと」reads morning_comment first (D-20261007-briefing-1)", () => {
  it("shows the column's comment on a day whose body has no 朝刊 section", async () => {
    const { ds } = makeDS(
      daily(docOf(para("Lunch with Aki.")), { morningComment: [C1, C2] }),
    );
    renderMorning(ds);
    await settle();
    expect(screen.getByText(AI_TITLE)).toBeTruthy();
    expect(screen.getByText(C1)).toBeTruthy();
    expect(screen.getByText(C2)).toBeTruthy();
  });

  it("shows the column, not the body's section, on a day that has both", async () => {
    const { ds } = makeDS(
      daily(docOf(head("朝刊"), para("An older comment.")), {
        morningComment: [C1],
      }),
    );
    renderMorning(ds);
    await settle();
    expect(screen.getByText(C1)).toBeTruthy();
    expect(screen.queryByText("An older comment.")).toBeNull();
  });

  it("falls back to the body's 朝刊 section on an older day", async () => {
    const { ds } = makeDS(daily(docOf(head("朝刊"), para(C2), head("夕刊"))));
    renderMorning(ds);
    await settle();
    expect(screen.getByText(AI_TITLE)).toBeTruthy();
    expect(screen.getByText(C2)).toBeTruthy();
  });

  it.each([
    ["no daily at all", null],
    ["a daily with neither", daily(docOf(para("Just a diary line.")))],
    ["an empty column", daily("", { morningComment: [] })],
  ])("leaves the block out on %s", async (_label, today) => {
    const { ds } = makeDS(today);
    renderMorning(ds);
    await settle();
    expect(screen.queryByText(AI_TITLE)).toBeNull();
  });
});

describe("opening the morning paper writes nothing (D-20261007-briefing-1)", () => {
  it.each([
    ["a blank day", null],
    ["a column-only day", daily("", { morningComment: [C1] })],
    [
      "an old day with 朝刊 and 宣言 sections",
      daily(
        docOf(head("朝刊"), para(C1), head("宣言"), para("走る"), para("日記")),
      ),
    ],
    [
      "a day with both the column and the section",
      daily(docOf(head("朝刊"), para("old")), { morningComment: [C2] }),
    ],
  ])("on %s", async (_label, today) => {
    const { ds, writes } = makeDS(today);
    renderMorning(ds);
    await settle();
    for (const name of WRITES) expect(writes[name]).not.toHaveBeenCalled();
  });
});

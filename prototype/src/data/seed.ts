import { DAILY_TEMPLATE, weekdayOf } from "../lib/id";
import type {
  AppSettings,
  MockState,
  Note,
  PomodoroPreset,
  ScheduleItem,
  TimerSession,
  WikiTag,
} from "../lib/types";
import { HOLIDAYS_2026 } from "./holidays";

const now = Date.now();
const H = (h: number) => now - h * 3600_000;
const D = (d: number) => now - d * 86_400_000;

const ymd = (ts: number): string => {
  const dt = new Date(ts);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const TAGS: WikiTag[] = [
  { id: "tag-dev", name: "dev", color: "#cba6f7", createdAt: now },
  { id: "tag-arch", name: "arch", color: "#89dceb", createdAt: now },
  { id: "tag-biz", name: "biz", color: "#fab387", createdAt: now },
  { id: "tag-personal", name: "personal", color: "#a6e3a1", createdAt: now },
  { id: "tag-book", name: "book", color: "#f5c2e7", createdAt: now },
  { id: "tag-journal", name: "journal", color: "#89b4fa", createdAt: now },
  { id: "tag-birthday", name: "birthday", color: "#f9e2af", createdAt: now },
  { id: "tag-holiday", name: "holiday", color: "#f38ba8", createdAt: now },
];

const TODAY = ymd(now);
const TOMORROW = ymd(now + 86_400_000);
const NEXT_WEEK = ymd(now + 7 * 86_400_000);

const TASKS: ScheduleItem[] = [
  {
    id: "task-seed-1",
    title: "life-editor 仕様レビュー",
    type: "task",
    status: "doing",
    wikiTagIds: ["tag-dev", "tag-arch"],
    description: "03/04/05 要件の整合確認",
    isDeleted: false,
    createdAt: H(72),
    updatedAt: H(2),
  },
  {
    id: "task-seed-2",
    title: "Tauri 2.0 移行",
    type: "task",
    status: "todo",
    due: NEXT_WEEK,
    wikiTagIds: ["tag-dev"],
    isDeleted: false,
    createdAt: H(48),
    updatedAt: H(12),
  },
  {
    id: "task-seed-3",
    title: "請求書送付",
    type: "task",
    status: "todo",
    due: TODAY,
    wikiTagIds: ["tag-biz"],
    isDeleted: false,
    createdAt: H(24),
    updatedAt: H(24),
  },
  {
    id: "task-seed-4",
    title: "ジム",
    type: "task",
    status: "done",
    due: TODAY,
    wikiTagIds: ["tag-personal"],
    isDeleted: false,
    createdAt: H(36),
    updatedAt: H(1),
  },
  {
    id: "task-seed-5",
    title: "週次レビュー",
    type: "task",
    status: "todo",
    due: TOMORROW,
    wikiTagIds: ["tag-personal", "tag-journal"],
    isDeleted: false,
    createdAt: H(50),
    updatedAt: H(50),
  },
  {
    id: "task-seed-6",
    title: "DB スキーマ整理",
    type: "task",
    status: "todo",
    wikiTagIds: ["tag-dev", "tag-arch"],
    isDeleted: false,
    createdAt: H(96),
    updatedAt: H(96),
  },
  {
    id: "task-seed-7",
    title: "読書: パタヘネ 第3章",
    type: "task",
    status: "doing",
    wikiTagIds: ["tag-book"],
    isDeleted: false,
    createdAt: H(120),
    updatedAt: H(10),
  },
  {
    id: "task-seed-8",
    title: "ミーティング議事録",
    type: "task",
    status: "todo",
    due: TODAY,
    wikiTagIds: ["tag-biz"],
    isDeleted: false,
    createdAt: H(8),
    updatedAt: H(8),
  },
  {
    id: "task-seed-9",
    title: "Refactor wiki-link parser",
    type: "task",
    status: "todo",
    wikiTagIds: ["tag-dev"],
    isDeleted: false,
    createdAt: H(60),
    updatedAt: H(60),
  },
  {
    id: "task-seed-10",
    title: "買い物",
    type: "task",
    status: "todo",
    due: TOMORROW,
    wikiTagIds: ["tag-personal"],
    isDeleted: false,
    createdAt: H(4),
    updatedAt: H(4),
  },
];

const EVENTS: ScheduleItem[] = [
  {
    id: "event-seed-1",
    title: "チーム会議",
    type: "event",
    status: "todo",
    due: TODAY,
    time: "09:00",
    endTime: "10:00",
    wikiTagIds: ["tag-dev"],
    isDeleted: false,
    createdAt: H(48),
    updatedAt: H(48),
  },
  {
    id: "event-seed-2",
    title: "1on1",
    type: "event",
    status: "todo",
    due: TODAY,
    time: "15:00",
    endTime: "15:30",
    wikiTagIds: ["tag-biz"],
    isDeleted: false,
    createdAt: H(72),
    updatedAt: H(72),
  },
  {
    id: "event-seed-3",
    title: "歯医者",
    type: "event",
    status: "todo",
    due: TOMORROW,
    time: "11:00",
    endTime: "12:00",
    wikiTagIds: ["tag-personal"],
    isDeleted: false,
    createdAt: H(96),
    updatedAt: H(96),
  },
  {
    id: "event-seed-4",
    title: "勉強会",
    type: "event",
    status: "todo",
    due: ymd(now + 2 * 86_400_000),
    time: "19:00",
    endTime: "21:00",
    wikiTagIds: ["tag-dev", "tag-arch"],
    isDeleted: false,
    createdAt: H(168),
    updatedAt: H(168),
  },
  {
    id: "event-seed-5",
    title: "出張",
    type: "event",
    status: "todo",
    due: ymd(now + 5 * 86_400_000),
    wikiTagIds: ["tag-biz"],
    isDeleted: false,
    createdAt: H(120),
    updatedAt: H(120),
  },
  {
    id: "event-seed-6",
    title: "コーヒーミート",
    type: "event",
    status: "todo",
    due: NEXT_WEEK,
    time: "14:00",
    endTime: "15:00",
    wikiTagIds: ["tag-personal"],
    isDeleted: false,
    createdAt: H(24),
    updatedAt: H(24),
  },
  {
    id: "event-seed-7",
    title: "コード読書会",
    type: "event",
    status: "doing",
    due: TODAY,
    time: "20:00",
    endTime: "21:30",
    wikiTagIds: ["tag-dev", "tag-book"],
    isDeleted: false,
    createdAt: H(12),
    updatedAt: H(12),
  },
  {
    id: "event-seed-8",
    title: "オフィス移転手続き",
    type: "event",
    status: "todo",
    due: ymd(now + 30 * 86_400_000),
    wikiTagIds: ["tag-biz"],
    isDeleted: false,
    createdAt: H(60),
    updatedAt: H(60),
  },
];

const BIRTHDAYS: ScheduleItem[] = [
  {
    id: "event-seed-bd1",
    title: "ボブの誕生日",
    type: "birthday",
    status: "todo",
    due: ymd(now + 1 * 86_400_000),
    wikiTagIds: ["tag-birthday"],
    isDeleted: false,
    createdAt: H(168),
    updatedAt: H(168),
  },
  {
    id: "event-seed-bd2",
    title: "Alice の誕生日",
    type: "birthday",
    status: "todo",
    due: ymd(now + 20 * 86_400_000),
    wikiTagIds: ["tag-birthday"],
    isDeleted: false,
    createdAt: H(168),
    updatedAt: H(168),
  },
];

const HOLIDAYS: ScheduleItem[] = HOLIDAYS_2026.map((h) => ({
  id: `event-holiday-${h.date}`,
  title: h.title,
  type: "holiday" as const,
  status: "todo" as const,
  due: h.date,
  wikiTagIds: ["tag-holiday"],
  isDeleted: false,
  createdAt: now,
  updatedAt: now,
}));

const SCHEDULE_ITEMS: ScheduleItem[] = [
  ...TASKS,
  ...EVENTS,
  ...BIRTHDAYS,
  ...HOLIDAYS,
];

const NOTES_KIND: Note[] = [
  {
    id: "note-seed-1",
    kind: "notes",
    title: "life-editor 設計メモ",
    excerpt:
      "Tauri + Rust + React 19 構成。[[life-editor 仕様レビュー]] と関連。",
    body: "## 構成\n\nTauri + Rust + React 19 構成。\n[[life-editor 仕様レビュー]] と関連。\n\n## 課題\n- WikiTag の polymorphic 参照\n- ScheduleItem 統合型",
    wikiTagIds: ["tag-dev", "tag-arch"],
    pinned: true,
    isDeleted: false,
    createdAt: H(120),
    updatedAt: H(2),
  },
  {
    id: "note-seed-2",
    kind: "notes",
    title: "Pomodoro 運用",
    excerpt: "25 分 + 5 分。長休憩前に 4 セッション。",
    body: "## 運用ルール\n\n25 分 + 5 分。長休憩前に 4 セッション。\n\n[[Tauri 2.0 移行]] 中はバースト型 (Short Burst) で。",
    wikiTagIds: ["tag-dev", "tag-personal"],
    pinned: false,
    isDeleted: false,
    createdAt: H(80),
    updatedAt: H(20),
  },
  {
    id: "note-seed-3",
    kind: "notes",
    title: "読書ログ: パタヘネ",
    excerpt: "MIPS アーキテクチャと命令セット。",
    body: "## 第 3 章\n\nMIPS アーキテクチャと命令セット。\n[[読書: パタヘネ 第3章]] 進行中。",
    wikiTagIds: ["tag-book", "tag-arch"],
    pinned: false,
    isDeleted: false,
    createdAt: H(168),
    updatedAt: H(48),
  },
  {
    id: "note-seed-4",
    kind: "notes",
    title: "ミーティング議事録 (チーム会議)",
    excerpt: "次週のリリース計画と QA 体制。",
    body: "## アジェンダ\n\n- リリース計画\n- QA 体制\n\nRefer: [[チーム会議]]",
    wikiTagIds: ["tag-biz"],
    pinned: false,
    isDeleted: false,
    createdAt: H(40),
    updatedAt: H(40),
  },
  {
    id: "note-seed-5",
    kind: "notes",
    title: "アイデア帳",
    excerpt: "気付きとアイデアの蓄積場所。",
    body: "## ふと思ったこと\n\n- ScheduleItem 統合型は本番でも採用したい\n- WikiTag は全エンティティ共通プール",
    wikiTagIds: ["tag-personal", "tag-arch"],
    pinned: false,
    isDeleted: false,
    createdAt: H(96),
    updatedAt: H(30),
  },
  {
    id: "note-seed-6",
    kind: "notes",
    title: "Refactor ノート",
    excerpt: "wiki-link parser の改善点。",
    body: "## TODO\n\n- IME composition チェック\n- 候補の updated 降順\n\n[[Refactor wiki-link parser]] に紐付け。",
    wikiTagIds: ["tag-dev"],
    pinned: false,
    isDeleted: false,
    createdAt: H(60),
    updatedAt: H(10),
  },
  {
    id: "note-seed-7",
    kind: "notes",
    title: "週次レビュー テンプレート",
    excerpt: "金曜夜の振り返り用。",
    body: "## 良かったこと\n\n## 改善点\n\n## 来週の優先度",
    wikiTagIds: ["tag-personal", "tag-journal"],
    pinned: true,
    isDeleted: false,
    createdAt: H(72),
    updatedAt: H(72),
  },
  {
    id: "note-seed-8",
    kind: "notes",
    title: "出張準備リスト",
    excerpt: "持ち物・予約・連絡先。",
    body: "## 持ち物\n- PC + 充電器\n- 名刺\n\nRefer: [[出張]]",
    wikiTagIds: ["tag-biz", "tag-personal"],
    pinned: false,
    isDeleted: false,
    createdAt: H(36),
    updatedAt: H(36),
  },
];

const DAILY_NOTES: Note[] = Array.from({ length: 8 }, (_, i) => {
  const date = ymd(D(i));
  const moods: Note["mood"][] = ["green", "sky", "yellow", "peach", "red"];
  const bodies = [
    "## 今日の振り返り\n\n集中できた。\n\n## 学び・気づき\n\nWikiTag のポリモフィズム。\n\n## 明日の予定\n[[週次レビュー]]",
    "## 今日の振り返り\n\n会議が長かった。\n\n## 学び・気づき\n\n議事録テンプレート化。\n\n## 明日の予定\n",
    "## 今日の振り返り\n\nコード読書。[[読書: パタヘネ 第3章]] を進めた。\n\n## 学び・気づき\n\nMIPS の魅力。\n\n## 明日の予定\n",
    DAILY_TEMPLATE,
    "## 今日の振り返り\n\nジム + 読書。\n\n## 学び・気づき\n\n運動後の集中が高い。\n\n## 明日の予定\n",
    DAILY_TEMPLATE,
    "## 今日の振り返り\n\nリファクタ。\n\n## 学び・気づき\n\n小さいコミットの効能。\n\n## 明日の予定\n",
    DAILY_TEMPLATE,
  ];
  return {
    id: `daily-${date}`,
    kind: "daily",
    title: date,
    excerpt: bodies[i].split("\n").find((l) => l && !l.startsWith("#")) ?? "",
    body: bodies[i],
    wikiTagIds: ["tag-journal"],
    pinned: false,
    date,
    weekday: weekdayOf(date),
    mood: moods[i % moods.length],
    pomodoroSessions: i === 0 ? 4 : i === 1 ? 5 : 0,
    isDeleted: false,
    createdAt: D(i),
    updatedAt: D(i) + 3600_000,
  };
});

const NOTES: Note[] = [...NOTES_KIND, ...DAILY_NOTES];

const PRESETS: PomodoroPreset[] = [
  {
    id: "preset-classic",
    name: "Classic",
    workMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    sessionsBeforeLongBreak: 4,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "preset-long-focus",
    name: "Long Focus",
    workMin: 50,
    breakMin: 10,
    longBreakMin: 20,
    sessionsBeforeLongBreak: 3,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "preset-short-burst",
    name: "Short Burst",
    workMin: 15,
    breakMin: 3,
    longBreakMin: 10,
    sessionsBeforeLongBreak: 4,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  },
];

const buildSession = (
  daysAgo: number,
  hourOffset: number,
  scheduleItemId: string | null,
  scheduleItemTitle: string | null,
  sessionType: TimerSession["sessionType"],
  plannedMin: number,
): TimerSession => {
  const completedAt = D(daysAgo) + hourOffset * 3600_000;
  const plannedSec = plannedMin * 60;
  return {
    id: `session-d${daysAgo}-h${hourOffset}-${sessionType.toLowerCase()}`,
    scheduleItemId,
    scheduleItemTitle,
    sessionType,
    plannedSec,
    durationSec: plannedSec,
    startedAt: completedAt - plannedSec * 1000,
    completedAt,
    isDeleted: false,
  };
};

const TIMER_SESSIONS: TimerSession[] = [
  // Today (4)
  buildSession(0, -4, "task-seed-1", "life-editor 仕様レビュー", "WORK", 25),
  buildSession(0, -3.5, null, null, "BREAK", 5),
  buildSession(0, -3, "task-seed-1", "life-editor 仕様レビュー", "WORK", 25),
  buildSession(0, -2.5, null, null, "BREAK", 5),
  // Yesterday (5)
  buildSession(1, -5, "task-seed-7", "読書: パタヘネ 第3章", "WORK", 25),
  buildSession(1, -4.5, null, null, "BREAK", 5),
  buildSession(1, -4, "task-seed-7", "読書: パタヘネ 第3章", "WORK", 25),
  buildSession(1, -3.5, null, null, "LONG_BREAK", 15),
  buildSession(1, -2.5, "task-seed-2", "Tauri 2.0 移行", "WORK", 25),
  // Day before yesterday (4)
  buildSession(2, -3, "task-seed-9", "Refactor wiki-link parser", "WORK", 25),
  buildSession(2, -2.5, null, null, "BREAK", 5),
  buildSession(2, -2, "task-seed-9", "Refactor wiki-link parser", "WORK", 25),
  buildSession(2, -1.5, null, null, "BREAK", 5),
];

const SETTINGS: AppSettings = {
  themeMode: "dark",
  fontSize: 16,
  language: "ja",
  notifications: {
    pomodoroSessionEnd: true,
    scheduleReminder10min: true,
    scheduleReminder30min: false,
    dailyUnwritten: true,
  },
  layoutDefaults: { materialsLayout: "card" },
  updatedAt: now,
};

export const SEED: MockState = {
  scheduleItems: SCHEDULE_ITEMS,
  notes: NOTES,
  presets: PRESETS,
  timerSessions: TIMER_SESSIONS,
  wikiTags: TAGS,
  settings: SETTINGS,
  activePresetId: "preset-classic",
  currentTaskId: null,
  autoStartBreaks: true,
};

---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md
Previous: .claude/docs/vision/plans/10_UIUX設計書_Settings.md
---

# Plan: CRUD モック層 実装計画書 (Prototype Mobile)

> 段階 C — 03-06 で定義した要件と 07-10 の UIUX を、in-memory + localStorage の mock store として実装する。**4 セクション横断の唯一の実装計画書**。

---

## Context

- **動機**: 要件定義 (03-06) と UIUX (07-10) で「何を作り、どう見せるか」が確定した。本書は「どう動かすか (mock CRUD レイヤ)」と「実装の段階分け」を確定する
- **制約**: 1 ファイル TSX 維持 / Provider 不使用 / localStorage `lifemobile-mock:*` のみ例外許可 / 既存 prototype 依存セットを増やさない (`react / react-dom / react-router-dom / lucide-react` のみ)
- **Non-goals**: 本番 frontend/ への変更 / DataService 接続 / E2E テスト / ライブラリ追加

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/11_実装計画書_CRUDモック.md       (本書)
prototype/src/App.tsx                                       (ルート追加)
prototype/src/dev/IndexPage.tsx                             (Settings/Trash/CrossSearch リンク追加)
prototype/src/lib/mockStore.ts                              (新規、mock CRUD 中核)
prototype/src/lib/storage.ts                                (新規、localStorage wrapper)
prototype/src/lib/wikiLink.ts                               (新規、`[[title]]` 解決)
prototype/src/lib/id.ts                                     (新規、ID 生成)
prototype/src/data/seed.ts                                  (新規、初期データ)
prototype/src/data/holidays.ts                              (新規、祝日ハードコード)
prototype/src/hooks/useMockStore.ts                         (新規、subscribe hook)
prototype/src/screens/ScheduleScreen.tsx                    (リライト、03 + 07 を実装)
prototype/src/screens/WorkScreen.tsx                        (リライト、04 + 08 を実装)
prototype/src/screens/MaterialsScreen.tsx                   (リライト、05 + 09 を実装)
prototype/src/screens/SettingsScreen.tsx                    (新規、06 + 10 を実装)
prototype/src/screens/TrashScreen.tsx                       (新規)
prototype/src/screens/CrossSearchScreen.tsx                 (新規)
```

---

## 1. 全体アーキテクチャ (mock CRUD 層)

```
┌──────────────────────────────────────────────────┐
│  各 Screen TSX (1 ファイル完結)                    │
│   ┌──────────────────────────────────────────┐   │
│   │ const store = useMockStore();              │   │
│   │ store.scheduleItems / store.notes / ...    │   │
│   │ store.addScheduleItem(...) / ...           │   │
│   └──────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────┘
                   │ subscribe
                   ▼
┌──────────────────────────────────────────────────┐
│  hooks/useMockStore.ts                            │
│   - subscribe 風 hook (useSyncExternalStore)      │
│   - selector で部分購読                            │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│  lib/mockStore.ts                                 │
│   - state: { scheduleItems, notes, presets,       │
│             timerSessions, wikiTags, settings }   │
│   - actions: addScheduleItem, updateNote, ...     │
│   - notifyListeners()                             │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│  lib/storage.ts                                   │
│   - localStorage wrapper (namespace + JSON)       │
│   - get<T>(key) / set<T>(key, value)              │
└──────────────────────────────────────────────────┘
```

**Provider 不使用の代替**: 単一 module-level singleton + `useSyncExternalStore` で各コンポーネントが subscribe する。Zustand 風だがライブラリは入れない。

---

## 2. データ型 (03-06 統合)

```ts
// lib/types.ts
export type EntityId = string;
export type TaskStatus = "todo" | "doing" | "done";
export type ScheduleItemType = "task" | "event" | "birthday" | "holiday";
export type SessionType = "WORK" | "BREAK" | "LONG_BREAK";
export type MaterialKind = "notes" | "daily";
export type Mood = "green" | "sky" | "yellow" | "peach" | "red";
export type ThemeMode = "light" | "dark" | "system";
export type Language = "ja" | "en";
export type NotificationKind =
  | "pomodoroSessionEnd"
  | "scheduleReminder10min"
  | "scheduleReminder30min"
  | "dailyUnwritten";

export interface ScheduleItem {
  /* 03 §1 */
}
export interface WikiTag {
  /* 03 §1 */
}
export interface PomodoroPreset {
  /* 04 §1 */
}
export interface TimerSession {
  /* 04 §1 */
}
export interface Note {
  /* 05 §1 */
}
export interface AppSettings {
  /* 06 §1 */
}

export interface MockState {
  scheduleItems: ScheduleItem[];
  notes: Note[];
  presets: PomodoroPreset[];
  timerSessions: TimerSession[];
  wikiTags: WikiTag[];
  settings: AppSettings;
}
```

---

## 3. lib/storage.ts (localStorage wrapper)

```ts
const NS = "lifemobile-mock:";

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    localStorage.setItem(NS + key, JSON.stringify(value));
  },
  clearAll(): void {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(NS))
      .forEach((k) => localStorage.removeItem(k));
  },
};
```

**設計判断**: 1 つの巨大 JSON ではなく、エンティティ別キー (`schedule-items` / `notes` / ...) で保存 → 部分更新コスト低減。

---

## 4. lib/mockStore.ts (中核)

```ts
import { storage } from "./storage";
import type { MockState, ScheduleItem, Note /* ... */ } from "./types";
import { genId } from "./id";
import { SEED } from "../data/seed";

let state: MockState = {
  scheduleItems: storage.get("schedule-items", SEED.scheduleItems),
  notes: storage.get("notes", SEED.notes),
  presets: storage.get("presets", SEED.presets),
  timerSessions: storage.get("timer-sessions", SEED.timerSessions),
  wikiTags: storage.get("wiki-tags", SEED.wikiTags),
  settings: storage.get("settings", SEED.settings),
};

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getState(): MockState {
  return state;
}

// ===== ScheduleItem =====
export function addScheduleItem(
  input: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt" | "isDeleted">,
): ScheduleItem {
  const now = Date.now();
  const item: ScheduleItem = {
    ...input,
    id: genId(input.type === "task" ? "task" : "event"),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  state = { ...state, scheduleItems: [...state.scheduleItems, item] };
  storage.set("schedule-items", state.scheduleItems);
  notify();
  return item;
}

export function updateScheduleItem(
  id: EntityId,
  patch: Partial<ScheduleItem>,
): void {
  state = {
    ...state,
    scheduleItems: state.scheduleItems.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
    ),
  };
  storage.set("schedule-items", state.scheduleItems);
  notify();
}

export function deleteScheduleItem(id: EntityId): void {
  updateScheduleItem(id, { isDeleted: true, deletedAt: Date.now() });
}

export function restoreScheduleItem(id: EntityId): void {
  updateScheduleItem(id, { isDeleted: false, deletedAt: undefined });
}

export function purgeScheduleItem(id: EntityId): void {
  state = {
    ...state,
    scheduleItems: state.scheduleItems.filter((s) => s.id !== id),
  };
  storage.set("schedule-items", state.scheduleItems);
  notify();
}

export function toggleStatus(id: EntityId): void {
  const NEXT: Record<TaskStatus, TaskStatus> = {
    todo: "doing",
    doing: "done",
    done: "todo",
  };
  const item = state.scheduleItems.find((s) => s.id === id);
  if (!item || item.type === "birthday" || item.type === "holiday") return;
  updateScheduleItem(id, { status: NEXT[item.status] });
}

// ===== Note =====
export function addNote(
  input: Omit<Note, "id" | "createdAt" | "updatedAt" | "isDeleted">,
): Note {
  const now = Date.now();
  const note: Note = {
    ...input,
    id:
      input.kind === "daily" && input.date
        ? `daily-${input.date}`
        : genId("note"),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  state = { ...state, notes: [note, ...state.notes] };
  storage.set("notes", state.notes);
  notify();
  return note;
}

export function getOrCreateDaily(date: string): Note {
  const existing = state.notes.find(
    (n) => n.kind === "daily" && n.date === date && !n.isDeleted,
  );
  if (existing) return existing;
  return addNote({
    kind: "daily",
    title: "",
    excerpt: "",
    body: DAILY_TEMPLATE,
    wikiTagIds: [],
    pinned: false,
    date,
    weekday: weekdayOf(date),
    mood: "green",
    pomodoroSessions: 0,
  });
}

// (updateNote / deleteNote / togglePinNote / duplicateNote 略、同パターン)

// ===== WikiTag =====
export function addWikiTag(name: string, color: string): WikiTag {
  const normalized = name.trim().toLowerCase();
  const existing = state.wikiTags.find(
    (t) => t.name.toLowerCase() === normalized,
  );
  if (existing) return existing;
  const tag: WikiTag = {
    id: genId("tag"),
    name: name.trim(),
    color,
    createdAt: Date.now(),
  };
  state = { ...state, wikiTags: [...state.wikiTags, tag] };
  storage.set("wiki-tags", state.wikiTags);
  notify();
  return tag;
}

export function attachTag(entityId: EntityId, tagId: EntityId): void {
  // ScheduleItem / Note の両方に対応
  if (entityId.startsWith("task-") || entityId.startsWith("event-")) {
    const item = state.scheduleItems.find((s) => s.id === entityId);
    if (!item || item.wikiTagIds.includes(tagId)) return;
    updateScheduleItem(entityId, { wikiTagIds: [...item.wikiTagIds, tagId] });
  } else if (entityId.startsWith("note-") || entityId.startsWith("daily-")) {
    const note = state.notes.find((n) => n.id === entityId);
    if (!note || note.wikiTagIds.includes(tagId)) return;
    updateNote(entityId, { wikiTagIds: [...note.wikiTagIds, tagId] });
  }
}

// (detachTag 略)

// ===== Preset / TimerSession =====
// (略、同パターン)

// ===== Settings =====
export function setSettings(patch: Partial<AppSettings>): void {
  state = {
    ...state,
    settings: { ...state.settings, ...patch, updatedAt: Date.now() },
  };
  storage.set("settings", state.settings);
  notify();
}

// ===== 管理 =====
export function resetAll(): void {
  storage.clearAll();
  location.reload();
}
```

---

## 5. hooks/useMockStore.ts

```ts
import { useSyncExternalStore } from "react";
import { subscribe, getState } from "../lib/mockStore";
import type { MockState } from "../lib/types";

export function useMockStore<T>(selector: (s: MockState) => T): T {
  return useSyncExternalStore(
    (l) => subscribe(l),
    () => selector(getState()),
    () => selector(getState()),
  );
}
```

**使用例** (各 Screen 内):

```tsx
const scheduleItems = useMockStore((s) =>
  s.scheduleItems.filter((i) => !i.isDeleted),
);
const settings = useMockStore((s) => s.settings);
```

---

## 6. lib/wikiLink.ts (`[[title]]` 解決 + Backlink)

```ts
import { getState } from "./mockStore";

const LINK_RE = /\[\[([^\]]+)\]\]/g;

export type LinkTarget =
  | { kind: "note" | "daily"; id: EntityId; title: string }
  | {
      kind: "task" | "event" | "birthday" | "holiday";
      id: EntityId;
      title: string;
    };

export function resolveLink(rawTitle: string): LinkTarget | null {
  const t = rawTitle.trim().toLowerCase();
  if (!t) return null;
  const s = getState();
  // Notes / Daily 優先
  const note = s.notes
    .filter((n) => !n.isDeleted)
    .find((n) => n.title.toLowerCase() === t);
  if (note)
    return {
      kind: note.kind === "daily" ? "daily" : "note",
      id: note.id,
      title: note.title,
    };
  // ScheduleItem
  const item = s.scheduleItems
    .filter((i) => !i.isDeleted)
    .find((i) => i.title.toLowerCase() === t);
  if (item) return { kind: item.type, id: item.id, title: item.title };
  return null;
}

export function suggestLinks(prefix: string, limit = 10): LinkTarget[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const s = getState();
  const matches: LinkTarget[] = [];
  for (const n of s.notes) {
    if (n.isDeleted) continue;
    if (n.title.toLowerCase().includes(p)) {
      matches.push({
        kind: n.kind === "daily" ? "daily" : "note",
        id: n.id,
        title: n.title,
      });
    }
  }
  for (const i of s.scheduleItems) {
    if (i.isDeleted) continue;
    if (i.title.toLowerCase().includes(p)) {
      matches.push({ kind: i.type, id: i.id, title: i.title });
    }
  }
  return matches.slice(0, limit);
}

export interface Backlink {
  fromEntityId: EntityId;
  fromTitle: string;
  fromKind: LinkTarget["kind"];
  matchedText: string;
}

export function findBacklinks(targetTitle: string): Backlink[] {
  const target = targetTitle.trim().toLowerCase();
  if (!target) return [];
  const s = getState();
  const result: Backlink[] = [];
  const check = (
    body: string,
    fromId: EntityId,
    fromTitle: string,
    fromKind: LinkTarget["kind"],
  ) => {
    const matches = body.matchAll(LINK_RE);
    for (const m of matches) {
      if (m[1].trim().toLowerCase() === target) {
        result.push({
          fromEntityId: fromId,
          fromTitle,
          fromKind,
          matchedText: m[0],
        });
      }
    }
  };
  for (const n of s.notes) {
    if (n.isDeleted) continue;
    check(n.body, n.id, n.title, n.kind === "daily" ? "daily" : "note");
  }
  for (const i of s.scheduleItems) {
    if (i.isDeleted) continue;
    check(i.description ?? "", i.id, i.title, i.type);
  }
  return result;
}
```

---

## 7. lib/id.ts

```ts
export function genId(prefix: string): string {
  // crypto.randomUUID() を使う (modern browser 標準)
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid}`;
}

export function weekdayOf(yyyymmdd: string): string {
  const d = new Date(yyyymmdd);
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}

export const DAILY_TEMPLATE =
  "## 今日の振り返り\n\n\n## 学び・気づき\n\n\n## 明日の予定\n";
```

---

## 8. data/seed.ts と data/holidays.ts

### 8.1 holidays.ts

```ts
// 2026 年の日本の主要祝日 (要件 03 §FR-6 のサンプル)
export const HOLIDAYS_2026: Array<{ date: string; title: string }> = [
  { date: "2026-01-01", title: "元日" },
  { date: "2026-01-12", title: "成人の日" },
  { date: "2026-03-20", title: "春分の日" },
  { date: "2026-05-05", title: "こどもの日" },
  { date: "2026-11-03", title: "文化の日" },
];
```

### 8.2 seed.ts

```ts
import { genId, weekdayOf, DAILY_TEMPLATE } from "../lib/id";
import { HOLIDAYS_2026 } from "./holidays";
import type { MockState } from "../lib/types";

const now = Date.now();
const H = (h: number) => now - h * 3600_000;

// WikiTags (全エンティティ共通プール)
const TAGS = [
  { id: "tag-dev", name: "dev", color: "#cba6f7" /* mauve */ },
  { id: "tag-arch", name: "arch", color: "#89dceb" /* sky */ },
  { id: "tag-biz", name: "biz", color: "#fab387" /* peach */ },
  { id: "tag-personal", name: "personal", color: "#a6e3a1" /* green */ },
  { id: "tag-book", name: "book", color: "#f5c2e7" /* pink */ },
  { id: "tag-journal", name: "journal", color: "#89b4fa" /* blue */ },
  { id: "tag-birthday", name: "birthday", color: "#f9e2af" /* yellow */ },
  { id: "tag-holiday", name: "holiday", color: "#f38ba8" /* red */ },
];

// ScheduleItem (task / event / birthday / holiday)
const SCHEDULE_ITEMS: ScheduleItem[] = [
  // tasks (10)
  {
    id: "task-seed-1",
    title: "life-editor 仕様レビュー",
    type: "task",
    status: "todo",
    wikiTagIds: ["tag-dev"],
    isDeleted: false,
    createdAt: H(72),
    updatedAt: H(2),
  },
  // ... (合計 10 件、Schedule 03 §6 のシード規模)

  // events (8)
  {
    id: "event-seed-1",
    title: "チーム会議",
    type: "event",
    status: "todo",
    due: "2026-05-21",
    time: "09:00",
    endTime: "10:00",
    wikiTagIds: ["tag-dev"],
    isDeleted: false,
    createdAt: H(48),
    updatedAt: H(48),
  },
  // ...

  // birthday (2)
  {
    id: "event-seed-bd1",
    title: "ボブの誕生日",
    type: "birthday",
    status: "todo",
    due: "2026-05-25",
    wikiTagIds: ["tag-birthday"],
    isDeleted: false,
    createdAt: H(168),
    updatedAt: H(168),
  },

  // holiday (5) — HOLIDAYS_2026 から生成
  ...HOLIDAYS_2026.map((h) => ({
    id: `event-holiday-${h.date}`,
    title: h.title,
    type: "holiday" as const,
    status: "todo" as const,
    due: h.date,
    wikiTagIds: ["tag-holiday"],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  })),
];

// Notes (8) と Daily (8) — Materials 05 §6 のシード規模
const NOTES: Note[] = [
  {
    id: "note-seed-1",
    kind: "notes",
    title: "life-editor 設計メモ" /* ... */,
    body: "Tauri + Rust + React 19 構成。\n[[life-editor 仕様レビュー]] と関連。",
    wikiTagIds: ["tag-dev", "tag-arch"] /* ... */,
  },
  // ...
];

// PomodoroPreset (3)
const PRESETS = [
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

// TimerSession (13) — Work 04 §6 のシード規模、過去 3 日分
const TIMER_SESSIONS: TimerSession[] = [
  // ... (略)
];

// AppSettings (singleton)
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
};
```

---

## 9. 段階分け実装 (Phase 3.A 〜 3.E)

要件定義 01 / 02 で Phase 0-4 は完了済 (環境構築 + 3 screens 移植)。本書は **Phase 3.A 以降の細分化** を扱う。

### Phase 3.A: 基盤層 (mock store + hooks + ID + storage)

**Gate**: 🤖 自律 / **Acceptance**: `npm run build` 通過 (vite tsc 相当)

- [ ] `lib/types.ts` — 全エンティティ型を 03-06 §1 から実装
- [ ] `lib/id.ts` — `genId` / `weekdayOf` / `DAILY_TEMPLATE`
- [ ] `lib/storage.ts` — localStorage wrapper
- [ ] `lib/mockStore.ts` — state + listeners + 全 action 関数
- [ ] `lib/wikiLink.ts` — `resolveLink` / `suggestLinks` / `findBacklinks`
- [ ] `hooks/useMockStore.ts` — `useSyncExternalStore` wrapper
- [ ] `data/holidays.ts` / `data/seed.ts` — シードデータ
- [ ] 動作確認: 既存 3 screens は **触らない**、build が通ること

**想定工数**: 4h

### Phase 3.B: Schedule 画面リライト (03 + 07 を反映)

**Gate**: 🤖 自律 + 👀 目視 (MV-1 / FAB-1 / SHEET-1 / STATUS-1 の不変要件を目視確認)

- [ ] `screens/ScheduleScreen.tsx` を **リライト** (既存 2118 行を廃棄、03/07 準拠で再構築)
- [ ] `ScheduleItem` 単一型に統合 (旧 ListItem + DayEvent を統合)
- [ ] CalendarTag 廃止、Sidebar フィルタを WikiTag + Status に変更
- [ ] 祝日 read-only バナー (`type === 'holiday'`)
- [ ] AddEventModal の type radio (task/event/birthday) — holiday は新規時非表示
- [ ] WikiTag chip + TagSheet 統合 (Picker 共通化、Materials と shared な実装 inline)
- [ ] StatusCheckbox 循環 (birthday/holiday は循環なし)
- [ ] CRUD wire-up: 全 handler を mockStore action に接続
- [ ] 動作確認:
  - [ ] FAB → 新規 task / event / birthday を保存 → 各 view に反映 (👀)
  - [ ] StatusCheckbox 循環 (👀)
  - [ ] MonthView セルタップ → DayDetailSheet (👀 [SHEET-1])
  - [ ] WikiTag chip タップ → CrossSearchScreen 起動 (Phase 3.E と連携、本フェーズではプレースホルダで可)

**想定工数**: 6h

### Phase 3.C: Work 画面リライト (04 + 08 を反映)

**Gate**: 🤖 自律 + 👀 目視 (Countdown 色変化 / Pulse / Session Dots)

- [ ] `screens/WorkScreen.tsx` を **リライト** (既存 2029 行を廃棄、04/08 準拠で再構築)
- [ ] TaskPickerModal が `mockStore.scheduleItems` (type='task') を表示
- [ ] Pomodoro WORK 完了時 `scheduleItem.status` を `todo→doing` 自動進行
- [ ] Task 完了ボタン → ConfirmModal → `status='done'`
- [ ] PomodoroPreset CRUD (add/update/delete + 最後の 1 つ削除防御)
- [ ] TimerSession 自動追加 (sessionEnd 時)
- [ ] History タブ: 日付 group + long press 削除
- [ ] 動作確認:
  - [ ] Timer の start/pause/reset/skip (👀)
  - [ ] WORK 完了 → SessionCompletionModal + currentTask が doing に進行 (👀)
  - [ ] プリセット切替: 走行中は ConfirmModal (👀)

**想定工数**: 5h

### Phase 3.D: Materials 画面リライト (05 + 09 を反映)

**Gate**: 🤖 自律 + 👀 目視 (Editor スライドイン / Card-Row 切替 / `[[link]]` ハイライト)

- [ ] `screens/MaterialsScreen.tsx` を **リライト**
- [ ] Notebook 廃止、フィルタは WikiTag のみ
- [ ] Daily の `getOrCreateDaily(today)` 実装、ID `daily-YYYY-MM-DD`
- [ ] WikiTag chip + TagSheet (Schedule と共通実装、各ファイル inline)
- [ ] EditorView の textarea overlay で `[[title]]` ハイライト
- [ ] `[[` 入力候補ポップアップ (suggestLinks + Enter 確定)
- [ ] Backlink パネル (findBacklinks)
- [ ] BottomSheet 7 種 (Sort/Filter/ItemMenu/EditorMenu/Mood/Tag/Sort)
- [ ] LongPress 600ms + scroll cancel
- [ ] 動作確認:
  - [ ] Notes / Daily 切替 + FAB 新規作成 (👀)
  - [ ] Editor で `[[` 候補ポップアップ → Enter 確定 (👀)
  - [ ] Backlink パネルが正しく逆参照を出す (👀)
  - [ ] LongPress でメニュー、tap で Editor (👀)

**想定工数**: 7h

### Phase 3.E: Settings / Trash / CrossSearch (06 + 10 を反映)

**Gate**: 🤖 自律 + 👀 目視 (List Section / 「本番で適用」バッジ / Trash 復元)

- [ ] `screens/SettingsScreen.tsx` (新規)
  - [ ] List Section 4 つ (表示 / 通知 / データ / About)
  - [ ] Theme / Language → BottomSheet Picker
  - [ ] FontSize → Slider (プレビュー字のみ実反映)
  - [ ] 「本番で適用」バッジ
  - [ ] Mock 初期化 → ConfirmModal → `resetAll()`
  - [ ] 通知 toggle → 各トリガー (Pomodoro 終了等) で console.log + Toast
- [ ] `screens/TrashScreen.tsx` (新規)
  - [ ] フィルタ tab (全て / Sch / Notes / Daily / Preset / Session)
  - [ ] 復元 / 完全削除 / 全削除
- [ ] `screens/CrossSearchScreen.tsx` (新規)
  - [ ] 検索 input + Tag chip 列
  - [ ] 結果行クリック → 該当画面遷移 (URL search param or location state)
- [ ] `App.tsx` に `/settings` `/trash` `/cross-search` ルート追加
- [ ] `dev/IndexPage.tsx` にリンク追加
- [ ] 動作確認:
  - [ ] Settings の全 row が機能 (👀)
  - [ ] Trash で削除 → 復元 → 元画面に再表示 (👀)
  - [ ] CrossSearch がタグ起点で正しい結果 (👀)

**想定工数**: 6h

### Phase 3.F: 統合 + 仕上げ

**Gate**: 🤖 自律 + 👀 目視 / 🛑 人手 (PR 作成)

- [ ] `IndexPage.tsx` を Phase 3 状態に更新 (Settings / Trash / CrossSearch リンク追加)
- [ ] `App.tsx` ルートの整理
- [ ] localStorage 名前空間の grep 監査 (`grep -r "lifemobile-mock:" prototype/src/` で網羅確認)
- [ ] tailwind v4 構文混入監査 (`grep -rE "@theme|oklch\(" prototype/src` が空)
- [ ] 禁止依存監査 (`grep -E "tauri|electron|capacitor|supabase" prototype/package.json` が空)
- [ ] README.md 更新 (新規ルートと mock store の使い方を追記)
- [ ] iPhone Safari 確認 (👀): 全画面 + 全 CRUD 操作
- [ ] PR 作成 (🛑): `prototype/mobile-ui` → `refactor/web-first-v2`

**想定工数**: 2h

---

## 10. Acceptance Criteria (機械検証可能)

- [ ] `cd prototype && npm run build` exit 0 (型エラー 0)
- [ ] `grep -E "tauri|electron|capacitor|supabase|@tanstack" prototype/package.json` が空
- [ ] `grep -rE "@theme|oklch\(" prototype/src` が空 (tailwind v4 構文混入なし)
- [ ] `grep -rE "sessionStorage" prototype/src` が空 (localStorage のみ、`lifemobile-mock:` 接頭辞)
- [ ] `prototype/src/lib/mockStore.ts` が 03-06 §7 の全 CRUD 操作を export している
- [ ] `prototype/src/data/seed.ts` がデータシード規模 (03 §6 / 04 §6 / 05 §6 / 06 §6) を満たす
- [ ] 全 4 画面 + Trash + CrossSearch が `/schedule` `/work` `/materials` `/settings` `/trash` `/cross-search` で動作
- [ ] (👀) リロード後も全データが復元される

---

## 11. DB Migration Notes

**該当なし**。本書はプロトタイプ内 mock CRUD のみで、Supabase / SQLite に触れない。

本番 frontend/ への移植時には別途 migration 計画が必要 (各要件定義 §9 マッピング参照)。

---

## 12. Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` を grep:
  - `useSyncExternalStore` / React 19 関連
  - localStorage quota / JSON.stringify の循環参照
  - IME 関連 (`isComposing` チェック)
- 新規 known issue 候補:
  - mockStore の immutable update で巨大配列 spread → 規模拡大時に性能課題 (mock では問題なし)
  - localStorage 容量上限 (5MB) を超えた時の挙動 → try/catch で警告 toast
  - subscribe listeners の leak 防止 (`useSyncExternalStore` が unsubscribe を返り値で渡す形を守る)
  - Daily 復元時に `daily-YYYY-MM-DD` 衝突 (06 §FR-2 で警告 toast、復元キャンセル)

---

## 13. 本番移植時の追加考慮

本書のスコープは prototype 内完結。本番 frontend/ 移植は別計画書 (将来 `YYYY-MM-DD-prototype-mobile-port.md` で作成予定)。但し、移植時に「本書の決定を持ち越す」事項を以下に明示:

| 持ち越す決定                                        | 本番への影響                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ScheduleItem` 統合型 (task/event/birthday/holiday) | 本番でも統合型を採用 → DATA-1 課題の本質解消                                     |
| WikiTag 全エンティティ共通プール                    | 本番の `wiki_tag_assignments` が ScheduleItem / Note の両方を polymorphic に参照 |
| `[[title]]` リンク + Backlink                       | 本番 Tier 2 補助機能として新規追加                                               |
| 横断検索 (CrossSearch)                              | 本番 `searchService.ts` を新規作成                                               |
| Settings の Sync 除外                               | 本番でも Mobile UI の Settings には Sync を出さない (Desktop 側で管理)           |

各要件定義 (03-06) §9 「本番移植マッピング」と組み合わせて参照。

---

## References

- 親計画書: `01_要件定義書_プロトタイプ環境.md` / `02_実装計画書_プロトタイプ環境.md`
- 要件定義 (Parent 群): `03_要件定義書_Schedule.md` / `04_要件定義書_Work.md` / `05_要件定義書_Materials.md` / `06_要件定義書_Settings.md`
- UIUX 設計 (実装根拠): `07_UIUX設計書_Schedule.md` / `08_UIUX設計書_Work.md` / `09_UIUX設計書_Materials.md` / `10_UIUX設計書_Settings.md`
- 凍結原本: `prototype/_artifacts/*.tsx`
- vision: `.claude/docs/vision/coding-principles.md`

---

## Worklog

- 2026-05-24: 初版。mock store 単一 module-level singleton (useSyncExternalStore) で Provider 不使用を維持 / 段階分け Phase 3.A-F で 30h 想定 / 各 Phase に Gate と Acceptance を明示

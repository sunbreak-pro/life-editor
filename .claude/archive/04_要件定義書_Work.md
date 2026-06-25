---
Status: Draft
Created: 2026-05-24
Branch: prototype/mobile-ui
Owner-chat: chat-main
Parent: .claude/docs/vision/plans/01_要件定義書_プロトタイプ環境.md
Previous: .claude/docs/vision/plans/03_要件定義書_Schedule.md
---

# Plan: Work 画面 要件定義 (Prototype Mobile)

> 段階 A — 「何を作るか」を確定する書類。UIUX (08) と CRUD (11) は本書を Parent とする。Schedule (03) のデータモデル合意を継承。

---

## Context

- **動機**: prototype の Work 画面 (`prototype/src/screens/WorkScreen.tsx`) は Pomodoro Timer / 履歴 / プリセット設定の 3 サブタブ構成。本書では Task プールを **Schedule と統合** し、Pomodoro 完了が Schedule 側の Task 状態に影響する関係を確定する
- **制約**: 1 ファイル TSX 維持 / Provider 不使用 / Catppuccin Mocha 固定 / localStorage 名前空間 `lifemobile-mock:*` のみ例外許可
- **Non-goals**: 実際の通知音 / Web Audio API 連携 / バイブレーション API / Background Timer API / 本番 DataService 接続

---

## Scope (Touchable Paths)

```
.claude/docs/vision/plans/04_要件定義書_Work.md              (本書)
prototype/src/screens/WorkScreen.tsx                         (将来の実装対象、本書では参照のみ)
prototype/_artifacts/mobile work section demo.tsx            (凍結原本、参照のみ)
```

---

## 1. 上位データモデル合意 (Schedule 03 を継承 + 追加)

`ScheduleItem` / `WikiTag` は 03 §1 を参照。Work 画面で追加で必要な型:

```ts
type SessionType = "WORK" | "BREAK" | "LONG_BREAK";

interface PomodoroPreset {
  id: EntityId; // `preset-<uuid>`
  name: string;
  workMin: number; // 1-180
  breakMin: number; // 1-60
  longBreakMin: number; // 1-60
  sessionsBeforeLongBreak: number; // 1-10
  isDeleted: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface TimerSession {
  id: EntityId; // `session-<uuid>`
  scheduleItemId: EntityId | null; // ScheduleItem への参照 (Schedule 03 のタスクと共有)
  scheduleItemTitle: string | null; // 削除されても履歴に残すためのスナップショット
  sessionType: SessionType;
  plannedSec: number; // 予定秒数
  durationSec: number; // 実測秒数 (スキップ時は実時間)
  startedAt: number; // epoch ms
  completedAt: number; // epoch ms
  isDeleted: boolean;
  deletedAt?: number;
}
```

**重要な統合決定**: 旧 demo の `Task` 型は **廃止**。Work が参照する Task は **Schedule の `ScheduleItem` (type='task')** と同一プール。`folder: 'dev' | 'biz' | 'personal'` は WikiTag `#dev` / `#biz` / `#personal` に置換 (mock seed で初期投入)。

---

## 2. 機能要件 (FR)

### FR-1: 3 サブタブ切替 (Timer / History / Settings)

WorkScreen 上部の SubTabBar で切替。state のみ、URL 変更なし。

- **Timer**: Pomodoro カウントダウン + Task ピッカー
- **History**: 完了セッション一覧 (日付グルーピング)
- **Settings**: プリセット切替 + 個別調整 + auto-start toggle

### FR-2: Pomodoro Timer

- **Countdown**: `mm:ss` 表示、1 秒ごと減算 (`setInterval` + cleanup)
- **コントロール**: Start / Pause / Reset / Skip
- **SessionType セグメント**: WORK / BREAK / LONG_BREAK 手動切替 (running 中は無効)
- **完了検知**: `remainingSec === 0` で `handleSessionEnd(false)` (true=skip)
- **Auto-start**: `autoStartBreaks=true` の場合、WORK 終了後 5 秒カウントダウン → BREAK 自動開始
- **Pulse Effect**: 完了瞬間に視覚パルス (`pulseKey++` で key 更新、CSS animation で 1 回再生)

### FR-3: Task ピッカー (Schedule との統合)

- Timer タブで「Task を選択」ボタン → TaskPickerModal 起動
- **データソース**: `mockStore.scheduleItems` をフィルタ `type === 'task' && !isDeleted`
- **検索**: 部分一致 (title)
- **グルーピング**: WikiTag 別 (旧 folder の代替)
- **選択**: `currentTask` (=ScheduleItem) を state に保持
- **完了処理**: Pomodoro WORK セッション完了時、`currentTask.status === 'todo'` なら自動で `doing` に進める (`done` 化はしない、ユーザー判断)
- **Task 完了確認**: Timer タブの「Task 完了」ボタン → 確認モーダル → `scheduleItemUpdate({ status: 'done' })`

### FR-4: 履歴 (History タブ)

- 完了した `TimerSession` を新しい順に表示
- **グルーピング**: 「今日 / 昨日 / 日付」(formatDateLabel) で section header 区切り
- **行表示**: 時刻 / Task タイトル / SessionType chip / 実測時間
- **削除**: 行 long press → 削除確認 → soft delete

### FR-5: プリセット (Settings タブ内)

- **切替**: PomodoroPreset を chip ボタン群で切替。Timer 走行中は確認モーダル後に切替
- **追加**: 「+ プリセット追加」→ AddPresetModal (name / workMin / breakMin / longBreakMin / sessionsBeforeLongBreak)
- **編集**: SliderRow で `workMin / breakMin / longBreakMin / sessionsBeforeLongBreak` をその場編集 (アクティブプリセットのみ)
- **削除**: 「削除」ボタン → 確認モーダル → soft delete (最後の 1 つは削除不可)
- **toggle**: `autoStartBreaks` (休憩自動開始) のオン/オフ

### FR-6: 通知モック

- WORK セッション完了時: SessionCompletionModal 表示 (タイトル / 経過時間 / 「次のセッションへ」/「やめる」)
- (FR-6 の通知トリガーポイントは 06 Settings の Notifications 章で UI フックを集約)
- 実音・実通知は出さない (Settings の Notifications トグルが ON でも console.log + Toast のみ)

### FR-7: BottomTabBar (Work タブが active)

03 §FR-8 と同じ仕様 (4 タブ全 enabled)。

---

## 3. 非機能要件 (NFR)

### NFR-1: タイマー精度

- `setInterval` ベースで OK (1 秒精度)、ドリフト補正 (`Date.now()` 比較) はプロトタイプ範囲外
- ブラウザタブ非アクティブ時の正確性は **保証しない** (実用度確認が目的、Background Timer は本番 Capacitor 化で対応)

### NFR-2: 永続化

- `presets`, `activePresetId`, `currentTaskId`, `timerSessions[]`, `autoStartBreaks` を localStorage に保存
- **保存しない state**: `remainingSec`, `isRunning`, `sessionType` (リロード = タイマー停止扱い)

### NFR-3: 想定解像度・操作

- Schedule 03 NFR-3 と同じ

### NFR-4: 依存

- Schedule 03 NFR-4 と同じ (Web Audio / Notifications API も追加しない)

---

## 4. 不変要件 (Invariants)

旧 demo から **維持**:

- **[W-COUNTDOWN-1] Countdown 表示**: `mm:ss` フォーマット固定、桁数固定 (1 桁台でも 2 桁ゼロパディング)
- **[W-PRESET-1] プリセット切替の保護**: Timer 走行中の切替は確認モーダル必須
- **[W-DELETE-1] プリセット最後の 1 つ削除不可**: UI 側で削除ボタンを無効化

旧 demo から **変更**:

- **[W-FOLDER 廃止]**: `FolderKey` (dev/biz/personal) は廃止 → WikiTag 化
- **[W-TASK 統合]**: Work 独立の `Task` プール廃止 → Schedule の ScheduleItem(type=task) を参照

---

## 5. 画面遷移

```
/work
  ├─ WorkScreen
  │    ├─ SubTabBar (Timer / History / Settings)
  │    ├─ TimerTab (active=timer)
  │    │    ├─ CountdownDigits + Controls
  │    │    ├─ SessionTypeTabs (WORK/BREAK/LONG_BREAK)
  │    │    ├─ Task 選択 → TaskPickerModal
  │    │    │    └─ ScheduleItem(type=task) 一覧 → currentTask 確定
  │    │    ├─ Task 完了 → ConfirmModal → ScheduleItem.status='done'
  │    │    └─ Session 完了 → SessionCompletionModal
  │    ├─ HistoryTab (active=history)
  │    │    └─ TimerSession 一覧 (日付 group + long press 削除)
  │    └─ SettingsTab (active=settings)
  │         ├─ Preset chip 群 → 切替 (走行中は ConfirmModal)
  │         ├─ SliderRow (workMin/breakMin/longBreakMin/sessions)
  │         ├─ ToggleRow (autoStartBreaks)
  │         ├─ 「+ プリセット追加」 → AddPresetModal
  │         └─ 「削除」 → ConfirmModal → soft delete
  └─ BottomTabBar → /schedule /materials /settings へ遷移
```

---

## 6. データシード (mock data 初期値)

CRUD 11 で `prototype/src/data/seed.ts` に集約。Work 関連:

| データ                  | 件数                         | 内容                                                                      |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| PomodoroPreset          | 3                            | Classic (25/5/15/4) / Long Focus (50/10/20/3) / Short Burst (15/3/10/4)   |
| TimerSession            | 13                           | 過去 3 日分 (今日 4 / 昨日 5 / 一昨日 4)、ScheduleItem 参照を seed と整合 |
| ScheduleItem(type=task) | (Schedule 03 の 10 件と同一) | folder→WikiTag (`#dev` `#biz` `#personal`) で seed                        |
| WikiTag                 | `#dev` `#biz` `#personal`    | (Schedule 03 のシードに同居)                                              |

---

## 7. CRUD 操作一覧 (CRUD 計画書 11 への要件)

| Op                                         | 対象             | トリガー                             | 保存先                                  |
| ------------------------------------------ | ---------------- | ------------------------------------ | --------------------------------------- |
| `addPreset`                                | PomodoroPreset   | AddPresetModal 保存                  | localStorage                            |
| `updatePreset`                             | PomodoroPreset   | SliderRow 操作                       | inline update                           |
| `deletePreset`                             | PomodoroPreset   | 削除ボタン + 確認                    | soft delete (最後の 1 つは UI で防御)   |
| `setActivePresetId`                        | string           | chip タップ                          | localStorage                            |
| `setCurrentTask`                           | EntityId \| null | TaskPickerModal 選択 / クリア        | localStorage                            |
| `addTimerSession`                          | TimerSession     | Pomodoro 自動完了 / skip             | localStorage                            |
| `deleteTimerSession`                       | TimerSession     | 行 long press + 確認                 | soft delete                             |
| `setAutoStartBreaks`                       | boolean          | ToggleRow                            | localStorage                            |
| (Schedule 連携) `updateScheduleItemStatus` | ScheduleItem     | Pomodoro WORK 完了 / Task 完了ボタン | Schedule 03 §7 の `toggleStatus` 再利用 |

---

## 8. Acceptance Criteria (本書の完了条件)

- [ ] §1 のデータモデル合意 (PomodoroPreset / TimerSession) が 03/05/06/11 と矛盾しない
- [ ] §2 機能要件で Schedule との Task プール統合 (FR-3) が明示されている
- [ ] §4 不変要件で「維持」と「変更」が明示されている (W-FOLDER 廃止 / W-TASK 統合)
- [ ] §7 CRUD 操作が 11 計画書の入力として十分
- [ ] §9 本番移植マッピングが具体的に書かれている

---

## 9. 本番移植マッピング (Production Port Mapping)

### 9.1 ファイル対応

| Prototype                                           | 本番 `frontend/`                                               | 備考                                                       |
| --------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `prototype/src/screens/WorkScreen.tsx` (1 ファイル) | `frontend/src/components/Mobile/MobileWorkView.tsx` + 配下分割 | Pattern A 3 ファイル化は Desktop の TimerProvider に揃える |
| `mockStore.timerSessions`                           | `frontend/src/services/getDataService().listTimerSessions` 等  | `addTimerSession` → `DataService.createTimerSession`       |
| `mockStore.presets`                                 | 本番 `pomodoro_presets` テーブル                               | id 体系 `preset-<uuid>` → uuid                             |

### 9.2 型対応

| Prototype 型     | 本番型                                                | 差分                                                                                               |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `PomodoroPreset` | `frontend/src/types/pomodoroPreset.ts` (既存 or 新規) | フィールド名互換                                                                                   |
| `TimerSession`   | `frontend/src/types/timerSession.ts`                  | `scheduleItemId` は本番では `task_id` (Schedule 統合型を本番にも持ち越す場合は `schedule_item_id`) |
| `SessionType`    | 既存 enum                                             | 互換                                                                                               |

### 9.3 配色対応

Schedule 03 §9.3 と同じ (Catppuccin C → notion-\* トークン)。

### 9.4 移植時の注意

- 旧 demo の `currentTask: Task | null` は本番では `currentScheduleItemId: EntityId | null` に変更 (型統合の継承)
- TaskPickerModal は Schedule のタスク一覧コンポーネントを共通化して再利用
- Auto-start カウントダウン (5 秒) は本番では Audio cue ありに格上げ可能 (Desktop の AudioProvider に依存)
- Background Timer の精度問題 (NFR-1) は本番 Capacitor 化で `@capacitor/background-runner` 検討

### 9.5 移植時に **持ち込まない** もの

- localStorage 永続化レイヤ
- `buildMockSessions()` 等の seed 関数
- `formatDateLabel` 等のユーティリティ (本番 `frontend/src/utils/dateFormat.ts` を使う想定)

---

## Risks / Known Issues 参照

- `.claude/docs/known-issues/INDEX.md` を grep:
  - `setInterval` / タブ非アクティブ時のタイマードリフト
  - Modal の二重起動 / focus trap
- 新規 known issue 候補:
  - ScheduleItem 削除 → Work の `currentTask` 参照切れ。ガード必要 (`scheduleItemTitle` snapshot を `TimerSession` に保持する設計で対応済)
  - プリセット切替時、Timer state (`remainingSec`) のリセット範囲 (BREAK 途中切替時の挙動)

---

## References

- 親計画書: `01_要件定義書_プロトタイプ環境.md` / `02_実装計画書_プロトタイプ環境.md`
- 前計画書 (データモデル合意元): `03_要件定義書_Schedule.md`
- 凍結原本: `prototype/_artifacts/mobile work section demo.tsx`
- 本書を参照する後続: `08_UIUX設計書_Work.md` / `11_実装計画書_CRUDモック.md`

---

## Worklog

- 2026-05-24: 初版。Task プール統合 (W-TASK) / folder→WikiTag 置換 (W-FOLDER 廃止) / Pomodoro 完了の ScheduleItem.status 自動進行 (FR-3) を反映

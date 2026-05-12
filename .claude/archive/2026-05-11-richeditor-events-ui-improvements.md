---
Status: COMPLETED
Created: 2026-05-11
Updated: 2026-05-12（曖昧点 4 件すべて確定）
Completed: 2026-05-12（HISTORY.md 2026-05-12 エントリ参照、ブランチ feat/richeditor-events-ui-batch）
Task: MEMORY.md（task-tracker 登録は実装着手時）
Project: /Users/newlife/dev/apps/life-editor
Related: docs/vision/coding-principles.md / 2026-05-04-cross-platform-migration.md
---

# Plan: RichEditor / Events / TaskDetail UI 改修（5 件バッチ）

## Context

### 動機

ユーザーから 5 件の UI 改修要望を受領（2026-05-11、2026-05-12 に曖昧点回答）。DB スキーマ拡張は #4 で 2 列追加（`timer_sessions.event_id` + `schedule_items.actual_time_minutes`）。他は frontend のみで完結。

### 制約

- **Active Migration 中（`refactor/web-first-v2`）**: 本作業は `main` ブランチ（Tauri 構成）で進める。Web 移行で frontend は大半が共通持ち越し予定だが、TipTap 拡張 / 共有コンポーネントは移行後も生きる想定。schedule_items テーブル拡張のみ Supabase スキーマでもミラーが必要（#4）。
- **Mobile Optional Provider 規約**: 改修対象（RichEditor / EventList / TaskDetail）は Desktop / Mobile 両方で使われるため、Mobile 省略 Provider の Optional バリアントを壊さない（特に Timer を Event に紐付ける際）。
- **`notion-*` トークン使用必須 / 透明落ち禁止**（coding-principles.md §5）

### Non-Goals

- TipTap → Lexical 等のエディタ基盤差し替え
- 既存 SlashCommand 機能の全面リライト（**追加のみ**で実現）
- Event ↔ Task の双方向参照（#4 は Timer 起動 + 実績時間ログのみ。Event の Task 化はしない）
- Database Property `checkbox` の **編集機能本体**の実装（既存の「表示のみ + クリックで toggle」は維持。今回は見た目を `RoundedCheckbox` に揃えるだけ）

### Assumptions（確定済 — 2026-05-12 ユーザー回答反映）

ユーザーの回答（2026-05-12）で全曖昧点が解消。以下を確定前提として進める:

| #   | 要件文                                             | 確定前提                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 「bubble tool にスラッシュコマンドの選択を入れる」 | 既存の `CommandPanel` を **フル機能で** BubbleMenu からも展開。テキスト選択 → BubbleMenu の "Turn into" ボタン → CommandPanel が `mode="selection"` で全コマンド（Heading 1-3 / Todo / Bullet / Ordered / Code Block / Quote / Callout etc.）を表示。サブセット化しない                                                            |
| 3   | チェックボックス UI 統一範囲                       | **TodoList のみではなく、frontend 全体のチェックボックス UI を `RoundedCheckbox` に統一**。対象: (a) TipTap TaskItem の `<input type="checkbox">` / (b) `TaskTree/TaskNodeCheckbox.tsx` の未完了タスク checkbox / (c) `Schedule/DayFlow/ScheduleItemBlock.tsx` の完了ボタン / (d) `Database/CellRenderer.tsx` の checkbox property |
| 3   | 旧 checkbox UI コード完全削除                      | 各箇所の `<input type="checkbox">` / `accent-color` 系 CSS / インライン `<Check>` ボタン実装を **完全削除**。`git grep` で残骸ゼロ確認                                                                                                                                                                                             |
| 4   | 「Event も Work できるように調整」                 | Timer を多態化（`task` / `event`）。**Event 完了時に `schedule_items` 側へ実績時間ログを書き戻す**（D-2.5 で実装）。`timer_sessions.event_id` 追加 + `schedule_items.actual_time_minutes` 追加                                                                                                                                     |
| 5   | TaskDetailPanel ヘッダー breadcrumb の「画面遷移」 | breadcrumb 上に表示される **ancestor 全階層をクリッカブル**に。それぞれの onClick で `navigateToAncestor(ancestorId)` を呼び、TaskTree 展開 + 右ペインを当該フォルダの TaskDetail に切り替える。IconPicker はアイコン右クリック or hover 補助ボタンで存続                                                                          |

## Files (影響範囲)

| File                                                                   | Operation | Notes                                                                                                                           |
| ---------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/Tasks/TaskDetail/BubbleToolbar.tsx`           | Modify    | #1: "Turn into" ボタン追加、押下で CommandPanel を `mode="selection"` で展開                                                    |
| `frontend/src/components/Tasks/TaskDetail/CommandPanel.tsx`            | Modify    | #1: BubbleMenu からの起動経路を許容（座標渡し）。#2: `customFontSizeInput=true` 時に親（Slash/Bubble）から unmount されない保証 |
| `frontend/src/components/Tasks/TaskDetail/editorCommands.ts`           | Modify    | #2: `headingSubActions` の "Custom..." が選択時に CommandPanel を閉じない controlled signal を返す                              |
| `frontend/src/hooks/useSlashCommand.ts`                                | Modify    | #2: 「Custom 入力モード遷移」シグナルを受けたら `isOpen` を維持する分岐を追加                                                   |
| `frontend/src/components/shared/RichTextEditor.tsx`                    | Modify    | #1: BubbleMenu 経由の CommandPanel 起動コールバック注入。#3: TaskItem を NodeView 化、または独自 ToggleList で差し替え          |
| `frontend/src/extensions/CustomTaskItem.ts` **(NEW)**                  | Create    | #3-a: TipTap TaskItem を継承し ReactNodeViewRenderer で `RoundedCheckbox` を埋め込む                                            |
| `frontend/src/extensions/CustomTaskItemView.tsx` **(NEW)**             | Create    | #3-a: NodeView 本体。`RoundedCheckbox` + 子コンテンツの NodeViewContent                                                         |
| `frontend/src/index.css`                                               | Modify    | #3-a: `.memo-editor ul[data-type="taskList"] li > label input[type="checkbox"]` 系 CSS を完全削除                               |
| `frontend/src/components/shared/RoundedCheckbox.tsx`                   | Modify    | #3: NodeView / TaskTree / DB Cell で使えるよう `size` / `disabled` / `aria-label` を補強                                        |
| `frontend/src/components/Tasks/TaskTree/TaskNodeCheckbox.tsx`          | Modify    | #3-b: 未完了タスクの `<input type="checkbox">` を `RoundedCheckbox` に置換。完了/フォルダの分岐は維持                           |
| `frontend/src/components/Tasks/Schedule/DayFlow/ScheduleItemBlock.tsx` | Modify    | #3-c: インライン `<Check>` ボタン実装を削除し `RoundedCheckbox` に置換                                                          |
| `frontend/src/components/Database/CellRenderer.tsx`                    | Modify    | #3-d: checkbox property の `<Check>` 表示を `RoundedCheckbox` に置換（読み取り専用 / クリックで toggle の挙動は変えない）       |
| `frontend/src/components/Database/CellEditor.tsx`                      | (Verify)  | #3-d: 既存で checkbox は `null` を返す（編集 UI なし）→ Renderer 側のクリックで toggle する設計を確認、不整合があれば調整       |
| `frontend/src/components/ScheduleList/EventList.tsx`                   | Modify    | #4: TaskTree 風アイテム — `Trash2` / `Play` ボタンを hover で表示。onClick で `deleteScheduleItem` / `startForEvent`            |
| `frontend/src/components/Tasks/TaskTree/TaskNodeActions.tsx`           | (Read)    | #4: 既存パターンを共有化する場合の参照元（hover opacity / アイコン構成）                                                        |
| `frontend/src/context/TimerContext.tsx`                                | Modify    | #4: `startForEvent(eventId, title)` 追加。`activeSubject: { kind: 'task' \| 'event', id: string }` に多態化                     |
| `frontend/src/context/TimerContextValue.ts`                            | Modify    | #4: interface 拡張                                                                                                              |
| `frontend/src/services/DataService.ts` / `TauriDataService.ts`         | Modify    | #4: `createTimerSession` の引数に `eventId` 追加。`incrementScheduleItemActualMinutes(eventId, minutes)` 追加（4 点同期）       |
| `src-tauri/src/commands/timer.rs`（or 該当）+ `schedule.rs`            | Modify    | #4: `event_id` 引数受け入れ。schedule_items 実績時間 increment コマンド追加                                                     |
| `src-tauri/src/lib.rs`                                                 | Modify    | #4: 新規コマンド `generate_handler!` 登録                                                                                       |
| `src-tauri/src/db/migrations/v61_plus.rs`                              | Modify    | #4: V70 — `timer_sessions.event_id TEXT NULLABLE` + `schedule_items.actual_time_minutes INTEGER NOT NULL DEFAULT 0` 追加        |
| `src-tauri/src/db/migrations/full_schema.rs`                           | Modify    | #4: 同 schema 反映                                                                                                              |
| `src-tauri/src/db/migrations/mod.rs`                                   | Modify    | #4: `LATEST_USER_VERSION = 70`                                                                                                  |
| `src-tauri/src/sync/sync_engine.rs`                                    | (Verify)  | #4: `schedule_items` は `VERSIONED_TABLES` の `schedule_items` で既に対象。version bump 必要なら確認                            |
| `cloud/db/migrations/0008_timer_sessions_event_id.sql` **(NEW)**       | Create    | #4: D1 ミラー（`timer_sessions.event_id` + `schedule_items.actual_time_minutes`）                                               |
| `frontend/src/hooks/useSessionCompletionToast.ts`                      | Modify    | #4: Event 完了時のトースト文言分岐 + `incrementScheduleItemActualMinutes` 呼び出し                                              |
| `frontend/src/components/Tasks/TaskDetail/TaskSidebarContent.tsx`      | Modify    | #5: breadcrumb の **全 ancestor**（行53-108 の loop 内）を Clickable に、onClick で `navigateToAncestor(id)` 呼び出し           |
| `frontend/src/hooks/useTaskDetailHandlers.ts`（または該当）            | Modify    | #5: `navigateToAncestor(ancestorId)` ハンドラ追加 — `expandToNode` + `setSelectedTaskId` まで一括                               |
| `frontend/src/context/TaskTreeContext.tsx`                             | Modify    | #5: `expandToNode(id)` — id の全 ancestor chain を expand する helper を追加（既存 `toggleExpanded` を内部利用）                |

## Steps

各ステップは独立検証可能。順序は #2 (バグ修正) → #3 (基盤統一) → #1 (Bubble 拡張) → #5 (TaskDetail 遷移) → #4 (Event の Work、最重) で進める。

### Phase A: バグ修正 + 基盤統一（独立性高、先行）

- [ ] **A-1**: `#2` Heading Custom 入力 UI が表示されないバグ調査と修正
  - 仮説: `handleSubAction` で `setCustomFontSizeInput(true)` した直後に親側 `useSlashCommand` の `isOpen` が false 化して CommandPanel が unmount されている可能性。`deleteSlashText?.()` がエディタ内容を変えて `useSlashCommand` 側の `/`-存在チェックを false にしている疑い
  - 確認: ブラウザで実機再現 → React DevTools で CommandPanel の lifecycle 監視
  - 修正方針: (a) "Custom..." 選択時は `deleteSlashText` をスキップする / (b) `customFontSizeInput` state を CommandPanel ローカルから親側に持ち上げ、isOpen を制御する / (c) Custom 入力中フラグを `useSlashCommand` に伝搬し isOpen を維持する。最も小さい変更で済む方法を採用
  - 検証: `/` → `Heading 1` の `Custom...` → 数字入力フィールドが表示される / Enter で fontSize が適用される / Escape で input が閉じる

- [ ] **A-2**: `#3` `RoundedCheckbox` の API 拡充
  - `size` / `disabled` / `aria-label` を props に追加（既存 14px / 16px のサイズ可変は維持）
  - `variant` props で「タスク完了用（green）」と「フィルタ用（accent）」の色を切り替え可能に
  - Storybook / 単体テストがあれば追記、なければスキップ

- [ ] **A-3**: `#3-a` `CustomTaskItem` 拡張 + `CustomTaskItemView` NodeView 作成
  - TipTap `@tiptap/extension-task-item` を extend、`addNodeView()` で React コンポーネントを返す
  - NodeView 内で `<RoundedCheckbox checked={node.attrs.checked} onChange={...}>` + `<NodeViewContent>`
  - `updateAttributes({ checked })` で TipTap state を更新
  - `RichTextEditor.tsx` で既存 TaskItem を差し替え
  - `frontend/src/index.css` から `ul[data-type="taskList"] li > label input[type="checkbox"]` 関連ルール削除（`accent-color` / strikethrough は NodeView 側に移管）

- [ ] **A-4**: `#3-b` TaskTree の checkbox 統一
  - `TaskNodeCheckbox.tsx` の **未完了タスク**分岐で使われている `<input type="checkbox">` を `RoundedCheckbox` に置換
  - **完了タスク** (`CheckCircle2`) / **フォルダ** (`Folder` + `Chevron`) の分岐はそのまま維持（チェックボックスではないため）
  - `accentColor` CSS variable 依存箇所を削除

- [ ] **A-5**: `#3-c` Schedule (DayFlow) の checkbox 統一
  - `ScheduleItemBlock.tsx` のインライン `<button>` + `<Check>` 実装を `RoundedCheckbox` に置換
  - `w-4 h-4 rounded border` / `bg-green-500` のハードコードを削除
  - 既存 `onToggleComplete` ハンドラは温存

- [ ] **A-6**: `#3-d` Database checkbox property の表示統一
  - `CellRenderer.tsx` の `<Check>` icon + `bg-notion-accent` 実装を `RoundedCheckbox` に置換（クリックで toggle する既存挙動は維持）
  - `CellEditor.tsx` の checkbox 分岐は変更なし（null を返したまま、Renderer 側で完結）

- [ ] **A-7**: `#3` 旧 checkbox UI 残骸の grep 確認
  - `git grep -n 'taskList.*checkbox\|task-list.*checkbox' frontend/src/`
  - `git grep -n 'input type="checkbox"' frontend/src/`
  - `git grep -n 'accent-color' frontend/src/`
  - いずれも 0 件（または `RoundedCheckbox.tsx` 内部のみ）であることを確認

- [ ] **A-8**: `#3` 全箇所の動作検証
  - Note / Daily / Task のエディタで Todo 化 → RoundedCheckbox でレンダリングされ toggle 可能
  - TaskTree で未完了タスクが RoundedCheckbox で表示され、クリックで完了化
  - Schedule (DayFlow) で Event を完了 → RoundedCheckbox の状態が更新される
  - Database の checkbox property セルが RoundedCheckbox で表示される
  - IME 入力 / キーボードナビ / DnD が壊れていない

### Phase B: Bubble 内 SlashCommand（#1）

- [ ] **B-1**: `BubbleToolbar.tsx` に "Turn into" ボタン（lucide-react `Type` or `Replace`）追加
- [ ] **B-2**: クリック時に `CommandPanel` を `mode="selection"` で開く。位置は BubbleMenu の直下、座標は BubbleMenu の `referenceClientRect` から取得
- [ ] **B-3**: `CommandPanel` 側で `mode="selection"` のときの挙動を確認 — 既存実装は `cmd.check?.(editor)` で active 表示する設計なので、選択範囲を heading / taskList に変換するコマンドが動くか検証
- [ ] **B-4**: 検証
  - テキストを選択 → BubbleMenu の "Turn into" → Heading 1 / Todo / Bullet List 等が表示される
  - 項目を **キーボードかマウスでなぞって** ハイライト遷移 → クリックで変換適用
  - Custom Font Size（A-1 で修正済み）が BubbleMenu からも動く

### Phase C: TaskDetailPanel breadcrumb の画面遷移化（#5、全 ancestor 階層対応）

- [ ] **C-1**: `TaskTreeContext` に `expandToNode(id: string)` を追加
  - 引数 id の **全 ancestor chain を再帰的に expand** するヘルパー（既存 `toggleExpanded` を内部で使う or 直接 `expanded` state を更新）
  - 副作用なし（既に expand 済みなら no-op）
- [ ] **C-2**: `navigateToAncestor(ancestorId)` ハンドラ実装
  - `expandToNode(ancestorId)` + `setSelectedTaskId(ancestorId)` を一括で
  - 配置: `useTaskDetailHandlers` または `TaskSidebarContent.tsx` 内
- [ ] **C-3**: `TaskSidebarContent.tsx` の breadcrumb で **ancestor チェーン上の全ノードを Clickable に**
  - 既存実装（行53-108）は ancestor を loop で並べているため、各要素の onClick に `navigateToAncestor(ancestor.id)` をバインド
  - 既存の `setIconPickerNodeId` 呼び出しは削除（左クリック動作を完全に置き換え）
- [ ] **C-4**: IconPicker への代替動線を実装（消さない）
  - **ancestor アイコン右クリック** で `setIconPickerNodeId(ancestor.id)` を起動（contextMenu イベント）
  - もしくは hover で出る小さな "編集" 補助ボタン（lucide-react `Pencil`）
  - どちらを採るかは UI 試作で決める（右クリック優先、ボタン併用も可）
- [ ] **C-5**: 検証
  - TaskDetailPanel ヘッダーの **どの ancestor をクリックしても** TaskTree でそのフォルダが展開・選択され、右ペインが切り替わる
  - 階層が深いタスク（3 階層以上）で全 ancestor がクリッカブル
  - 右クリック（または補助ボタン）で IconPicker が引き続き起動する
  - 既存のアイコン編集機能がデグレしていない

### Phase D: Event を TaskTree 風 UI + Work 可能に（#4、最重）

- [ ] **D-1**: DB スキーマ拡張（V70）
  - `timer_sessions.event_id TEXT NULLABLE` 追加
  - `timer_sessions.task_id` は既に nullable か確認、そうでなければ nullable に変更
  - `schedule_items.actual_time_minutes INTEGER NOT NULL DEFAULT 0` 追加（Event の実績累積用）
  - `tasks.actual_time_minutes` が既存にあるか確認、命名統一
  - `v61_plus.rs` に V70 ブロックを idempotent で追加、`full_schema.rs` 反映、`LATEST_USER_VERSION = 70`
  - Cloud D1 `0008_timer_sessions_event_id.sql` 追加（`timer_sessions.event_id` + `schedule_items.actual_time_minutes`）
  - `db-migration` スキルの 3 系統（per-version / full_schema / D1）整合チェックを通す

- [ ] **D-2**: IPC 4 点同期 — Timer
  - `commands/timer.rs` に `event_id: Option<String>` 引数追加
  - `lib.rs` の `generate_handler!` は既存登録のまま（引数追加のみ）
  - `DataService.createTimerSession()` のシグネチャ拡張: `(taskId?, eventId?, ...)`
  - `TauriDataService` 実装更新

- [ ] **D-3**: IPC 4 点同期 — 実績時間 increment（新規）
  - `commands/schedule.rs`（or 該当）に `increment_schedule_item_actual_minutes(event_id, minutes)` 追加
  - `lib.rs` の `generate_handler!` に新規コマンド登録
  - `DataService.incrementScheduleItemActualMinutes(eventId, minutes)` 追加
  - `TauriDataService` 実装追加

- [ ] **D-4**: `TimerContext` に `startForEvent(eventId, title)` を追加
  - `activeSubject` を `{ kind: 'task' | 'event'; id: string; title: string } | null` に拡張
  - 既存の `startForTask` は `kind='task'` で薄いラッパに
  - Mobile Optional Provider 規約を維持（Timer Provider 自体は Mobile でも有効）

- [ ] **D-5**: `useSessionCompletionToast` で kind 分岐
  - Event の場合: 遷移先を Schedule タブに、トースト文言を「○○ に △△ 分の実績を記録しました」
  - **完了時に `incrementScheduleItemActualMinutes(eventId, sessionDurationMinutes)` を呼び出して schedule_items に書き戻し**
  - Task の場合: 既存挙動を維持

- [ ] **D-6**: `EventList.tsx` を TaskTree 風 hover アクションに改修
  - `TaskNodeActions` のアイコン構成 / hover opacity を参考に、ただし共有化はしない（Event 固有のセマンティクスが混ざる）
  - 表示: `RoundedCheckbox`(統一済) + `CalendarClock`(既存) + title + 時刻 + **`<Play>` ボタン**(右端、hover で opacity-0→100) + **`<Trash2>` ボタン**(右端、hover)
  - `<Play>` onClick → `startForEvent(event.id, event.title)`
  - `<Trash2>` onClick → 既存 `deleteScheduleItem` ハンドラ呼び出し（確認ダイアログは既存に倣う）
  - hover 表示は `group-hover:opacity-100 opacity-0 transition-opacity` パターン（TaskTree 踏襲）

- [ ] **D-7**: 検証
  - Events タブで Event の右側に hover でゴミ箱 / Play アイコンが出る
  - Play クリックで Pomodoro Timer が起動し、Event 名がタイマーに表示される
  - 完了 → `timer_sessions.event_id` に記録され、`schedule_items.actual_time_minutes` が累積される
  - 同 Event を複数回 Work すると累積される（上書きではない）
  - 既存 Task の Work が壊れていない（`timer_sessions.task_id` 経由が正常）
  - Mobile（iOS）で EventList が透明落ち / Provider null エラーしていない
  - Cloud Sync 環境（作者のみ）で実績時間が双方向同期される

## Verification（全体）

- [ ] `cd frontend && npm run test` 全パス
- [ ] `cd frontend && npx tsc -b` 型エラーなし（`tsc --noEmit` は solution-style では効かない、feedback_frontend_verification 参照）
- [ ] `cargo tauri dev` 起動 → 各機能を手動操作
- [ ] `docs/known-issues/INDEX.md` を grep して類似バグ（透明落ち / 同期欠落）に該当しないか確認
- [ ] `task-tracker` で MEMORY.md に登録、Phase ごとにコミット
- [ ] 旧 TodoList CSS / `<input type="checkbox">` の文字列検索でゼロ件確認:
  ```
  git grep -n 'taskList.*input\[type' frontend/src/
  git grep -n 'task-list.*input\[type' frontend/src/
  ```
- [ ] `session-verifier` を通してから PR

## Risks

| Risk                                                                                                | Mitigation                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TipTap TaskItem の NodeView 化で IME / DnD / Keyboard nav が壊れる                                  | StarterKit の TaskList と組み合わせる場合は extend で minimum diff、`@tiptap/react` の `ReactNodeViewRenderer` 標準パターンを踏襲             |
| Event の Work で `timer_sessions` スキーマ変更が Web 移行 Phase 5 で巻き戻る                        | 移行 SSOT に "schedule_items ↔ timer_sessions に event_id 必須" を追記して引き継ぐ（D-1 完了時に SSOT 編集）                                  |
| Bubble に CommandPanel を埋めると Selection が消える（Editor focus 喪失で BubbleMenu も閉じる）     | CommandPanel 内の onMouseDown で `e.preventDefault()` を徹底（既存実装に倣う）。BubbleMenu の `tippyOptions.hideOnClick=false` 等で持続させる |
| TaskDetail breadcrumb 遷移化で IconPicker への到達手段を失うと「アイコン変更できない」苦情          | C-4 で右クリック or hover 補助ボタンを残す。実装後にユーザーへ動線案内                                                                        |
| checkbox UI を全箇所統一する過程で、Database checkbox property の編集挙動が変わる                   | A-6 で `CellRenderer` のクリック toggle 動作を確認、必要なら `onChange` を `CellEditor` 経由に揃える。テストデータで複数行 toggle を検証      |
| `schedule_items.actual_time_minutes` 追加で Cloud Sync の VERSIONED_TABLES バージョン整合性が崩れる | D-1 で sync_engine.rs を確認、必要なら schedule_items の row version を bump させる migration を含める                                        |

## Resolved Questions（2026-05-12 ユーザー回答）

1. **#1 Bubble の "Turn into" スコープ** → **CommandPanel フル機能**（Heading / List / Code Block / Quote / Callout 等すべて）
2. **#3 checkbox UI 統一範囲** → **全て統一**: TodoList / TaskTree / Schedule (DayFlow) / Database checkbox property のすべてを `RoundedCheckbox` に統一、旧 UI コードは完全削除
3. **#4 Event Work の実績記録** → **schedule_items 側に実績時間ログを残す**。`schedule_items.actual_time_minutes` を新設、Timer 完了時に累積書き込み
4. **#5 breadcrumb 遷移範囲** → **ancestor 全階層**でクリック有効。どの階層をクリックしてもそのフォルダに遷移可能

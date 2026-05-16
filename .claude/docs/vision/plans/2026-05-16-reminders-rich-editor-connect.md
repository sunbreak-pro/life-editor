---
Status: NOT STARTED — 実装キックオフ計画
Created: 2026-05-16
Task: ①Task/Event/Routine 個別リマインダー + アプリ通知 ②RichEditor リンク/タグ UX 改善 + リンク一覧を RightSidebar へ移設 ③RichEditor 由来の Daily↔Notes Connect 不具合修正
Branch: claude/plan-reminders-editor-LzZ8E
Stack: 現行 Tauri 2 (`frontend/` + `src-tauri/`)。Web/Supabase 移行との関係は「Migration interaction」節参照
Related: CLAUDE.md §4(Data Model) / §6(Coding Standards) / §7(Workflows) / docs/vision/db-conventions.md / docs/vision/coding-principles.md
---

# Plan: リマインダー通知 + RichEditor Connect/Tag UX 改善

> 文脈ゼロから再開できる引き継ぎ計画書。3 要件を独立に着手可能なよう分割している。
> UI/UX を伴うステップは **`/frontend-react-designer` スキルを併用して設計** すること（要件 4。本計画書作成セッションの利用可能スキル一覧には未登録のため、実装セッションで利用可否を確認のこと）。

## Context

### 調査で確定した現状

#### 要件1: リマインダー（部分実装済み・配信層が欠落）

- **DB カラムは既に存在**: `full_schema.rs`（V60 相当）で `tasks`/`schedule_items`/`routines` すべてに `reminder_enabled INTEGER DEFAULT 0` / `reminder_offset INTEGER` を定義済み。3 テーブルとも `version`/`created_at`/`updated_at` を持ち sync 対象（`VERSIONED_TABLES` に全て含まれる）。Cloud D1 `0001_initial.sql` にも同カラムあり。**基本カラムの新規 migration は不要**
- **CRUD のギャップ**:
  - `routines`: `routine_commands.rs` / `services/data/routines.ts` は `reminderEnabled`/`reminderOffset` を create/update で受け渡し済み ✅
  - `tasks`: `task_commands.rs` / DataService が reminder フィールド対応済み ✅
  - `schedule_items`: **DB カラムはあるが frontend `services/data/scheduleItems.ts`（createScheduleItem/updateScheduleItem）と `src-tauri/.../schedule_item_commands.rs`/repository が reminder フィールドを通していない** ❌（要修正）
- **通知配信層が皆無**:
  - `tauri-plugin-notification = "2"` は `Cargo.toml` に依存追加済み、`capabilities/default.json`・`mobile.json` に `notification:default` 付与済みだが **コードから一度も invoke されていない**
  - Web Notification API は `Settings/NotificationSettings.tsx` / `Mobile/.../MobileNotificationsSection.tsx` で権限取得のみ実装。実際に `new Notification()` を出すのは `TimerContext.tsx`（Pomodoro 完了時）だけ
  - **スケジューラ不在**: reminder 発火時刻（対象時刻 − offset）を監視して通知を出すバックグラウンド機構が存在しない
  - reminder 設定は `reminder_commands.rs` が `app_settings` テーブルに JSON 文字列で保存（`getReminderSettings`/`setReminderSettings`）。これはグローバル設定用で、エンティティ個別のオン/オフは上記スキーマカラム側
- **MCP**: `mcp-server/.../scheduleHandlers.ts` は `reminder_enabled`/`reminder_offset` を expose 済み（配信ロジックは無し）

#### 要件2: RichEditor リンク/タグ UX

- エディタ本体: `components/shared/RichTextEditor.tsx`。TipTap 拡張 `NoteLink`(`extensions/NoteLink.ts`+`NoteLinkView.tsx`) / `WikiTag`(`extensions/WikiTag.ts`+`WikiTagView.tsx`)
- リンク挿入: `[[` で `NoteLinkSuggestionMenu.tsx`（`useNoteLinkSuggestion.ts`、`[[Note#heading#blockId|alias|embed]]` 構文対応）
- タグ挿入: `#` で `WikiTagSuggestionMenu.tsx`（`useWikiTagSync.ts` が `db_wiki_tag_upsert_for_entity` へ同期）
- **削除対象のリンク一覧フィールド**: `components/Ideas/BacklinksPane.tsx`。`NotesView.tsx:384` で `selectedNote.type === "note"` のときエディタ下部に描画（Backlinks / Unlinked Mentions の 2 タブ、`useBacklinks.ts`）。**`DailyView.tsx` には BacklinksPane が無い**（Daily の被リンクを見る UI が現状存在しない）
- 移設先: `components/Layout/RightSidebar.tsx` は現状 **空の Portal ターゲット**（`useSidebarListNavigation` のみ、下部セクション未実装）

#### 要件3: Daily↔Notes Connect 不具合（根本原因 特定済み）

- `RichTextEditor.tsx:515-524` `noteLinkSource` は `id = syncEntityId ?? taskId` を使う
- `DailyView.tsx:234-243` は `taskId={selectedDate}`（生 `YYYY-MM-DD`）かつ `syncEntityId={selectedDaily?.id}`（= `daily-YYYY-MM-DD`、§4.3 の DailyNode id）を渡す
- → Daily が存在する場合 `dailyDate = "daily-2026-05-16"` で `upsertNoteLinksForDaily` に渡り `note_links.source_memo_date` へ保存される。一方 `usePointGraphModel.ts:117` は `daily-${link.sourceMemoDate}` でノード id を再構成 → **`daily-daily-2026-05-16` の二重プレフィックスでリンクが解決不能**。Note 側は id 再構成が無いため顕在化しない（Daily 限定バグ）
- 追加: `useRoleConversion.ts:550-571` の Daily→Note 変換は content をコピーするだけで **note_links / note_connections の関連を一切作らない** → 変換で生成した Note は元 Daily へバックリンクしない（要件3 の「生成時の Connect」に該当）

### Migration interaction（重要）

CLAUDE.md 冒頭の通り Tauri → Electron/Capacitor/Web/Supabase 移行が進行中（SSOT `.claude/2026-05-04-cross-platform-migration.md`、`refactor/web-first-v2`）。本計画は **現行 Tauri スタック（`frontend/` + `src-tauri/`）に対する修正**。移行 Phase 2/3 で Notes/Schedule/Daily を `shared/` へ移植する際、本変更も追従移植が必要。Schedule 側の reminder CRUD ギャップ修正は移植前に閉じておくと二重作業を減らせる。並行チャット競合回避のため commit は **パス指定ステージ必須**（`git add -A` 禁止）。

### 制約

- 「完成までコスト $0 厳守」継続（OS 通知/Web Notification は無料、追加 SaaS 不可）
- §6.2 Provider 順序・§6.3 Pattern A・§6.4 共有配置（`notion-*` トークン / 透明背景禁止）厳守
- §7.2 IPC 4 点同期（command 追加 / lib.rs 登録 / DataService / TauriDataService）厳守
- §7.3 migration: `v61_plus.rs` 末尾追記 + `LATEST_USER_VERSION` bump + idempotent

## Steps

> 着手順序は独立性の高い順。**要件3 → 要件1 → 要件2** を推奨（要件3 は局所修正で即効果、要件2 は UI 設計を要し最大）。

### 要件3: Daily↔Notes Connect 修正（最小・先行）

- [ ] **R3-1**: `RichTextEditor.tsx` の `noteLinkSource` で `entityType === "daily"` 時に id を正規化（`daily-` プレフィックスを除去した生 `YYYY-MM-DD` を `dailyDate` に渡す）。`useWikiTagSync` 側の daily entity id 表現（V64 で `daily-` 形式へ移行済み）と整合が崩れないこと、`note_links.source_memo_date` の既存データ表現を確認のうえ「保存形式を生 date に統一」する。`usePointGraphModel.ts:117` の `daily-${sourceMemoDate}` 再構成と一致させる
- [ ] **R3-2**: 既存破損データ（`source_memo_date` に `daily-` が二重保存されたレコード）の扱いを決定 — クリーンアップ migration を入れるか、読み取り時に正規化するか（推奨: 読み取り時 + 次回 sync で上書き、$0 ＆ idempotent）
- [ ] **R3-3**: `useRoleConversion.ts:550-571` Daily→Note 変換に、生成 Note → 元 Daily の関連作成を追加（`note_links`/`note_connections` のどちらが backlink ソースか `BacklinksPane`/`useBacklinks` の参照経路に合わせる）。undo/redo の redo パスにも同じ関連作成を入れる
- [ ] **R3-4**: 検証 — Daily で `[[Note]]` を書く → Note 側 Backlinks に Daily が出る / Daily→Note 変換 → 生成 Note の Backlinks に元 Daily が出る / PointGraph で Daily↔Note エッジが描画される

### 要件1: 個別リマインダー + 通知

- [ ] **R1-1（CRUD ギャップ閉じ）**: `schedule_items` の reminder を end-to-end 開通
  - `src-tauri/.../schedule_item_commands.rs` `db_schedule_items_create`/`_update` に `reminder_enabled`/`reminder_offset` 引数追加
  - `src-tauri/.../schedule_item_repository.rs` の create/update SQL に反映
  - `frontend/src/services/data/scheduleItems.ts` `createScheduleItem`/`updateScheduleItem` に引数追加（§7.2 4 点同期、`DataService.ts`/`TauriDataService.ts` 含む）
  - `types/schedule.ts` は `reminderEnabled?`/`reminderOffset?` 定義済みのため型変更不要
- [ ] **R1-2（個別設定 UI）**: Task / Event(ScheduleItem) / Routine の各編集 UI に「リマインダー ON/OFF + offset（例: 5/10/15/30/60 分前、当日 N 時など）」コントロールを追加。**`/frontend-react-designer` で設計**。Routine は `frequencyType` 由来の発生時刻に対する offset 解釈をドキュメント化。共有 UI は `components/shared/`、`notion-*` トークン、i18n は props 経由（§6.4）
- [ ] **R1-3（スケジューラ）**: `src-tauri/src/reminder_scheduler.rs` 新規。アプリ起動時に async tick（1 分間隔目安、設定可能）。直近ウィンドウ内で「対象時刻 − reminder_offset」が到来した tasks(due)/schedule_items(date+startTime)/routines(生成インスタンス時刻) を抽出し通知。`main.rs`/`lib.rs` の setup で起動
- [ ] **R1-4（多重発火防止 — 同期しない設計を推奨）**: 発火済みを **デバイスローカルで** 管理（プロセス内 Set + ローカル永続: `app_settings` の per-device キー or 非同期対象のローカル専用テーブル）。**`reminder_fired_at` を `VERSIONED_TABLES` 同期カラムにしない**理由 = LWW で他デバイスの「未発火」が「発火済み」を上書きし、別デバイスで通知が出ない/重複する。各デバイスがローカルに発火判定するのが reminder のあるべき挙動。これにより **D1 migration 0008 / sync_engine 変更が不要**（$0・複雑度低）
- [ ] **R1-5（配信層）**: 抽象 `notify(title, body)` を 1 箇所に
  - Desktop(Tauri): `tauri-plugin-notification` を invoke（permission は capabilities 付与済み）
  - Mobile/Web: 既存 Web Notification API（`Notification.permission === 'granted'` ガード、`NotificationSettings.tsx` の権限フローを再利用）
  - フォールバック: アプリ内 Toast（既存 Toast Context）
- [ ] **R1-6**: `Settings/NotificationSettings.tsx` / `ReminderSettings` にグローバル既定 offset・通知手段選択（OS / アプリ内 / 両方）・権限再要求導線を追加（`/frontend-react-designer` 併用）
- [ ] **R1-7**: 検証 — 各エンティティで reminder 設定 → 設定時刻に Desktop OS 通知 / モバイル通知 / アプリ内 Toast が出る。アプリ再起動後も発火する。完了済み Task/過去 Event で発火しない

### 要件2: リンク/タグ UX 改善 + リンク一覧を RightSidebar へ

- [ ] **R2-1（設計）**: `/frontend-react-designer` で Connections パネルと挿入アフォーダンスを設計。決定事項: (a) リンク/タグ挿入の高速化方式（ツールバーボタン / キーボードショートカット / `[[`・`#` トリガの可視ヒント / スラッシュメニュー統合 等） (b) RightSidebar 下部 Connections パネルの情報設計（Forward links / Backlinks / Unlinked mentions / Tags の見せ方）。`notion-*` トークン・**主要コンテナ背景に透明禁止**（§6.4）
- [ ] **R2-2（移設）**: `NotesView.tsx:384` の `<BacklinksPane>` をエディタ下部から除去。RightSidebar 下部に「現在選択中アイテムの Connections」を表示する新パネル（`ConnectionsPanel`）を実装。RightSidebar は Portal ターゲットのため、選択中エンティティ（note/daily）を供給する経路（既存選択 Context or Portal source）を設計・配線
- [ ] **R2-3（Daily 対応）**: Note だけでなく **Daily 選択時も** 同パネルで被リンク/リンクを表示（現状 DailyView に Backlinks UI が無い欠落も同時に解消）。要件3 修正後にデータが正しく解決されること前提
- [ ] **R2-4（挿入 UX 実装）**: R2-1 の決定に沿ってリンク/タグ挿入を高速化（既存 `NoteLinkSuggestionMenu`/`WikiTagSuggestionMenu` を活かしつつ発見性・速度向上）
- [ ] **R2-5**: 検証 — Note/Daily 双方でリンク一覧が RightSidebar に出る / エディタ下部の旧フィールドが消えている / リンク・タグ挿入が以前より少手数。レイアウト崩れ・透明背景なし（実ブラウザ + Mobile 幅）

### 横断

- [ ] i18n: 追加文言を `frontend/src/i18n/locales/{en,ja}` 両方へ
- [ ] テスト: `cd frontend && npm run test`（影響 hook/component の単体）。Rust は `cargo test`（scheduler ロジックの純粋関数を分離してテスト可能に）
- [ ] CLAUDE.md 更新: 機能追加につき §8 Feature Tier Map に reminder/Connections 追記、変更とコード同一 PR（§0 更新規則）

## Files

| File / Dir | Op | Notes |
| --- | --- | --- |
| `frontend/src/components/shared/RichTextEditor.tsx` | Edit | R3-1 daily id 正規化（`noteLinkSource`） |
| `frontend/src/hooks/useRoleConversion.ts` | Edit | R3-3 Daily→Note 変換時の関連作成（undo/redo 含む） |
| `frontend/src/services/data/notes.ts` / `useNoteLinkSync.ts` | Edit | R3 保存形式統一・読み取り正規化 |
| `frontend/src/services/data/scheduleItems.ts` | Edit | R1-1 reminder 引数追加 |
| `frontend/src/services/{DataService.ts,TauriDataService.ts}` | Edit | R1-1 §7.2 4 点同期 |
| `src-tauri/src/commands/schedule_item_commands.rs` | Edit | R1-1 reminder 引数 |
| `src-tauri/src/db/schedule_item_repository.rs` | Edit | R1-1 SQL 反映 |
| `src-tauri/src/reminder_scheduler.rs` | Add | R1-3 バックグラウンド tick |
| `src-tauri/src/{main.rs,lib.rs}` | Edit | R1-3 scheduler 起動・command 登録 |
| `src-tauri/src/commands/notification_commands.rs`（or 既存に追加） | Add/Edit | R1-5 `tauri-plugin-notification` invoke ラッパ |
| `frontend/src/components/.../{Task,ScheduleItem,Routine}` 編集 UI | Edit | R1-2 個別 reminder コントロール |
| `frontend/src/components/Settings/NotificationSettings.tsx` | Edit | R1-6 既定 offset/手段選択 |
| `frontend/src/components/Layout/RightSidebar.tsx` | Edit | R2-2 下部 Connections セクション |
| `frontend/src/components/Ideas/ConnectionsPanel.tsx`（新） | Add | R2-2 移設先パネル |
| `frontend/src/components/Ideas/NotesView.tsx` | Edit | R2-2 BacklinksPane 除去 |
| `frontend/src/components/Ideas/BacklinksPane.tsx` | Edit/Move | ロジックを ConnectionsPanel へ再利用、不要なら削除 |
| `frontend/src/i18n/locales/{en,ja}/*` | Edit | 文言追加 |
| `.claude/CLAUDE.md` | Edit | §8 追記（同一 PR） |
| D1 `cloud/db/migrations/*` / `sync_engine.rs` | 不変更 | R1-4 設計により reminder 同期カラム不要（変更しない判断） |

## Verification（完了判定）

- [ ] 要件3: Daily の `[[Note]]` と Daily→Note 変換が双方向 backlink を生成、PointGraph に Daily↔Note エッジ表示、二重 `daily-` データ無し
- [ ] 要件1: Task/Event/Routine 個別に reminder 設定可能、設定時刻に Desktop=OS 通知 / Mobile=通知 / フォールバック=Toast、再起動後も発火、完了/過去項目は非発火、`schedule_items` reminder が永続化
- [ ] 要件2: リンク一覧がエディタ下部から消え RightSidebar 下部に Note/Daily 両対応で表示、リンク/タグ挿入が高速化、透明背景なし・レイアウト崩れなし
- [ ] `frontend` `npm run test` green / `cargo test` green / 実ブラウザ（PC + Mobile 幅）動作確認
- [ ] §7.2 4 点同期・§6.2/§6.3/§6.4 規約遵守、CLAUDE.md §8 反映

## 再開手順（次セッション最初の一手）

1. 本計画書 + CLAUDE.md §4/§6/§7 を読む
2. `git log --oneline -5` で着手済みステップを把握、`git status`（パス指定ステージ運用）
3. 要件3 から着手推奨（局所・低リスク）。`RichTextEditor.tsx:515` / `DailyView.tsx:234` / `usePointGraphModel.ts:117` を再確認し R3-1 を実装→`npm run test`
4. UI ステップ着手時は `/frontend-react-designer` スキルの利用可否を確認（未登録なら手動で設計指針を本計画 R2-1/R1-2 に沿って適用）
5. 要件1 のスケジューラは純粋関数（発火判定）を切り出して `cargo test` 可能にしてから配線

# HISTORY-archive.md - 変更履歴アーカイブ

---

### 2026-04-20 - Cloud Sync ブロッカー 3 件解消 + iOS 署名検証 + Notes Mobile 空表示の根本原因特定

#### 概要

iOS を 4G 環境でリモート同期させるための下準備として、Known Issues 004（`sync_last_synced_at` 未保存）/ 005（`tasks.updated_at` NULL）/ 008（routine-group-calendar tag_assignments が delta sync に乗らない）の 3 件を解消。既存 `.ipa` を codesign で検証し署名状態が健康（Bundle ID `com.lifeEditor.app.newlife` / Team `542QHWHN37` / Provisioning Profile 期限 2026/04/25）であることを確認、再生成不要と判定。並行して Notes の Mobile 詳細タップ時に本文が空になる症状の根本原因を特定（診断のみ、修正は次セッションへ）。cargo test 10 pass / Vitest 227 pass / tsc 0 / eslint clean。

#### 変更点

- **Known Issue 004 修正（防御ガード）**: `src-tauri/src/commands/sync_commands.rs` の `sync_trigger` read path に `.filter(|s| !s.is_empty())` を挟み空文字列を 1970 fallback 扱いに、`sync_trigger` と `sync_full_download` の write path に `if !remote.timestamp.is_empty()` ガードを追加。Cloud Workers は常に ISO timestamp を返すため実害は低いが、Workers 側に異常があっても `sync_last_synced_at` が空文字列で汚染されて `since=""` が全件マッチする事故を防ぐ
- **Known Issue 005 修正（V62 migration）**: `src-tauri/src/db/migrations.rs` に V62 ブロックを追加 — 10 versioned テーブル（tasks / memos / notes / schedule_items / routines / wiki_tags / time_memos / calendars / templates / routine_groups）の NULL `updated_at` を `strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')` で backfill + `tasks_updated_at_insert` トリガー（`AFTER INSERT ON tasks FOR EACH ROW WHEN NEW.updated_at IS NULL`）で INSERT 時の自動補完を保証
- **Migration runner 修正**: Fresh DB が `create_full_schema` → `user_version = 61` で early return して V62+ がスキップされる問題を発見 → `if current_version < 1` ブロックで `start_version = 61` として `run_incremental_migrations(conn, 61)` に合流する構造に変更。これで fresh DB でもトリガー・backfill が確実に適用される
- **Migration テスト追加**: `v62_migration_is_idempotent` / `v62_backfills_null_updated_at_and_installs_trigger`（NULL updated*at の task を 2 件 INSERT → migration で backfill + INSERT トリガーの動作検証）を追加、既存 `fresh_db_reaches_v61*_`を`fresh*db_reaches_latest*_`にリネームして期待値を 62 に更新、他 3 件の期待値も 61 → 62 に修正。cargo test`--lib db::migrations` 6 件 pass
- **Known Issue 008 修正（delta sync 親 bump）**: 3 箇所の `set_tags_for_*` 関数に親エンティティの `updated_at + version` bump を追加
  - `src-tauri/src/db/routine_tag_repository.rs::set_tags_for_routine` → `UPDATE routines SET updated_at = datetime('now'), version = version + 1`
  - `src-tauri/src/db/routine_group_repository.rs::set_tags_for_group` → `UPDATE routine_groups SET ...`
  - `src-tauri/src/db/calendar_tag_repository.rs::set_tags_for_schedule_item` → `UPDATE schedule_items SET ...`
  - これで sync_engine の delta query `WHERE r.updated_at > ?1` / `WHERE rg.updated_at > ?1` / `WHERE si.updated_at > ?1` がタグ付け替えを検知できるようになる
- **Known Issue 008 修正（fail-safe フィルタ緩和）**: `frontend/src/utils/routineScheduleSync.ts::shouldCreateRoutineItem` からタグ必須条件（`if (!routineTagIds || routineTagIds.length === 0) return false`）を削除。これまではタグ 0 件の routine を「削除対象」と判定し `ensureRoutineItemsForDateRange` が未来の schedule_items を消していたが、この過敏な挙動を止めてタグフィルタは表示層のみで行う設計に変更。引数 `tagAssignments` は call-site 互換のため `_tagAssignments` として残置
- **Known Issue 008 新規起票**: `.claude/docs/known-issues/008-routine-tag-assignments-delta-sync-invisible.md` を作成。症状（Desktop DB で `routine_tag_assignments` 0 件 / `routine_group_tag_assignments` 0 件 / 今日の routine schedule_items 0 件）、Root Cause（relation テーブルの delta sync が親 updated_at に依存するが親を bump していなかった）、Fix（3 箇所の bump + フィルタ緩和）、Lessons Learned（「relation + 親依存」は delta sync で壊れやすい、書き込み判定は読み取り判定より保守的に）を記録
- **Known Issue 004 / 005 Fixed 化**: INDEX.md の Active 2 件を Fixed に移動し Resolved 日付 2026-04-20 を付与、Status 集計を Active:0 / Fixed:7 に更新。Category 別索引に `Sync: 008` を追加
- **Vision ドキュメント更新**: `.claude/docs/vision/ios-everywhere-sync.md` §同期設計の「ブロッカー」記述を「2026-04-20 に解消」へ書き換え、CLAUDE.md §4.1 の DB 現行 version を v60 → v62 に更新（V62 要約を 1 行追加）
- **Notes Mobile 空表示の根本原因特定（診断のみ）**: DB の `notes.content` を直接観測して Desktop 保存データに `callout` / カスタム `heading` attrs (`backgroundColor`, `fontSize`) / カスタム `paragraph` attrs (`backgroundColor`) / `toggle*` 等のカスタム node が含まれることを確認。`MobileRichEditor` は StarterKit + Placeholder のみで、Desktop の `CustomHeading` / `BlockBackground` / `Callout` / `ToggleList` / `WikiTag` / `NoteLink` / `DatabaseBlock` / `PdfAttachment` / `ResizableImage` / `Table*` / `TaskList*` / `TextStyle` / `Color` / `Highlight` / `Link` を持たない → ProseMirror の schema 解釈で未知 node に遭遇し document 全体を空の `{type:"doc", content:[]}` に fallback。list preview が見えるのは `extractPlainText` が schema を介さず JSON を walk するため。修正案 A（全拡張 import） / 案 B（read-only fallback） / 案 C（軽量拡張のみ追加）は次セッションで決定
- **Routine Desktop 非表示の根本原因特定 + 修正**: DB 観測で Desktop の `routine_tag_assignments` が 0 件 / 今日の routine schedule_items が 0 件（将来 164 件は月グリッド範囲外で残存）と判明。バグの連鎖: (1) `set_tags_for_routine` が親 updated_at を bump しない → (2) sync の delta query が拾えない → (3) Desktop の tagAssignments 空 → (4) `shouldCreateRoutineItem` が false → (5) `ensureRoutineItemsForDateRange` が未来の schedule_items を削除 → (6) `MiniTodayFlow` が `if (!scheduleItem) continue;` で routine 自体を非表示化。iOS で見えていたのは Mobile UI が `shouldCreateRoutineItem` フィルタを通さず `ensureRoutineItemsForDateRange` の削除も走らないため
- **iOS Xcode 署名状態の検証**: 既存 `src-tauri/gen/apple/build/life-editor_iOS.xcarchive/Products/Applications/Life Editor.app` に対して `codesign -dvv` を実行、Bundle ID / Team ID / 証明書（`Apple Development: 2201akonayu@gmail.com (FVMH4L98Q3)` 有効期限 2027/04/18） / Provisioning Profile（`5ee1134c-...` 有効期限 2026/04/25、`~/Library/Developer/Xcode/UserData/Provisioning Profiles/` にインストール済み） が `project.yml` / `tauri.conf.json` と完全一致することを確認。Bundle ID は 1 回しか登録しておらず 10 App ID/7 日枠の消費ゼロ、Known Issue 007 対策の `DEVELOPMENT_TEAM` / `CODE_SIGN_STYLE` も既に project.yml 内に記入済みのため XcodeGen 再生成も安全。再署名までの残日数 5 日、本週中に 4G 検証を完了する方針
- **残タスク**: (a) アプリ再起動して V62 migration を実 DB に適用 → `PRAGMA user_version` が 62 / `tasks_updated_at_insert` トリガー存在の確認、(b) iOS で Full Re-sync → Cloud にタグ情報を押し戻す → Desktop で Full Re-sync して `routine_tag_assignments` を復元、(c) Wi-Fi で Desktop ↔ iOS の双方向 sync 検証、(d) 4G に切り替えて再検証、(e) Notes Mobile 空表示の修正方針決定 + 実装
- **検証**: `cargo check` 0 / `cargo test --lib` 10 pass / `cd frontend && npx vitest run` 227 pass / `npx tsc --noEmit` 0

---

### 2026-04-19 - Tipsパネル再設計 + Terminalセクション化 + LeftSidebar コンパクト化（計画書: 外部 `~/.claude/plans/leftsidebar-font-size-2px-rosy-beaver.md`）

#### 概要

Tips を「画面下部固定 / セクション 4 件のみ」から「LeftSidebar 下部のトグルボタン + 中央エリア下部の半透明オーバーレイ + サブカテゴリタブで多数件を縦スクロール表示」に刷新。Terminal は dock/resize/minimize を全削除し、TitleBar のターミナルアイコン (Undo/Redo の左隣) と `Cmd/Ctrl+J` で開閉する全画面セクション化。LeftSidebar は font-size 16px 固定 + padding/space を縮小してコンパクト化。Tips 内容は実装を 3 並列 Explore エージェントで調査して未実装機能の記述を削除し、内部用語を「右サイドバー」「鉛筆アイコン」「▶ ボタン」など分かりやすい言葉に統一。Analytics 専用 Tips も追加。en/ja 同期 (382 keys 各)、tsc / eslint（本セッション範囲）クリーン、Vitest 227 pass。

#### 変更点

- **Tips パネル UI 刷新**: `components/shared/TipsPanel.tsx` を全面書き換え。`isOpen` / `onClose` props で親制御化、`absolute inset-x-0 bottom-0 max-h-[55vh]` で中央エリア内の下部オーバーレイ配置（LeftSidebar / RightSidebar に被らない）、`bg-notion-bg-secondary/70 backdrop-blur-sm` で半透明（カード/ヘッダは不透明）、ヘッダ部にサブカテゴリタブ（横スクロール対応）+ 1 カラム縦スクロールリスト。`useLocalStorage(STORAGE_KEYS.TIPS_TAB_PREFIX + section)` でセクション別にアクティブタブを永続化
- **Tips データ構造**: `types/tips.ts` に `TipsTabDefinition` 追加（`{ id, labelKey, icon, tips: TipDefinition[] }`）。`TipsSectionId` を `schedule | work | materials | connect | terminal | analytics` の 6 セクションに拡張。`config/sectionTips.ts` を新規作成して 6 セクション × 4 タブ × 6〜10 件の Tips を `makeTip(section, tab, item, icon)` ヘルパで定義（合計 174 Tips）
- **Tips コンテンツ正確化**: 3 並列 Explore エージェントで Schedule/Materials/Connect/Work/Analytics/Terminal の実装を調査し、未実装機能の記述を削除 — Calendar 日ビュー / 月表示ドラッグ / Calendar 右クリック追加 / Calendar タグフィルタ / ルーティンスキップ / DayFlow 完了非表示 / DayFlow 複数選択編集 / Stats タブ（→ 右サイドバー Achievement パネル）/ ヒートマップ画面 / 週比較 / Materials ホバープレビュー / 壊れたリンク警告 / Connect タグ統合 / 音源リンク / ルーティンリンク / Backlink リンク昇格 / ビュー保存 / プリセットフィルタ / Work お気に入りピン / プリセット保存 / 環境音 6 種ミキサー / ヘッドホンモード / 休憩中ミュート / Terminal Cmd+F 検索 / Cmd+K クリア / CSV エクスポート（予定）。代わりに実装通りの操作（カレンダー日付の Repeat アイコン → ルーティン管理 / 右サイドバー Achievement の + ボタン / Day Flow Today ボタン / + Add Custom Sound / Sound Tags 等）に置換。内部用語（WikiTag / DayFlow 等）は「タグ」「Day Flow タブ」のように整理し、操作場所を明示（右サイドバー / Undo/Redo の左隣 / 鉛筆アイコン 等）
- **Analytics 専用 Tips 追加**: 4 タブ（Overview / Tasks / Time / Knowledge）× 各 6〜7 件。Today ダッシュボード / 期間セレクタ（右サイドバー） / 日付プリセット / 週次サマリ / Streak / 6 タブ切替 / 完了トレンド / 停滞チャート / 作業ヒートマップ / ポモドーロ達成率 / メモヒートマップ / タグ使用頻度 等を実装に沿って記述
- **Terminal セクション化**: `types/taskTree.ts` の `SectionId` に `"terminal"` 追加。`components/Terminal/TerminalSection.tsx` 新規（既存 `useTerminalLayout` / `SplitLayout` / `TerminalTabBar` を再利用、dock/resize/minimize 関連 prop を全削除した薄いラッパー）。`components/Terminal/TerminalPanel.tsx` を削除。`Layout.tsx` で TerminalSection を中央エリアに永続マウントし、`activeSection === "terminal"` のとき `display:flex` / それ以外 `display:none` で表示切替（PTY セッションを保持）
- **TitleBar Claude起動ボタン**: `components/Layout/TitleBar.tsx` に Undo/Redo の左隣に Terminal アイコンボタンを追加。クリックで `activeSection` を `"terminal"` に切替 + `launchClaude()` 実行。`SECTION_UNDO_DOMAINS` には `terminal` を未追加（Undo 対象外）
- **LeftSidebar Tips ボタン**: `LeftSidebar.tsx` / `CollapsedSidebar.tsx` の旧 [Claude 起動] 位置に [Tips] ボタン（Lightbulb アイコン）を配置 → `onToggleTips` で Tips オーバーレイをトグル。Layout から `tipsOpen` state（`useLocalStorage(STORAGE_KEYS.TIPS_OPEN)`）を渡してアクティブ表示
- **LeftSidebar コンパクト化**: 全メニューボタンを `style={{ fontSize: 16, lineHeight: 1.25 }}` に固定（旧 `text-scaling-sm` から脱却）、`py-2` → `py-1.5`、`space-y-1` → `space-y-0.5`、`p-3` → `p-2`、Timer ミニ表示の padding/フォントも同調縮小。アイコンは 18px 維持
- **Storage Keys 整理**: `TERMINAL_OPEN` / `TERMINAL_HEIGHT` / `TERMINAL_DOCK` / `TERMINAL_WIDTH` / `TIPS_COLLAPSED` を削除。`TIPS_OPEN` / `TIPS_TAB_PREFIX` を追加
- **Layout 統合**: dock 関連 state / 分岐ロジックを全削除して中央エリア構造を `flex-col` に単純化。`launchClaude` の実装を「セクション切替 + Claude コマンド送信」に簡素化（旧: terminal 開閉 + Claude 起動）。`view:toggle-terminal` キーボードショートカットを `activeSection` 切替ベースに変更（previousSectionRef で復元先を記憶）
- **App.tsx**: `terminalCommandRef` を Layout に渡すよう更新、`renderContent()` の switch に `case "terminal": return null` 追加（実体は Layout 内に永続マウント）
- **i18n**: en/ja 両方で `tips.*` ブロックを完全置換（370 参照キー、382 公開キー、両言語完全一致）。`sidebar.tipsButton`, `sidebar.launchClaude` 維持。jq でマージして JSON 整合性を確認
- **検証**: `tsc --noEmit -p tsconfig.app.json`（本セッション範囲エラーなし、pre-existing 2 件は IdeasView / MobileRichEditor）/ `npm run lint`（本セッション範囲エラーなし）/ `vitest run` 27 → 28 ファイル、222 → 227 pass

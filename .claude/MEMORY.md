# MEMORY.md - タスクトラッカー

## 進行中

### 🔧 クロスプラットフォーム移行 Phase 0 Day 1-3 — Vite + React + TS + Tailwind 基礎（着手日: 2026-04-29）

**対象**: `~/dev/learning/applications/life-editor-web-first/day-01-03-vite-react-ts-tailwind/`（教材） + `~/dev/learning/applications/_spikes/web-first-spike-1/`（実プロジェクト、別 git repo）
**計画書**: `.claude/2026-05-04-cross-platform-migration.md`（Phase 0 セクション、SSOT）。旧 `.claude/2026-04-29-web-first-migration.md` は archive 済（後継プランで Electron 章追加）

- 前回: —
- 現在: Day 1 ハンズオン途中。Vite + React + TS scaffolding は完了、Tailwind wiring が抜けていることを確認（`spike-1/package.json` に `tailwindcss` + `@tailwindcss/vite` 未登録 / `vite.config.ts` に `tailwindcss()` plugin 未追加 / `src/index.css` に `@import "tailwindcss";` 未追加）。原因は最初の `@teilwindcss` タイポ後、リカバリ時に親ディレクトリ `~/dev/learning/` で `npm install` 実行してしまい、Tailwind が `~/dev/learning/node_modules/` に入った（spike-1 ではない）。`~/dev/learning/.gitignore` で迷子の `package.json` / `package-lock.json` / `node_modules/` を除外済
- 次: spike-1 で正しく `npm install -D tailwindcss @tailwindcss/vite` → `vite.config.ts` 編集 → `index.css` 編集 → ブラウザで濃いグレー背景 + 白い太字 "Hello, Tailwind" 確認 → Q1/Q2 (dev vs build / TS の実行モデル) は正解済 → Day 2 教材 `day-02-counter-and-forms.md` 既作成（useState + controlled component + IME 対応）

## 直近の完了

- Calendar 表示整合性 A+B（useCalendar isDeleted filter + Progress 月単位集計）✅（2026-05-13）— ユーザー報告「DB から消したのに Task/Event/Routine が Calendar に残る + Task が見えているのに RightSidebar が 0/0 表示」の根因 2 軸を修正。**(A) `useCalendar.ts` の `tasksByDate` filter に `!n.isDeleted` を incomplete/completed 両分岐に追加** — soft-delete 後も Calendar に表示され続けるバグ。`ScheduleSection.allTasksByDate` は既に isDeleted を除外していたため Calendar 表示とサイドバー集計が食い違っていた。`useCalendar.test.ts` に 2 ケース追加 (合計 18 tests pass)。**(B) `ScheduleSection::calendarCategoryProgress` を月単位集計に再設計** — Calendar (月表示) と Progress (旧: 日表示) の temporal scope ズレ解消。`monthlyScheduleItems` + month-wide `allTasksByDate` + 月内 `dailies`/`notes` を集計。Calendar tab active 時に `loadScheduleItemsForMonth(year, month)` を発火 (旧 `loadItemsForDate(calendarProgressDateKey)` を撤去)。**ProgressSection / DayFlowSidebarContent に `scope?: "day" | "month"` prop 追加** — Calendar 経由は `"month"` (label = `YYYY/M`)、DayFlow 経由は `"day"` (label = `M/D`、現状維持)。session-verifier 6 ゲート PASS (tsc -b 0 / eslint 0 / vitest 60 pass / coverage +2 / structural OK / bug scan OK)。計画書: `.claude/docs/vision/plans/2026-05-12-calendar-display-integrity.md` (Status: A+B 完了 / C = Routine 一括削除導線は role-engineer worktree で並行進行中、`.claude/worktrees/agent-a4355e07a4a31d835`)。スコープ外の前セッション置き土産 `src-tauri/src/commands/data_io_commands.rs` (+449 行) は当コミット対象外。並行で C worktree が独自実装中のため、完了後に worktree 側の data_io_commands.rs と main 側の置き土産の衝突解決が残課題
- ad-hoc メンテナンス: Calendar DB ワイプ + statusLine UI 拡張 ✅（2026-05-12）— `~/Library/Application Support/life-editor/life-editor.db` (user_version=69) で `schedule_items` 全 1030 件 (active 342 / soft-deleted 688) + `calendar_tag_definitions` 1 件 + `calendar_tag_assignments`/`calendars` を `BEGIN; DELETE; COMMIT; VACUUM;` で hard delete (バックアップ `life-editor-pre-calendar-wipe-20260512-214035.db` 取得済 / 1.4MB)。`~/.claude/statusline-command.sh` を model 表示削除 + Git ブランチ `<name>[*]` (`git status --porcelain | head -1` で dirty 早期判定) + session cost `$%.2f` + MEMORY.md `## 進行中` 直下の最初の H3 タスク名を `awk` 抽出 → `perl -CSD substr` で 40 文字 multibyte 安全切り出し、graceful fallback 付きに改修。dummy JSON 3 ケース (フル / 最小 / 非 git) で動作確認済。**Mobile vs Desktop 設計方針メモは CLAUDE.md §2 Platform に追記した直後に working tree から消失** (並行チャットまたはリンターによる巻き戻しを推定) → CLAUDE.md は 400 行以下目標 + 「新機能は §8 + docs/requirements/」が原則のため §2 直接追記は不適切、`docs/vision/` 配下の独立ファイル化が筋と再評価し予定タスク先頭に再投入。コード/設定変更はすべて life-editor の git repo 外 (`~/.claude/` global config + SQLite ファイル) のため commit は MEMORY.md + HISTORY.md + HISTORY-archive.md (並行チャット作業含む) のみ
- Global git skill / agent 整備 ✅（2026-05-12）— ユーザー要望「ブランチ管理 / push / merge / conflict 対応がめんどくさい、git 操作専用 agent + skills (task-tracker と連携) を global で作る」を受けて Web 調査一次ソース 13 件（Conventional Commits 公式 / Pro Git Book §3.6+§7.9 / GitHub Docs 4 件 / DORA / Trunk Based Development 公式 / Atlassian / Claude Code Hooks Guide / Claude Code 破壊的コマンド対策実装例）から原則抽出 → AskUserQuestion で 4 観点（自動化レベル / tracker 連携 / ブランチ戦略 / conflict 対応）確定 → skill 3 + agent 1 実装。**(1) `~/dev/Claude/skill-lib/global/git-workflow/SKILL.md` 既存更新**: SSOT 専用に再設計（Conventional Commits 完全版 type 表 / Breaking Change 2 方式 / Co-Authored-By 必須 / 破壊的コマンド 3 段階分類 = 完全ブロック / 確認必須 / 自動可 / 推奨グローバル設定 rerere+zdiff3+pull.rebase）。**(2) `~/dev/Claude/skill-lib/global/git-branch-flow/SKILL.md` 新規**: GitHub Flow + 命名規則 (feat/fix/chore/docs/refactor/hotfix/test) + branch 作成 + main 取り込み rebase vs merge + PR 作成 heredoc + merge/rebase/squash 判断フローチャート（個人開発デフォルト=squash） + AI は main 直 commit しない原則。**(3) `~/dev/Claude/skill-lib/global/git-conflict-resolver/SKILL.md` 新規**: 5 種別判定 (logic / lockfile / generated / formatting / rename) + 両側意図解析 + zdiff3 マーカー読み方 + lockfile 安全解決 npm/yarn/pnpm/cargo の `--theirs` + 再生成 + 中断手順 (merge/rebase --abort) + rerere。自動編集はしない、ユーザー確認後のみ。**(4) `~/dev/Claude/agents-lib/global/git-orchestrator.md` 新規** (model:opus / effort:xhigh / tools:Read+Glob+Grep+Bash+Skill): 状況判断（branch / dirty / 上流差分 / 既存 PR）+ 戦略決定 + skill 委譲。標準モード = commit+push 自動 / PR・merge・rebase 確認 / `--force` 完全ブロック / `--force-with-lease` 確認後 / 保護 ref への force 完全ブロック / conflict 提案のみ。task-tracker END 連携モード = 計画書アーカイブ後 PR 作成補完で「commit+push (tracker) + PR (orchestrator)」一気通貫。main 直作業の自動 branch 切替提案。commit メッセージ自動生成。multi-session-coordinator とは役割分離（あちらは並行チャット監視、こちらは git 戦略）。**(5) シンボリックリンク**: `~/.claude/skills/{git-branch-flow,git-conflict-resolver}` + `~/.claude/agents/git-orchestrator.md` を一元管理 (skill-lib/agents-lib) から張替え。SKILL_INDEX (11→13 active) + AGENT_INDEX (8→9 active) 更新。グローバル `~/dev/Claude/` は git 管理外のため life-editor リポジトリには `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルのみ commit

## 予定

> **注**: 以下の予定タスクの大半は旧 Tauri / Cloudflare アーキテクチャ前提で書かれており、Web ファースト移行（refactor/web-first-v2）の進行に伴って **deprecated** になる可能性が高い。各タスクの存続判断は移行 Phase 1-2 進行時に再評価する。

### Mobile vs Desktop 設計方針の docs/vision/ への明文化

**対象**: 新規 `.claude/docs/vision/mobile-design.md`（仮名）
**背景**: 2026-05-12 セッションで CLAUDE.md §2 Platform に直接追記したが working tree から消失（並行チャットまたはリンターによる巻き戻しを推定）。CLAUDE.md は 400 行以下目標 + 「新機能は §8 + docs/requirements/」が原則のため §2 直接追記は不適切、`docs/vision/` 配下の独立ファイル化が筋。本セッションで取りまとめた内容:

- Desktop = クリエイティブ重視、Mobile = コンパクト重視
- Mobile 必須セクションは Schedule (予定/タスク/ルーティン) / Work (標準ミュージックのみ、カスタム音源追加は Mobile では非対応) / Notes (デイリー/ノート) / Settings の 4 つだけ
- Mobile は Desktop の縮小コピーではなく専用に再設計
- スラッシュコマンド・タグ付けは Mobile でも 1〜2 タップで到達できるよう設計

**手順**: `mobile-design.md` 新規作成 → CLAUDE.md §2 末尾に 1 行リンク追加 → `2026-05-04-cross-platform-migration.md` と相互リンク。並行チャットとの衝突回避のため、編集前に `.claude/comm/outbox/` で予告するか multi-session-coordinator でロック取得を検討

### ユーザー並行作業の TS エラー解消（別コミット）

**対象**: `App.tsx` / `CommandPalette.tsx` / `Schedule/ScheduleSection.tsx` / `Settings.tsx` / `Ideas/{Connect,Paper,Daily,Materials}Sidebar.tsx` / `useAppCommands.ts` / `useSectionCommands.ts` / 新規 `SearchTrigger.tsx` / `lucideIconRegistry.ts`
**背景**: 本セッションの Routine Tag→Group 移行とは独立して進行している検索トリガー refactor 由来の TS エラー: `sidebarSearchQuery is not defined` (ScheduleSection.tsx) / TS6133 unused vars 多数 / `searchPlaceholder` props 不整合
**手順**: 検索トリガーの refactor を一旦完成させ tsc -b clean に戻す → コミット

### Q2 機能パッチ Phase D / Phase A Cloud Sync の手動 UI 検証

**対象**: macOS app launch / 既定ブラウザ選択 / iOS Drawer 表示 / 双方向同期の動作確認
**前提**: D1 migration 0003/0004/0005/0006 全適用済 + Worker latest deploy 済 (2026-04-25 完了)
**手順**:

1. Desktop で Sync Now 実走 → `Last error` が消えて Connected 表示が維持されることを確認
2. Desktop V67 自動 apply 確認 → LeftSidebar に「Links」セクション表示 / `+` で URL/App リンク追加 / 既定ブラウザ切替で URL 起動先が変わる / `/Applications/*.app` 一覧から登録できる
3. iOS シミュレータ Drawer に `kind='app'` がグレーアウト + Toast 出ることを確認
4. Desktop ↔ iOS 双方向 sync で sidebar_links と calendar_tag_assignments が伝搬すること
5. **Known Issue 016 検討**: D1 0004 が transactional rollback 保証下にも関わらず `calendar_tag_assignments` rebuild 部分のみ未適用となった原因の調査・記録 (`docs/known-issues/_TEMPLATE.md` から起票)

### リファクタリング Phase 2-4 / 3-1 / 3-4 検証用実装計画の手動実施

**対象**: Desktop / iOS 実機での UI 回帰検証 + Cloud Sync round-trip
**計画書**: `.claude/2026-04-26-refactoring-verification-plan.md` (Status: AUTOMATED COMPLETE / MANUAL PENDING)
**前提**: 自動検証 (S-1 Rust build/test / S-7 calendarGrid 境界ケース 20/20 / S-8 fetch_tree benchmark 100ms 基準内 / S-9 plan ファイル反映) は 2026-04-26 完遂済。残るは手動 UI / Cloud Sync / docs 整理のみ
**手順**:

1. **S-2 IPC 統合**: Desktop 起動 → Tasks / Notes / Dailies / Schedule / Routines / Database / Wiki Tags / Paper Boards / Sound / Templates / Sidebar Links 全 11 ドメインの fetch 経路でエラー無し
2. **S-3 Cloud Sync round-trip**: 5 ドメイン変更 → push → 別端末 pull → 完走 + 5000 行超で `nextSince` cursor 進行確認
3. **S-4 Calendar Mobile**: Monday 始まり / 月遷移スワイプ / chip 表示 / Today ハイライト / 月境界 item
4. **S-5 Calendar Desktop**: Sunday 始まり / 6 行固定 / WeeklyTimeGrid / DayCell 描画 / Routine ハイライト
5. **S-6 Schedule View**: MobileScheduleView 週 dots / 週遷移 (`getMondayOf` 基準) / 月跨ぎラベル / Desktop ScheduleSection 4 タブ / DualColumn toggle
6. **S-9 docs 整理 (UI 検証完了後)**: `docs/known-issues/INDEX.md` で formatter / SQL whitelist / row_to_model 重複 を削除候補マーク / `docs/code-inventory.md` の Active/Duplicate セクション更新

### Realtime Sync Phase 1 実装 — foreground 可変 polling + 変更イベント駆動 push

**対象**: `frontend/src/context/SyncContext.tsx` / DataService mutation 呼出層
**背景**: 現状 30 秒間隔 polling で往復 60 秒ラグ。「DB 共有の実感」が薄い
**手順**: Visibility API 観測 → フォアグラウンド 3-5s / 非アクティブ 60s、主要 mutation 後に debounced `triggerSync()`
**参照**: `.claude/docs/vision/realtime-sync.md` Phase 1

### Mobile Settings に Full Re-sync ボタン追加

**対象**: `frontend/src/components/Mobile/MobileSettingsView.tsx::MobileSyncSection` (line 159-183)
**背景**: Desktop `SyncSettings.tsx` には `fullDownload` ボタンがあるが Mobile 側は `triggerSync` + `disconnect` の 2 ボタンのみ。初回 pull が truncate した時に「Disconnect → Reconnect」の 3 手順が必要で UX が悪い

### Desktop パッケージ版の更新

**対象**: `/Applications/Life Editor.app`
**背景**: 現在の /Applications 配下は session 前の Rust バイナリ(V63 migration / create() guard / sync_engine 特別扱いを含まない)。V63 は DB に既適用済なので実害は限定的だが、新規 Routine 作成時の (routine_id, date) UNIQUE 違反を graceful に握りつぶす guard が無い
**手順**: `cargo tauri build` → `target/release/bundle/macos/Life Editor.app` を `/Applications/` 既存と置換

### 旧バンドル DB の orphan クリーンアップ

**対象**:

- `~/Library/Application Support/com.lifeEditor.app/life-editor.db` (user_version=59、旧 routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments を保持)
- `~/Library/Application Support/sonic-flow/life-editor.db` (user_version=0、空)

**背景**: bundle ID 変遷（旧 `sonic-flow` → `com.lifeEditor.app` → 現行 `com.lifeEditor.app.newlife`）の遺産。Known Issue 006 関連。現在の app は `~/Library/Application Support/life-editor/life-editor.db` (user_version=69) を使うため上記 2 つは orphan。実害はないが (a) ストレージを浪費 / (b) 検証時に grep で誤って旧 DB を引いて混乱する（実際 2026-04-29 の Routine Tag 廃止検証の際に発生）
**前提**: 削除前に rescue 価値のあるデータが無いことを確認。`sonic-flow/sonic-flow.db` は別プロジェクト(Sonic Flow アプリ本体)なので残す
**手順**:

1. `sqlite3 <旧 DB path> "SELECT COUNT(*) FROM routines WHERE is_deleted=0; SELECT COUNT(*) FROM tasks WHERE is_deleted=0; SELECT COUNT(*) FROM notes WHERE is_deleted=0"` で各テーブル行数を確認
2. 行があれば `~/Backups/orphan-life-editor-<bundle_id>-$(date +%Y%m%d).db` に退避（rsync ではなく `cp` で WAL 含めず単一ファイル退避）
3. `rm <旧 DB path>` （`life-editor.db-shm` / `life-editor.db-wal` も同時削除）
4. アプリ再起動して動作影響なし + `find ~/Library/Application\ Support -name 'life-editor.db'` の結果が `~/Library/Application Support/life-editor/life-editor.db` の 1 件のみになることを確認

### Part A 手動受入テスト（iOS 実機）

**対象**: iPhone 実機での Materials Notes 表示確認
**背景**: 2026-04-21 Phase A コード変更は品質ゲート通過済み、iOS 実機での NodeView レンダリング確認が未実施
**観点**: Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が Desktop と同一構造で表示されること

### iOS 4G 同期検証

**対象**: iPhone 実機 / 4G 環境
**前提**: 004/005/008 修正完了 + V62 migration 適用

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証

### iOS 追加機能要件の残タスク（Phase 4 M-1 / Phase 5 / Phase 6.2 / Mobile C-3）

**対象**: `NoteTreeNode` (行スワイプ) / `components/Notes/extensions/SlashCommand.ts` (新規) / `MobileCalendarView` の filter UI / `MobileScheduleItemForm` (5-role 対応)
**背景**: 2026-04-24 Phase 8 完了時点で以下を次セッションに繰越:

- **M-1 行スワイプ (edit / pin / delete)**: 既存 `NoteTreeNode` が DnD + hover UI を抱えるため touch-UX 再設計が必要
- **M-2 / M-3 TipTap slash command + empty line hint**: `@tiptap/suggestion` 依存追加 + ポップオーバー UI 新規実装
- **C-2 Calendar filter / sort**: role multi-select + sort UI 設計が必要（drawer 内 filter sheet として実装予定）
- **Mobile C-3**: `MobileScheduleItemForm` を event 専用から 5-role 選択対応にリファクタ

**参照**: `~/.claude/plans/life-editor-note-ios-calm-moth.md` Phase 4-6

### Frontend 既存 lint 116 問題の一括解消

**対象**: `useTaskTreeCRUD.ts` / `databaseFilter.ts` / `holidays.ts` 他(session 外で蓄積)
**背景**: 2026-04-22 session-verifier で検出。Unused underscore-prefixed vars / React Compiler memoization 不整合 / exhaustive-deps missing が混在。本 session の変更範囲外のため touching 見送り、別セッションで一括対応

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し

## バグの温床 / 今後の注意点(2026-04-23 更新)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録。DB 系の再発防止ルールは [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) に集約:

- **timestamp 形式混在（Known Issue 013）**: SQL 内 `datetime('now')` と `new Date().toISOString()` / `helpers::now()` が同じテーブルに書き込まれ、スペース区切り vs ISO 8601 の混在で sync 文字列比較が壊れる。ASCII 順 space(0x20) < T(0x54) のため一度 since が ISO になると同日 space 行が永久に push から漏れる。暫定対応は sync query の `datetime()` 正規化、恒久対応は書き込み側を ISO 8601 に統一
- **delta sync が updated_at 単調性に依存（Known Issue 014）**: Mobile 11:50 編集 v=372 と Desktop 13:30 編集 v=228 のような高 version + 古 updated_at が Cloud に居座ると `WHERE updated_at > since` では永久に pull されない。Full Re-sync が緊急弁。本命は Cloud D1 に `server_updated_at` 列を追加して delta cursor をそちらへ切り替え
- **Cloud D1 migration が Desktop migration と同一テーブル前提になりがち**: 0002 を流用しようとしたら `note_links` / `paper_nodes` が D1 に無く失敗。Desktop schema は superset、Cloud は subset という認識を migration 作成時に徹底
- **Cloud deploy と D1 migration の tai-ming**: Worker を deploy すると新 schema を前提に push INSERT を試み、D1 が未 migration だと batch 全ロールバック → sync 全体が silent に停止。deploy と migration を必ずセットで運用
- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / dailies / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に `routine_tag_assignments (routine_id, tag_id)` のような複合キー relation は要再点検
- **sync 衝突解決が ID 単独**: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。今回は schedule_items に特別扱いを足したが、他の relation テーブルが同じ罠に嵌る可能性
- **pagination 半実装**: `/sync/changes` の LIMIT + `hasMore` は cursor が伴わず、client ループにも対応していない。暫定 LIMIT=5000 は応急措置で、テーブル成長で再発
- **D1 の compound SELECT 制限**: `UNION ALL` は 5 本まで。診断 SQL で 6 本以上繋ぐと `too many terms` エラー。個別 `--command` で回す
- **wrangler d1 execute の引数**: 相対パスは CWD 基準 / 長いコマンドを `\` で改行するとシェルによっては `--file=` 以降が別コマンド扱いで Unknown argument。1 行で書くのが確実
- **client / server 分散 flag**: `has_more` のように片方だけが使っている field は気づかず古びていく。片側更新時はもう片側の参照箇所を grep で確認する運用が必要
- **Mobile UI の機能欠落(Full Re-sync)**: Desktop SyncSettings と Mobile MobileSyncSection で実装差分があり、障害時の workaround が Mobile で取れない。014 のような状況で詰む
- **`tsc --noEmit` at frontend root は無意味**: `tsconfig.json` が solution-style(`files: []` + references のみ)なので実際の型チェックが走らない。Phase 0 verification では `tsc -b` または `npm run build` を使うべき(session-verifier skill には記録済)
- **Xcode GUI ⌘R は Tauri 2.x で動かない**: `cargo tauri ios xcode-script` は親プロセスが立てる JSON-RPC サーバに依存。Xcode 単独起動では `ConnectionRefused` で落ちる。必ず `cargo tauri ios build` or `dev --host` をターミナルから実行
- **Xcode の PATH に NVM / cargo が無い**: `/usr/local/bin/` への symlink(cargo/rustc/rustup)で解消済だが、他のマシンでセットアップする際に再発する。`ios-everywhere-sync.md` vision 更新案件
- **Desktop パッケージ版と HEAD 実装の乖離**: V64 migration は DB に適用される必要あり、`/Applications/Life Editor.app` の Rust バイナリは旧版のままだと Daily テーブル未対応で起動時 migration 走行 → dailies への rename を経験する。新規ビルドを置換推奨
- **iOS binary と Cloud schema の三者不整合**: Desktop / iOS / Cloud のどれか 1 つでも古いまま運用すると sync が silent に壊れる。V64 のような rename 系 migration は 3 端末同時更新が前提

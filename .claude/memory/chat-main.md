# MEMORY (chat-main)

## 進行中

### 🔧 Loop Engineering 自動検証ループ（scripts/loop-engine/）（着手日: 2026-06-27）

**対象**: `scripts/loop-engine/`（check.sh / run-once.sh / loop.sh / PROMPT.md / TODO.md）・`.claude/CLAUDE.md`（§7.4 Orca 例外1行）
**worktree/branch**: `.claude/worktrees/loop-engine` @ `feat/loop-engine`
**提案レポート(SSOT)**: `.claude/reports/2026-06-27-loop-engineering-orca-proposal.md`（git 非追跡）

- 前回: Step 1-2（check.sh = 型+テスト合否 / run-once.sh = Observe→Act→Check 1周 / PROMPT / TODO）完成
- 現在: **Step 3 完成・PR #106 open**（commit `c72e61d7`）。loop.sh = run-once を PASS/上限まで反復（4停止条件: PASS&全完了 / 空TODO→子起動せず$0 / 連続無進捗 / 上限回数 + 課金同意ゲート）。check/run-once のハードコード絶対パスを script 相対化。count_todo をコメント無視に修正（バグ1件）。スタブ harness で 5/5 合格（トークン/npm 不使用）
- 次: 🛑 PR #106 merge（ユーザー）/ 実ループ本走はトークン課金ゲート（node_modules 要・main か worktree install 後）/ check.sh の検証対象を frontend(FROZEN)→shared+web に切替は別 PR 候補 / `stash@{0}`（Orca バックアップ）は #106 着地で不要→drop 可

## 直近の完了

- [chat-main] **W8 対話グリッド救出** ✅（2026-06-27・**PR #105 merged**・merge commit `9b633068`）— 放棄ブランチにのみ存在した W8-2/W8-3 対話編集（クリック作成/ドラッグ移動/リサイズ）を shared プリミティブ + web ホストへ移植。`pxToMinutes` ゼロ高さ修正 + 対話テスト4本（jsdom PointerEvent 非実装の罠を回避）。検証緑
- [chat-main] **並行レーン棚卸し（cross-lane reconciliation）** ✅（2026-06-27）— 全 per-chat memory を git/gh 実態照合。phase3 #79 / phase4 #88 / work-mobile #51 / prototype #40・#46・#48 を MERGED 済と gh 確認し各 memory を完了化（ユーザー認可で単一書込者を override）。**connect-link-ui = 台帳外の生きたレーン**（Connect リンク UI・独自 commit `8711acfe`・`.session-name`/memory 無し・PR 未作成・MainScreen.tsx 編集中）検出。`stash@{1}`=DU-F 未コミット宙吊り
- [chat-main] **デザインシステム整備 + Cobalt+Mint リブランド** ✅（2026-06-20・**PR #102 merged**・merge `d6103eec`）— Pencil クラッシュで ClaudeDesign(DesignSync) へ切替、「Cobalt Ink + Mint」を `tokens.css` light/dark 適用・旧 teal 退役。`shared/design-system/PRINCIPLES.md` + 11 カード投入

## 予定

### 👀 ユーザー実機目視待ち（merge 済み機能・未確認のもの）

- **W8 カレンダーコア**（#96/#97 merged）: [広幅] 週グリッド時刻配置 / 曜日ヘッダ・今日強調 / 終日レーン / イベントクリック→右ペイン編集→即反映 / 重なり横並び / 週ナビ。[狭幅] 日アジェンダ / 日ナビ / タップ→BottomSheet 編集。**env あり実機**で
- **W4**（#78 merged）: テーマ追従 / 4タブのチャート描画 / Connect グラフ表示・ノードクリック遷移 / backlink。**最重要 = Connect グラフが実データで空でない**こと（env あり実機で・過去 treeshake 誤報前例）
- **Phase 3 Electron**（#79 merged）: `npm run dev` 起動→ログイン→Tasks CRUD / `build:mac` で DMG（実機ゲート）
- **Phase 4 Capacitor**（#88 merged）: iOS Simulator / Android AVD / 実機署名で起動→ログイン→Tasks golden path（Mac ハンドオフ）
- **W3-B**（merged）: Pomodoro 計測→timer_sessions 保存 / phase 遷移 / preset CRUD / TaskSelector
- **W3-C**（#75 merged）: 環境音ミックス再生(Storage URL) / 完了音(onSessionComplete) / AudioContext resume()
- **W1/W2**（merged）: dark/light・font-size・en/ja・リロード復元・shortcut rebind→conflict→reset / Cmd+K・Trash 5カテゴリ restore/permanentDelete
- **W3-0**（merged）: ⌘K パレット / ⌘1-5 section / ⌘, settings / rebind 即反映 / input 中 "n" 非発火
- DU-F Step 7-11 golden path（4 role Tag/Link/backlink + wiki_tag_groups CRUD）/ DU-C-6（Routine 作成/削除/復元 + 月またぎ）

### 🧹 クリーンアップ（ユーザー実行 — `git branch -D` は deny ルール）

- **ローカル merged branch 削除**: prune した 6 worktree のブランチ（chore/hooks-symlink-distribution / feat/phase3-electron / feat/w4-analytics-connect / fix/w8-schedule-dedup / feat/w8-schedule-calendar / feat/web-kanban-ui-ux）+ 旧 merged branch 群（chore/batch-a-_ ×2 / feat/w0-_ / feat/w1-_ / feat/w2-_ / feat/w3\* など）。`git branch -D <名>` でユーザー実行
- **remote merged branch 削除**（任意）: `git push origin --delete <名>`。特に多数の `claude/*` 自動生成ブランチ
- main の未 push tracker commit（`883247e3` 他）: main 専有チャットの pre-push hook 誤ブロックのため一時 worktree から push（memory `project_push_from_main_chat_hook`）。または次の feature PR に同梱

### 任意・将来タスク

- デザインシステム follow-up: badge/tabs/tooltip 等を ClaudeDesign へ incremental 追加 / 旧「Design System」project 殻削除は claude.ai UI 操作 / Functional色の notion トークン統一
- **既存テーブルの initplan WARN**（2026-06-11 advisor）: calendars/items_meta/payload 系等に auth_rls_initplan 警告残存 — 原因調査 + 一括 initplan 化 migration
- W4 由来: Analytics ScheduleTab の per-range fetch 化 / データ系列ハードコード色の notion トークン化 / Connect リンク作成・削除 UI
- W3-B 申し送り: undo/redo 結線意図確認 / Skip cadence 非対称裁定 / new-task の create-and-focus lift
- W1 残 Low: `text-white` の accent オン文字トークン化 / `FONT_SIZE_PX` 重複の constants 一元化
- web Phase 2 残: S8 Supabase Realtime（実装済）/ S9 モバイルレスポンシブ
- Perf: M4（useScheduleItemsRoutineSync 一括化）/ M1（note 一覧 content_json 除外）
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移（`2026-05-26-link-ux-obsidian-style.md`）
- DU-E Calendar 2 ビュー再実装
- 🔒 **Notes password bcrypt 化** — N>1 化の前ゲート必須（known-issue `027-notes-password-plaintext-debt.md`）
- **Known Issue 025 Fixed 化**（任意）: `prototype/mobile-ui` worktree 状況再確認の上判断
- **Mobile 基準統一 frontend Phase 2/4 は FROZEN**（frontend は Phase 5 破棄予定）

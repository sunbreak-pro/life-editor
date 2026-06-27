# MEMORY (chat-main)

## 進行中

### 🔧 W8 対話グリッド救出（クリック作成 / ドラッグ移動 / リサイズ）（着手日: 2026-06-27）

**対象**: `shared/src/components/schedule/WeekTimeGrid.tsx` / `shared/src/utils/scheduleGridLayout.ts` / `web/src/schedule/ScheduleCalendarView.tsx` / `shared/tests/weekTimeGrid.test.tsx`
**計画書**: `.claude/docs/vision/plans/2026-06-20-w8-salvage-interactive-schedule.md`（Status: In Progress）

- 前回: —
- 現在: 実装完了・検証緑・**PR #105 open**（`feat/w8-salvage-interactive-grid`・commit `14d9719e`・base main）。放棄ブランチにのみ存在した W8-2/W8-3 対話編集を shared プリミティブ + web ホストへ移植。`pxToMinutes` ゼロ高さフォールバック修正（1px=1分）+ 対話テスト4本（jsdom PointerEvent 非実装の罠をネイティブ MouseEvent で回避）。検証: shared 503 pass / shared tsc -b 0 / web build exit 0
- 次: 👀 実機目視（作成/移動/リサイズ・スナップ・永続化）→ 🛑 PR #105 merge（ユーザー判断）→ merge 後: 救出元 `origin/claude/app-dev-roadmap-cdhjjz` 削除（Step 8）+ 一時 worktree `.claude/worktrees/w8-salvage` prune + ローカル/remote branch 削除

## 直近の完了

- [chat-main] **進捗整理 + worktree/branch 棚卸し + main 同期** ✅（2026-06-27）— 「タスク全消化」依頼を受け全体監査。判明: tracker メモリが古く「PR 未作成」と記録の W4(#78)/Phase3(#79)/Phase4(#88)/Work-mobile(#51)/Kanban(#102)/W8(#96/#97) は**全て merged**（gh 認証断による偽陰性で一時誤判定 → 再認証で確定）。**唯一の真の未マージ実作業 = w8-salvage のみ**と特定。main を origin/main へ rebase 追従（hooks symlink 化 + CLAUDE.md 衝突=ローカル版が stale だったので origin 採用、旧編集は stash 保全）。merge 済み 6 worktree（hooks-symlink/phase3-electron/w4/w8-dedup/w8-schedule-calendar/web-kanban）を prune。残 worktree = main + w8-salvage のみ
- [chat-main] **デザインシステム整備 + ブランド Cobalt+Mint リブランド** ✅（2026-06-20・**PR #102 merged**・merge `d6103eec`）— Pencil クラッシュで ClaudeDesign(DesignSync) へ切替。「Cobalt Ink + Mint」採用を `tokens.css` light/dark 適用・旧 teal 退役・dark on-accent near-black 化。`shared/design-system/PRINCIPLES.md` + ClaudeDesign「DesignSystem」project に 11 カード投入。並行 Kanban UI/UX と同梱で PR #102
- [chat-main] **W8 二重実装の解消 + main ビルド破壊の修復** ✅（2026-06-20・**PR #97 merged**・commit `13e96a8d`）— #95(WeekGrid) と #96(ScheduleCalendarView) の二重実装で web build TS6133 破綻。機能広い #96 を正とし #95 dead 撤去(-573行)。**Known Issue 029** 追加（並行チャット境界調整不足）
- [chat-main] **W4 (Analytics + Connect)** web/shared lean 移植 ✅（2026-06-14・**PR #78 merged**・後続 #85 で series 色トークン化）— Analytics 集計層(879行純関数)を shared へ + 17チャート4タブ。Connect ノードグラフ(Canvas2D+d3-force)+backlink を unified item-link モデルで再構築。recharts 3.7.0 pin

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

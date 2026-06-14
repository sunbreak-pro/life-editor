# MEMORY (chat-main)

## 進行中

（なし）

## 直近の完了

- [chat-main] **W4 (Analytics + Connect)** web/shared lean 移植 ✅実装完了（2026-06-14・branch `feat/w4-analytics-connect`・PR 未作成）— Analytics: 集計層(879行純粋関数)を shared へ + AnalyticsFilterContext(period/dateRange・内部) + 17チャート + 4タブ(Overview/Tasks/Work/Schedule)。Materials/analytics-Connectタブ/可視サイドバー drop。host(web/src/analytics/AnalyticsScreen)が9メソfetch→labels/data props注入(§6.4)。 Connect: ノードグラフ(Canvas2D+d3-force)+backlink を **unified item-link モデルで再構築**(listNotesUnified/listAllTagConnections/listAllTagAssignments/listAllWikiTagsUnified)。legacy note_links/note_connections(Supabaseスタブ=空)不使用と明記。backlink は fetch済 connections から client側算出(listLinksToItem 等価をqa実証)。Paper Boards/@xyflow/d3-transition drop。 検証: shared tsc -b 0 / shared vitest 426 passed / web tsc -b 0err / web eslint 0err / frontend 変更0。recharts は `^3.7.0`→3.8.1 が型regression のため **3.7.0 pin** + d3(ease/force/quadtree/selection/zoom)+@types 追加。role-qa **PASS(Blocker 0)**。実装中ディスク満杯(ENOSPC)→npm cache 削除で復旧
- [chat-main] **PR #75 (W3-C)** web audio mixer + completion chime ✅（2026-06-14・merged）— AudioProvider(Optional バリアント) + ミキサー UI + Storage URL 再生 + onSessionComplete 完了音結線(AudioChimeBridge ref 経由) + sound 3 テーブル realtime consumer
- [chat-main] **PR #70/#71 merge 後処理** ✅（2026-06-11）— main 同期（rebase・dirty 3 ファイルは origin/main と byte 一致検証後に整理・損失ゼロ）+ build 全数検証（shared/mcp-server/frontend/web 4 build + shared/frontend テスト全 PASS）+ w3-b-timer-work worktree prune + 計画書 three-axis-slimming COMPLETED 化→archive（4aa93482）。tracker 記録は PR #73

## 予定

- 🛑 **PR #73 merge（ユーザー判断）** — tracker/archive 記録 3 commits（dfe4c07b 温存分 + 計画書 archive + 本セッション tracker）。merge 後: main 同期（squash と patch 非等価のため byte 一致検証→origin/main へ揃える）+ chore/tracker-claude-md-slimming branch 削除
- 🛑 **W4 PR 作成 → main merge（ユーザー判断・D2）** — branch `feat/w4-analytics-connect`。実装+計画書+tracker を 1 PR に。merge 後: 一時 worktree prune + ローカル/remote merged branch 削除
- 👀 **W4 実機目視（D1・merge 前後）**: テーマ追従 / 4タブのチャート描画 / Connect グラフ表示・ノードクリック遷移 / backlink パネル。**最重要 = Connect グラフが実データで空でないこと**（unified API が実データを返すか。過去 `worktree_supabase_treeshake` の env 欠落誤報前例ありなので **env あり実機**で確認）
- 👀 **W3-B 実機目視**（merge 済）: Pomodoro 計測→timer_sessions 保存 / WORK→BREAK→LONG_BREAK 遷移（auto-start 含む）/ preset 作成・適用・削除 / TaskSelector タスク紐付け / new-task shortcut で tasks へ navigate
- 👀 **W3-C 実機目視**（PR #75 merged）: 環境音ミックス再生（Storage URL）/ 完了音（onSessionComplete chime）/ AudioContext resume()
- **既存テーブルの initplan WARN 48 件**（任意・別タスク候補）: 2026-06-11 advisor 実測で calendars/items*meta/payload 系/wiki*\_/routine\_\_ に auth_rls_initplan 警告。0018 新テーブルは 0 件。0010 適用済みのはずの既存テーブルに残存 — 原因調査 + 一括 initplan 化 migration を検討
- 👀 **W1/W2 実機目視**: [W1] dark/light発色・font-size追従・en/ja切替・リロード復元・shortcut rebind→conflict→reset / [W2] Cmd+K開閉/絞り込み/ジャンプ・Trash 5カテゴリ一覧・restore/permanentDelete confirm（+ 統合修復後: settings タブ表示・palette「Go to 設定」）
- 👀 **W3-0 実機目視**（merge 後）: ⌘K パレット / ⌘1-5 section 切替 / ⌘, settings / rebind 即反映 / input 入力中 "n" 非発火 / palette 表示中の ⌘2 裏切替の体感評価（QA Medium・気になれば抑制を別タスク化）
- ローカル merged branch 13本の削除（`git branch -D` は deny ルールのためユーザー実行: chore/batch-a-_ ×2 / docs/web-first-v2-and-bash-rule / feat/w0-_ / feat/w1-_ / feat/w2-_ / fix/w1-w2-merge-integration / chore/tracker-w1-w2 / chore/tracker-w3b / docs/claude-md-three-axis-slimming / feat/w3-shortcut-executor / feat/w3a-timer-audio-foundation / **feat/w3b-timer-work**。remote 側の merged branch 削除も任意: `git push origin --delete feat/w3b-timer-work` 等）
- 任意（W4 後続・W3-B 申し送り未着手）: undo/redo 結線（activeInInput:false で input 内 ⌘Z 抑制になる挙動の意図確認 — OS 標準編集 undo に委ねるなら現状が正）/ Skip の cadence 非対称裁定（SET_PHASE は LONG_BREAK へ飛べず completedSessions 不増 — skip() 追加 or 現仕様の正式化）/ new-task の create-and-focus lift（現状 navigate のみ）
- 任意（W4 由来・将来）: Analytics ScheduleTab の wide-window fetch（2020-01-01..today 一括）を per-range fetch へ（データ量増大時）/ データ系列ハードコード色（stagnation 5色・PIE palette・LONG_BREAK amber、frontend verbatim）を notion トークン化（light/dark 統一）/ Connect グラフのリンク作成・削除 UI（read-only から書き込み可へ）
- W1 残 Low（非ブロッキング・別バッチ）: `text-white` の accent オン文字トークン化 / `FONT_SIZE_PX` の ThemeContext↔SettingsAppearance 重複を `constants/` 一元化
- **Mobile 基準セクション統一（frontend）の Phase 2 Schedule / Phase 4 Settings は FROZEN（取り下げ）** — frontend は移行 Phase 5 で破棄予定・web に伝播しないため。今後の統一は web-desktop-parity-roadmap（W0-W4）側で実施。Phase 2 設計（削除=週ビュー/Dual Column/CalendarTags/検索, Desktop維持=Events/Tasks/高度操作）は web 移植仕様の参照元として保全（master プラン `2026-06-05-mobile-first-section-unification.md`）
- [chat-main] web Phase 2 残: S8 Supabase Realtime（SyncContext no-op→postgres_changes購読+debounce bump+publication migration 0017）/ S9 モバイルレスポンシブ（本番web/）
- [chat-main] Perf follow-up: M4（useScheduleItemsRoutineSync の syncScheduleItemsWithRoutines を updateFutureScheduleItemsByRoutine に一括化）/ M1（note一覧content_json除外・遅延取得+検索移行の設計変更要
- **Known Issue 025 Fixed 化**（任意・軽量）: prototype 系 worktree 関連。`prototype/mobile-ui` worktree は現在も生存中のため要状況再確認の上 INDEX を Active→Fixed 判断
- **Link UX 強化（Obsidian 風）**: cross-role link / 遅延実体化 stub / クリック遷移。スケルトン `2026-05-26-link-ux-obsidian-style.md`。DU-G と独立
- DU-E Calendar 2 ビュー再実装（DU-G 完了後）
- 🔒 **Notes password bcrypt 化** — N>1 化（友達 MVP）の前ゲート必須。Known-issue `027-notes-password-plaintext-debt.md` が SSOT
- 👀 ユーザー実機確認待ち: DU-F Step 7-11 の golden path（4 role Tag 付与/解除/Link 作成/backlink + wiki_tag_groups CRUD UI）
- 👀 ユーザー実機確認待ち: DU-C-6（Routine 作成/削除/復元 + 月またぎ ループ防止 + key duplicate 警告ゼロ）

# MEMORY (chat-main)

## 進行中

### 🔧 レイアウト統一 fan-out + shared-fix ルート新設（着手日: 2026-07-10）

**対象**: `.claude/docs/vision/plans/2026-07-10-layout-unification-fanout.md`（新規）・GitHub Issues（label `shared-fix`）・`.claude/CLAUDE.md §9`
**計画書**: `.claude/docs/vision/plans/2026-07-10-layout-unification-fanout.md`

- 前回: —
- 現在: レイアウト実態監査（Explore）→ 計画書作成 + shared-fix ラベル/Issue 起票（smoke findings 2 件 = Analytics Today カード / Schedule セグメント間隔 → 各 refine worktree へ）
- 次: 計画書 PR 作成（一時 worktree 経由 push）→ ユーザーが各 refine worktree チャットへ boot 行を投入

## 直近の完了

- [chat-main] **残 Issue 消化体制の再編 + outbox 起票依頼の一括消化** ✅（2026-07-25〜26）— worktree 4 本体制へ再編（shell-refine #320→#304 子2 / briefing-section #318 / schedule-refine #352〜#355 / analytics-refine #334・#356。全て 09bae027 起点・.session-* 設定済み・新規 2 本は npm ci 済み）+ 残骸 worktree 5 本撤去 + Issue 22 件起票（#352〜#356・#360〜#376。#374 は事後記録で即 close）+ Epic #290 チェックリスト追随 + `section:tags` ラベル新設。code-reduction 計画書（2026-07-25-code-reduction.md）は repo 不在と実測判明 → chat-code-reduction へ COMPLETED 化の差し戻し依頼（outbox 2026-07-26）。起票依頼→Issue の全マッピングは outbox 2026-07-26 エントリ参照
- [chat-main] **Notes/Daily エディタ即クラッシュ修正（tiptap Suggestion PluginKey 衝突）** ✅（2026-07-19・Issue #293・**PR #294**・commit `11acaac0`）— "/" スラッシュメニューと "[[" 補完（#285）の両 Suggestion が `@tiptap/suggestion` の共有デフォルト PluginKey に二重登録 → マウント時 `RangeError` で Notes/Daily が真っ白。各々に固有 PluginKey 付与（2 files +14）。web build / eslint / role-qa 緑。merge 後の実ブラウザ確認は「予定」参照
- [chat-main] **Loop Engineering 自動検証ループ Step 3（loop.sh）** ✅（2026-06-27 実装・**PR #106 merged 2026-06-27**。2026-07-08 cross-lane 同期で完了化）— loop.sh = run-once を PASS/上限まで反復（4 停止条件 + 課金同意ゲート）・パス相対化・count_todo 修正。スタブ harness 5/5。follow-up は「予定」参照
- [chat-main] **W8 対話グリッド救出** ✅（2026-06-27・**PR #105 merged**・merge commit `9b633068`）— 放棄ブランチにのみ存在した W8-2/W8-3 対話編集（クリック作成/ドラッグ移動/リサイズ）を shared プリミティブ + web ホストへ移植。`pxToMinutes` ゼロ高さ修正 + 対話テスト4本（jsdom PointerEvent 非実装の罠を回避）。検証緑

## 予定

### 👀 ユーザー実機目視待ち（merge 済み機能・未確認のもの）

- **code-reduction 実測**（PR #341〜#351 merged・2026-07-25）: #348 = 主要画面に生 i18n キーが出ないこと（実ブラウザ）/ #351 = Analytics チャート・Kanban・Mobile タスクリスト・セグメントコントロールの見た目
- **宣言 AC6**（PR #287 merged・記録 Issue #374）: 朝刊で宣言入力 → Daily「宣言」セクション保存 → 夕刊「今朝の宣言」表示・朝夕セクション非破壊。あわせて write_briefing プロンプトに「昨日の宣言・夕刊への講評」を含める 1 往復の運用実測
- **Notes/Daily エディタ復旧確認**（PR #294 merge 後）: main を pull → Notes アイテムクリックで本文表示 / Daily エディタ表示 / 同一エディタで "/" メニューと "[[" 補完の併用動作（Issue #293 DoD・Console に RangeError なし）
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

- **ローカル merged branch 削除（2026-07-26 棚卸し済み — 16 本全てに MERGED PR を機械確認）**: chore/outbox-shell-refine-reply / chore/tracker-sync-notes-editor-fix / claude/asakan-yukan-theme / claude/briefing-section / claude/docs-orders-retire / claude/docs-workspace / claude/materials-refine / claude/notes-daily-editor-ux / claude/schedule-refine / claude/shell-refine-provider-docs / claude/worktree-policy-327 / docs/root-cleanup-and-stale-record / fix/db-push-workdir / fix/db-url-session-pooler / fix/tiptap-suggestion-plugin-key / fix/walk-ancestors-cycle-guard。`git branch -D <名>` でユーザー実行。**`claude/briefing-evening-patch-fix` のみ PR 無し — 中身確認まで削除しない**（旧記載の feat/w* 系 6 worktree ブランチ群は既に現存せず解消済み）
- **worktree 空フォルダ残骸の削除**（プロセスのロック解放後・再起動後などに）: `rmdir .claude\worktrees\editor-ux .claude\worktrees\materials-refine`（2026-07-25 撤去時に中身ゼロ・git 未登録まで確認済み・入れ物のみ残存）
- **remote merged branch 削除**（任意）: `git push origin --delete <名>`。特に多数の `claude/*` 自動生成ブランチ
- main の未 push tracker commit（`883247e3` 他）: main 専有チャットの pre-push hook 誤ブロックのため一時 worktree から push（memory `project_push_from_main_chat_hook`）。または次の feature PR に同梱

### 任意・将来タスク

- loop-engine follow-up（#106 merged 後続）: 実ループ本走（トークン課金ゲート・node_modules 要）/ check.sh の検証対象を frontend(FROZEN)→shared+web に切替（別 PR 候補）/ `stash@{0}`（Orca バックアップ）は不要→drop 可
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

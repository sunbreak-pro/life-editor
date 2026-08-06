# MEMORY (chat-main)

## 進行中

### ⏸️ Loop Engineering 親計画 Phase 1（夜間安全レーン + 毎朝 digest 自動化）（着手日: 2026-08-04）

**対象**: `.claude/automation/`・`.claude/settings.json`・`.claude/docs/vision/plans/`
**計画書**: `.claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md`

- 前回: 3 計画書の整合性評価 → ユーザー裁定 3 件（①順序 = 親 Phase 1 → カタログ → コスト → 親 Phase 2 ②Phase 0→1 昇格を前倒し確定 ③実行基盤は調査して提案）→ **Phase 1 インフラ配置 PR #594 merged**（`3ef1f752`。plans 2 本配置 / automation 改訂 = routine-digest + routine-night-safe + run-routine.ps1 + 台帳 / permissions.ask 二層）。実測補正: CronCreate は**セッション限定 + 7 日期限** → 推奨基盤 = Task Scheduler + `claude -p`（**D-20260804-main-1** 起票済み）
- 現在: **実行基盤の裁定待ち（D-20260804-main-1）**。自動発火は無効のまま
- 次: ユーザーが `run-routine.ps1` を手動実行して動作確認 → 裁定に応じて Task Scheduler 登録（手順 = `automation/routine-ids.md`）。Phase 2 はループカタログ定着後（decision キューで判定）

### ⏸️ ループカタログ試験運用 + 自律運転の到達点（着手日: 2026-08-06）

**対象**: `.claude/skills/loop-*/`・`.claude/docs/vision/plans/`
**計画書**: `.claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md`

- 前回: 初期 4 本（triage / implement / verify / postmortem）を配置し **PR #595 merged**（`18da6b5f`）。子計画 Step 1〜5 完了
- 現在: **Step 8 = 「自律運転の到達点」を別計画書に起こす**（P-001 改訂提案 + ゲート 3 段階解放 + merge 後 main 検証 → 自動 revert）。並行して Step 6 の試験運用（反復上限の実測）は使うたびに Worklog へ追記
- 次: 到達点の計画書をユーザーレビュー → 第 1 段（`claude/*` への push + draft PR 作成の解放）の可否を裁定。あわせてセッション 3（コスト削減ハーネス）向けプロンプトを生成

### 🔧 worktree 総入れ替え + 次期 fan-out（着手日: 2026-07-29）

**対象**: GitHub Issues（Epic #290 / #321）・`.claude/comm/outbox/`

- 前回: 新レーン 4 本（refactor-core / schedule-refine / mobile-refine / tags-docs）へ Issue #465〜#474 を fan-out し、各レーンが消化
- 現在: **巡回は停止条件を満たして完了**（2026-08-01・open PR 0 / #467 / #468 とも CLOSED / **PR #527 merged** `637a64e6`）。判断キューは**空**（回答 8 件を `ANSWERS.md` へ転記済み）。**次の動きはレーン起動待ち** — worktree 4 本ともチャットが未起動でコミットが進んでいない
- 次: open Issue 12 件を各レーンへ流す（**#507 / #509 / #525 / #526** = mobile-refine、**#511 / #519** = tags-docs、**#517** = refactor-core、**#520 / #524** = schedule-refine、**#512 / #528** = chat-main、**#372** = 将来 DDL）。chat-main 自身の手番は #512（実機目視・別チャットの検証終了後）と #528（archive のリンク切れ + docs-lint 拡張）

## 直近の完了

- [chat-main] **ループカタログ初期 4 本の配置（PR #595 merged `18da6b5f`）** ✅（2026-08-06）— 親計画 §4 に沿ってローカル実測 → 子計画書 → レビュー → `/loop-triage` でフォーマット確定 → 残り 3 本。実測で親計画の前提が 2 か所崩れているのを検出（リポジトリ内 12 スキル中 **8 本が Mac パスを指す死んだポインタ**・`gh pr merge` が deny / ask のどちらにも無く P-001 が機械未強制 + `git-workflow` §0.1.1 と矛盾）→ 設計変更 2 点（triage は起票しない / implement は commit まで）。**D-20260804-main-2** 起票

- [chat-main] **判断キュー 8 件の消化 + docs 反映（PR #527 merged）** ✅（2026-08-01）— ユーザー回答を `ANSWERS.md` へ転記し、行き先ごとに実行。#520 は 🛑 ゲート解除コメント（A = 移動時にレンズを外す）／ B 採用の mobile-2 / mobile-3 は実装が要るので **#525 / #526** 起票／ docs 反映 4 件は **PR #527**（`[all]` prefix の廃止・tracker を実装ブランチに載せない・enum は plans/ 由来だけ・ClaudeDesign 計画書の COMPLETED 化と「追跡正本」宣言の付け替え）。自己レビューで **archive 移動により自分が壊した相対リンク 2 本**を検出し同 PR 内で修正、同種の**既存壊れ 6 本**は **#528** へ（docs-lint がリンク解決を見ていない穴も込み）

- [chat-main] **open PR 巡回（停止条件 = #467 / #468 close + open PR 0）** ✅（2026-08-01）— 巡回開始時の open PR 2 本（#522 tracker 復元 / #523 d3 sim を発火時読み取りへ）を `/code-review low` で確認中に両方 merge され、**停止条件達成**。Epic #290（Step 2〜7 全 [x]）/ Epic #321（Phase 2 全消化）/ mobile-scope.md / plans Status は各レーンの PR 内で追随済みで chat-main の追加修正は不要だった。outbox は **worktree 5 本の実体まで直接 diff** して未処理ゼロを確認（main 側のコピーだけ見ると未 push 分を取りこぼす）。#523 のレビュー検出は **#524** として起票

## 予定

### 📋 Loop Engineering 続き（セッション 3 — 貼り付け用プロンプトは history の各セッションエントリ参照）

- ~~セッション 2: ループカタログ実装~~ **完了**（PR #595 merged `18da6b5f`・2026-08-06）
- セッション 3: **コンテキストコスト削減ハーネス**（`2026-08-04-context-cost-reduction-harness.md` — Phase 1 計測 + Phase 2 枠づくりまで。Phase 3 移送は移行完了後）
- 親計画 Phase 2（実装レーン自走）はカタログ試験運用 1〜2 週間後に decision キューで着手判定。前提 = `goals.md` 全面改訂。**到達点の設計は Step 8 の別計画書が先**（進行中セクション参照）

### 📝 #524（2026-08-01 巡回のレビュー検出 → 起票済み・実ブラウザ確認が DoD 先頭）

- **#524 Connect グラフ: 選択中ノードを再クリックしても選択解除できない**（`shared/src/components/Connect/graph/useGraphInteraction.ts:197` — PR #523 merge 済み `8e624422`）。effect の deps が `[size.w, size.h]` だけになり、**リスナーを貼り直す機会がサイズ変更時しかない**。`GraphCanvas.tsx:178` の `onSelect: (id) => onSelectedIdChange(id === selectedId ? null : id)` は毎レンダー作り直される inline クロージャなので、effect が掴んだ古い `selectedId`（初回サイズ確定時 = 通常 `null`）と比較し続ける → トグル判定が常に false。`onActivate` / `onZoom` も同じく凍結する。**#523 が原因というより、`simRef.current` の dep が偶然果たしていた貼り直しが消えて確定的になった**（従来はグラフ再構築のたびに更新されて「たまに効く」状態）。直しは #523 と同じ発想で、コールバックも ref 経由で発火時に読む形。`section:connect` / `type:bug` / `sev:minor` 相当。**未実測**（jsdom にレイアウトが無く canvas 経路はテスト不能・実ブラウザ確認は chat-main）

### 👀 ユーザー実機目視待ち（merge 済み機能・未確認のもの）

- **背の高いシート + ソフトキーボード**（#470 / PR #494 merged・mobile-refine から引き取り 2026-07-31）: iOS / Android 実機で、タスク詳細シート（`web/src/tasks/MobileTaskList.tsx` の `max-h-[92vh] / min-h-[70vh]`）のタイトル欄・本文を編集したときにカーソルがキーボードの裏に回らないか。`vh` はレイアウトビューポート基準でキーボード表示に追随しない。**iOS では `dvh` も縮まないので、憶測で差し替えず実測してから**（#471 の mobile notes フル編集も同型・直すなら両方まとめて）
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
- ~~main の未 push tracker commit~~ **解消済み**（2026-08-01 実測）: chat-main から `git push` がそのまま通り、`git status -sb` に ahead 表示なし。pre-push hook の誤ブロックは再現しなかったので、一時 worktree 経由の回避策は不要

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

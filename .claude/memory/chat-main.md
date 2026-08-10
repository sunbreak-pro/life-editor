# MEMORY (chat-main)

## 進行中

### 🔧 Loop Engineering 親計画 Phase 1 + 2（夜間レーン 2 本 + 毎朝 digest）（着手日: 2026-08-04）

**対象**: `.claude/automation/`・`.claude/settings.json`・`.claude/docs/vision/plans/`
**計画書**: `.claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md`

- 前回: **Phase 1 インフラ配置 PR #594 merged**（`3ef1f752`。routine-digest + routine-night-safe + run-routine.ps1 + 台帳 / permissions.ask 二層）。実測補正: CronCreate は**セッション限定 + 7 日期限** → 推奨基盤 = Task Scheduler + `claude -p`（**D-20260804-main-1** 起票済み）
- 現在: **Phase 2 の文書整備 = PR #597 merged**（`5161a9a1`）。Step 9 ゲート（カタログ定着後に裁定）は**ユーザー指示で前倒し・試験運用 0 件のまま着手**し、その事実を Worklog 先頭に記録。① `goals.md` を役割ごと差し替え（Goal 一覧 + 状態機械 → 「今夜どれを選ぶか」の選定基準。一覧は GitHub が正本なので持たない）② `routine-night.md` を `/loop-implement` の薄い殻へ（無人固有の事情のみ・**commit 止まり**）③ 追随 3 か所（`run-routine.ps1` の ValidateSet に `night` / README 状態列 / `routine-morning.md` 退役）。**§7 の「draft PR 止まり」は permissions 実測と食い違っていたので commit 止まりへ訂正**
- 次: **発火の裁定 D-20260804-main-1** → `run-routine.ps1 -Routine night` を手動 1 回で動作確認 → `schtasks` 登録（手順 = `automation/routine-ids.md`）。**有効化の前提が 1 つ増えた**（PR #619・#618）= repo の `permissions.ask` から `git push*` / `gh pr create*` を外したので、**無人レーンの push 抑止は runner 側 settings で渡す**（`claude -p --settings <無人用>` / `--disallowedTools`）。**後継のいない機能が 1 つ残る** = merge 済みブランチの worktree 掃除（旧・朝ルーチンのみが持っていた。digest に報告として足すかは未決）

### ⏸️ ループカタログ試験運用 + 自律運転の到達点（着手日: 2026-08-06）

**対象**: `.claude/skills/loop-*/`・`.claude/docs/vision/plans/`
**計画書**: `.claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md`

- 前回: 初期 4 本（triage / implement / verify / postmortem）を配置し **PR #595 merged**（`18da6b5f`）。子計画 Step 1〜5 完了
- 現在: **Step 8 完了** = 到達点の計画書 `2026-08-06-autonomous-operation-endpoint.md` を配置（**PR #596 merged** `1e33b4c2`）。P-001 は**案 B = 据え置きで確定**（D-20260806-main-1・第 2 段の自動 merge は開けない）→ `permissions.ask` に `Bash(gh pr merge*)` 追加 + CLAUDE.md §7.2 に `git-workflow` §0.1.1 非適用を明記。**試験運用（Step 6）は依然 0 件** — 親 Phase 2 はこれを待たずに前倒しした
- 次: 2026-08-06 23:33 JST のクラウド夜間レビュー（`trig_018fECsiaVRLNSCFcoVMDF4q` → Notion「Life Editor Night Review」）を回収し、残る未検証 = `gh auth status` を確定 → 第 1 段（`claude/*` への push + draft PR 作成）の設計を書き直す

### 🔧 worktree 総入れ替え + 次期 fan-out（着手日: 2026-07-29）

**対象**: GitHub Issues（Epic #290 / #321）・`.claude/comm/outbox/`

- 前回: 新レーン 4 本（refactor-core / schedule-refine / mobile-refine / tags-docs）へ Issue #465〜#474 を fan-out し、各レーンが消化
- 現在: **巡回は停止条件を満たして完了**（2026-08-01・open PR 0 / #467 / #468 とも CLOSED / **PR #527 merged** `637a64e6`）。判断キューは**空**（回答 8 件を `ANSWERS.md` へ転記済み）。**次の動きはレーン起動待ち** — worktree 4 本ともチャットが未起動でコミットが進んでいない
- 次: open Issue 12 件を各レーンへ流す（**#507 / #509 / #525 / #526** = mobile-refine、**#511 / #519** = tags-docs、**#517** = refactor-core、**#520 / #524** = schedule-refine、**#512 / #528** = chat-main、**#372** = 将来 DDL）。chat-main 自身の手番は #512（実機目視・別チャットの検証終了後）と #528（archive のリンク切れ + docs-lint 拡張）

## 直近の完了

- [chat-main] **確認待ちの摩擦を除去（#618 = PR #619 open / dotfiles PR #15 open）** ✅（2026-08-10）— `permissions.ask` を `Bash(gh pr merge*)` だけに縮小（deny 27 件は無変更）。無人レーンの push 抑止は **runner 側 settings** へ分離し `automation/` 2 本に明記。あわせて tracker 新運用を **D-20260810-main-1** として台帳化（END の tracker は **session-verifier 緑の直後**に実行し merge を待たない・専用ブランチ `chore/tracker-<chat>-YYYYMMDD`）→ CLAUDE.md §7.4 + `worktree-policy` を行単位修正、dotfiles 側は task-tracker / lead-pipeline / role-engineer（Verdict をゲート別 PASS/FAIL 表へ）に追随。**DoD 4 つ目（確認プロンプトなしの実測）だけ merge + セッション再起動後に持ち越し**

- [chat-main] **ハーネス統合とループ再設計 Phase A+B+C（PR #616 merged・dotfiles PR #14 は open）** ✅（2026-08-10）— P-008（実装中スコープ凍結）を POLICY に追加・`_TEMPLATE.md` に「検討した代替案」節 + 完了時の乖離レビュー 3 行を必須化・重複 8 系統を各正本へのポインタに統一・Mac 専用 symlink 10 本を known-issues/031 化（計画書: archive/2026-08-10-harness-loop-consolidation.md）。dotfiles 側（tone 一本化 / lead-pipeline ミニスコープ / QA ラベル統一）は `~/.claude` にローカル実効済みで merge のみ残

- [chat-main] **main の未追跡資産を 2 PR に整理（PR #610 / #611 merged）** ✅（2026-08-09）— 未追跡 13 ファイルを計画書（#610 = fanout r3）と Codex 対応（#611）に分割。Codex 側は全文コピーだった初版を**参照方式**へ再設計（`hooks.json` が `.claude/hooks/*.sh` を git ルート相対で呼ぶ・skills は入口だけ）。宙に浮いていた `chore/docs-sync-20260731` は**中身が既に main にあり PR が巻き戻しになる**ため削除。**docs-lint に検査 (e) が増えている** — plans/ を触る PR は `node .claude/scripts/records.mjs index` を同一 PR に含める（#610 で 1 度落ちた）

## 予定

### 📋 Loop Engineering 続き（セッション 3 — 貼り付け用プロンプトは history の各セッションエントリ参照）

- ~~セッション 2: ループカタログ実装~~ **完了**（PR #595 merged `18da6b5f`・2026-08-06）
- ~~親計画 Phase 2 はカタログ試験運用後に判定~~ **前倒しで実施済み**（PR #597・2026-08-06。試験運用 0 件のままユーザー指示で着手）
- セッション 3: **コンテキストコスト削減ハーネス**（`2026-08-04-context-cost-reduction-harness.md`）。**貼り付け用プロンプトは history の 2026-08-06「Loop Engineering Phase 2」エントリが最新**（同日の旧プロンプトは差し替え済み）。到達点 = **Phase 1 計測 + Phase 2 枠づくり + Phase 4 `/loop-prune`**。Phase 3 移送は移行完了まで開けないので、Status は COMPLETED にせず「残は Phase 3 だけ」と分かる形にする。**申し送り = グローバル側（`~/.claude/CLAUDE.md` + `claude-dotfiles/claude/rules/` 11 本 28.8KB・うち 8 本が毎回無条件ロード）が計画書 §4 の調査表に入っていない**。プロジェクト側は CLAUDE.md 18.5KB + rules 3 本 12.6KB
- 自律運転の到達点・第 1 段の設計（`2026-08-06-autonomous-operation-endpoint.md` Step 4）— プロンプトは history の同日エントリ

### 🔧 ハーネス統合の残件（PR #616 merged 2026-08-10・計画書は archive 済み）

- dotfiles **PR sunbreak-pro/claude-dotfiles#14**（Lane G: tone 一本化ほか）の merge — ユーザー手番（P-001）。中身は `~/.claude` にローカル実効済み
- role-engineer の引き継ぎをゲート別 PASS/FAIL の Verdict 形式へ揃える（dotfiles 次 PR — G7/G14 の対の残件）
- Phase D: Scope vs git diff 照合 hook（#173 系・別 PR — 分析 = `docs/reports/2026-08-09-harness-loop-redesign.md`）
- symlink 10 本の実体化 = **Mac セッションの手番**（known-issues 031。skill-lib / agents-lib に git remote があれば Windows へ clone してこちらで実体化する道もある — remote の有無は Mac で確認）

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

# MEMORY (chat-main)

## 進行中

### 🔧 worktree 総入れ替え + 次期 fan-out（着手日: 2026-07-29）

**対象**: GitHub Issues（Epic #290 / #321）・`.claude/comm/outbox/`

- 前回: 新レーン 4 本（refactor-core / schedule-refine / mobile-refine / tags-docs）へ Issue #465〜#474 を fan-out し、各レーンが消化
- 現在: 2026-08-01 の巡回 2 巡目も **open PR 0 のまま**（main `9c6debf7`）。**Epic #290 は Step 2〜7 全て [x]**・**Epic #321 は Phase 2 全消化**（残は Phase 1 の #391 のみ）。outbox は **worktree 5 本の実体を直接 diff して未処理ゼロを確認**（main 側のコピーだけ見ると tags-docs の未 push 4 エントリを取りこぼすが、内容は #511 / #512 / 判断キューで処理済み。schedule-refine 分は #520 として起票済み）。#523 のレビュー検出は **#524** として起票
- 次: **(1)** open Issue 9 件を各レーンへ流す（#507 / #509 / #511 = materials、#519 = connect、#520 / #524 = schedule、#512 / #517 = shared-fix、#372 = 将来 DDL）。**(2)** 判断キューの未回答 6 件をユーザーへ（うち **D-20260801-sched-1 = #520 の実装ブロッカー**）

## 直近の完了

- [chat-main] **open PR 巡回（停止条件 = #467 / #468 close + open PR 0）** ✅（2026-08-01）— 巡回開始時の open PR 2 本（#522 tracker 復元 / #523 d3 sim を発火時読み取りへ）を `/code-review low` で確認中に両方 merge され、**open PR 0・#467 / #468 とも CLOSED で停止条件達成**。Epic #290（Step 2〜7 全 [x]）/ Epic #321（Phase 2 全消化）/ mobile-scope.md / plans Status は各レーンの PR 内で追随済みで chat-main の追加修正は不要だった。outbox 全 18 ファイルの未処理エントリもゼロ。**レビューで 1 件検出（未起票 → 「予定」参照）**

- [chat-main] **worktree 総入れ替え + Issue fan-out + V4 実ブラウザ検証** ✅（2026-07-29）— 旧 worktree 5 本を撤去（PR state で全ブランチの merge 済みを実測してから削除。未 PR だった `claude/enhance-mobile-work-section-Cmphw` の demo HTML はユーザー判断で削除・退避済み）+ ローカル 74 / リモート 89 ブランチ削除 → 新レーン 4 本作成。Issue #465（MainScreen hooks = DataService 分割計画の最終ステップ）/ #466〜#469（Epic #290 Step 5-b・5-c・6・7）/ #470〜#473（Epic #321 Phase 2）/ #474（plans/ Status 棚卸し）を起票。あわせて V4 (#411) を claude-in-chrome で実測し 3 pass / 1 fail（`[[` リンクのクリック遷移 → **#475**）。検証計画は全項目消化で COMPLETED → archive

- [chat-main] **残 Issue 消化体制の再編 + outbox 起票依頼の一括消化** ✅（2026-07-25〜26）— worktree 4 本体制へ再編（shell-refine #320→#304 子2 / briefing-section #318 / schedule-refine #352〜#355 / analytics-refine #334・#356。全て 09bae027 起点・.session-* 設定済み・新規 2 本は npm ci 済み）+ 残骸 worktree 5 本撤去 + Issue 22 件起票（#352〜#356・#360〜#376。#374 は事後記録で即 close）+ Epic #290 チェックリスト追随 + `section:tags` ラベル新設。code-reduction 計画書（2026-07-25-code-reduction.md）は dev クローン（C:\Users\user\dev\life-editor）の code-reduction worktree に git 未追跡で残存していたのを発見・回収 → 実行記録 + 実測訂正を Worklog 転記のうえ Status: COMPLETED で archive/ へ収録（PR #377 同梱）。**この PC は orca / dev の 2 クローン構成**（探索時は両方を見ること）。起票依頼→Issue の全マッピングは outbox 2026-07-26 エントリ参照

## 予定

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

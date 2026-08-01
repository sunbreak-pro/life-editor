# HISTORY (chat-main)

### 2026-08-01 - open PR 巡回の完走（open PR 0 到達・Epic #290 / #321 の DoD 実測確認・#523 のレビュー検出 1 件）

#### 概要

「open PR を巡回して merge 可能なものを報告 → outbox の未処理を処理 → merge を検知したら Epic のチェックボックスと docs Status を追随」の巡回を、停止条件（#467 / #468 close + open PR 0）まで走らせた。巡回開始時の open PR 2 本はレビュー中にユーザーが merge したため、レビュー結果は merge 後の指摘として記録に残す形になった。

#### 変更点

- **停止条件の達成**: #467（Step 5-c Mobile List+FAB）・#468（Step 6 台帳タグレンズ）とも CLOSED、open PR は 0（巡回中に #521 / #522 / #523 が merge され main は `8e624422`）
- **PR レビュー 2 本**: #522（tracker 復元・docs 専用）は本文の 3 claim を `git show origin/main:` で実測照合し全一致 — 指摘なし。#523（`useGraphInteraction` の d3 sim を発火時読み取りへ）は変更自体は正しいが、**deps から `simRef.current` を落としたことでリスナーの貼り直し機会がサイズ変更時のみになる**副作用を検出（下記）
- **検出（未起票・memory「予定」に記録）**: `GraphCanvas.tsx:178` の `onSelect` は `selectedId` を掴む inline クロージャで、effect が凍結すると**選択中ノードの再クリックによる選択解除が常に効かなくなる**。従来は `simRef.current` の dep がグラフ再構築のたびに偶然貼り直していたため「たまに効く」状態だった（#523 が壊したのではなく確定化させた）。直しは #523 と同じ発想でコールバックも ref 経由の発火時読み取りにする
- **Epic / docs の追随は不要と実測**: Epic #290 は Step 2〜7 が全て [x]（PR 番号・merge commit つき）、Epic #321 は Phase 2 の 5 項目すべて [x] で残は Phase 1 の #391 のみ。mobile-scope.md・plans の Status 行も各レーンが自 PR 内で追随済みだった
- **outbox 巡回**: 全 18 ファイルを走査し、最新の未処理候補（chat-schedule-refine 2026-08-01 の起票依頼 = #520 起票済み / 「記録のみ」項目 = 本人が tracker で処理済み）まで含めて**未処理ゼロ**を確認
- **残タスク**: open Issue 8 件（#507 / #509 / #511 = materials、#519 = connect、#520 = schedule、#512 / #517 = shared-fix、#372 = 将来 DDL）+ Epic #321 Phase 1 の #391

### 2026-07-26 - chat-main 宿題消化（outbox 起票依頼 17 件 → #360〜#376・code-reduction 計画書の回収と COMPLETED 化）

#### 概要

前日の worktree 再編（4 本体制 + Issue #352〜#356 起票）に続き、各レーン outbox に溜まっていた起票依頼を一括消化した。起票前に docs-consistency の実測必須則に従い主要 claim を spot check（savePositions の読み手不在 / softDeleteNoteUnified の assignment 非波及 / check.sh・labels.ts の stale コメント / CI に eslint ジョブ不在 / useDayStartHourPref・NoteNodeType/createFolder の現存）。

#### 変更点

- **起票 17 件**: code-reduction Step 14 = #360〜#364 / materials 系 = #365〜#369（`section:tags` ラベル新設・#368）/ editor-ux 系 = #370〜#372 / settings = #373 / briefing 事後記録 = #374(即 close）/ connect+materials folder 退役後段 = #375 / schedule 統合生成パネル = #376
- **カバー済み判定**: analytics タグ後継集計（materials 2026-07-11 依頼）= #334 の候補 3 / analytics「今日」追随 = #356 / Mobile 省略 Provider 記述乖離 = PR #326 で解消済み（起票不要）
- **計画書の回収と COMPLETED 化**: `2026-07-25-code-reduction.md` は origin/main・tracker ブランチ（#340/#343 merged）とも不在 → 一次結論は「Mac 側ローカル想定・差し戻し」だったが、ユーザー指摘（Windows でしか触っていない）を受けて再探索。セッション記録（`~/.claude/projects/`）の grep で **dev クローン**（`C:\Users\user\dev\life-editor\.claude\worktrees\code-reduction`・git 未追跡 `??`）に実体を特定し回収。実行記録（PR #338〜#351・A15 SUPERSEDED・A18 修理・C9/C10 非実行）+ 実測訂正（C4/C6/C2/A21/Step 7）を Worklog に転記し、Status: COMPLETED で `archive/` へ収録（PR #377 同梱）。**教訓: この PC は orca / dev の 2 クローン構成 — ファイル不在の結論を出す前に両クローンとセッション記録を探索すること**
- **ブランチ棚卸し**: ローカル 17 本中 16 本の PR MERGED を機械確認（`git branch -D` は deny ルールのため削除コマンドをユーザーへ提示・memory のクリーンアップ節を更新）。`claude/briefing-evening-patch-fix` のみ PR 無しで保留（中身確認まで削除しない）

### 2026-07-19 - Notes/Daily エディタ即クラッシュ修正（tiptap Suggestion PluginKey 衝突・PR #294）

#### 概要

Notes のアイテムクリックで詳細パネルが真っ白になる regression（#288 merge の [[ autocomplete 導入で顕在化）を Windows 機の chat-main で診断・修正。"/" スラッシュメニューと "[[" オートコンプリートが @tiptap/suggestion の共有デフォルト PluginKey に衝突し、両方を登録する Notes/Daily エディタが ProseMirror の RangeError でマウント時にクラッシュしていた。

#### 変更点

- **Root Cause**: `web/src/notes/slashCommand.ts` / `itemLinkSuggestion.ts` の両 `Suggestion({...})` が `pluginKey` 未指定 → 共有デフォルト `SuggestionPluginKey` に二重登録 → `RangeError: Adding different instances of a keyed plugin (suggestion$)`。実行時にのみ発生し型/build 検証は通過するため merge 前検出不可（運用どおり merge 後の chat-main 実ブラウザ確認で発覚）
- **Fix**: 各 Suggestion に module-level の固有 `PluginKey`（`"slashCommand"` / `"itemLinkSuggestion"`）を付与（2 files, +14 行・commit `11acaac0`）。一時 worktree `tmp-suggestion-key` 経由で push・push 後即削除（main 直 push 禁止準拠）
- **起票/追跡**: Issue #293（type:bug / sev:blocking / section:materials・DoD 付き）→ PR #294 が `Fixes #293`。issue-dispatch スキルは Windows 機に未配備のため gh 直接起票
- **検証**: web build（tsc -b --force + vite）0 / eslint 対象 2 ファイル 0 / role-qa 独立レビュー PASS（BLOCKING/IMPORTANT 0 — prosemirror-state の `Configuration` 実装を実測し、module-level PluginKey の複数エディタ共有はキー衝突判定が単一 EditorState 内のみのため安全と確証。MINOR 1 件 = const 配置の見た目のみ・見送り）。merge 後の実ブラウザ確認（Issue #293 DoD）は「予定」に登録

### 2026-06-27 - Loop Engineering Step 3 + 並行レーン memory 棚卸し（#105 merged / connect-link-ui 検出）

#### 概要

Loop Engineering の自動検証ループ（`scripts/loop-engine/`）を Step 3 まで完成させ PR #106 を作成。続けて全 per-chat memory を git/gh 実態と照合し、マージ済みなのに「PR 待ち / 未コミット」と古いままだった 4 レーンの memory をユーザー認可のもと実態へ同期した。

#### 変更点

- **loop-engine Step 3**: `loop.sh` 新規（run-once を PASS/上限まで反復・4停止条件・課金同意ゲート・空 TODO は子 Claude 起動せず $0）。check.sh/run-once.sh のハードコード絶対パスを script 相対化（worktree 移動・マージ後も動く）。`count_todo` をコメント無視へ修正（TODO 冒頭の例を実タスクと誤認するバグ）。スタブ harness で 4 停止条件＋無課金経路を 5/5 実証（トークン/npm 不使用）。`feat/loop-engine` worktree で commit `c72e61d7` → push → **PR #106 open**。CLAUDE.md §7.4 に Orca ADE worktree 例外 1 行を stash から復元同梱。
- **並行レーン棚卸し**: gh で全 PR 状態を確認（#79/#88/#51/#105/#102/#97/#96/#78/#48/#40/#46/#38/#36 = MERGED、#106 のみ OPEN）。**#105（W8 救出）も merged 済**と判明し chat-main の「open」表記を訂正。stale だった chat-phase3-electron（#79）/ chat-phase4-capacitor（#88）/ chat-work-mobile-unify（#51）/ chat-prototype-mobile（#40/#46/#48）の 4 memory を「完了」へ同期（各ファイル冒頭に棚卸しマーカー付記）。単一書込者原則の例外＝ユーザー明示認可の cross-lane reconciliation。
- **検出した宙吊り（申し送り）**: `connect-link-ui` worktree が **台帳外の生きたレーン**（別セッションで Connect リンク作成/削除 UI を実装中・独自 commit `8711acfe`・未コミット 3 ファイル・`.session-name`/memory 無し・PR 未作成）。`stash@{1}` に DU-F Step 6-14 の未コミット作業が宙吊り。本コミットでは触らず記録のみ。

### 2026-06-27 - 進捗整理 + worktree 棚卸し + W8 対話グリッド救出（PR #105）

#### 概要

「現在のタスク進捗を整理 + 全タスクを終わらせたい」依頼を受け、全体監査 → main 同期 → 唯一の未マージ実作業 w8-salvage の仕上げ → PR 化 → merge 済み worktree のお掃除を一気通貫で実施。tracker メモリが古く多数の「PR 未作成」が実は merged だったことを突き止め、現実に再同期した。

#### 変更点

- **全体監査**: gh 認証断による偽陰性（PR 0件・branch 1本）に一度誤誘導されたが再認証で確定。「未マージ実作業」と記録されていた W4(#78)/Phase3(#79)/Phase4(#88)/Work-mobile(#51)/Kanban(#102)/W8(#96/#97) は**全て merged**。真の未マージは **w8-salvage 1件のみ**と特定。
- **main 同期**: origin/main へ rebase（behind 7→0）。詰まりの原因 2 件を解消 = (1) PR #98 の hooks symlink 化とローカル実ファイルの型不一致 → working tree を一旦実ファイルへ戻して rebase、着地で symlink 復帰。(2) CLAUDE.md 衝突 → ローカル版が stale（`shared/src/services` を `frontend` へ逆戻り・schedule-management 行欠落）と判明し origin 版採用、旧編集は `stash@{0}` に保全。
- **w8-salvage 仕上げ**（PR #105・commit `14d9719e`）: サブエージェント監査で完成度 85–90%・3 機能とも実データ結線済みと確認。残作業を実施 — `pxToMinutes` ゼロ高さフォールバックを「1px=1分」傾きへ修正（失敗していた layout 単体テスト緑化）/ `weekTimeGrid.test.tsx` に対話テスト4本追加（jsdom が PointerEvent 非実装で RTL fireEvent.pointerDown が button を落とす罠を、ネイティブ `MouseEvent("pointerdown")` 発火で回避）/ origin/main へ rebase（merge-tree クリーン）/ 計画書 Draft→In Progress。検証: shared 503 pass・shared tsc -b 0・web build exit 0。
- **検証の工夫**: worktree は node_modules 非共有のため、メイン worktree の `node_modules` / `shared/node_modules` / `web/node_modules` を symlink で借用（package.json 同一）→ ENOSPC リスク（残 2.9Gi）を回避して install なしで全テスト/build 実行。
- **お掃除**: merge 済み 6 worktree（hooks-symlink / phase3-electron / w4-analytics-connect / w8-dedup / w8-schedule-calendar / web-kanban-ui-ux）を `git worktree remove` で prune。残 worktree = main + w8-salvage のみ。ローカル/remote の merged branch 削除は `git branch -D` deny ルールのためユーザー実行（tracker 予定に列挙）。

> 古いエントリは [`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照

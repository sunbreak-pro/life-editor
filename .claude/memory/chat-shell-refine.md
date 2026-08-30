# MEMORY (chat-shell-refine)
> RETIRED: 2026-08-30 — worktree 廃止・書き手不在（D-20260830-main-1）

## 進行中

### ⏸️ #412 / #421 / #419 の 3 PR = merge 待ち（着手日: 2026-07-28）

**対象**: `web/src/{tasks/KanbanView,notes/NotesView,wikitag/TagPicker,wikitag/TagPill}.tsx` + `shared/src/i18n/locales/{en,ja}.json`（#412）/ 新規 `shared/eslint.config.js` + `shared/package.json` + `.github/workflows/ci.yml` + lint 修正 8 ファイル（#421）/ `mcp-server/src/{tools.ts,handlers/taskHandlers.ts}` + 新規 `tests/listTasksContract.test.ts`（#419）

- 前回: 2026-07-28 に 3 Issue を消化し、Issue ごとに `claude/shell-<issue>-<slug>` を origin/main から切って PR 化（#438 / #444 / #447）。判断根拠は各 Issue にコメント済み
- 現在: 3 PR とも open = merge 待ち（merge = こうだいさん）。#438 / #444 は CI 緑を実測、#447 は投稿直後で pending
- 次: merge 後の実ブラウザ検証は main 側の検証セッション（§7.4）。**#412 の申し送り = rightSidebar 本文が `overflow-y-auto` で、TagPicker のドロップダウン（`absolute` / `w-64` = 256px）がサイドバーを下限 240px まで縮めたとき横にはみ出さないかの実測**（既定 320px なら計算上は収まる）

## 直近の完了

- #412 アイテム側のタグ付け外し Phase 1: Kanban 詳細パネルの読み取り専用チップを `TagPicker` に置換し、タスクからタグを付け外しできるようにした。`TagPicker` に `itemRole` を追加して #409 の `ItemRoleBadge` を描画（**種類チップの型はこれで確定** — 汎用「Tags」キャプションを置き換える形にした）。Notes 詳細も `itemRole="note"` に追随。`TagPicker` に直書きされていた英語を `materials.tags.picker*` として en/ja 両 catalog へ。盤面上での直接編集は**見送り**（tag view はカラム＝assignment なのでカードが操作中に移動する）。PR #438（open・CI 緑）✅（2026-07-28）
- #421 shared eslint 導入: **再実測は 51 problems（48 errors / 3 warnings）· 27 ファイル**で Issue 記載の 3 件と大きく違った（あちらは 1 ファイル `--stdin` の値）。「この worktree で検証できるか」で線を引き、11 件（unused-vars 6 / prefer-const / no-empty-object-type / static-components / test の globals 2）を修正、37 件（refs / set-state-in-effect / immutability）は `shared/eslint.config.js` の**per-file baseline** に隔離（severity 下げではなくパス列挙 = リスト外の新規違反は CI で落ちる）。CI の `shared — lint (eslint)` が実際に走って pass するのをログで確認。PR #444（open・CI 緑）✅（2026-07-28）
- #419 MCP `list_tasks` の `folder_id` → `parent_id`: 案 1（旧名を残さない）。**呼び手 = Claude Code はスキーマを読んで引数を選ぶのでパラメータ名がドキュメントそのもの**、という理由で案 2 / 3 を棄却。新名は Issue 提案の `parent_task_id` ではなく `parent_id`（同じ `tools.ts` の `create_task` が同概念に既に使用 — 別名にすると直そうとしたずれを 1 ファイル隣に作り直す）。スキーマを固定する test を新設。PR #447（open）✅（2026-07-28）

## 予定

- **3 PR の merge 後**: 実ブラウザ検証は main 側の検証セッションへ（§7.4）。#419 は **merge 後に MCP の再接続が要る**（稼働中セッションは古いスキーマを掴んだまま `folder_id` を送り続け、その引数は黙って無視される）
- **#412 Phase 2**（chat-main へ起票依頼済み）: **Daily を先行**（`web/src/daily/DailyView.tsx` は詳細パネルを持たない 1 枚ページなので置き場所を決めるだけ・他 worktree と衝突しない）。**Event は #408 / #411 の着地後**（配線先の `EventEditorPane` と rightSidebar を chat-schedule-refine が作り替え中）
- **#421 の残 37 件解消**（chat-main へ起票依頼済み）: rule ごと・ファイル群ごとに小さく分け、merge 後に実ブラウザで確認できる単位にする。`useFrozenNoteSortKey`（8 件）と `UndoRedoContext`（4 件）だけでも独立 1 本
- shared-fix [all] 宛 open 2 件が残存（#363 docs 追随 sweep / #321 Mobile UI/UX Epic）— 次セッション開始時に自分の担当分を判断して着手
- merge 後の実ブラウザ実測は §7.4 に従い chat-main（worktree 側は build / 型検証 / vitest まで）
- ✅ 着手前の残骸は処理済み（2026-07-27）: 旧 `claude/shell-refine-outbox-364`（PR #414 merged）に staged 43 ファイルが残っていた件。`git diff --stat stash@{0} 01fb2d37` が**空 = PR #414 merge 時点の main と全ファイル完全一致**と実測できたため固有の作業ゼロと確定し、ユーザーが `git stash drop` 実行（345b079e）。**staged の「43 ファイル変更」は差分ではなく HEAD が main より 6 コミット遅れていただけ**という見え方の罠。教訓 2 点 =（1）残骸の正体判定は `git status` の件数ではなく「ツリーが既存コミットと一致するか」で見る、（2）あの staged には `chat-analytics-refine` / `chat-briefing-section` の memory・history・outbox が含まれていた（他チャット担当 = §7.4 単一書込者原則違反）ので、`git add -A` していたら巻き込んでいた

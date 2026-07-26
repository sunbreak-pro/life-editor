# MEMORY (chat-schedule-refine)

## 進行中

（なし — 今スプリントのキュー #352 / #353 / #354 / #355 は全て PR 提出済み。merge は 🛑 ユーザーゲート）

## 直近の完了

- **#355 ダブルクリック時の吹き出しフラッシュ抑制** ✅（2026-07-26 — **PR #386**・`Closes #355`。吹き出しだけ 350ms 待たせ、他サーフェスが開いたら effect 1 本で pending 取消。仕組みは `shared/src/hooks/useDeferredAction.ts`（web にテストランナーが無いため shared 側に置いてテスト可能化））
- **#354 生成後に新規アイテムを開く導線** ✅（2026-07-26 — **PR #384**・`Closes #354`。**方式はユーザーがチャットで直接選択**＝生成パネルに「予定を追加」/「追加して詳細へ」の 2 ボタン。Mobile のプレーン作成は**あえて選択しない**（Mobile は選択＝詳細シート表示のため、選択すると 2 ボタンが同じ動きになる））
- **#353 生成パネルに対象日を表示** ✅（2026-07-26 — **PR #382**・`Closes #353`。`EventCreateFields` に読み取り専用の日付行。整形はホスト（対象日とロケールを持つ側）が担当）
- **#352 Epic #290 Step 4 = Routine 頻度編集の未来伝播 + dead code / RoutineGroup 削除** ✅（2026-07-26 — **PR #381**・`Closes #352`・-2337/+454 行。**確認の勘所 = 繰り返しを「曜日」に切り替えた直後に予定が消えないこと**）
- ~~**main のビルド復旧（#378 regression）**（PR #385）~~ → **重複だった**（2026-07-26）。**#383（`eb893f94`, 11:29）が既にバイト単位で同一の修正を入れており、私の #385（11:49 作成）は差分ゼロで squash merge された**（`fe8f0362`）。着手前に `git fetch origin` していれば不要だった PR。**教訓 = main 由来の不具合を見つけたら、直す前にまず fetch して最新 main で再現を確認する**（CLAUDE.md §7.4 はブランチ作成のたびに効く）
- #299 アイテム操作 UI 刷新 ✅（2026-07-25 — merge は 🛑 ユーザーゲート）

## 予定

- merge 順: **#385 は不要（空マージ済み）**。#381 は merge 済み（`a0e1a01c`）。残るは #382 / #384 / #386 で互いに独立
- **#386（#355）は分岐元が古い**（`de7a3eb4` = #381 マージ前）。CalendarTab を触っており main 側の #380 / #381 と近接するので、**merge 前に `git fetch origin && git merge origin/main --no-edit` で取り込むこと**
- Epic #290 の残 Step（Step 5 構成再編 / Step 6 カレンダー台帳配線 / Step 7 エディタ拡充）は section:schedule の open Issue として残る想定。次の着手前に `gh issue list --label section:schedule --state open` + `--label shared-fix` を確認
- chat-main へ起票依頼済み（outbox 2026-07-26 の 3 通）: (1) `web/src/notes/NotesView.tsx:291` の lint error（main 由来）(2) Mobile 月表示で FAB が `mobileSelectedDay` ではなく `anchorDate` に作る (3) 生成直後の楽観行が同期リフェッチで消えると開いたばかりの詳細エディタが閉じる

## 引き継ぎメモ（この worktree で効く事実）

- **自分の変更範囲外の型エラーの原因を「増分ビルド」と決めつけない**（2026-07-26 に一度誤診し、role-qa の監査で訂正）。`web/package.json` の build は**最初から `tsc -b --force`** で references 経由の shared をフルチェックしている（`cd web && npx tsc -b --force --dry` で確認可）。同セッションの他ブランチが緑だったのは増分のせいではなく、**分岐元の main がまだ壊れていなかった**だけ（`git merge-base origin/main <branch>` で実測できる）。#378 のような squash merge 事故は**壊れた版がどのブランチにも存在せずマージ後の main にだけ現れる**ので、手元の検証を厳しくしても捕まらない — 穴は「マージ後の main で誰もビルドしない」側にある
- **この PC には skill-lib の実体が無い**（`.claude/skills/` の中身は Mac パスへのシンボリックリンクがテキストとして checkout されている）。`session-loader` / `task-tracker` 等は Skill ツールから起動できないため、セッション開始・進捗記録は手動（memory/ + history/ を直接編集）
- **`web` の lint は緑ではない**: `web/src/notes/NotesView.tsx:291` の 1 error は main 由来。セクションの標準ゲートは shared test / shared build / web build で lint を含まないので、赤を自分の変更のせいと誤認しない
- **`REALTIME_TABLES`（`shared/src/context/SyncContext.tsx`）は publication と完全一致が不変式**（`shared/tests/syncRealtimeTables.test.ts` がハードカウント込みで検証）。DDL を伴わないコード削除でテーブルを購読リストから外すとテストが落ちる — #352 で一度踏んだ
- **`web` にテストランナーが無い**（scripts は dev / build / lint / preview のみ）。ホスト側のロジックはテストで守れないので、**判定ロジックは shared の純粋関数 / フックに寄せる**と vitest で pin できる（#352 の `seedFrequencyPatch`、#355 の `useDeferredAction` はこの方針）

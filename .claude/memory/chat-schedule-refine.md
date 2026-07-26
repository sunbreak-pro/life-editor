# MEMORY (chat-schedule-refine)

## 進行中

（なし — 今スプリントのキュー #352 / #353 / #354 / #355 は全て PR 提出済み。merge は 🛑 ユーザーゲート）

## 直近の完了

- **#355 ダブルクリック時の吹き出しフラッシュ抑制** ✅（2026-07-26 — **PR #386**・`Closes #355`。吹き出しだけ 350ms 待たせ、他サーフェスが開いたら effect 1 本で pending 取消。仕組みは `shared/src/hooks/useDeferredAction.ts`（web にテストランナーが無いため shared 側に置いてテスト可能化））
- **#354 生成後に新規アイテムを開く導線** ✅（2026-07-26 — **PR #384**・`Closes #354`。**方式はユーザーがチャットで直接選択**＝生成パネルに「予定を追加」/「追加して詳細へ」の 2 ボタン。Mobile のプレーン作成は**あえて選択しない**（Mobile は選択＝詳細シート表示のため、選択すると 2 ボタンが同じ動きになる））
- **#353 生成パネルに対象日を表示** ✅（2026-07-26 — **PR #382**・`Closes #353`。`EventCreateFields` に読み取り専用の日付行。整形はホスト（対象日とロケールを持つ側）が担当）
- **#352 Epic #290 Step 4 = Routine 頻度編集の未来伝播 + dead code / RoutineGroup 削除** ✅（2026-07-26 — **PR #381**・`Closes #352`・-2337/+454 行。**確認の勘所 = 繰り返しを「曜日」に切り替えた直後に予定が消えないこと**）
- **main のビルド復旧（#378 regression）** ✅（2026-07-26 — **PR #385**。キュー外だがユーザー判断で別 PR 化。**これを最初に merge する**）
- #299 アイテム操作 UI 刷新 ✅（2026-07-25 — merge は 🛑 ユーザーゲート）

## 予定

- merge 順の依頼: **#385（main 復旧）を先に**。その後 #381 / #382 / #384 / #386 は互いに独立
- Epic #290 の残 Step（Step 5 構成再編 / Step 6 カレンダー台帳配線 / Step 7 エディタ拡充）は section:schedule の open Issue として残る想定。次の着手前に `gh issue list --label section:schedule --state open` + `--label shared-fix` を確認
- chat-main へ起票依頼済み（outbox 2026-07-26 の 3 通）: (1) `web/src/notes/NotesView.tsx:291` の lint error（main 由来）(2) Mobile 月表示で FAB が `mobileSelectedDay` ではなく `anchorDate` に作る (3) 生成直後の楽観行が同期リフェッチで消えると開いたばかりの詳細エディタが閉じる

## 引き継ぎメモ（この worktree で効く事実）

- **`tsc -b` は増分なので「触っていないファイルの壊れ」を見逃す**。2026-07-26 に main の `analyticsAggregation.ts` が import 重複で壊れていたのを、新規ファイル追加で全体チェックが走るまで誰も踏まなかった（PR #378 の merge 事故）。**重要な検証時は `find shared -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete` してから `npx tsc -b --force`**
- **この PC には skill-lib の実体が無い**（`.claude/skills/` の中身は Mac パスへのシンボリックリンクがテキストとして checkout されている）。`session-loader` / `task-tracker` 等は Skill ツールから起動できないため、セッション開始・進捗記録は手動（memory/ + history/ を直接編集）
- **`web` の lint は緑ではない**: `web/src/notes/NotesView.tsx:291` の 1 error は main 由来。セクションの標準ゲートは shared test / shared build / web build で lint を含まないので、赤を自分の変更のせいと誤認しない
- **`REALTIME_TABLES`（`shared/src/context/SyncContext.tsx`）は publication と完全一致が不変式**（`shared/tests/syncRealtimeTables.test.ts` がハードカウント込みで検証）。DDL を伴わないコード削除でテーブルを購読リストから外すとテストが落ちる — #352 で一度踏んだ
- **`web` にテストランナーが無い**（scripts は dev / build / lint / preview のみ）。ホスト側のロジックはテストで守れないので、**判定ロジックは shared の純粋関数 / フックに寄せる**と vitest で pin できる（#352 の `seedFrequencyPatch`、#355 の `useDeferredAction` はこの方針）

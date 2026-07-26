# MEMORY (chat-schedule-refine)

## 進行中

### ⏸️ #376 統合アイテム生成パネル — Step B レビュー待ち（着手日: 2026-07-26）

**対象**: `shared/src/components/schedule/ItemCreatePanel.tsx` / `web/src/schedule/{CalendarTab,useCreatePanelNotes}.tsx`
**計画書**: `.claude/docs/vision/plans/2026-07-14-schedule-redesign.md` §4.6

- 前回: Step A（予定 / タスクタブ）= **PR #393 merge 済み**（main `0c02f10`）
- 現在: Step B（ノートタブ）= **PR #395 OPEN**。ブランチ `claude/schedule-376-note`（main から切り直して cherry-pick 済み・verify 済み）。merge は 🛑 ユーザーゲート
- 次: #395 merge 後に #376 を close → Epic #290 Step 5（構成再編 = 単一 Calendar タブ + 繰り返しフィルタ / Mobile を List+FAB）

## 直近の完了

- **#376 統合アイテム生成パネル Step A** ✅（2026-07-26 — **PR #393** merge 済み `0c02f10`）。`EventCreateFields`（#299）→ `ItemCreatePanel` に置換し、Desktop オーバーレイと Mobile QuickCaptureSheet が同一パネルを描く。予定タブは従来どおり、タスクタブは「新規作成」（`addNode` で配置済みタスク）/「既存から選ぶ」（`pickAddableTasks` + 検索 → `updateNode`）。**#298 トレイとの棲み分けを plan §4.6 に明文化**（トレイ = 今日固定・時刻なしの「宣言」／パネル = 任意の日・時刻ありの「配置」。プールは同一なので重複ではなく直列）
- **#355 ダブルクリック時の吹き出しフラッシュ抑制** ✅（2026-07-26 — **PR #386**・`Closes #355`。吹き出しだけ 350ms 待たせ、他サーフェスが開いたら effect 1 本で pending 取消。仕組みは `shared/src/hooks/useDeferredAction.ts`（web にテストランナーが無いため shared 側に置いてテスト可能化））
- **#354 生成後に新規アイテムを開く導線** ✅（2026-07-26 — **PR #384**・`Closes #354`。**方式はユーザーがチャットで直接選択**＝生成パネルに「予定を追加」/「追加して詳細へ」の 2 ボタン。Mobile のプレーン作成は**あえて選択しない**（Mobile は選択＝詳細シート表示のため、選択すると 2 ボタンが同じ動きになる））
- **#353 生成パネルに対象日を表示** ✅（2026-07-26 — **PR #382**・`Closes #353`。`EventCreateFields` に読み取り専用の日付行。整形はホスト（対象日とロケールを持つ側）が担当）
- **#352 Epic #290 Step 4 = Routine 頻度編集の未来伝播 + dead code / RoutineGroup 削除** ✅（2026-07-26 — **PR #381**・`Closes #352`・-2337/+454 行。**確認の勘所 = 繰り返しを「曜日」に切り替えた直後に予定が消えないこと**）
- ~~**main のビルド復旧（#378 regression）**（PR #385）~~ → **重複だった**（2026-07-26）。**#383（`eb893f94`, 11:29）が既にバイト単位で同一の修正を入れており、私の #385（11:49 作成）は差分ゼロで squash merge された**（`fe8f0362`）。着手前に `git fetch origin` していれば不要だった PR。**教訓 = main 由来の不具合を見つけたら、直す前にまず fetch して最新 main で再現を確認する**（CLAUDE.md §7.4 はブランチ作成のたびに効く）
- #299 アイテム操作 UI 刷新 ✅（2026-07-25 — **PR #325 merge 済み**・`2026-07-25T05:17:13Z`）
- #298 Step 3 rightSidebar 本日の Todo tray ✅（2026-07-23 — PR #323 merge 済み・main `5f9abf48`）。**history 側にエントリが無いのはここだけ**なので、この行を消すと merge 済みの記録がこの worktree から消える（#296 / #297 は history の 2026-07-20 に残る）

## 予定

- **#381 / #382 / #384 / #386 / #393 は全て merge 済み**（2026-07-26 実測 = `gh pr list --state all --json number,state`）。#385 は空マージ（重複）。残る open は **#395 のみ**
- **#395 merge 後にやること**: (1) #376 を close（DoD は Issue コメントに記録済み）(2) 実ブラウザ検証を chat-main へ依頼（生成パネルの 3 タブ・既存タスクの配置・ノートのリンクが Connect / Notes 側に出るか）
- Epic #290 の残 Step（Step 5 構成再編 / Step 6 カレンダー台帳配線 / Step 7 エディタ拡充）は未起票の想定。次の着手前に `gh issue list --label section:schedule --state open` + `--label shared-fix` を確認（Step 5 の子 Issue が無ければ chat-main へ起票依頼を outbox へ）
- chat-main へ起票依頼済み（outbox 2026-07-26 の 3 通）: (1) `web/src/notes/NotesView.tsx:291` の lint error（main 由来）(2) Mobile 月表示で FAB が `mobileSelectedDay` ではなく `anchorDate` に作る (3) 生成直後の楽観行が同期リフェッチで消えると開いたばかりの詳細エディタが閉じる

## 引き継ぎメモ（この worktree で効く事実）

- **自分の変更範囲外の型エラーの原因を「増分ビルド」と決めつけない**（2026-07-26 に一度誤診し、role-qa の監査で訂正）。`web/package.json` の build は**最初から `tsc -b --force`** で references 経由の shared をフルチェックしている（`cd web && npx tsc -b --force --dry` で確認可）。同セッションの他ブランチが緑だったのは増分のせいではなく、**分岐元の main がまだ壊れていなかった**だけ（`git merge-base origin/main <branch>` で実測できる）。#378 のような squash merge 事故は**壊れた版がどのブランチにも存在せずマージ後の main にだけ現れる**ので、手元の検証を厳しくしても捕まらない — 穴は「マージ後の main で誰もビルドしない」側にある
- **この PC には project 側 skill-lib の実体が無い**（`.claude/skills/` の中身は Mac パスへのシンボリックリンクがテキストとして checkout されている）。ただし **`task-tracker` はユーザーグローバル（`~/.claude/skills/`）にあり Skill ツールから起動できる**（2026-07-26 実測 — 「全て手動」は誤り）。`session-loader` 等プロジェクト固有スキルだけが不在
- **PR は作った直後に merge されることがある**（2026-07-26 実測）。#393 は作成から数分で merge され、後から push した Step B のコミットは PR に入らなかった。**1 PR に段階を積むつもりなら、全部 push し終えてから PR を立てる**。取り残したら `git checkout -b <new> origin/main` + `git cherry-pick <sha>` で切り出せる（Step A の内容は既に main にあるので衝突は最小 — 実際 `shared/src/index.ts` の隣接追加 1 箇所だけだった）
- **`web` の lint は緑ではない**: `web/src/notes/NotesView.tsx:291` の 1 error は main 由来。セクションの標準ゲートは shared test / shared build / web build で lint を含まないので、赤を自分の変更のせいと誤認しない
- **`REALTIME_TABLES`（`shared/src/context/SyncContext.tsx`）は publication と完全一致が不変式**（`shared/tests/syncRealtimeTables.test.ts` がハードカウント込みで検証）。DDL を伴わないコード削除でテーブルを購読リストから外すとテストが落ちる — #352 で一度踏んだ
- **`web` にテストランナーが無い**（scripts は dev / build / lint / preview のみ）。ホスト側のロジックはテストで守れないので、**判定ロジックは shared の純粋関数 / フックに寄せる**と vitest で pin できる（#352 の `seedFrequencyPatch`、#355 の `useDeferredAction` はこの方針）

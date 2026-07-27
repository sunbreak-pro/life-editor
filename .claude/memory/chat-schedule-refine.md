# MEMORY (chat-schedule-refine)

## 進行中

（なし）

## 直近の完了

- **#367 Schedule サイドバーのソート・フィルタ検討** ✅（2026-07-27 — **見送りで決着・コード変更ゼロ・PR なし**。根拠を Issue にコメントして NOT_PLANNED で close）。判断の芯は 4 点 = (1) Routines の rightSidebar は編集フォームだけでリストが存在しない（一覧は main area・`RoutinesTab.tsx:168-194` / `:200-221`）(2) Calendar サイドバーの 2 リストは当日スコープで毎日リセットされ、本番実測で events は 1 日あたり最大 3 件・平均 1.5 件（累積して増える Notes / Daily とは性質が違う）(3) `AgendaList` の now-line は `findIndex(startTime >= nowMinutes)` で**昇順前提**なので direction toggle の desc は機能破壊（`AgendaList.tsx:98-104`）(4) 日スコープでない唯一の pool（`pickAddableTasks`）は `ItemCreatePanel` のタスクタブに既に検索欄がある。**再オープン条件も Issue に明記済み**（addable が常時 20 件超で tray がスクロールする / Routines 一覧が rightSidebar へ移設 or 20 件超）
- **#376 統合アイテム生成パネル（Step A + Step B + QA follow-up）** ✅（2026-07-27 — **PR #393 / #395 / #400 全て merge 済み・Issue #376 close 済み**）。#400 で「ノートのリンクをアイテム本体の行ができてから撃つ」順序バグを解消（main `433974d1`）
- **#376 統合アイテム生成パネル Step A** ✅（2026-07-26 — **PR #393** merge 済み `0c02f10`）。`EventCreateFields`（#299）→ `ItemCreatePanel` に置換し、Desktop オーバーレイと Mobile QuickCaptureSheet が同一パネルを描く。予定タブは従来どおり、タスクタブは「新規作成」（`addNode` で配置済みタスク）/「既存から選ぶ」（`pickAddableTasks` + 検索 → `updateNode`）。**#298 トレイとの棲み分けを plan §4.6 に明文化**（トレイ = 今日固定・時刻なしの「宣言」／パネル = 任意の日・時刻ありの「配置」。プールは同一なので重複ではなく直列）
- #298 Step 3 rightSidebar 本日の Todo tray ✅（2026-07-23 — PR #323 merge 済み・main `5f9abf48`）。**history 側にエントリが無いのはここだけ**なので、この行を消すと merge 済みの記録がこの worktree から消える（#296 / #297 は history の 2026-07-20 に残る）
  （#352 / #353 / #354 / #355 / #385 / #299 は history の 2026-07-25〜26 に全文あり。ここからは間引いた）

## 予定

- **自分宛の open Issue は実測 3 件**（2026-07-27・`gh issue list --label section:schedule --state open` + `--label shared-fix`）: `section:schedule` = **#290（Epic・Step 2〜7 の tracking）のみ**で子 Issue はゼロ。`shared-fix` = **#363（docs 追随 sweep）/ #321（Mobile UI/UX 追随 Epic）**。つまり次に着手できる粒度のタスクが無い状態なので、まず #290 の Step 5 を子 Issue に割ってもらう依頼が要る
- **実ブラウザ検証を chat-main へ依頼する**（#376 の 3 タブ・既存タスクの配置・**既存ノートを選んだときにリンクが Connect / Notes 側に出るか** — ここが #400 で直した経路）。§7.4 の localhost 集約ポリシーによりこの worktree では実測できない
- Epic #290 の残 Step（Step 5 構成再編 / Step 6 カレンダー台帳配線 / Step 7 エディタ拡充）は未起票。Step 5 の子 Issue が無ければ chat-main へ起票依頼を outbox へ
- chat-main へ起票依頼済み（outbox 2026-07-26 の 3 通）: (1) `web/src/notes/NotesView.tsx:291` の lint error（main 由来）(2) Mobile 月表示で FAB が `mobileSelectedDay` ではなく `anchorDate` に作る (3) 生成直後の楽観行が同期リフェッチで消えると開いたばかりの詳細エディタが閉じる

## 引き継ぎメモ（この worktree で効く事実）

- **`wiki_tag_connections` へのリンクは「FK 先の行が DB にできてから」しか書けない**（2026-07-26 の #376 QA で実測）。作成系フック（`createScheduleItem` / `addNode`）は**楽観的 id を同期で返して裏で書く**ので、直後にリンクを撃つとリンクの INSERT が先に飛んで FK / RLS に弾かれる（どちらの writer も `auth.getUser()` の 1 往復から始まるが、リンク側にはその前置きが無い）。**「ローカル state にある」は FK 先の存在証明にならない** — これは #371 が `shared/src/utils/pendingItemLinks.ts` の冒頭に明文化済みの罠で、`DailyView.flushPendingLinks` が正しい流儀。#376 は `opts.onSaved` / `options.onSaved` で同じ規律を作成経路に通した（undo / redo には渡さない = redo が sync を再実行するため二重付与になる）
- **`shared/` に eslint config は無い**（lint は web だけの script）。`cd shared && npx eslint` は config not found で落ちるが、これは異常ではない
- **PR merge は「数分で来る」前提で動く**（2026-07-26 に **2 回**踏んだ = #393 / #395）。どちらも push 前に merge され、後追いのコミットが PR から漏れた。**レビュー → 修正が想定されるなら、PR を立てる前にレビューまで済ませる**。漏れたら `git checkout -b <new> origin/main` + `git cherry-pick <sha>` で切り出し、**main が動いているのでゲートは必ず回し直す**

- **自分の変更範囲外の型エラーの原因を「増分ビルド」と決めつけない**（2026-07-26 に一度誤診し、role-qa の監査で訂正）。`web/package.json` の build は**最初から `tsc -b --force`** で references 経由の shared をフルチェックしている（`cd web && npx tsc -b --force --dry` で確認可）。同セッションの他ブランチが緑だったのは増分のせいではなく、**分岐元の main がまだ壊れていなかった**だけ（`git merge-base origin/main <branch>` で実測できる）。#378 のような squash merge 事故は**壊れた版がどのブランチにも存在せずマージ後の main にだけ現れる**ので、手元の検証を厳しくしても捕まらない — 穴は「マージ後の main で誰もビルドしない」側にある
- **この PC には project 側 skill-lib の実体が無い**（`.claude/skills/` の中身は Mac パスへのシンボリックリンクがテキストとして checkout されている）。ただし **`task-tracker` はユーザーグローバル（`~/.claude/skills/`）にあり Skill ツールから起動できる**（2026-07-26 実測 — 「全て手動」は誤り）。`session-loader` 等プロジェクト固有スキルだけが不在
- **PR は作った直後に merge されることがある**（2026-07-26 実測）。#393 は作成から数分で merge され、後から push した Step B のコミットは PR に入らなかった。**1 PR に段階を積むつもりなら、全部 push し終えてから PR を立てる**。取り残したら `git checkout -b <new> origin/main` + `git cherry-pick <sha>` で切り出せる（Step A の内容は既に main にあるので衝突は最小 — 実際 `shared/src/index.ts` の隣接追加 1 箇所だけだった）
- **`web` の lint は緑ではない**: `web/src/notes/NotesView.tsx:291` の 1 error は main 由来。セクションの標準ゲートは shared test / shared build / web build で lint を含まないので、赤を自分の変更のせいと誤認しない
- **`REALTIME_TABLES`（`shared/src/context/SyncContext.tsx`）は publication と完全一致が不変式**（`shared/tests/syncRealtimeTables.test.ts` がハードカウント込みで検証）。DDL を伴わないコード削除でテーブルを購読リストから外すとテストが落ちる — #352 で一度踏んだ
- **`web` にテストランナーが無い**（scripts は dev / build / lint / preview のみ）。ホスト側のロジックはテストで守れないので、**判定ロジックは shared の純粋関数 / フックに寄せる**と vitest で pin できる（#352 の `seedFrequencyPatch`、#355 の `useDeferredAction` はこの方針）

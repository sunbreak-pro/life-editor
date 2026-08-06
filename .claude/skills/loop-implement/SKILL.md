---
name: loop-implement
description: Issue 1 件を実装し、検証を通して commit まで持っていくループ。着手する Issue が決まった時にユーザーが明示起動する。PR 作成と merge はしない。
disable-model-invocation: true
---

# /loop-implement — Issue 1 件を commit まで

## 目標

指定された Issue 1 件を実装し、検証ゲートを通して commit まで持っていく。1 起動 = 1 Issue。またぐなら分割する。

## 完了条件（機械検証可能）

- `session-verifier` の Verdict が PASS（BLOCKING finding ゼロ）
- 対象 Issue の DoD をすべて満たした状態で commit 済み
- PR 本文の下書きが `.claude/comm/outbox/chat-<self>/pr-draft-<issue>.md` に出ている
- `git diff origin/main --name-only` が Issue に紐づく Scope 内に収まっている（宣言外パスの変更ゼロ）

## 予算

- 反復上限: **5 周**（1 周 = 実装 → 検証 → 修正）。超えたら**仮説を出して停止**する
- 時間上限: **90 分**。開始直後に `START_TS=$(date +%s)` を取り、各周の冒頭で経過を確認する
- **仮説には「次に試すこと」を 1 つ具体的に書く**。「もう少しで終わりそう」だけの仮説は成果として認めない（次の自分が拾えない）

## 停止条件（人間に返す）

- 反復上限・時間上限に当たった
- **DDL / migration が必要**と分かった（適用はユーザーの手番。ローカルファイル先行 → `supabase db push`）
- 宣言した Scope の外に手を入れないと進まない（広げず、計画書か Issue の更新を先に依頼する）
- 要件が二義的で、どちらに倒すかで成果物が変わる（`decisions/chat-<self>.md` に A/B で書く）
- 検証の失敗が環境起因に見える（`/loop-verify` の担当。切り分けをこのループでやらない）

## 使ってよい道具

- `lead-pipeline` スキル — 軽 / 中 / 重のティア判定と、どの工程を呼ぶかの采配表
- `role-engineer` エージェント — 重ティアの実装主体（起動はメインが Agent ツールで行う。再帰起動は不可）
- `session-verifier` スキル — 検証ゲートの正本。ゲートの中身をこのループに転記しない
- `worktree-policy` スキル — ブランチ切替・main 取り込み・マージ済み判定
- `git-workflow` スキル — commit 規約と破壊的操作のガードレール

## 環境の事実（推論では埋まらないので明記する）

- **`git push*` と `gh pr create*` は `permissions.ask`** に入っている。無人実行では答える人がいないので必ず失敗する。だから本ループの完了条件は commit までで、PR 作成は人間の手番に残してある
- **メインリポジトリ直下は `main` 専有**。feature 作業は worktree から。ブランチを切り替えたら `.claude/comm/.session-branch` を必ず書き換える
- **tracker（`memory/` + `history/`）を実装ブランチに載せない**（D-20260801-main-1）。並行ブランチが必ず衝突する。記録は merge 後に 1 commit でまとめ、PR 本文側に要約を書く
- 検証コマンドは `shared` / `web` / `desktop` で別々に回す必要がある（`web` の lint は `web/` 配下しか歩かない）。一覧の正本は CLAUDE.md §7.1
- **`add-feature` / `test-writing` / `db-migration` スキルはこの機械では解決できない**（Mac パスを指す死んだポインタ）。テストの書き方は既存テストに倣う

---

- 1 起動 = 1 目標。「ついでにこれも」で Scope を広げない。広げたくなったら停止条件に当たったと見なす
- 実測した周回数・所要時間は、区切りで `2026-08-04-loop-catalog-implementation.md` の Worklog に 1 行足す

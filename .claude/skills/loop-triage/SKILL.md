---
name: loop-triage
description: 自分宛の open Issue を 1 件ずつ着手可否で判定し、着手順を出すループ。着手前・手が空いた時にユーザーが明示起動する。判定までが範囲で、起票・実装・close はしない。
disable-model-invocation: true
---

# /loop-triage — 自分宛 Issue の仕分け

## 目標

自分のレーン宛の open Issue すべてに「着手可 / 保留（理由 1 行）」の判定をつけ、着手順の 1 位を根拠つきで出す。

## 完了条件（機械検証可能）

- `gh issue list` で取得した自分宛 open Issue の件数と、判定をつけた件数が一致する
- 着手可の Issue に順位がつき、1 位に「なぜ先か」が 1 行ついている
- 二義的と判断した Issue が `.claude/comm/decisions/chat-<self>.md` にエントリとして残っている
- 自分宛 open Issue が 0 件なら「担当なし」の 1 行で終わる（沈黙しない）

## 予算

- 反復上限: **12 件**（1 反復 = 1 Issue の判定）。超えたら残りを判定せず、「未判定 N 件・そのうち効きそうなのはどれか」の**仮説**を出して停止する
- 時間上限: **20 分**。開始直後に `START_TS=$(date +%s)` を取り、数件ごとに経過を確認する（上限の宣言だけでは信用しない）
- どちらかに当たったら成果を切り上げる。上限超過は失敗ではない

## 停止条件（人間に返す）

- **自分宛かどうかが判断できない** Issue がある（レーンの境界が読めない）
- 判定の前提が **未回答の decision に依存**している（`decisions/ANSWERS.md` に答えが無い）
- 判定の結果、**Issue 本文の修正や新規起票が必要**と分かった（起票は chat-main 一元）
- 上のいずれでもない曖昧さは停止せず、`decisions/chat-<self>.md` に書いて**次の Issue へ進む**

## 使ってよい道具

- `docs-workflow` スキル — ラベル routing・起票の一元化・Issue と `docs/known-issues/` の境界の正本
- `worktree-policy` スキル — 自分のレーンの担当範囲に迷ったとき
- `gh issue list` / `gh issue view`（`-R sunbreak-pro/life-editor`）— **読み取りのみ**
- 書き込んでよいのは `.claude/comm/decisions/chat-<self>.md` と `.claude/comm/outbox/chat-<self>/` の 2 か所だけ

## 環境の事実（推論では埋まらないので明記する）

- 自分のレーン名は `.claude/comm/.session-name`。宛先ラベルは `section:<id>`（`shared/src/sections.ts` の SectionId と一致）と `shared-fix`（宛先はタイトル prefix `[<slug>]`）の 2 系統
- **`issue-dispatch` スキルはこの機械では解決できない**（Mac パスを指す死んだポインタ）。起票が要るものは outbox へ依頼を append する
- **Issue への書き込み（起票・コメント・close）は機械では止まっていない**。chat-main 一元の規約は文章だけなので、ここは自分で守る

---

- 判定の粒度は「リンク先を開かなくても着手可否が分かる」まで。それ以上は書かない
- 実測した反復数・所要時間は、区切りで `2026-08-04-loop-catalog-implementation.md` の Worklog に 1 行足す（上限値の改訂根拠になる）

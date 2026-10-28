---
name: issue-prompter
description: open GitHub Issue を宛先ラベルで worktree レーンごとに束ね、各レーンのチャットへ貼る /goal コマンド文字列を組み立てて表示する（chat-main 専用・読み取りのみ）。Triggers include "goal プロンプト", "各 worktree に配る", "レーンに投げる", "貼り付け用プロンプト", "issue-prompter", "prompt fan-out".
---

# issue-prompter — Issue → 各 worktree の `/goal` プロンプト生成

起票済みの open Issue を**宛先ラベルで束ね直し、レーンごとに 1 本の `/goal` 文字列**にして表示する。
配達物を宛先ごとに仕分けて宅配便の送り状を書く役で、荷造り（起票）も配送（実装）も別の担当がやる。

- **上流 = `issue-dispatch`**（起票・ラベル付け）。本スキルは起票しない
- **下流 = 各 worktree チャット**（実装）。本スキルは実装しない
- **`execution-router` の life-editor 特化版**。モード選定の一般則はそちらが正本で、ここは「Issue → レーン → `/goal` 文面」の組み立てだけを持つ
- **読み取り専用**: Issue・git・ファイルへの書き込みを一切しない。出力はチャットに表示するテキストのみ（2026-08-17 ユーザー確定）

## 起動条件

「各 worktree に配って」「goal プロンプト作って」「今 open な Issue をレーンに投げたい」。
起票そのものを頼まれたら `issue-dispatch`、1 レーン内の実装の進め方なら `lead-pipeline` へ。

## 手順

### 1. 収集（並列）

```bash
gh issue list -R sunbreak-pro/life-editor --state open --limit 200 --json number,title,labels,url
gh pr list -R sunbreak-pro/life-editor --state open --json number,title,headRefName,body
gh pr list -R sunbreak-pro/life-editor --state merged --limit 300 --json number,headRefName,body,mergeCommit
git fetch origin
git branch -a
git worktree list
```

**配る前に、既存のブランチと PR を必ず確かめる。** Issue 番号 `<n>` を、PR の本文（`Refs #<n>`）、PR のブランチ名、`git branch -a` の出力の 3 か所で探す。ブランチ名は `-<n>` で終わるか、`-<n>-` を含む形を当たりとする。open PR か `git branch -a` に当たる Issue は着手済みなので配らない。merged PR に当たり、その `mergeCommit` が origin/main に入っている Issue も配らない（実装は済んでいて、実ブラウザの確認と close だけが残っている）。ブランチだけあって PR が無い Issue も同じ扱いにする（PR を開く前に止まった作業が残っているため、新しく切り直すと二重実装になる）。

open PR が既に紐づく Issue は**除外**する（本文・ブランチ名に `#<n>` を含むもの）。着手済みを再度配ると二重実装になる（#473 で 40 分溶けた）。

ただし **`chore/tracker-*` / `chore/outbox-*` ブランチの PR は数えない** — tracker PR の本文は「今日触った Issue」を一覧で列挙するため、実装 PR と同じ扱いにすると未着手の Issue まで丸ごと除外される（2026-08-17 初回実行で #889 ほかが誤除外になりかけた）。

`status:frozen` ラベルの Issue も配らない（着手判断がユーザー待ちのため）。「止まっている」に理由付きで載せる。

本文が**着地済み PR を明示している** Issue（「実際の着地は PR #<n>（merged）」等）も配らない。
「open PR あり」の除外は merged PR を拾えないため、この形の Issue を規則どおり配ると**空の PR を
作らせる**（実例 = #993: 本文が PR #1078 merged と明記、残作業は chat-main の実測のみだった）。
残りが実測・判断だけなら「止まっている」へ回す。

### 2. 宛先解決（上から順に当てはめる）

| 判定                                                                                          | 宛先                                                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 依存する作業のうち、PR が origin/main に入っていないものがある（判定は下の「依存の判定」） | **配らない**。「止まっている」に、止めている Issue 番号つきで載せる（ラベルより先に判定する） |
| `shared-fix` + タイトル `[<slug>]`                                                            | その slug の worktree                                                             |
| `section:<id>`                                                                                | slug が `<id>` で始まる worktree（`section:schedule` → `schedule-refine`）        |
| `shared-fix` + `[all]`                                                                        | **配らない**。禁止則（`docs-workflow`）— 個別 slug への割り直しを提案する         |
| 上のどれでもない / 候補が複数                                                                 | **配らない**。「止まっている」に「宛先が決まらない」で載せる                                |

#### 依存の判定

依存は Issue 本文の `依存する作業: #a, #b` から読む（Issue フォームから起票した本文では `### 依存する作業` の見出しの次の行に同じ値が入る）。`なし` ならば依存なし。旧い書式（`依存: #n` / `Parent: #n`）も同じ意味で読む。ただし `依存: なし（#n は close 済み）` のように先頭が `なし` の行は依存なしとして扱い、括弧の中の番号は拾わない。

依存先 `#d` は、**close されたかではなく、その PR が origin/main に入ったか**で判定する。close は人の手番で遅れる（P-001 のため merge も close もこうだいさんが行う）うえ、実装 PR の merge 前に手で close されることもあるからです。

1. 収集した merged PR のうち、本文に `Refs #d` を含むか、ブランチ名が `-d` で終わる（または `-d-` を含む）ものを探す
2. 見つかった PR の `mergeCommit.oid` について `git merge-base --is-ancestor <oid> origin/main` を実行し、exit 0 なら着地済み
3. 着地済みの PR が 1 本でもあれば、その依存先は満たされている
4. 満たされない依存先が 1 つでもあれば、その Issue は止める。理由は次のどれかで書く: 「PR #x が open」「PR なし」「merge 済みだが origin/main に無い」「close 済みだが着地した PR が見つからない」

`gh issue view` の state が closed でも、2 で通らなければ満たされていない扱いにする。

推測で宛先を埋めない。`git worktree list` に無い slug 宛の Issue も「止まっている」へ回す。
同じファイルを 2 レーンに触らせない（one writer per artifact）— Scope が重なる Issue は片方を「止まっている」へ落とす。
依存の判定はラベルでは代替できない — ツアー 4 本（#1122〜#1125）はラベル上 3 レーン宛だったが、
3 本が「基盤の完了が前提」で、無視して配ると**存在しない `TourProvider` に 3 レーンが同時着手**し、
全員が `shared/src/i18n/resources.ts` を触って one writer も破れるところだった（2026-08-27 実例）。

### 3. `/goal` 条件の組み立て

条件は**英語・観測可能・4,000 文字以内**（判定モデルは Haiku）。レーンの open Issue を 1 本にまとめる。

```
/goal in the life-editor worktree for <slug>: every open issue below has a branch off origin/main, a green local run of the CI verify steps, and an opened PR referencing it — #<n1> <title1>, #<n2> <title2>. Read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch on every branch switch, merge nothing yourself, and end with the hand-off table defined in the "セッション終了時の引き継ぎ表" section of .claude/skills/docs-workflow/SKILL.md.
```

**終端は「PR を開くまで」で切る** — merge と Issue close はユーザーの手番（POLICY P-001）なので、そこを条件に入れると人待ちで永久に達成されない。

### 4. 出力フォーマット

出力は「配れる」と「止まっている」の 2 つに分ける。どの Issue も必ずどちらか一方に載る（件数の合計が open Issue の数に合うことを確かめる）。

**配れる** はレーンごとに 1 ブロック。ヘッダに宛先と件数、続けて貼り付け用の 1 行。

```
## 配れる

### <slug>  ← section:<id> / 3 件（#812 #830 #845）
<`/goal` 1 行>
停止: 3 本の PR が open になったら（merge は待たない）
```

**止まっている** は 1 つの表にする。「止めている Issue」は依存待ちのときの依存先の番号で、依存待ちでなければ `—` と書く。

```
## 止まっている

| Issue | 理由                         | 止めている Issue |
| ----- | ---------------------------- | ---------------- |
| #2285 | 依存先の PR が open          | #2223            |
| #2334 | 着手済み（ブランチあり）     | —                |
| #2037 | status:frozen                | —                |
| #2215 | 宛先が決まらない             | —                |
```

理由は「依存先の PR が open / 依存先に PR なし / 依存先は close 済みだが着地した PR が見つからない / 着手済み（open PR）/ 着手済み（ブランチあり）/ 着地済み（PR #x が origin/main に入った・Issue は確認待ち）/ status:frozen / 宛先が決まらない / `[all]` は配らない / Scope が他の Issue と重なる」のどれかから選ぶ。「着地済み」の行は、残っている作業が実ブラウザの確認と close だけなので、こうだいさんか chat-main の手番として読む。

## 安全則

- `/goal` は Claude が実行しない。**文字列を出すだけ**（`rules/heavy-workflows.md`）。ユーザーが各レーンのチャットに貼る
- 1 レーンに 1 本まで。同じレーンへ複数の `/goal` を並べない（後勝ちで前が消える）
- 各ブロックに「いつ止めるか」を必ず 1 行添える
- `/goal` は CLI v2.1.139+ が要る。古ければ `claude --version` を促す

## Gotchas

- **Issue 一覧は git のブランチ状態に依存しない**が、`gh pr list` は origin が古いと取りこぼす。収集前に `git fetch origin main`
- **worktree が `chore/tracker-*` ブランチにいるのは正常**（tracker 分離 = D-20260801-main-1）。着手中とは限らないので、手番の判定に使わない
- **レーンの手番確認は `.claude/memory/INDEX.md`**。open Issue 数だけ見て「暇そう」と判断しない。
  退役レーンは RETIRED マーカーで「進行中」の集計から除外済み（#1135 / D-20260830-main-1）。
  迷ったら worktree のブランチ実測で裏取りする

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
git worktree list
```

open PR が既に紐づく Issue は**除外**する（本文・ブランチ名に `#<n>` を含むもの）。着手済みを再度配ると二重実装になる（#473 で 40 分溶けた）。

ただし **`chore/tracker-*` / `chore/outbox-*` ブランチの PR は数えない** — tracker PR の本文は「今日触った Issue」を一覧で列挙するため、実装 PR と同じ扱いにすると未着手の Issue まで丸ごと除外される（2026-08-17 初回実行で #889 ほかが誤除外になりかけた）。

`status:frozen` ラベルの Issue も配らない（着手判断がユーザー待ちのため）。采配欄に理由付きで残す。

本文が**着地済み PR を明示している** Issue（「実際の着地は PR #<n>（merged）」等）も配らない。
「open PR あり」の除外は merged PR を拾えないため、この形の Issue を規則どおり配ると**空の PR を
作らせる**（実例 = #993: 本文が PR #1078 merged と明記、残作業は chat-main の実測のみだった）。
残りが実測・判断だけなら采配欄へ回す。

### 2. 宛先解決（上から順に当てはめる）

| 判定                                                                                          | 宛先                                                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 本文に依存宣言があり、依存先が未 close（`Parent: #<n>` / 「〜の完了が前提」「〜に依存する」） | **配らない**。依存先が close されるまで采配欄で待たせる（ラベルより先に判定する） |
| `shared-fix` + タイトル `[<slug>]`                                                            | その slug の worktree                                                             |
| `section:<id>`                                                                                | slug が `<id>` で始まる worktree（`section:schedule` → `schedule-refine`）        |
| `shared-fix` + `[all]`                                                                        | **配らない**。禁止則（`docs-workflow`）— 個別 slug への割り直しを提案する         |
| 上のどれでもない / 候補が複数                                                                 | **配らない**。「chat-main 采配」欄に番号だけ並べる                                |

推測で宛先を埋めない。`git worktree list` に無い slug 宛の Issue も采配欄へ回す。
同じファイルを 2 レーンに触らせない（one writer per artifact）— Scope が重なる Issue は片方を采配欄へ落とす。
依存の判定はラベルでは代替できない — ツアー 4 本（#1122〜#1125）はラベル上 3 レーン宛だったが、
3 本が「基盤の完了が前提」で、無視して配ると**存在しない `TourProvider` に 3 レーンが同時着手**し、
全員が `shared/src/i18n/resources.ts` を触って one writer も破れるところだった（2026-08-27 実例）。

### 3. `/goal` 条件の組み立て

条件は**英語・観測可能・4,000 文字以内**（判定モデルは Haiku）。レーンの open Issue を 1 本にまとめる。

```
/goal in the life-editor worktree for <slug>: every open issue below has a branch off origin/main, a green local run of the CI verify steps, and an opened PR referencing it — #<n1> <title1>, #<n2> <title2>. Read .claude/skills/worktree-policy/SKILL.md first, update .claude/comm/.session-branch on every branch switch, and merge nothing yourself.
```

**終端は「PR を開くまで」で切る** — merge と Issue close はユーザーの手番（POLICY P-001）なので、そこを条件に入れると人待ちで永久に達成されない。

### 4. 出力フォーマット

レーンごとに 1 ブロック。ヘッダに宛先と件数、続けて貼り付け用の 1 行。

```
## <slug>  ← section:<id> / 3 件（#812 #830 #845）
<`/goal` 1 行>
停止: 3 本の PR が open になったら（merge は待たない）
```

最後に 2 行だけ添える:

- **chat-main 采配**: 宛先が決まらなかった Issue 番号の列挙（無ければ「なし」）
- **除外**: open PR 済みでスキップした Issue 番号

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

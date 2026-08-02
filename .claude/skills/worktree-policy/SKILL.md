---
name: worktree-policy
description: life-editor の multi-chat worktree 運用規約の正本。worktree の新規作成・ブランチ切替・main の取り込み・初回 push・マージ済み判定・Windows での削除・Orca ADE 利用時の例外を扱う。worktree を作る / ブランチを切り替える / main を取り込む / merge 済みか確認する / worktree を消す ときに読む。Triggers include "worktree", "ワークツリー", "ブランチ切替", "main を取り込む", "マージ済み", "session-branch", "worktree 削除".
---

# Multi-chat Worktree Policy（**"1 chat = 1 worktree、ブランチは課題ごとに切替"**）

> CLAUDE.md §7.4 の本体。CLAUDE.md 側には禁止事項の要約だけを残し、理由・手順・実測エピソードはここが正本。

## 大前提

- メイン（リポジトリ直下。マシンごとにパスは異なる）は chat-main 専有・**`main` のみ**。**メインで `git checkout <feature>` 禁止** — feature 作業は worktree から
- **1 worktree = 1 チャット。ブランチは課題ごとに切り替える**（2026-07-25 ユーザー確定 #327 — 旧「1 chat = 1 worktree = 1 branch」を SUPERSEDE）: 1 つの worktree が複数 Issue を順に担当するため、Issue ごとに `claude/<slug>-<issue>` 等でブランチを切り直す（実例 = shell-refine worktree 1 本から 9 ブランチ → PR #234/#236/#241/#243/#313/#314/#315/#316/#326）。**worktree に 1 ブランチを固定し続けない** — PR merge 後も同じブランチを使い回すと履歴が絡む

## 置き場所（リポジトリの外）

**worktree はリポジトリの外に置く**（2026-07-29 変更・旧 `.claude/worktrees/<slug>/` を SUPERSEDE）。

置き場所は**リポジトリと同階層の `<repos-parent>/workspaces/life-editor/<slug>/`**（この Windows 機では `C:\Users\user\orca\workspaces\life-editor\<slug>` = Orca の `workspaceDir` 設定と同じ場所）。

理由 = Orca ADE 1.4.160 以降、**`.gitignore` で無視されたパスにある worktree を一覧から除外する**ようになり、リポジトリ内の `.claude/worktrees/` が Orca から一切見えなくなった。2026-07-29 に 3 パターンの実測で確定（リポジトリ外 = 表示 / リポジトリ内かつ非 ignore = 表示 / リポジトリ内かつ ignore = 非表示。Orca は worktree 列挙の直後に `git check-ignore` を実行している）。`.gitignore` の `.claude/worktrees/` 行は旧式作成の保険として残す。Orca 一覧への反映は最大 20 秒ほど遅れる。

**パスは必ず絶対パスで書く**（2026-08-02 実測）: `git worktree add workspaces/life-editor/<slug>` のように相対パスで打つと **cwd 基準で解決される**ため、リポジトリ直下にいるときは `life-editor/workspaces/life-editor/<slug>` という**リポジトリ内**の worktree ができてしまう。worktree の中で同じ相対パスを打つとさらにネストする（実際に `life-editor/workspaces/life-editor/workspaces/life-editor/work-refine` という三重ネストが発生した）。`git worktree list` はフルパスを出すので、作成直後に置き場所を目視で確認する。

## 新規作成は 4 ステップ 1 セット

```bash
git worktree add <repos-parent>/workspaces/life-editor/<slug> -b <branch> origin/main   # 絶対パスで
cd <repos-parent>/workspaces/life-editor/<slug>
echo <branch> > .claude/comm/.session-branch      # .session-name も書く
claude
```

省略禁止 — `.session-branch` 抜けで hook が無音スキップする。

## ブランチ切替は 2 ステップ 1 セット

```bash
git checkout -b <new-branch> origin/main
echo <new-branch> > .claude/comm/.session-branch   # 省略禁止
```

**`.claude/comm/.session-branch` は「今作業中のブランチ名」を都度更新する**。宣言と実態がズレると監査が規約違反と誤判定する（2026-07-25 実例 = shell-refine が `-307` で作業中に `.session-branch` が `claude/shell-refine` のままで、chat-main が「宣言と実態の不一致」と誤報告した）。

**初回 push は `git push -u origin <branch>` と明示する**: `origin/main` から切ると upstream が `origin/main` のまま残り、引数なしの `git push` が「upstream の名前がブランチ名と一致しない」で失敗する（2026-07-30 tags-docs 実測。`tail` へパイプしていると本体の失敗が隠れて exit code 0 に見えるので、パイプ時は `${PIPESTATUS[0]}` を見る）。

## 作業開始前に main を取り込む

（2026-07-11 ユーザー決定）セッション開始時・着手前に 2 段階:

1. `git pull --ff-only`（自ブランチの origin 追従・履歴が割れていたら停止）
2. `git fetch origin && git merge origin/main --no-edit`（main の差分取り込み）

feature ブランチでは (2) を `pull --ff-only` で代替できない（fast-forward 不成立で必ず失敗する）。コンフリクトは細心の注意で手動解消 — 判断に迷う衝突は自動解消せず停止して chat-main / ユーザーに報告。chat-main（main ブランチ）だけは `git pull --ff-only` のみで良い。

## tracker の更新は実装ブランチに載せない

（2026-08-01 ユーザー確定 D-20260801-main-1）1 レーンが複数ブランチを並行させると、各ブランチが同じファイル（`memory/` + `history/`）の同じ位置へ別々の追記をするため**必ず衝突する**（2026-08-01 に schedule-refine の 4 本が全滅し、1 本 merge するたびに次が再衝突した。コードは全部 auto-merge できていた）。

実装 PR では tracker を触らず、**merge 後に 1 commit でまとめる**。引き換えに「PR 単位で何をしたか」の記録が同時に残らなくなるので、PR 本文側に要約を書く。

## マージ済み判定に git の差分を使わない

（2026-07-25 実測）squash merge されたブランチは `git diff origin/main <branch>` / `git log origin/main..<branch>` / `git cherry` のいずれでも「未マージ」に見える（内容は main にあるのにコミット・patch-id が一致しないため）。実例 = 完全マージ済みの `claude/schedule-refine` を `git cherry` が 38 patch 未マージと誤判定。

**判定の正 = `gh pr list --json number,state,headRefName` の state**。差分で確認したい場合は `git merge-tree --write-tree origin/main <branch>` の結果ツリーを main と比較する（衝突マーカーが差分に混ざるので中身の確認まで必須 — 「追加のみ・削除ゼロ」はマーカー分の疑い）。

## Windows での worktree 削除

`git worktree remove` はディレクトリ削除で `Permission denied` になることがある（node_modules がプロセスに掴まれている）。この場合 git 側の登録だけ外れてディレクトリが残るため、worktree 置き場に実体だけの残骸が溜まる。残骸は手動削除する（`git worktree list` に出ないものが対象）。掴んでいるのが Orca のターミナルのときは `orca terminal list --json` で該当 handle を探し `orca terminal close --terminal <handle>` で解放してから削除する（2026-07-29 実測）。

## Orca ADE 利用時の例外処理

Orca の GUI worktree 作成は `.session-branch` / `.session-name` を書かないため hook が無音スキップする。Orca で作った worktree は Claude 起動前に `echo <branch> > .claude/comm/.session-branch`（必要なら `.session-name` も）を手動で書くか、Orca 内蔵ターミナルで上記 4 ステップを踏むこと。メインリポジトリは Orca から開いてもブランチ切替しない（`main` 専有を維持）。

## 実ブラウザ検証・dev server は chat-main のみ

（2026-07-11 ユーザー決定）playwright MCP（実ブラウザ検証）と進捗確認用 dev server は chat-main（メインリポジトリ）のみで起動する。複数 worktree で localhost を重複起動するとポートずれで「どの画面がどの変更か」の確認が壊れるため。各 worktree チャットは build / 型検証（+ vitest）まで — 実ブラウザでの表示確認は PR merge 後に chat-main 側で実測する。

## 課題分配（Issue 駆動）

（2026-07-11 ユーザー決定 — 同日運用の orders .md 台帳 fan-out と worktree 自己起票を SUPERSEDE）chat-main が課題を worktree 関係なくラベル付きで Issue 起票し（手順 = `issue-dispatch` スキル）、各 worktree は自分宛 open Issue をタスクキューとして実行 → close まで担う（詳細 = `docs-workflow` スキル）。

大型の仕様詳細は従来どおり plans/ 計画書として chat-main が一元作成する（commit / PR は main 直 push 禁止のため一時 worktree 経由 — push 後即削除）が、**作業分配・進捗追跡の台帳 .md（orders 等）は新規作成しない**（`docs/vision/plans/_TEMPLATE.md` §Worktree 分担は Issue 参照型）。

## 既知制約

npm install / .tsbuildinfo 非共有・二重 checkout 不可・prune 手順 → `docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md`

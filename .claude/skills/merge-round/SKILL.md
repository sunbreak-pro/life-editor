---
name: merge-round
description: chat-main 専用。open PR を事前確認してから順番に squash merge し、衝突した PR と CI が赤い PR をレーンごとの /goal 指示文にまとめ、回を閉じて戻す地点を記録する。merge 後に戻す手順も持つ。作業レーンでの merge・db push・Issue の close には使わない。Triggers include "merge して", "まとめて merge", "PR を片付けて", "merge-round", "マージの回", "revert したい", "merge を戻したい".
---

# merge-round — chat-main の merge を 1 回ぶんまとめる

こうだいさんがこのスキルを起動したら、それがその回の merge の承認になる（POLICY P-001、D-20261102-main-1）。事前確認を通った PR は確認ダイアログなしで merge する。`hooks/merge-gate.mjs` が、回の一覧にある PR の決まった形の merge だけを通す。

宅配便の集荷にたとえると、積める荷物を全部積んでから、積めなかった荷物の送り主にまとめて連絡するやり方です。1 本 merge するたびに止まって聞くことはしない。

## 前提

- chat-main（リポジトリ直下の checkout、ブランチは `main`）で動かす。worktree の中では hook が merge を止める。
- 最初に `git pull --ff-only` を打つ。手元に変更があって pull できないときは、その変更を報告して止まる。
- スクリプトは GitHub に書き込まない。merge は Claude が `gh pr merge` を 1 本ずつ打つ。

## 手順

### 1. 事前確認と順番

```bash
node .claude/scripts/merge-round.mjs plan
```

表の「判定」は次の 3 つになる。

| 判定         | 当たる PR                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| merge        | CI がすべて通り、手元の `git merge-tree` で main と衝突せず、レーンの手元と PR の先頭が一致し、依存先が main に着地済みか今回の回で先に merge される                         |
| 直してもらう | main と衝突している、または CI が赤い                                                                                                                                         |
| 今回は見送り | 下書き / `merge:hold` ラベル / マイグレーションを含む / `Refs #番号` が無い / Issue が `status:frozen` / CI 実行中 / レーンに未コミットの変更がある / 依存先が未着地 |

順番は、依存の前後を守ったうえで、実装と revert を先に、記録（`chore/tracker-*` など）を後にする。同じ回の中では、他の PR と同じファイルを触る数が少ない PR から、古い PR から並べる。衝突しない PR を先に積み、衝突しうる PR を後ろに寄せるためです。

終了コード 3 は「main の CI が赤い」を表す。その場合は回を始めず、下の「main が赤いとき」に進む。

### 2. 回を始める

```bash
node .claude/scripts/merge-round.mjs start
```

plan の「merge」の PR を今回の一覧として `.git/merge-round/active.json` に書き、戻る地点（この回の前の main の commit）を表示する。plan が 30 分より古いと断るので、plan からやり直す。

### 3. 1 本ずつ merge する

順番どおりに、各 PR で次の 2 つを続けて打つ。

```bash
node .claude/scripts/merge-round.mjs check <n>
gh pr merge <n> -R sunbreak-pro/life-editor --squash
```

`gh pr merge` はこの形で、単独で打つ。`&&` でつなぐ、`--admin` を付ける、`--delete-branch` を付けると hook が確認を出す。ブランチを消さないのは、レーンがそのブランチを開いたままのことがあるからです。

`check` の終了コードで次を決める。

| 終了コード | 意味                                | 次                           |
| ---------- | ----------------------------------- | ---------------------------- |
| 0          | merge できる                        | `gh pr merge` を打つ         |
| 3          | 前の merge で main と衝突した       | 飛ばす。手順 4 で指示文になる |
| 4          | mergeable が 60 秒たっても決まらない | 飛ばす                       |
| 5          | plan の後に push された              | 飛ばす。次の回で確認し直す   |
| 7 / 8 / 10 | close 済み / `merge:hold` / merge 済み | 飛ばす                       |

`gh pr merge` が失敗したら、その出力を報告に書いて次の PR に進む。

### 4. 直してもらう分を指示文にする

```bash
node .claude/scripts/merge-round.mjs fixes
```

最新の main に対して全 open PR を `git merge-tree` で確かめ、衝突した PR と CI が赤い PR を、PR のブランチを開いているレーン（無ければ Issue のラベルから決めたレーン）ごとに 1 本の `/goal` にまとめる。出力はそのまま報告に貼る。モデルは衝突したファイルで決める。

- Haiku 5.5: 衝突が文書（`.md`）と lockfile だけ
- Sonnet 5.5: 衝突が翻訳ファイル（`i18n/locales/*.json`）とテストに収まる
- Opus 5.5: それ以外のコードが衝突している、または CI が赤い

前回と同じ head の PR には「前回と同じ指示」と付くので、レーンがまだ直していないと分かる。レーンが別のブランチで作業中なら、いまの `/goal` が終わってから貼るよう注意が付く。

### 5. 回を閉じる

```bash
node .claude/scripts/merge-round.mjs finish
```

merge した PR と merge commit を新しい順に表示し、`.git/merge-round/rounds/<回の ID>.json` に残す。main の CI の状態も出す。CI が実行中なら、その旨を報告に書く。次の回の plan が結果を確かめる。

### 6. 報告

次の順で書く。

1. merge した PR の表（PR・題・merge commit の先頭 8 文字）と、戻る地点の commit
2. `fixes` の出力（レーンごとの `/goal`、モデル、停止条件）
3. 見送った PR と理由
4. merge 後に残る作業: 実ブラウザでの確認と Issue の close（chat-main とこうだいさんの作業）、マイグレーションを含む PR の db push の順番

レーンが直し終えたら、こうだいさんがもう一度このスキルを起動する。2 回目以降も手順は同じです。

## 止める・戻す

### merge の前に止める

- 特定の PR を外す: `gh pr edit <n> -R sunbreak-pro/life-editor --add-label merge:hold`。plan は見送りにし、回の途中なら `check` が終了コード 8 で飛ばす。ラベルが無ければ最初に `gh label create merge:hold -R sunbreak-pro/life-editor` で作る。
- 回ごと止める: 残りの PR を merge せずに `finish` を打つ。merge 済みの分はそのまま残る。

### merge した後に戻す

main を書き換えない（`reset --hard` と force push は deny 済み）。revert の PR を作り、それもこの回の手順で merge する。

1. 戻す commit を決める。1 本なら `finish` の表か `gh pr view <n> --json mergeCommit` の commit。回ごとなら `.git/merge-round/rounds/<回の ID>.json` の `merged` を新しい順に並べる。
2. 一時 worktree で revert する（パスは `worktree-policy` のとおり絶対パスで書く）。

   ```bash
   git fetch origin
   git worktree add C:/Users/user/orca/workspaces/life-editor/revert-<n> -b revert/pr-<n> origin/main
   cd C:/Users/user/orca/workspaces/life-editor/revert-<n>
   echo revert/pr-<n> > .claude/comm/.session-branch
   git revert --no-edit <新しい commit> <その次> ...
   git push -u origin revert/pr-<n>
   gh pr create -R sunbreak-pro/life-editor --title "revert: <元の題> (#<n>)" --body "Reverts #<n>. Refs #<Issue>"
   ```

3. chat-main に戻り、`plan --only <revert PR>` → `start` → `check` → `gh pr merge` → `finish` で merge する。
4. 元の Issue は `Refs` なので open のまま残る。戻した理由を Issue にコメントし、直した PR を出し直すレーンへ `issue-prompter` で配り直す。

マイグレーションを含む PR は revert しない。反映済みのマイグレーションは中身を変えず、次の番号で戻すマイグレーションを足す（CLAUDE.md §7.3）。db push はこうだいさんの作業のままです。

### main が赤いとき

`plan` が終了コード 3 で止まる。`gh run view <run の URL>` で落ちたステップを見て、直近の回の PR のどれが原因かを決める。原因の PR を上の手順で revert するか、原因の Issue を `issue-dispatch` で起票して直す。どちらにするかはこうだいさんに聞く（AskUserQuestion、推奨は revert）。main が緑に戻るまで新しい回を始めない。

## 安全則

- 作業レーンでは使わない。レーンからの `gh pr merge` は hook が deny する。
- 人の起動なしに回を始めない（定時実行・無人ループに載せない。POLICY P-001）。
- `supabase db push` と Issue の close はこのスキルで行わない。
- 回の一覧にない PR を merge したくなったら、plan からやり直して一覧に入れる。hook の確認ダイアログで押し通さない。

## Gotchas

- GitHub の `mergeable` は merge の直後しばらく `UNKNOWN` になる。plan と fixes は手元の `git merge-tree` で衝突を決め、`check` だけが GitHub の値を最大 60 秒待つ。
- squash merge したブランチは `git log` や `git cherry` で未マージに見える。merge 済みの判定は `gh pr view` の state で行う（`worktree-policy`）。
- 状態は `.git/merge-round/` にあり、commit されない。回は 6 時間で切れ、切れた後の merge は hook が確認を出す。

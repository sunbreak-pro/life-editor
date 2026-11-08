---
name: merge-round
description: chat-main 専用。open PR を事前確認してから順番に squash merge し、文書・lockfile・翻訳だけの衝突は chat-main が一時 worktree で直し、残りの衝突と CI の赤はレーンごとの /goal 指示文にまとめ、回を閉じて戻す地点を記録する。CI は GitHub Actions を見ず手元の local-ci で決める（Actions の支払いロック中も回せる）。merge 後に戻す手順も持つ。作業レーンでの merge・db push・Issue の close には使わない。Triggers include "merge して", "まとめて merge", "PR を片付けて", "merge-round", "マージの回", "revert したい", "merge を戻したい".
---

# merge-round — chat-main の merge を 1 回ぶんまとめる

こうだいさんがこのスキルを起動したら、それがその回の merge の承認になる（POLICY P-001、D-20261102-main-1）。事前確認を通った PR は確認ダイアログなしで merge する。`hooks/merge-gate.mjs` が、回の一覧にある PR の決まった形の merge だけを通す。

宅配便の集荷にたとえると、積める荷物を全部積んでから、積めなかった荷物の送り主にまとめて連絡するやり方です。1 本 merge するたびに止まって聞くことはしない。

## 前提

- chat-main（リポジトリ直下の checkout、ブランチは `main`）で動かす。worktree の中では hook が merge を止める。
- 最初に `git pull --ff-only` を打つ。手元に変更があって pull できないときは、その変更を報告して止まる。
- スクリプトは GitHub に書き込まない。merge は Claude が `gh pr merge` を 1 本ずつ打つ。
- **CI の緑は GitHub Actions を見ない。** Actions が支払いのロックで動かない間（2026-11-05 から）は、`plan` が検査用の一時 worktree（`workspaces/life-editor/merge-verify`）で `node scripts/local-ci.mjs` を回して決める。Actions が動くようになっても、この回の判定は手元の検査に従う。
- 手元の検査は重い。組み合わせを 1 回回すと `npm ci` から始まるので、数分から数十分かかる。赤が出ると PR を 1 本ずつ回し直すので、さらに時間が延びる。ログは `.git/merge-round/verify/<回>.log` に残る。

## 手順

### 1. 事前確認と順番

```bash
node .claude/scripts/merge-round.mjs plan
```

plan は次の順で決める。

1. 下書き・`merge:hold`・マイグレーション・Issue の読めなさ・`status:frozen`・レーンの未コミットなどで見送りにする。
2. `git merge-tree` で main と衝突する PR を「直してもらう」にする。
3. 残りを順番に重ねて、手元の `local-ci.mjs` を回す。全部緑なら、その組み合わせの tree と各 PR の head を `plan.json` に記録する。赤なら 1 本ずつ回し直し、赤い PR を「直してもらう」に回す。通った PR だけを重ね直して、もう一度回す。

表の「判定」は次の 3 つになる。

| 判定         | 当たる PR                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| merge        | 手元の検査で、ほかの PR と積み重ねても緑。レーンの手元と PR の先頭が一致し、依存先が main に着地済みか今回の回で先に merge される                                              |
| 直してもらう | main と衝突している、またはローカル CI が赤い                                                                                                                                  |
| 今回は見送り | 下書き / `merge:hold` ラベル / マイグレーションを含む / `Refs #番号` が無い / Issue が `status:frozen` / レーンに未コミットの変更がある / 依存先が未着地 / 組み合わせ全体が赤 |

順番は、依存の前後を守ったうえで、実装と revert を先に、記録（`chore/tracker-*` など）を後にする。同じ回の中では、他の PR と同じファイルを触る数が少ない PR から、古い PR から並べる。衝突しない PR を先に積み、衝突しうる PR を後ろに寄せるためです。

Issue の「依存する作業」の行には、Issue 番号と PR 番号のどちらが書かれていてもかまいません。PR 番号なら、その PR が main 宛てに merge 済みで、merge commit が `origin/main` に入っていれば着地済みとみなします。Issue 番号なら、それを `Refs` に書いた merge 済みの PR の merge commit で決めます。open の PR の番号は未着地のままです。

plan の表の「ローカル CI」が「緑」のときだけ、次の `start` が回を作る。

main の CI が支払いのロックで止まっているときは、赤に数えない。それ以外で main の CI が赤いと、plan は終了コード 3 で止まる（下の「main が赤いとき」）。

### 2. 回を始める

```bash
node .claude/scripts/merge-round.mjs start
```

plan の「merge」の PR を今回の一覧として `.git/merge-round/active.json` に書く。検査した tree・PR ごとの head・戻る地点（この回の前の main の commit）も一緒に書く。次の場合は断るので、plan からやり直す。

- plan が 30 分より古い
- plan の後に main が進んだ
- ローカル CI の組み合わせが緑でない
- 一覧と検査した組み合わせが違う

### 3. 1 本ずつ merge する

順番どおりに、各 PR で次の 2 つを続けて打つ。

```bash
node .claude/scripts/merge-round.mjs check <n>
gh pr merge <n> -R sunbreak-pro/life-editor --squash
```

`gh pr merge` はこの形で、`check` の直後に単独で打つ。`&&` でつなぐ、`--admin` を付ける、`--delete-branch` を付けると hook が確認を出す。ブランチを消さないのは、レーンがそのブランチを開いたままのことがあるからです。

`check` は GitHub の CI を見ない。代わりに、検査したときの head と今の head が同じかを見る。

`check` の終了コードで次を決める。

| 終了コード | 意味                                                              | 次                           |
| ---------- | ----------------------------------------------------------------- | ---------------------------- |
| 0          | merge できる                                                      | `gh pr merge` を打つ         |
| 3          | 前の merge で main と衝突した                                     | 飛ばす。手順 4 で指示文になる |
| 4          | mergeable が 60 秒たっても決まらない                              | 飛ばす                       |
| 5          | 検査の後に push された                                            | 飛ばす。次の回で検査し直す   |
| それ以外   | close 済み・`merge:hold`・下書き・merge 済み・スクリプトの失敗    | 飛ばす。理由を報告に書く     |

0 以外はすべて飛ばす。hook は `check` が 0 を返した PR しか確認なしで通さないので、`check` を省いて merge すると確認ダイアログが出る。`gh pr merge` が失敗したら、その出力を報告に書いて次の PR に進む。

### 4. 衝突と CI の赤を振り分ける

`fixes` の前に、issue-workflow が作った `wf-*` の worktree のうち PR が open のものを `git -C C:/Users/user/orca/life-editor worktree remove C:/Users/user/orca/workspaces/life-editor/wf-<番号>` で外す。ブランチは origin に残る。`merge-round.mjs` は `autofix-*` と `merge-verify` 以外の worktree をすべてレーンに数えるので、残すと誰もいない worktree 宛てに `/goal` が出て、4a の autofix も「レーンが開いている」で止まるからです（`.claude/issue-workflow.md` の「実行のあと」）。

```bash
node .claude/scripts/merge-round.mjs fixes
```

plan が決めた「直してもらう」を 2 つに分ける。`fixes` は plan の結果を読むだけで、検査は回し直さない。plan が古いときは先に plan を回す。

- **chat-main が直す**: 衝突が文書（`.md`）・lockfile・翻訳ファイル（`i18n/locales/*.json`）だけで、ローカル CI は赤くなく、どのレーンもそのブランチを開いていない PR。手順 4a で直す。
- **レーンに直してもらう**: それ以外。手順 4b の指示文になる。

レーンがブランチを開いている PR を chat-main が直さないのは、同じブランチに書き手が 2 人いると、レーンの手元と push がずれるからです（one writer per artifact）。

#### 4a. chat-main が直す

PR ごとに一時 worktree を作り、main を merge して衝突を出す。

```bash
node .claude/scripts/merge-round.mjs autofix-start <n>
```

出力の「サブエージェントへの指示」をそのまま Agent ツールに渡し、`model: sonnet` で起動する。複数あれば 1 メッセージで並べて起動する（同時 5 体まで）。サブエージェントは衝突を解いて merge の commit まで作り、push はしない。

サブエージェントが終わったら、PR ごとに確かめて push する。

```bash
node .claude/scripts/merge-round.mjs autofix-push <n>
```

`autofix-push` は次をすべて確かめてから、PR のブランチへ fast-forward で push し、一時 worktree を消す。1 つでも外れたら push せずに止まる。

- HEAD が「PR の先頭に、そのときの main を merge した commit」になっている
- 自動の merge の結果と比べて、変わったのが衝突したファイルだけ
- 衝突の印が残っておらず、JSON が読める
- 作業の間にレーンが push しておらず、ブランチを開いてもいない

止まったときと、サブエージェントが「判断できない」と返したときは、`autofix-abort <n>` で片付けて、もう一度 `plan` と `fixes` を打つ。`autofix-abort` はその PR の先頭を覚えておくので、同じ先頭のあいだ `fixes` はその PR をレーンへの指示文に回す。

push した PR は CI（Actions でも手元でも）が走り直すので、次の回の plan で検査し直す。レーンがあとでそのブランチを開くときは、`worktree-policy` のとおり `git pull --ff-only` で取り込む。

#### 4b. レーンに直してもらう

PR のブランチを開いているレーン（無ければ Issue のラベルから決めたレーン）ごとに 1 本の `/goal` にまとめる。出力はそのまま報告に貼る。モデルは衝突したファイルと赤いステップで決める。

- Haiku 5.5: 衝突が文書（`.md`）と lockfile だけ
- Sonnet 5.5: 衝突が翻訳ファイル（`i18n/locales/*.json`）とテストに収まる
- Opus 5.5: それ以外のコードが衝突している、またはローカル CI が赤い

前回と同じ head の PR には「前回と同じ指示」と付くので、レーンがまだ直していないと分かる。レーンが別のブランチで作業中なら、いまの `/goal` が終わってから貼るよう注意が付く。

### 5. 回を閉じる

```bash
node .claude/scripts/merge-round.mjs finish
```

merge した PR と merge commit を新しい順に表示し、`.git/merge-round/rounds/<回の ID>.json` に残す。全部 merge できた回では、main の tree が検査した tree と一致するかも表示する。一致しなければ、merge の途中で main が動いたか、squash の内容が検査と違う。次の回の前に確かめる。

main の CI は、支払いのロックなら「手元の CI で代えた」と表示する。ロックでなければ状態を表示する。

### 6. 報告

次の順で書く。

1. merge した PR の表（PR・題・merge commit の先頭 8 文字）と、戻る地点の commit、検査した tree の先頭 8 文字
2. chat-main が直して push した PR（解いたファイルと、どちらを残したか）と、直せずにレーンへ回した PR
3. `fixes` のレーン宛ての出力（レーンごとの `/goal`、モデル、停止条件）
4. 見送った PR と理由
5. merge 後に残る作業: 実ブラウザでの確認と Issue の close（chat-main とこうだいさんの作業）、マイグレーションを含む PR の db push の順番

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

3. chat-main に戻り、revert の PR を手元の検査にかけてから `plan --only <revert PR>` → `start` → `check` → `gh pr merge` → `finish` で merge する。
4. 回ごと戻したときは、`git fetch origin` のあと `git diff <戻る地点> origin/main --stat` を打ち、差分が空か、戻した回より後に merge した PR の分だけになっているかを確かめる。
5. 元の Issue は `Refs` なので open のまま残る。戻した理由を Issue にコメントし、直した PR はグローバルの `issue-workflow` スキルで実装し直す（life-editor の設定は `.claude/issue-workflow.md`）。

マイグレーションを含む PR は revert しない。反映済みのマイグレーションは中身を変えず、次の番号で戻すマイグレーションを足す（CLAUDE.md §7.3）。db push はこうだいさんの作業のままです。

### main が赤いとき

`plan` が終了コード 3 で止まる。`gh run view <run の URL>` で落ちたステップを見て、直近の回の PR のどれが原因かを決める。原因の PR を上の手順で revert するか、原因の Issue を `issue-dispatch` で起票して直す。どちらにするかはこうだいさんに聞く（AskUserQuestion、推奨は revert）。main が緑に戻るまで新しい回を始めない。

支払いのロックは「赤」ではない。`plan` は支払いの文言か「どのステップも始まっていない」を見て判定し、ロックなら赤に数えない。判定は経験則なので、表示が違うと感じたら `gh run view <run の URL>` で確かめる。

全部の PR がローカル CI で赤になったときも、plan は終了コード 3 で止まる。main 自身が手元で赤い疑いがあるので、`node scripts/local-ci.mjs` を main で回して確かめる。

## 安全則

- 作業レーンでは使わない。レーンからの `gh pr merge` は hook が deny する。
- 人の起動なしに回を始めない（定時実行・無人ループに載せない。POLICY P-001）。
- `supabase db push` と Issue の close はこのスキルで行わない。
- 回の一覧にない PR を merge したくなったら、plan からやり直して一覧に入れる。hook の確認ダイアログで押し通さない。
- chat-main がレーンの PR のブランチへ push するのは `autofix-push` だけにする。fast-forward だけで、force push はしない。レーンが開いているブランチには push しない。
- 検査用の一時 worktree（`merge-verify`）はレーンに数えない。中身を手で編集しない。

## Gotchas

- 検査の結果は、その時点の main と head に対してだけ正しい。plan の後に main が進んだら、`start` は断る。
- GitHub の `mergeable` は merge の直後しばらく `UNKNOWN` になる。plan は手元の `git merge-tree` で衝突を決め、`check` だけが GitHub の値を最大 60 秒待つ。
- squash merge したブランチは `git log` や `git cherry` で未マージに見える。merge 済みの判定は `gh pr view` の state で行う（`worktree-policy`）。
- 状態は `.git/merge-round/` にあり、commit されない。回は 2 時間で切れ、切れた後の merge は hook が確認を出す。
- settings.json には `gh pr merge` の allow も ask も置かない。ask を置くと hook の allow が効かず（Claude Code の仕様）、allow を置くと hook が落ちたときに素通りするためです。
- 支払いのロック中は PR の CI が 1 本も走らない。だから PR を開いたあとの緑は、この回の手元の検査だけが根拠になる。

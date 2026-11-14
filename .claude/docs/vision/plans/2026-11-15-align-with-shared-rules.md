---
Status: IN PROGRESS # 決めてもらう点の 7 つのうち 4 つに答えが出ました。Step 3 は PR #2722 にしてあります
Created: 2026-11-15
Branch: claude/align-with-shared-rules-plan
Owner-chat: main
---

# Plan: claude-dotfiles の共通の決まりに、このリポジトリを合わせる

> 元になる計画は、claude-dotfiles の `claude/docs/plans/2026-11-11-project-rollout.md`（下位のプロジェクトを共通の決まりに合わせる計画）の Step 13 です。先に合わせた original-card-battle の計画書（そのリポジトリの `.claude/docs/vision/plans/2026-11-14-align-with-shared-rules.md`）と、同じ組み立てにしてあります。

---

## Context

### 何のための計画か

claude-dotfiles の `claude/CLAUDE.md`・`claude/rules/`・`claude/skills/` は `~/.claude/` に入り、どのプロジェクトでも自動で読まれます。このリポジトリが同じ決まりや同じ道具を別に持つと、片方だけが直されて食い違います。この計画は、重なっているものをこのリポジトリから消し、残すものを「このリポジトリだけの事実と値」に絞ります。

引っ越しにたとえると、新居（共通の決まり）に備え付けの家具があるのに、古い家具も運び込んで二重になっている状態です。古いほうを手放し、自分の持ち物だけを残します。

### いま起きていること

2026-11-15 に、claude-dotfiles のプロジェクトの検査（`check-project.mjs`）を、main の `09d67344` に読み取りだけで当てました。エラーが 247 件、警告が 5 件です。

| 検査 | 件数 | 中身 |
| --- | --- | --- |
| 記号と番号の組 | エラー 98 件 | 決定の記録の番号（`D-` で始まる形）が 70 件、方針の番号（`P-001` など）が 19 件、作業の区切りの記号（`W0` など）が 3 件です。残りの 6 件は、検査の誤りの疑いがあります（`TS2307`・`F5` など） |
| 内輪の語 | エラー 140 件 | 元になる文書を指す語が 68 件、担当の区分を指す語が 50 件、ほかの 4 語が 22 件です |
| 共通の道具と同じ名前 | エラー 5 件 | スキル 3 本（`merge-round`・`worktree-policy`・`issue-dispatch`）と、スクリプト 2 本（`merge-round.mjs`・`scope-overlap.mjs`）です |
| 置き場 | エラー 3 件 | 計画書が 2 か所、報告書が `.claude/docs/reports/`、判断待ちの置き場が `.claude/comm/decisions/` です |
| 入口の文書への書き写し | エラー 1 件、警告 4 件 | `.claude/CLAUDE.md` の merge の行（103・115・128 行）と、計画書の置き場の行（145 行）です |
| Codex 用の入口の長さ | 警告 1 件 | `AGENTS.md` が 59 行あります |

番号と語の 238 件のうち、42 件は、消す予定のスキル 3 本の中にあります。手で直すのは 196 件です。`.claude/CLAUDE.md` には 63 件あります。

検査が数えないものも、次のとおり確かめました。

- **入口の文書。** `.claude/CLAUDE.md` は 146 行・34,013 バイトで、`2026-` を含む行が 25 行あります。行数は少ないのに 1 行が長く、決定の日付と経緯が同じ行に入っています。経緯を外す計画書（`2026-11-11-claude-md-history-offload.md`）が進行中で、Step 3 以降は未着手です。
- **番号を付ける決まり。** 「入口の文書に書く決定には、番号を必ず添える」と定めているのは `.claude/rules/records.md` の 24 行目です。番号の形は、`.claude/decisions/README.md`・`.claude/decisions/_TEMPLATE.md`・`.claude/comm/decisions/README.md` が定めています。
- **番号を読む道具。** `.claude/scripts/records.mjs` が、決定の記録のファイル名・見出し・回答の一覧を、番号の形の正規表現で読みます。CI の文書の検査（`scripts/docs-lint.sh` の 124 行目）が、この道具を回します。この道具は、名前が `D-` で始まるファイルだけを拾います。そのため、番号の無い名前のファイルを足しても、エラーは出ず、検査と索引の対象から外れます。この道具にテストはありません。
- **番号の量。** 決定の記録は 205 本あります。番号は、現行の決まりの文書に約 90 回、過去の記録に約 1,830 回、`.claude/` の外のコードのコメントに 266 回出てきます。
- **hook（Claude Code 本体が決まった場面で自動で動かすスクリプト）。** `.claude/settings.json` に 7 本の登録があります。6 本は、claude-dotfiles の 2 本（`bash-guards.mjs` と `project-session-start.mjs`）に置き換わります。残る 1 本（`records.mjs index`）は、このリポジトリだけのものです。このリポジトリだけの判定を持つ hook は、ありません。
- **設定。** `.claude/issue-workflow.md` の `## 設定値` には 9 項目があります。共通の道具が読む 7 項目（`mergeMethod` など）は、1 つもありません。Step 3 では、この 7 項目に、このリポジトリのいまの手順が定数で持っている 3 項目を合わせた、10 項目を足します。`mainCheckout` と `worktreeRoot` は、個人の PC の絶対パスです。
- **merge の決まり。** 方針の文書（`.claude/comm/decisions/POLICY.md` の `P-001`）が、「merge は、こうだいさんが行うか、こうだいさんが merge の手順を起動した回だけ行う」と定めています。現行の文書の 14 ファイルが、この方針を引いています。共通の決まりは、手順と検証の条件を満たした PR を、確認なしで merge してよいとしています。
- **判断の聞き方。** `.claude/rules/decision-queue.md` は、判断を `.claude/comm/decisions/` のファイルに書いて次へ進む方式です。共通の決まりは、最後の報告のあとに AskUserQuestion（選択式の質問）でまとめて聞く方式です。
- **Codex（別の AI コーディング道具）用の入口。** 8 ファイルあります（`AGENTS.md`、`.agents/skills/` の 4 本、`.codex/` の 3 本）。こうだいさんは 2026-11-14 に、すべて消すと決めました。`.codex/hooks.json` が呼ぶ hook の 4 本は、Claude Code も使っています。そのため、この 4 本は Codex の片付けでは消さず、共通の hook へ切り替える Step で消します。
- **スキル。** `.claude/skills/` の 19 本のうち 12 本は、直近 30 日の会話の記録（625 本）に、起動が 1 回もありませんでした。ただし、この値は無人の実行（定時に動く作業）を数えていません。無人の実行の指示文（`.claude/automation/` の下）は、12 本のうち 3 本（`loop-implement`・`dev-digest`・`schedule-management`）を読みます。無人の実行の最後の報告は 2026-11-01 です。
- **進捗の記録。** `.claude/memory/` の 34 本のうち 29 本、`.claude/history/` の直下の 59 本のうち 54 本は、30 日以上変わっていません。
- **`.claude/` の直下の計画書。** `.claude/2026-05-04-cross-platform-migration.md`（移行の元になる文書、551 行、Status は ACTIVE）です。55 ファイルが指しています。
- **開いている PR と worktree。** 開いている PR は 0 件です。worktree は 4 つで、どれにも未コミットの変更はありません。`harness-fixes` の worktree は、経緯を外す計画書のためのものです。
- **CI。** GitHub Actions は、支払いのロックで 2026-11-05 から動いていません。手元で CI を流すコマンド（`node scripts/local-ci.mjs`）が、いまの唯一の確認です。

### 制約

- **待っている PR。** claude-dotfiles の PR #106「feat(harness): move merge-round, worktree policy, issue dispatch and the project hooks into the core」と、PR #107「feat(check-project): check projects against the core rules and add the entry template」です。2026-11-14 の時点で、どちらも承認待ちでした。Step 8 だけが、#106 が main に入っていることを前提にします。検査のスクリプト（`check-project.mjs`）は #107 にあります。main に入るまでは、claude-dotfiles の作業用の worktree にあるものを使います。
- **#106 を入れる前に、Step 3 を入れます。** #106 が main に入ると、共通の側に、このリポジトリと同じ名前のスキルが 3 本できます。同じ名前のときにどちらが読まれるかは、確かめていません（未確認）。共通の側が読まれる場合、設定に `mergeMethod` が無いと、merge の手順が終了コード 12 で止まります。
- **同じ日に行うもの。** claude-dotfiles の `claude/settings.json` に 2 本の hook を登録する作業と、この計画の Step 8 です。日がずれると、同じ判定が 2 回動きます。
- **入口の文書を触る PR は、1 度に 1 本だけ動かします。** Step 7・8・9 は、どれも `.claude/CLAUDE.md` を触ります。前の PR が main に入ってから、次のブランチを切ります。
- **方針の文書の変更は、こうだいさんの明示の承認が要ります。** `POLICY.md` の 3〜4 行目が、そう定めています。
- **入口の文書の節の組み直しは、この計画では行いません。** 決定の記録（`.claude/decisions/D-20260806-main-3.md`）が、節の移し替えを、移行の完了（移行の元になる文書の最後の段階）のあとに行うと決めているためです。

### Non-goals

- 製品のコード（`shared/`・`web/`・`desktop/`・`mobile/`・`mcp-server/`・`supabase/`）の変更。コードのコメントにある決定の番号 266 回も、書き直しません。
- 過去の記録（決定の記録 205 本、`.claude/history/`、`.claude/archive/`、過去の報告書、完了していない計画書の本文）の書き直し。
- 製品のスキル（`add-component`・`add-feature`・`add-ipc-channel`・`db-migration`・`frontend-react-designer`・`test-writing` など）の手順の中身。語と番号の直しだけ、Step 9 で扱います。
- GitHub のラベル名（`section:<id>`・`shared-fix`）、ブランチ名の形、worktree のフォルダ名。名前はコードとして残します。
- claude-dotfiles のファイル。直しが要るときは、依頼を claude-dotfiles の計画書へ戻します。

---

## こうだいさんに決めてもらう点

どの点にも仮定を置いてあります。答えが出るまでは、仮定に左右されない Step（2・3・4）を進められます。

**1. merge の方針を、共通の決まりに合わせるか。**

- **何が起きているか。** このリポジトリの方針（`POLICY.md` の `P-001`）は、merge をこうだいさんが行うか、こうだいさんが merge の手順を起動した回に限ります。2026-08-06 の決定は、条件つきの自動の merge を認めませんでした。共通の決まり（`claude/docs/development-flow.md` の「merge」）は、手順と検証の条件を満たした PR を、Claude Code が確認なしで merge してよいとしています。設定・hook・秘密の値・データベースの変更を含む PR は、共通の hook が止めて、こうだいさんの確認に回します。
- **なぜ決める必要があるか。** 決めないと、Step 8 で方針の文書と `mergePolicy` を書けません。共通の hook は、条件が欠けた merge を「確認」ではなく「停止」にします。方針と hook の動きが食い違ったまま切り替えると、merge の手順が途中で止まります。
- **選ぶと何が起きるか。**
  - 共通の決まりに合わせると、仕上げ役が、条件を満たした PR を merge まで運びます。方針の文書を書き換え、新しい決定の記録を 1 本足します。
  - いまの方針のままにすると、共通の例外の一覧（claude-dotfiles の `claude/docs/exceptions.md`）に 1 行足します。共通の hook には「人が起動した回だけ通す」仕組みが無いので、その仕組みを claude-dotfiles に足す依頼が要ります。Step 8 は、その依頼が済むまで待ちます。
- **推奨と根拠。** 共通の決まりに合わせる案を推奨します。こうだいさんが 2026-11-11 に全プロジェクトの決まりとして決め、original-card-battle でも 2026-11-14 に同じ案を選んだためです。共通の hook は、3 つを機械で確かめます。確かめたあとに PR へ commit が足されていないこと、全体確認が通っていること、別の役の確認の記録があることです。
- **答え（2026-11-15）。** こうだいさんは、共通の決まりに合わせる案を選びました。

**2. 決定の記録の名前から、番号をやめるか。**

- **何が起きているか。** 決定の記録は、ファイル名も見出しも番号（`D-` + 日付 + チャットの名前 + 連番）です。現行の文書は、決定を番号で呼びます。共通の決まりは、Claude Code が付けた記号と番号の組で物事を呼ぶことをやめ、中身を名前で書くと定めています。
- **なぜ決める必要があるか。** 決めないと、Step 5 で番号を付ける決まりをどう直すかと、Step 7 と 9 で、入口の文書の番号 44 件を何に置き換えるかが決まりません。
- **選ぶと何が起きるか。**
  - 新しい記録から、名前を「日付 + 中身を表す英語の名前」にする案では、`records.mjs` を、新旧の両方の名前を読めるように直します。過去の 205 本は書き直しません。現行の文書は、決定を中身の名前で呼び、要る所にだけファイルのパスを添えます。
  - 番号を続けて、共通の例外の一覧に載せる案では、作業は例外の 1 行だけです。こうだいさんが読む文書に、番号が残ります。
  - 205 本をすべて名前に付け替える案では、約 1,830 回の言及と、コードのコメント 266 回が切れます。
- **推奨と根拠。** 新しい記録から名前を変える案を推奨します。claude-dotfiles の決定の記録と同じ名前の付け方になり、過去の記録を壊さないためです。
- **この案に残る点。** 検査は、ファイルのパスの中の番号も数えます（`rules/design-first-planning.md` の 3 行目などで、リンクの文字とパスの両方が指摘されています）。過去の記録をパスで指すたびに、エラーが 1 件出ます。そこで、検査が「実在するファイルのパス」を数えないようにする直しを、claude-dotfiles に頼みます。直るまでは、過去の記録を指すパスを、例外の一覧に載せます。
- **答え（2026-11-15）。** こうだいさんは、新しい記録から名前を変える案を選びました。

**3. 判断の聞き方を、共通の決まりに合わせるか。**

- **何が起きているか。** このリポジトリは、判断をファイル（`.claude/comm/decisions/chat-<名前>.md`）に書いて次へ進み、こうだいさんが回答の一覧（`ANSWERS.md`）に答えを書く方式です。共通の決まりは、作業の最後の報告のあとに、AskUserQuestion でまとめて聞く方式です。
- **なぜ決める必要があるか。** 決めないと、Step 6 で `rules/decision-queue.md` をどう直すかが決まりません。置き場の検査のエラー 1 件（`.claude/comm/decisions/`）の扱いも決まりません。
- **選ぶと何が起きるか。**
  - 対話のチャットは AskUserQuestion で聞き、判断待ちの置き場は無人の実行（定時に動く作業）だけが使う案では、決まりの文書を直し、置き場は残します。`records.mjs` は変えずに済みます。置き場のエラーは、例外の一覧に 1 行足します。
  - 置き場をやめる案では、`records.mjs` の読み取りと、回答済みの印の意味を直します。無人の実行が判断を残す場所を、別に決める必要があります。
  - いまのままにする案では、共通の決まりと 2 つの聞き方が並びます。
- **推奨と根拠。** 対話のチャットだけ合わせる案を推奨します。こうだいさんが 2026-10-06 に、判断は質問で聞くと決めているためです。無人の実行は質問を出せないので、書いて残す場所が要ります。
- **答え（2026-11-15）。** こうだいさんは、対話のチャットだけ合わせる案を選びました。

**4. 共通の道具が無い PC を、どう扱うか。**

- **何が起きているか。** 2026-08-10 の決定（`.claude/decisions/D-20260810-main-2.md`）は、「スキルの実体をリポジトリの中に置き、どの PC でも同じものが見える」と決めました。この計画は、スキル 3 本と hook 6 本を、`~/.claude/` の共通の道具に置き換えます。claude-dotfiles を入れていない PC（Mac、リモートのセッション、新しい clone）では、この 3 本と hook が無くなります。
- **なぜ決める必要があるか。** 決めないと、Step 8 でファイルを消してよいかが決まりません。消したあとで Mac から作業すると、秘密の値の検査の hook も動きません。
- **選ぶと何が起きるか。**
  - claude-dotfiles を入れた PC だけで作業する、と決める案では、2026-08-10 の決定を新しい決定の記録で置き換えます。Mac を使うときは、先に claude-dotfiles の `install.mjs` を流します。
  - リポジトリの中にも残す案では、共通の道具との食い違いが続きます。同じ名前の 5 件は、例外の一覧に載せます。
- **推奨と根拠。** claude-dotfiles を入れた PC だけで作業する案を推奨します。この PC では数か月、この形で動いているためです。Mac をいまも使っているかは、確かめていません（未確認）。

**5. 進行中の「入口の文書から経緯を外す」計画書を、この計画に取り込むか。**

- **何が起きているか。** 計画書 `2026-11-11-claude-md-history-offload.md` は、入口の文書の経緯を外し、「決定の番号だけを残す」と書いています。番号を残す点が、共通の決まりと逆です。この計画の Step 7〜9 と、同じファイルを触ります。
- **なぜ決める必要があるか。** 決めないと、同じ行を 2 回直すことになります。1 回目は経緯を番号に置き換え、2 回目は番号を名前に置き換えます。
- **選ぶと何が起きるか。**
  - 取り込む案では、その計画書の Step 3〜6 を、この計画の Step 7 として行います。経緯を外すときに、番号ではなく中身の名前を残します。その計画書は、Status を SUPERSEDED にして `.claude/archive/` へ移します。
  - 別々に進める案では、その計画書を先に終え、番号の直しは Step 9 で行います。入口の文書の同じ行を、2 回触ります。
- **推奨と根拠。** 取り込む案を推奨します。1 回で済み、入口の文書を触る PR の数が減るためです。大きさの上限（7,600 tok）と検査を足す Step は、そのまま引き継ぎます。
- **答え（2026-11-15）。** こうだいさんは、取り込む案を選びました。

**6. 会話で使われていないスキルのうち、ループの 4 本を消すか。**

- **何が起きているか。** 直近 30 日の会話の記録に起動が無かったスキルは 12 本です。製品のスキルが 4 本（`add-component`・`add-feature`・`add-ipc-channel`・`design-critique`）、無人の実行の指示文が読むものが 3 本（`loop-implement`・`dev-digest`・`schedule-management`）、セッションの最初に文脈を読むスキルが 1 本（`session-loader`）、どこからも読まれていないループが 4 本（`loop-triage`・`loop-prune`・`loop-verify`・`loop-postmortem`）です。この 12 本に、語と番号のエラーが 50 件あります。
- **なぜ決める必要があるか。** 決めないと、Step 9 で、消すかもしれないスキルの語を直すことになります。
- **選ぶと何が起きるか。**
  - どこからも読まれていないループの 4 本だけを消す案では、Step 9 の量が少し減ります。必要になったら、git の履歴から戻せます。
  - 12 本とも残す案では、12 本の語を直します。
  - 無人の実行そのものをやめる案では、無人の実行の指示文と起動役（`.claude/automation/`）、それが読む 3 本も消せます。この計画の範囲を超えるので、別の計画書にします。
- **推奨と根拠。** ループの 4 本だけを消す案を推奨します。どの文書からも、どの指示文からも読まれていないためです。無人の実行が読む 3 本と、`session-loader` と、製品のスキル 4 本は、残して語を直します。無人の実行がいまも動いているかは、確かめていません（未確認。最後の報告は 2026-11-01 です）。

**7. `.claude/` の直下にある移行の文書を、動かすか。**

- **何が起きているか。** 移行の元になる文書（`.claude/2026-05-04-cross-platform-migration.md`、Status は ACTIVE）は、計画書の置き場ではなく `.claude/` の直下にあります。検査は、計画書の置き場が 2 か所あると指摘しています。この文書は、55 ファイルから 121 回指されています。
- **なぜ決める必要があるか。** 決めないと、Step 11 が、例外の行を書く作業なのか、ファイルを動かして 55 ファイルを直す作業なのかが決まりません。
- **選ぶと何が起きるか。**
  - 動かさずに例外の一覧に載せる案では、作業は例外の 1 行です。移行が完了したら、archive へ移します。
  - 計画書の置き場へ動かす案では、55 ファイルの参照を直します。過去の記録（決定の記録 8 本以上）の中の参照も変わります。
- **推奨と根拠。** 動かさない案を推奨します。移行の残りは、文書の書き換え 3 つと完了の判定だけで、完了すれば archive へ移るためです。

### 仮定として置いたもの

- **CI が使う担当表の検査。** `scripts/docs-lint.sh` の検査が、消す予定の `scope-overlap.mjs` を回します。CI の環境には共通の道具がありません。「共通の版があるときだけ回し、無ければ警告して飛ばす」形に直します。手元で CI を流すコマンドが文書の検査を回すので、この PC では、いままでどおり確かめられます。
- **積んだ PR。** このリポジトリの merge の方式は squash のままにします。共通の決まりは、積んだ PR を merge commit で入れます。このリポジトリは、前の PR が main に入ってから次のブランチを切る決まりなので、PR を積みません。
- **報告書の置き場。** `.claude/docs/reports/` のまま動かしません。動かすと、Artifact と Note からのリンクが切れます。元になる計画も、例外にする案を推奨しています。例外の一覧に載せる行の案を、claude-dotfiles へ渡します。
- **無人の実行の指示文と起動役。** `.claude/automation/` は、この計画では扱いません。merge の方針を引いている 2 行（Step 8）だけを直します。

---

## 検討した代替案（必須）

| 案 | 採否 | 却下理由 | 復活条件 |
| --- | --- | --- | --- |
| 重なるものを消し、値は設定に残す | ✓ | — | — |
| 共通の道具をこのリポジトリへ写して配る | ✗ | 写しが古くなり、いまの食い違いが続くため | 共通の決まりを読めない実行環境で、このリポジトリを動かすと決めたとき |
| 1 本の PR で全部直す | ✗ | hook の切り替えと文書の直しが混ざり、戻しにくいため | なし |
| 検査のエラーを、全部例外の一覧に載せる | ✗ | 直せるものまで隠れるため | なし |
| 決定の記録 205 本を、すべて名前に付け替える | ✗ | 約 2,100 回の言及が切れるため | 番号を読む道具が無くなり、言及をまとめて直す道具ができたとき |
| 入口の文書を、ひな形から書き直す | ✗ | 節の組み直しは、移行の完了のあとに行うと決まっているため | 移行の元になる文書の最後の段階が完了したとき |

---

## Scope (Touchable Paths)

```
.claude/CLAUDE.md
.claude/issue-workflow.md
.claude/settings.json
.claude/rules/**
.claude/skills/**
.claude/hooks/**
.claude/scripts/merge-round.mjs
.claude/scripts/merge-round.test.mjs
.claude/scripts/scope-overlap.mjs
.claude/scripts/scope-overlap.test.mjs
.claude/scripts/hooks-lib/**
.claude/scripts/records.mjs
.claude/scripts/records.test.mjs
.claude/scripts/lane-ownership.json
.claude/decisions/README.md
.claude/decisions/_TEMPLATE.md
.claude/decisions/2026-11-*.md
.claude/comm/README.md
.claude/comm/decisions/README.md
.claude/comm/decisions/POLICY.md
.claude/automation/README.md
.claude/automation/run-routine.ps1
.claude/docs/vision/claude-md-layering.md
.claude/docs/vision/plans/_TEMPLATE.md
.claude/docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md
.claude/docs/vision/plans/2026-11-11-claude-md-history-offload.md
.claude/docs/vision/plans/2026-11-15-align-with-shared-rules.md
.claude/docs/requirements/tier-*.md
.claude/docs/reports/2026-08-06-context-fixed-cost-baseline.md
scripts/docs-lint.sh
.github/pull_request_template.md
.gitignore
AGENTS.md
.agents/**
.codex/**
```

触らないものは、製品のコード、`.claude/settings.json` の `permissions`、`.claude/settings.local.json`、`.claude/memory/` と `.claude/history/`（進捗の記録は task-tracker が書きます）、過去の決定の記録 205 本、`.claude/comm/decisions/ANSWERS.md` の過去の行、`.github/workflows/`、claude-dotfiles のファイルです。

---

## Steps

1 つの Step を 1 本の PR にします（Step 7 と 9 は、数本に分けます）。作業は、main の checkout ではなく worktree で行います。どの PR も、いまの方針のあいだは、こうだいさんが merge を決めます。

| # | Step | Gate | Acceptance |
| --- | --- | --- | --- |
| 1 | 始める条件を確かめます | 人手 | 決めてもらう点の答えと、検査の基準の件数が、Worklog にある |
| 2 | Codex 用の入口の 8 ファイルを消します | 自律 | `git ls-files AGENTS.md .agents .codex` が何も出さない |
| 3 | 設定に、共通の道具が読む値を足します | 自律 | 共通の `profile.mjs` で読んで、`errors` と `warnings` が空である |
| 4 | 共通の側に無い中身を、残る文書へ移します | 自律 | 移した 6 件が移し先にあることを、PR の本文に grep で示す |
| 5 | 番号を付ける決まりと、番号を読む道具を直します | 人手 | `node .claude/scripts/records.mjs check` が、新旧の両方の名前のファイルを確かめる |
| 6 | 判断の聞き方を合わせます | 人手 | `rules/decision-queue.md` が、対話のチャットの聞き方を AskUserQuestion と書いている |
| 7 | 入口の文書から経緯を外します（節ごとに 1 本の PR） | 自律 | 入口の文書が 7,600 tok 以下で、消した記述が移し先にある |
| 8 | 共通の道具へ切り替えます（claude-dotfiles が hook を登録する日） | 人手 | 止まるはずの `gh pr merge` と `gh issue create` を、共通の hook が止める |
| 9 | 残りの語と番号を直します（文書ごとに 1 本の PR） | 人手 | 検査の番号と語のエラーが、例外を除いて 0 件である |
| 10 | 共通の側から外す記述の受け皿を作ります | 自律 | TypeScript と React の規約が `rules/frontend.md` にある |
| 11 | 置き場の例外と、古い進捗の記録を扱います | 人手 | 例外の行の案が、claude-dotfiles の計画書の Worklog にある |
| 12 | 検査を取り直し、結果を報告します | 自律 | 検査のエラーが、例外を除いて 0 件である |

### Gate の意味

- **自律** は、Claude Code が検証まで終えられる Step です。PR の merge は、どの Step でも、いまの方針に従います。
- **人手** は、こうだいさんの答えか操作が要る Step です。

### Step ごとの中身

**Step 1。始める条件を確かめます。**

- 決めてもらう点の答えを、Worklog に書きます。
- `node <claude-dotfiles>/check-project.mjs <このリポジトリ> --json` を流し、件数を Worklog に書きます。2026-11-15 の値は、エラー 247 件・警告 5 件です。
- claude-dotfiles の PR #106 と #107 の状態を、`gh pr view` の出力で確かめます。
- pdca-harness（定時に Issue を進める道具）が、このリポジトリで動いている間は、merge しません。

**Step 2。Codex 用の入口の 8 ファイルを消します。**

- 消すのは、`AGENTS.md`、`.agents/skills/` の 4 本（`dev-digest`・`docs-workflow`・`schedule-management`・`worktree-policy` の `SKILL.md`）、`.codex/config.toml`・`.codex/environments/environment.toml`・`.codex/hooks.json` です。
- 言及を 3 か所直します。`.claude/scripts/merge-round.mjs` の 35 行目の形から `.agents` と `.codex` を外します。`.claude/scripts/merge-round.test.mjs` の 167 行目の入力を合わせます。`.claude/skills/merge-round/SKILL.md` の 42 行目の一覧から、2 つを消します。
- `.codex/hooks.json` が呼んでいた hook の 4 本と、同梱の 4 本（`.claude/scripts/hooks-lib/`）は、消しません。Claude Code が使っているためです。Step 8 で消します。
- 確かめは、`node --test .claude/scripts/merge-round.test.mjs` と `LC_ALL=C bash scripts/docs-lint.sh` です。

**Step 3。設定に、共通の道具が読む値を足します。**

- `.claude/issue-workflow.md` の `## 設定値` に、次の値を足します。いまの 9 項目は変えません。

  ```json
  "mergeMethod": "squash",
  "ciCommand": "node scripts/local-ci.mjs",
  "ciWorkflow": "ci.yml",
  "recordBranchPattern": "^chore/(?:tracker|outbox|routine)-(?:(?<workspace>.+?)-\\d{8})?",
  "harnessOnlyPaths": [".claude/**", ".github/**", "scripts/**", "*.md"],
  "migrationPaths": ["supabase/migrations/**"],
  "mechanicalFiles": ["**/*.md", "**/package-lock.json", "**/yarn.lock", "**/pnpm-lock.yaml", "**/Cargo.lock", "**/i18n/locales/*.json"],
  "areaWorkspaces": { "shared-fix": "{{titleTag}}", "section:*": "*" },
  "workspaceMapPath": ".claude/scripts/lane-ownership.json",
  "issueCreation": "main-only"
  ```

- 値の根拠は、いまの merge の手順のスクリプトが持つ定数です。`areaWorkspaces` は、`shared-fix` を先に書きます。いまの手順が、`shared-fix` の題の先頭の名前を先に当てているためです。`harnessOnlyPaths` は、Step 2 で消す `.agents` と `.codex` を除いた形です。
- この Step では、値を足すだけにします。いまの台本は、名前を挙げた項目だけを設定から読むので、動きは変わりません。`mainCheckout` と `worktreeRoot` を相対パスに変える直しは、Step 8 で行います。相対パスを絶対パスに直す部品が、claude-dotfiles の PR #106 にあるためです。
- 確かめ方は、`node <claude-dotfiles の PR #106 の worktree>/claude/skills/issue-workflow/scripts/profile.mjs <このリポジトリの場所>` です。引数は、設定のファイルではなく、リポジトリの場所です。
- 2026-11-15 に、この値の写しを共通の `profile.mjs` に読ませて、`errors` と `warnings` が空になることを確かめました。共通の担当表の検査（`scope-overlap.mjs --check-map`）も通りました。

**Step 4。共通の側に無い中身を、残る文書へ移します。**

- 移すのは 6 件です。整合の監査の 7 つの観点（`issue-dispatch` の 97〜104 行）、休んでいるチャットを起こす 1 行の指示文、Orca（worktree を並べて開く道具）のターミナルを閉じる手順、同じ区分の臨時の worktree を並べて立てない決まり、GitHub Actions が支払いのロックで止まっている事実、課題を配るときの決まり（`worktree-policy` の 102〜106 行。計画書は main のチャットが一時の worktree から push する、作業の一覧の文書を別に作らない）です。
- 移し先は、`docs-workflow` スキルと、worktree の決まりの元になる計画書（`2026-05-24-multi-chat-worktree-policy.md`）です。入口の文書には足しません。
- 元のスキル 3 本は、この Step では消しません。

**Step 5。番号を付ける決まりと、番号を読む道具を直します（決めてもらう点 2 の答えに従います）。**

- `rules/records.md` の 24 行目を、「2 か所目からは、本文を書き写さず、決定の中身の名前で呼ぶ。要る所にだけ、決定の記録のパスを添える」に直します。
- `decisions/README.md` と `decisions/_TEMPLATE.md` の名前の形を、「日付 + 中身を表す英語の名前」に直します。claude-dotfiles の `claude/docs/decisions/README.md` に合わせます。
- `comm/decisions/README.md` の見出しと回答の一覧の形を、番号の無い形に直します。
- 計画書のひな形（`.claude/docs/vision/plans/_TEMPLATE.md`）の、方針の番号と決定の番号を、名前に直します。
- `records.mjs` を、新旧の両方の名前を読めるように直します。テスト（`records.test.mjs`）を新しく書きます。テストは、過去の名前のファイル、新しい名前のファイル、両方が混ざった回答の一覧の 3 つを確かめます。新しい名前のファイルに欠けた項目があるとき、`check` が指摘することも確かめます。いまの道具は、新しい名前のファイルを黙って読み飛ばすためです。
- 方針（`P-001`〜`P-008`）は 8 本だけなので、番号は見出しに残し、現行の文書からは名前で呼びます（方針「merge はこうだいさんが決める」など）。

**Step 6。判断の聞き方を合わせます（決めてもらう点 3 の答えに従います）。**

- `rules/decision-queue.md` を、「対話のチャットは、最後の報告のあとに AskUserQuestion で聞く。判断待ちの置き場は、無人の実行だけが使う」に直します。
- 判断待ちの置き場を出し先にしている文書（`comm/decisions/README.md`、`POLICY.md` の 2 行、`add-feature`・`loop-triage`・`docs-workflow` のスキル、`rules/design-first-planning.md`）を合わせます。`POLICY.md` の変更は、こうだいさんの承認のあとに行います。

**Step 7。入口の文書から経緯を外します（決めてもらう点 5 の答えに従います）。**

- 進行中の計画書の Step 3〜6 を引き継ぎます。節ごとに 1 本の PR にします。順番は、機能の重さの表の節、AI 連携の節と動作環境の節、hook の説明、の順です。最後に、大きさの上限の検査を `scripts/docs-lint.sh` に足します。
- 経緯を外すときに、決定を番号ではなく中身の名前で書きます。経緯が要る所にだけ、決定の記録のパスを添えます。
- 消した記述が移し先にあることを、PR の本文に grep で示します。
- 取り込んだ計画書は、最初の PR で Status を SUPERSEDED にし、`.claude/archive/` へ移します。文書の検査が、SUPERSEDED の計画書を計画書の置き場に残すことを許さないためです。その計画書を指すリンクも直します。
- hook の説明の節（115 行のあたり）は、Step 8 が書き換えます。Step 8 が先に入った場合は、その節を飛ばします。

**Step 8。共通の道具へ切り替えます（決めてもらう点 1 と 4 の答えに従います）。**

claude-dotfiles の PR #106 が main に入り、claude-dotfiles が 2 本の hook を登録する日と、同じ日に入れます。

- 先に済ませる Step は、2（Codex 用の入口）、3（設定の値）、4（中身を移す）、5（新しい名前の決定の記録を読めるようにする）です。決めてもらう点の 1 と 4 の答えも要ります。hook を登録する日は、これがそろった日に決めます。Step 5 より先に入れると、この Step で足す決定の記録が、検査を通らないまま入ります。
- `.claude/settings.json` の hook の登録 6 本を消します。`records.mjs index` の 1 本は残します。
- 消すファイルは 17 本です。スキル 3 本（`merge-round`・`worktree-policy`・`issue-dispatch`）、`.claude/scripts/merge-round.mjs` とそのテスト、`.claude/hooks/` の 8 本（`merge-gate.mjs`、`lib/hook-context.mjs` とそのテスト、`.sh` の 5 本）、`.claude/scripts/hooks-lib/` の 4 本です。
- `.claude/scripts/scope-overlap.mjs` とそのテストの 2 本も消し、`scripts/docs-lint.sh` の担当表の検査を、「共通の版があるときだけ回す」形に直します。
- 消すスクリプトを呼ぶ現行の文書を、共通のパスに直します。
  - 拾い方は、`git grep -n "scope-overlap.mjs"` と `git grep -n "scripts/merge-round.mjs"` です。
  - 分かっている場所は、`.claude/issue-workflow.md` の 57 行（Issue を選ぶときの重なりの確認）と 103〜106 行（全体確認の手順）、計画書のひな形（`_TEMPLATE.md`）の 68 行、`.claude/CLAUDE.md` の 124 行、`.github/pull_request_template.md` の 15 行です。
  - 直さないと、全体確認が、毎回「スクリプトが無い」で失敗します。共通の版は、同じオプションを持っています。
- 消すスキルと hook を名指しする現行の文書も直します。`.claude/CLAUDE.md` の 115・119・142・146 行、`rules/records.md` の 54 行、`docs-workflow` スキルの 12 行、`.gitignore` の 61 行、`scripts/docs-lint.sh` の 39 行です。
- `.claude/issue-workflow.md` の設定を直します。`mainCheckout` と `worktreeRoot` を、相対パス（`.` と `../workspaces/life-editor`）に変えます。`mergePolicy` を書き換えます。
- `.claude/issue-workflow.md` の「仕上げ」の節を直します。手順の参照先を、共通の `merge-round` スキルに変えます。merge のコマンドの形と、承認の印を消す項目は削ります。共通の `merge-round.mjs check` がコマンドを表示し、承認の印は共通の側に無いためです。
- `.claude/issue-workflow.md` の、merge の方針を述べる 3 行（45 行・121 行・152 行）を、新しい方針に合わせます。
- 方針の文書（`POLICY.md` の 6 行目）を書き換え、新しい決定の記録を足します。
- merge の方針を引いているほかの現行の文書を合わせます。`.claude/CLAUDE.md` の 103 行、`.claude/automation/README.md` の 65 行、`.claude/automation/run-routine.ps1` の 21 行のコメント、`add-feature` スキルの 76 行、`claude-md-layering.md` の 57 行と 70〜73 行です。`run-routine.ps1` は、UTF-8 の BOM（ファイルの先頭の印）を保ちます。
- 担当表（`.claude/scripts/lane-ownership.json` の 217 行目）の持ち主の名前を、`chat-main` から `main` に直します。共通の道具は、main の checkout を `main` と数えるためです。入れる前に、共通の `scope-overlap.mjs` で、main のチャットが持ち主に数えられることを確かめます。
- 入れたあとに、main の checkout で次を確かめます。止まらなければ、この PR を revert します。
  - `node ~/.claude/skills/merge-round/scripts/merge-round.mjs status` が、設定の不足を表示せずに終わる。
  - `node ~/.claude/skills/worktree-policy/scripts/scope-overlap.mjs --check-map` が通る。
  - merge の手順の回の外で `gh pr merge` を打つと、共通の hook が止める。担当の worktree で `gh issue create` を打つと、同じく止まる。
  - `.mcp.json` に秘密の値の形を書いて commit しようとすると、共通の hook が止める（確かめたあとで、変更を捨てます）。
- claude-dotfiles の hook の登録から、この PR が main に入るまでの間は、古い hook と共通の hook の両方が動きます。この間の merge は、共通の形（head の commit を固定した形）で、こうだいさんの確認を通して行います。

**Step 9。残りの語と番号を直します（決めてもらう点 2 と 6 の答えに従います）。**

- 検査の指摘を、言い換えるもの・コードとして残すもの・例外にするもの、の 3 つに分けた一覧を作り、こうだいさんに見せてから直します。
- 直す順は、入口の文書、`rules/`、`.claude/issue-workflow.md`、スキルです。スキルは 1 本ずつ PR にします。
- 検査の誤りの疑いがある 6 件（`TS2307`・`F5` など）と、例外にするものは、claude-dotfiles の計画書の Worklog へ渡します。このリポジトリからは書きません。

**Step 10。共通の側から外す記述の受け皿を作ります。**

- claude-dotfiles の `claude/CLAUDE.md` から外す予定の規約は 3 行です（TypeScript の strict と公開 API の戻り値の型、React の関数コンポーネント、named export）。React の 1 行は、`rules/frontend.md` の命名の節に足します。TypeScript の 2 行は、`.claude/CLAUDE.md` の Coding Standards の節に 1 行で足します。`rules/frontend.md` が読まれるのは `shared/src/` と `web/src/` を扱うときだけで、TypeScript は `mcp-server/` と `desktop/` にもあるためです。strict は tsconfig が守っているので、文書に無いのは、戻り値の型の 1 つです。
- claude-dotfiles の `claude/settings.json` にある、このリポジトリだけの説明 6 行（クラウドの事業者、秘密の値の置き場など）の移し先を決めます。自動で判断するモードが、どの設定ファイルを読むかは、確かめていません（未確認）。Claude Code の文書で確かめてから、移し先を決めます。
- 受け皿ができたら、claude-dotfiles の側が 2 つを外します。

**Step 11。置き場の例外と、古い進捗の記録を扱います。**

- 報告書の置き場（`.claude/docs/reports/`）と、判断待ちの置き場（`.claude/comm/decisions/`）を、例外の一覧に載せる行の案にして、claude-dotfiles へ渡します。移行の元になる文書の置き場（`.claude/` の直下）は、決めてもらう点 7 の答えに従います。
- 30 日以上変わっていない進捗の記録（memory 29 本、history 54 本）を、task-tracker の月ごとの退避の決まりで片付けられるかを調べ、結果を Worklog に書きます。片付ける場合は、別の PR にします。

**Step 12。検査を取り直し、結果を報告します。**

- `check-project.mjs` のエラーが、例外の一覧に載せたものを除いて 0 件であることを確かめます。
- `node scripts/local-ci.mjs` が通ることを確かめます。
- 検査が誤って指摘したものと、進め方で詰まった点を、claude-dotfiles の計画書の Worklog に書きます。引き渡しの一覧の `areaWorkspaces` の案は、順番が逆です（`shared-fix` を先に書くのが正しい形です）。この直しも、あわせて渡します。
- この計画書を `.claude/archive/` へ移します。

---

## Acceptance Criteria (機械検証可能)

- [ ] `node <claude-dotfiles>/check-project.mjs <このリポジトリ>` のエラーが、例外の一覧に載せたものを除いて 0 件である
- [ ] `git ls-files AGENTS.md .agents .codex` が何も出さない
- [ ] `.claude/settings.json` の `hooks` に、`.claude/hooks/` を指す行が無い
- [ ] `git ls-files .claude/skills/merge-round .claude/skills/worktree-policy .claude/skills/issue-dispatch .claude/hooks .claude/scripts/hooks-lib` が何も出さない
- [ ] `node ~/.claude/skills/merge-round/scripts/merge-round.mjs status` が、設定の不足を表示せずに終わる
- [ ] `node .claude/scripts/records.mjs check` が exit 0 で、`node --test .claude/scripts/records.test.mjs` が全 pass
- [ ] `node .claude/scripts/context-cost-measure.mjs` で、`.claude/CLAUDE.md` が 7,600 tok 以下
- [ ] `LC_ALL=C bash scripts/docs-lint.sh` が OK
- [ ] `node scripts/local-ci.mjs` の全部の手順が exit 0
- [ ] `git grep -n "\.claude/scripts/scope-overlap.mjs\|\.claude/scripts/merge-round.mjs" -- .claude/CLAUDE.md .claude/issue-workflow.md .claude/rules .claude/skills .claude/docs/vision/plans/_TEMPLATE.md .github` が何も出さない
- [ ] 完了時に、この計画書と、取り込んだ計画書（`2026-11-11-claude-md-history-offload.md`）の Status を更新し、どちらも `.claude/archive/` へ移した

---

## Risks / Known Issues 参照

- **CI が動いていません。** GitHub Actions は 2026-11-05 から、支払いのロックで止まっています。どの PR も、手元で CI を流すコマンドの結果を PR の本文に書きます。
- **`records.mjs` にテストがありません。** Step 5 で、先にテストを書いてから直します。直しを誤ると、CI の文書の検査が全部の PR で落ちます。
- **hook が 2 組動く時間があります。** Step 8 の当日、claude-dotfiles の登録から、このリポジトリの PR が main に入るまでの間です。同じ commit を 2 回確かめるだけで、止める判定が増える方向なので、壊れはしません。merge の形だけが食い違います（Step 8 の最後の項目）。
- **秘密の値の検査が、共通の hook に移ります。** `.mcp.json` に平文の秘密の値を書く commit を止める hook です。Step 8 で、切り替えたあとに動くことを確かめます。
- **経緯を消すと、理由を推測で埋めるおそれがあります。** 入口の文書には、決まりの理由を 1 文残します。経緯は、決定の記録のパスで指します。
- **改行。** このリポジトリのファイルは、作業ツリーで CRLF です。スクリプトでまとめて書き換えるときは、前後で `git ls-files --eol` を見て、改行が混ざっていないことを確かめます。
- **ほかの worktree。** 4 つの worktree と、別の clone（`C:/Users/user/dev/life-editor`）には、未コミットの変更がありません。Step 8 を取り込むと、古い hook のファイルが消えます。動いているセッションは、取り込んだあとで始め直します。

---

## References

- 元になる計画: claude-dotfiles の `claude/docs/plans/2026-11-11-project-rollout.md`（Step 13）
- 引き渡しの一覧: claude-dotfiles の PR #106 の計画書 `claude/docs/plans/2026-11-11-flow-parts-into-core.md` の Worklog
- 先に合わせたリポジトリの計画書: original-card-battle の `.claude/docs/vision/plans/2026-11-14-align-with-shared-rules.md`
- 取り込む計画書: `.claude/docs/vision/plans/2026-11-11-claude-md-history-offload.md`
- 節の移し替えを待つ決定: `.claude/decisions/D-20260806-main-3.md`
- スキルの実体をリポジトリに置く決定: `.claude/decisions/D-20260810-main-2.md`
- 方針の文書: `.claude/comm/decisions/POLICY.md`

---

## Worklog

- 2026-11-15: 計画書を書きました。検査の基準は、main の `09d67344` で、エラー 247 件・警告 5 件です。調べたのは、番号を付ける決まりと文書の置き場、共通の道具と重なるスキル・hook・設定、Codex 用の入口の 3 つです。コードと設定は、何も変えていません。別の役の確認で、止める指摘が 2 件出ました（消すスクリプトを呼ぶ文書の抜け、会話で使われていないスキルの前提のずれ）。どちらも直してあります。
- 2026-11-15: 決めてもらう点の 1 と 2 に答えが出ました。merge の方針は共通の決まりに合わせ、決定の記録は新しいものから名前を変えます。同じ日に、3 と 5 にも答えが出ました。判断の聞き方は対話のチャットだけ合わせ、進行中の計画書はこの計画に取り込みます。残りは、4（共通の道具が無い PC）、6（ループの 4 本）、7（移行の文書の置き場）の 3 つです。

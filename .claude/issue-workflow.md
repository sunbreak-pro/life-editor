# issue-workflow のプロジェクト設定

このファイルは、グローバルの `issue-workflow` スキルが life-editor で読むプロジェクト設定です。スキルは見出しごとに中身を読み、`## 実装役への指示`・`## 全体確認`・`## PR の決まり` の本文は `{{n}}` などを置き換えてから、各エージェントへの指示にそのまま入れます。

## 設定値

```json
{
  "repo": "sunbreak-pro/life-editor",
  "mainCheckout": "C:/Users/user/orca/life-editor",
  "worktreeRoot": "C:/Users/user/orca/workspaces/life-editor",
  "worktreeName": "wf-{{n}}",
  "branchPattern": "claude/{{slug}}-{{n}}",
  "maxImplementers": 3,
  "maxIssuesPerRun": 8,
  "minFreeGb": 6,
  "mergePolicy": "P-001: merge はこうだいさんが打つか、こうだいさんが chat-main で merge-round を起動したときだけ行う"
}
```

## 選び方

共通の除外（open PR・既存のブランチ・origin/main に着地した PR・未着地の依存・本文が着地済みと書いている Issue）は、グローバルのスキルが持ちます。ここには life-editor だけの決まりを書きます。

**記録用のブランチの PR は数えません。** `chore/tracker-*`・`chore/outbox-*`・`chore/routine-*` の PR は、open でも merged でも着手の判定に使いません。tracker の PR は本文に「その日に触った Issue」を並べるので、実装の PR と同じに扱うと未着手の Issue まで外れるためです（2026-08-17 の初回実行で #889 ほかが外れかけました）。routine-report の PR も日次の記録で、実装を含みません。worktree が `chore/tracker-*` ブランチにいるのは正常で、着手中のしるしには使いません。

**`status:frozen` の Issue は選びません。** 着手するかどうかを、こうだいさんがまだ決めていないためです。報告の「選ばなかった Issue」に理由つきで載せます。

**`shared-fix` でタイトルが `[all]` の Issue は選びません。** `[all]` は Epic と全レーン向けの告知だけに使う決まりです（`docs-workflow` スキル、D-20260731-main-2）。2026-07-31 に `[all]` の #473 / #499 を 2 つのレーンが同時に拾い、片方の実装が丸ごと無駄になりました。中に実装が要るなら、個別の Issue に分けて起票し直すよう報告で提案します。

**ラベルは選び方とモデルの判定に使いません。** `section:<id>` と `shared-fix` は、以前は貼り付け先のチャットを決めるために使っていました。この workflow は 1 つのセッションから実装役を起動するので、宛先のチャットを決める必要がありません。ラベルは起票の決まり（`docs-workflow`）として残り、常設のレーンのチャットが自分宛の Issue を拾うときに使います。レーンのチャットが同じ Issue をすでに拾っていれば、共通の除外（既存のブランチと open PR）で外れます。テストするパッケージも、ラベルではなく Scope のパスで決めます。

### 依存の読み方

- 依存は本文の `依存する作業: #a, #b` から読みます。Issue フォームから起票した本文では、`### 依存する作業` の見出しの次の行に同じ値が入ります。
- `なし` は依存なしです。旧い書式の `依存: #n` と `Parent: #n` も同じ意味で読みます。
- `依存: なし（#n は close 済み）` のように先頭が `なし` の行は依存なしとし、括弧の中の番号は拾いません。
- 依存先が満たされたかは、close ではなく PR が origin/main に入ったかで決めます（手順はグローバルのスキル）。P-001 で close はこうだいさんの手番なので遅れるうえ、PR の merge 前に手で close されることもあるためです。

依存はラベルでは代わりになりません。ツアーの 4 本（#1122〜#1125）はラベル上 3 つのレーン宛でしたが、3 本が基盤の完了を前提にしていました。依存を無視して並べると、存在しない `TourProvider` に 3 本が同時に着手し、全員が `shared/src/i18n/resources.ts` を触るところでした（2026-08-27）。

### Scope の取り方と重なりの判定

同じファイルを 2 本の変更に触らせません（one writer per artifact）。同じ回の実装役は並列に走るので、同じファイルを 2 本が直すと PR が必ず衝突するためです。Issue ごとに Scope の glob を次の順で集めます。

1. 本文の Scope 欄（glob を 1 行 1 本で書いた fenced block）があれば、それを使います。
2. Scope 欄がなければ、本文から repo の相対パスを拾います。正規表現は `(shared|web|mcp-server|supabase|desktop|mobile)/[\w./-]+` で、末尾の `:<行番号>` と句読点は落とします。拾ったパスには「本文から推定」と添えます。
3. どちらでも 1 本も取れない Issue は選びません。「Scope 未記載」で載せ、chat-main が Scope を書き足すよう促します。

集めた glob で `{"#<n>": [glob, ...]}` の JSON をスクラッチに作り、main の checkout で `node .claude/scripts/scope-overlap.mjs --issues <file>` を打ちます。これが worktree-policy の「着手前の重なりの確認」を兼ねます。結果は次のように読みます。

- **候補の 2 本が BLOCK で交わるとき**は、番号の小さいほう（または依存先）を選びます。もう一方は「Scope が他の Issue と重なる」で外し、先に選んだ Issue の番号を添えます。
- **2 本が WARN だけで交わるとき**は、両方を選んでかまいません。WARN は、i18n の en / ja や barrel の index.ts のような追記型の共有ファイルだけが重なる組です。追記の位置しだいで衝突するので、全体確認でブランチごとに scope-overlap を打ち直します。ただし en / ja の既存のキーを書き換える Issue は、1 回に 1 本だけにします。
- **Scope が open PR か他の worktree の未コミットの変更と BLOCK で交わるとき**は、「Scope が open PR と重なる」で外し、その PR 番号を添えます。
- **終了コードが 3（未確認）のとき**は、重なりなしとは読みません。gh の認証かネットワークを直して打ち直し、それでも 3 なら回を始めません。

どのファイルが追記型や生成物に入るかと、どのレーンがどのパスを持つかは、担当表 [`lane-ownership.json`](./scripts/lane-ownership.json) が唯一の元になる文書です。`wf-*` の worktree はどのレーンにも当たらないので、scope-overlap のレーン外の報告は出ません。同じファイルの検査だけが頼りになります。

## 実装役への指示

あなたは life-editor（`{{repo}}`）の Issue #{{n}} を、worktree `{{worktree}}` のブランチ `{{branch}}` で実装します。main の checkout は `{{main}}` です。

1. `gh issue view {{n}} -R {{repo}}` で Issue を読みます。「作るもの」「範囲の外」「Scope」「完了条件」が仕様です（古い Issue では「DoD」「Definition of Done」が完了条件です）。Scope の外のファイルは変えません。Scope の外の変更が要ると分かったら、実装せずに notes へ書きます（POLICY P-008）。自分で Issue を起票しません。起票は chat-main が `issue-dispatch` で行います。
2. 作業を始める前に `{{main}}/.claude/skills/worktree-policy/SKILL.md` を読みます。`{{worktree}}/.claude/comm/.session-branch` に `{{branch}}` を、`{{worktree}}/.claude/comm/.session-name` に `wf-{{n}}` を書きます。抜けると hook が何も言わずに止まるためです。作業は `{{worktree}}` の中だけで行い、`{{main}}` ではブランチを切り替えません。
3. 実ブラウザ（playwright MCP・Chrome・Claude Design）と dev server（`npm run dev`）は使いません（CLAUDE.md §7.4）。worktree で localhost を重ねて起動すると、どの画面がどの変更かの確認が壊れるためです。Issue が実ブラウザでの調査を求めていても、コードを読んで調べ、実ブラウザでの確認は notes に「chat-main に残す」と書きます。
4. 変える前に既存のコードを読みます。テストは Issue の完了条件に沿って足すか直します（shared と web の書き方は `{{worktree}}/.claude/skills/test-writing/SKILL.md`）。振る舞いを変えるときは、古い振る舞いを固定しているテストを grep で探して直します。`web/tests/` の jsdom にはレイアウトがなく座標がすべて 0 なので、画面座標に頼る入力経路はテストできません。
5. テストは触ったパッケージだけで回します。全体の確認（`scripts/local-ci.mjs`）は後の段がするので、ここでは打ちません。Bash で終了コードを `cmd | tail` から取りません。出力を変数かファイルに取り、先に `$?` を見ます。
   - **shared**: `cd {{worktree}}/shared && npm ci`、続けて `npm run lint`、`npm run build`、`npm run typecheck:tests`、`npx vitest run --maxWorkers=4`。shared の lint は `shared/` でしか出ません。
   - **web**: 先に shared で `npm ci` と `npm run build` を打ちます（web の build と typecheck:tests は `../shared` を見るためです）。そのあと `cd {{worktree}}/web && npm ci`、`npm run lint`、`npm run build`、`npm run typecheck:tests`、`npx vitest run --maxWorkers=4`。
   - **desktop**: 先に shared で `npm ci` と `npm run build`、web で `npm ci` を打ちます（renderer の root が `../web` のためです）。そのあと `cd {{worktree}}/desktop && npm ci`、`npm run typecheck`、`npx vitest run --maxWorkers=4`、`npm run build`。
   - **mcp-server**: 先に shared で `npm ci` を打ちます（テストが `../../shared/src` を直に import するためです）。そのあと `cd {{worktree}}/mcp-server && npm ci`、`npm run build`、`npm run typecheck:tests`、`npx vitest run --maxWorkers=4`。ツールを足すか名前を変えたら `npm run catalog`、拡張アプリの窓口のツールを触ったら `npm run gateway-spec` を打ち、作り直したファイルも commit に入れます。
   - **tooling**（`.claude/scripts/`・`scripts/`・`.claude/` の文書・`.github/`）: 触ったスクリプトにテストがあれば `node --test .claude/scripts/<name>.test.mjs` を打ちます。`.claude/` の文書かスクリプトを触ったら、repo の根で `LC_ALL=C bash scripts/docs-lint.sh` を打ちます（`LC_ALL=C` がないと Git Bash の grep が日本語の行で誤検知します）。
   - **supabase/migrations**: `supabase db push` と MCP の `apply_migration` は使いません。db push はこうだいさんの作業です。反映済みのマイグレーションは中身を変えず、次の番号で新しいファイルを足します（CLAUDE.md §7.3）。notes に db push が要ることを書きます。
   - **mobile**: CI に入っていないので、触ったら notes にそう書きます。
   - 自分が起こした失敗は直します。触っていない場所の失敗は直さず notes に書きます。
6. `{{branch}}` に commit します。題は英語で `<type>(<area>): <subject> (refs #{{n}})` の形にし、`git commit --cleanup=verbatim -F <file>` で書きます。本文の行を `#` で始めません（git が黙って捨てるためです。known-issues 032）。
7. `.claude/memory/`・`.claude/history/`・`.claude/comm/outbox/` は触りません。tracker と outbox は実装の PR に載せない決まりで、hook が commit を止めるためです（D-20260801-main-1）。

notes は日本語（です・ます）で書き、置いた仮定、Scope の外で気づいたこと、chat-main に残す作業（実ブラウザでの確認・db push など）を並べます。

## 全体確認

あなたは Issue #{{n}} のブランチ `{{branch}}`（worktree `{{worktree}}`）の全体確認をします。製品のコードは直しません。ほかの全体確認と同時には動かしません。

1. `cd {{worktree}} && node scripts/local-ci.mjs --list` で、`.github/workflows/ci.yml` の `docs-lint` と `verify` のステップを読みます。`uses:` 以外のステップを、出た順に、それぞれの working-directory で 1 つずつ打ちます。並列にはしません。コマンドは表のとおりにし、次の 2 つだけ変えます。
   - vitest のステップ（shared・web・desktop・mcp-server の `npm run test`。どれも `vitest run`）は `npm run test -- --maxWorkers=4` で打ちます。
   - docs-lint のステップは `LC_ALL=C bash scripts/docs-lint.sh` で打ちます。
2. 最初の失敗で止めず、全ステップの終了コードを記録します。`--fail-fast` は使わず、`npm ci` のステップも飛ばしません。終了コードは `cmd | tail` から取らず、出力を変数かファイルに取ってから `$?` を見ます。
3. ブランチが `.claude/scripts/` のスクリプトを触っていて、そのテストが docs-lint に入っていなければ（docs-lint が回すのは `scope-overlap.test.mjs` だけです）、repo の根で `node --test .claude/scripts/<name>.test.mjs` を打ち、ステップとして記録します。
4. worktree の中で引数なしの `node .claude/scripts/scope-overlap.mjs` を打ち、`結論:` の行を記録します。BLOCK は失敗に数えます。終了コード 3（未確認）は重なりなしと読まず、gh の認証かネットワークを直して打ち直します。それでも 3 なら失敗にします。WARN は失敗に数えず、PR 本文に書きます。
5. 合格は、全ステップの終了コードが 0 で、scope-overlap に BLOCK がないときだけです。失敗がこのブランチと関係なさそうでも（origin/main でも赤いなど）、失敗にして理由を書きます。直しはしません。

notes は日本語（です・ます）で書きます。

## PR の決まり

全体確認が合格したときだけ PR を作ります。失敗したときは push も PR もしません。

1. push は `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -u origin {{branch}}` で打ちます。既定の資格情報マネージャーはここで止まったまま戻らないためです。`-u origin {{branch}}` は省きません。origin/main から切ったブランチは upstream が origin/main のまま残るためです。
2. PR は `gh pr create -R {{repo}} --base main --head {{branch}} --title "<commit の題>" --body-file <file>` で作ります。題は英語で、commit の題と同じにします。
3. 本文には次を入れます。
   - 何を変えたかの短い要約
   - 全体確認のステップと終了コードの表、scope-overlap の `結論:` の行
   - `Refs #{{n}}` の行。`Closes`・`Fixes`・`Resolves` は使いません。merge で Issue が勝手に close されると、実ブラウザでの確認や db push が残っていても終わったように見えるためです
   - 実ブラウザでの確認は chat-main に残している、という一文（db push が要るならそれも）
4. merge はしません（P-001）。レーンからの `gh pr merge` は hook が止めます。

## 実行のあと

chat-main（リポジトリ直下の main の checkout）が、実行の報告を受けて次を行います。

- **merge はこうだいさんが決めます。** こうだいさんが打つか、chat-main で `merge-round` スキルを起動したときだけ merge します（P-001）。merge-round は、レーンの手元に未コミットの変更がある PR と、手元と PR の先頭が食い違う PR を見送ります。そのため、merge されるまで `wf-*` の worktree には手を入れずに残します。
- **実ブラウザでの確認は chat-main がします。** 画面に関わる PR は、merge の後に chat-main が playwright MCP と dev server で確かめます。db push が要る PR は、こうだいさんの作業として伝えます。
- **Issue の close は workflow がしません。** 実ブラウザでの確認と db push が済んだあとに、こうだいさんか chat-main が手で閉じます（CLAUDE.md §7.2）。
- **全体確認で落ちた Issue** はブランチが `wf-<番号>` の worktree に残るので、次の回では共通の除外で外れます。その worktree で直して PR まで進めるか、ブランチと worktree を消して次の回に回すかを、chat-main がこうだいさんに聞きます。
- **notes に出た Scope の外の気づき**は、chat-main が `issue-dispatch` で起票します。
- **記録**は、chat-main が `task-tracker` で専用のブランチ `chore/tracker-main-YYYYMMDD` に残します。実装の PR には載せません。
- **片付け**は、PR が merge されたあとに `finished-work` スキルで `wf-*` の worktree を一覧にし、確認を取ってから消します。Windows で `Permission denied` になったときの手順は `worktree-policy` スキルの「Windows での worktree 削除」にあります。

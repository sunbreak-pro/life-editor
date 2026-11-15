# issue-workflow のプロジェクト設定

このファイルは、グローバルの `issue-workflow` スキルが life-editor で読むプロジェクト設定です。スキルは見出しごとに中身を読み、`## 実装役への指示`・`## 全体確認`・`## PR の決まり`・`## 動作確認`・`## 仕上げ` の本文は `{{n}}` などを置き換えてから、各エージェントへの指示にそのまま入れます。

## 設定値

```json
{
  "repo": "sunbreak-pro/life-editor",
  "mainCheckout": ".",
  "worktreeRoot": "../workspaces/life-editor",
  "worktreeName": "wf-{{n}}",
  "branchPattern": "claude/{{slug}}-{{n}}",
  "maxImplementers": 3,
  "maxIssuesPerRun": 8,
  "minFreeGb": 6,
  "mergeMethod": "squash",
  "ciCommand": "node scripts/local-ci.mjs",
  "ciWorkflow": "ci.yml",
  "recordBranchPattern": "^chore/(?:tracker|outbox|routine)-(?:(?<workspace>.+?)-\\d{8})?",
  "harnessOnlyPaths": [".claude/**", ".github/**", "scripts/**", "*.md"],
  "migrationPaths": ["supabase/migrations/**"],
  "mechanicalFiles": ["**/*.md", "**/package-lock.json", "**/yarn.lock", "**/pnpm-lock.yaml", "**/Cargo.lock", "**/i18n/locales/*.json"],
  "areaWorkspaces": { "shared-fix": "{{titleTag}}", "section:*": "*" },
  "workspaceMapPath": ".claude/scripts/lane-ownership.json",
  "issueCreation": "main-only",
  "mergePolicy": "merge は claude-dotfiles の claude/docs/development-flow.md の「merge」に従います（POLICY.md の方針「merge と main への取り込み」）。条件を満たした PR は、chat-main か、issue-workflow の仕上げ役（work-finishers）が共通の merge-round で入れます。緑かどうかは、merge-round が ciCommand（node scripts/local-ci.mjs）を手元で回して決めます。承認が要るファイルを変える PR は共通の hook が止めます。仕上げ役はその PR を飛ばし、chat-main が merge-round を回して、こうだいさんがその場で決めます。実装役と全体確認の役、定時の実行と無人のループは merge しません。"
}
```

`mainCheckout` と `worktreeRoot` は、このファイルがある checkout から決める相対パスです。共通の道具は、`node ~/.claude/skills/issue-workflow/scripts/profile.mjs` で絶対パスに直してから使います。PC ごとのフォルダの場所を、設定に持たないためです。`profile.mjs` は main の checkout で打ちます。worktree の中で打つと、相対パスが worktree から決まり、違う場所を指すためです。

`mergeMethod` から `issueCreation` までの項目は、claude-dotfiles の共通の `merge-round`・`worktree-policy`・`issue-dispatch` と、共通の hook が読む値です。hook は、worktree の写しではなく main の checkout のこのファイルを読みます。worktree で値を変えても、merge が済むまで hook の判定は変わりません。

## 選び方

共通の除外（open PR・既存のブランチ・origin/main に着地した PR・未着地の依存・本文が着地済みと書いている Issue）は、グローバルのスキルが持ちます。ここには life-editor だけの決まりを書きます。

**revert された PR は着地に数えません。** この判定は、グローバルのスキルの着地の判定より先に、main のセッションが行います。merge-round で戻した作業は、この workflow で実装し直す決まりだからです（共通の `merge-round` スキルの「merge した後に戻す」）。戻した PR の `mergeCommit` も origin/main の祖先のままなので、この判定がないと、戻した Issue が着地済みに見えて二度と選ばれません。merged の PR #p（merge commit が `<oid>`）は、次のどちらかに当たれば着地に数えません。

1. origin/main に着地した merged の PR が、#p を戻している。題が `Revert "<#p の題>"` か `revert: <#p の題> (#p)`（merge-round の書式）で、題か本文に `#p` を含むものが当たりです。数えるのは merged の revert PR だけで、open や close のままの revert PR は数えません。番号は `#<p>(?!\d)` の形で照らし、直後に数字が続くものは当たりにしません（#12 で #123 を拾わないためです）。
2. `git log origin/main --grep "This reverts commit <oid>"` が 1 件以上出る。

戻した PR 自身も着地に数えません。merge-round の書式では、戻した PR の本文にも `Refs #<Issue>` が入るためです。戻した PR がさらに戻されていれば、元の PR は着地に戻ります。

**revert のあと、元の PR のブランチは origin と手元の両方で消します。** ブランチが残っていると、戻した Issue が共通の除外の「既存のブランチ」に当たり、次の回から外れるためです。origin は `git push origin --delete <ブランチ>` で消します。手元の `git branch -D` は settings で deny しているので、こうだいさんが手で打ちます。

**記録用のブランチの PR は数えません。** `chore/tracker-*`・`chore/outbox-*`・`chore/routine-*` の PR は、open でも merged でも着手の判定に使いません。tracker の PR は本文に「その日に触った Issue」を並べるので、実装の PR と同じに扱うと未着手の Issue まで外れるためです（2026-08-17 の初回実行で #889 ほかが外れかけました）。routine-report の PR も日次の記録で、実装を含みません。worktree が `chore/tracker-*` ブランチにいるのは正常で、着手中のしるしには使いません。

**`status:frozen` の Issue は選びません。** 着手するかどうかを、こうだいさんがまだ決めていないためです。報告の「選ばなかった Issue」に理由つきで載せます。

**`shared-fix` でタイトルが `[all]` の Issue は選びません。** `[all]` は Epic と、すべての担当の区分に向けた告知だけに使う決まりです（`docs-workflow` スキルと、`[all]` の Issue の二重着手を防ぐ決定 `decisions/D-20260731-main-2.md`）。2026-07-31 に `[all]` の #473 / #499 を 2 つの担当のチャットが同時に拾い、片方の実装が丸ごと無駄になりました。中に実装が要るなら、個別の Issue に分けて起票し直すよう報告で提案します。

**ラベルは選び方とモデルの判定に使いません。** `section:<id>` と `shared-fix` は、以前は貼り付け先のチャットを決めるために使っていました。この workflow は 1 つのセッションから実装役を起動するので、宛先のチャットを決める必要がありません。ラベルは起票の決まり（`docs-workflow`）として残り、常設の担当のチャットが自分宛の Issue を拾うときに使います。担当のチャットが同じ Issue をすでに拾っていれば、共通の除外（既存のブランチと open PR）で外れます。テストするパッケージも、ラベルではなく Scope のパスで決めます。

### 依存の読み方

- 依存は本文の `依存する作業: #a, #b` から読みます。Issue フォームから起票した本文では、`### 依存する作業` の見出しの次の行に同じ値が入ります。
- `なし` は依存なしです。旧い書式の `依存: #n` と `Parent: #n` も同じ意味で読みます。
- `依存: なし（#n は close 済み）` のように先頭が `なし` の行は依存なしとし、括弧の中の番号は拾いません。
- 依存先が満たされたかは、close ではなく PR が origin/main に入ったかで決めます（手順はグローバルのスキル）。close は確認が済んだあとに手で行う作業（`.claude/CLAUDE.md` §7.2）なので遅れるうえ、PR の merge 前に手で close されることもあるためです。

依存はラベルでは代わりになりません。ツアーの 4 本（#1122〜#1125）はラベル上 3 つの担当の区分宛でしたが、3 本が基盤の完了を前提にしていました。依存を無視して並べると、存在しない `TourProvider` に 3 本が同時に着手し、全員が `shared/src/i18n/resources.ts` を触るところでした（2026-08-27）。

### Scope の取り方と重なりの判定

同じファイルを 2 本の変更に触らせません（one writer per artifact）。同じ回の実装役は並列に走るので、同じファイルを 2 本が直すと PR が必ず衝突するためです。Issue ごとに Scope の glob を次の順で集めます。

1. 本文の Scope 欄（glob を 1 行 1 本で書いた fenced block）があれば、それを使います。
2. Scope 欄がなければ、本文から repo の相対パスを拾います。正規表現は `(shared|web|mcp-server|supabase|desktop|mobile)/[\w./-]+` で、末尾の `:<行番号>` と句読点は落とします。拾ったパスには「本文から推定」と添えます。
3. どちらでも 1 本も取れない Issue は選びません。「Scope 未記載」で載せ、chat-main が Scope を書き足すよう促します。

集めた glob で `{"#<n>": [glob, ...]}` の JSON をスクラッチに作り、main の checkout で `node ~/.claude/skills/worktree-policy/scripts/scope-overlap.mjs --issues <file>` を打ちます。これが共通の `worktree-policy` の「ほかの作業とのファイルの重なりを調べる」の着手の前の確認を兼ねます。結果は次のように読みます。

- **候補の 2 本が BLOCK で交わるとき**は、下の「選ぶ順番」で先に来るほうを選びます。もう一方は「Scope が他の Issue と重なる」で外し、先に選んだ Issue の番号を添えます。
- **2 本が WARN だけで交わるとき**は、両方を選んでかまいません。WARN は、i18n の en / ja や barrel の index.ts のような追記型の共有ファイルだけが重なる組です。追記の位置しだいで衝突するので、全体確認でブランチごとに scope-overlap を打ち直します。ただし en / ja の既存のキーを書き換える Issue は、1 回に 1 本だけにします。
- **Scope が open PR か他の worktree の未コミットの変更と BLOCK で交わるとき**は、「Scope が open PR と重なる」で外し、その PR 番号を添えます。
- **終了コードが 3（未確認）のとき**は、重なりなしとは読みません。gh の認証かネットワークを直して打ち直し、それでも 3 なら回を始めません。
- **終了コードが 4（設定が足りない）のとき**も回を始めません。出力の「足りない項目」を報告します。

どのファイルが追記型や生成物に入るかと、どの担当の区分がどのパスを持つかは、担当表 [`lane-ownership.json`](./scripts/lane-ownership.json) が唯一の元になる文書です。`wf-*` の worktree はどの担当の区分にも当たらないので、scope-overlap が「担当の区分の外」を報告することはありません。同じファイルの検査だけが頼りになります。

### 選ぶ順番

除外を通った候補は、次の順に並べて上から選びます。1 回に選ぶ数は `maxIssuesPerRun` までで、BLOCK で交わる 2 本のどちらを選ぶかもこの順で決めます。

1. ほかの open Issue が依存先に挙げている Issue を先にします。後ろの Issue が次の回で選べるようになるためです。
2. 次に `sev:blocking`、`sev:important`、`sev:minor`、`sev:` のラベルなしの順にします。
3. 同じ段では、番号の小さいほうを先にします。

## 実装役への指示

あなたは life-editor（`{{repo}}`）の Issue #{{n}} を、worktree `{{worktree}}` のブランチ `{{branch}}` で実装します。main の checkout は `{{main}}` です。

1. `gh issue view {{n}} -R {{repo}}` で Issue を読みます。「作るもの」「範囲の外」「Scope」「完了条件」が仕様です（古い Issue では「DoD」「Definition of Done」が完了条件です）。Scope の外のファイルは変えません。Scope の外の変更が要ると分かったら、実装せずに notes へ書きます（`.claude/comm/decisions/POLICY.md` の方針「実装中スコープ凍結」）。自分で Issue を起票しません。起票は chat-main が `issue-dispatch` で行います。
2. 作業を始める前に、共通の `worktree-policy` スキル（`~/.claude/skills/worktree-policy/SKILL.md`）を読みます。`{{worktree}}/.claude/comm/.session-branch` に `{{branch}}` を、`{{worktree}}/.claude/comm/.session-name` に `wf-{{n}}` を書きます。あとでこの worktree を Claude で開いたときに、セッション開始の hook が読むためです。作業は `{{worktree}}` の中だけで行い、`{{main}}` ではブランチを切り替えません。
3. 実ブラウザ（playwright MCP・Chrome・Claude Design）と dev server（`npm run dev`）は使いません（CLAUDE.md §7.4）。worktree で localhost を重ねて起動すると、どの画面がどの変更かの確認が壊れるためです。Issue が実ブラウザでの調査を求めていても、コードを読んで調べ、実ブラウザでの確認は notes に「chat-main に残す」と書きます。画面での確認は、全体確認の後に別の役（work-finishers の動作確認）が受け持ちます。
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
7. `.claude/memory/`・`.claude/history/`・`.claude/comm/outbox/` は触りません。tracker と outbox は実装の PR に載せない決まりです（進捗の記録の衝突を避ける決定 `decisions/D-20260801-main-1.md`）。並行するブランチが同じ記録のファイルに追記すると、必ず衝突するためです。commit を止める共通の hook（`bash-guards.mjs`）は、コマンドの `cd` か `git -C` が指した worktree の index を見て止めます。hook が行き先を読めない形もあるので、この決まりは自分でも守ります。

notes は日本語（です・ます）で書き、置いた仮定、Scope の外で気づいたこと、chat-main に残す作業（実ブラウザでの確認・db push など）を並べます。

## 全体確認

あなたは Issue #{{n}} のブランチ `{{branch}}`（worktree `{{worktree}}`）の全体確認をします。製品のコードは直しません。ほかの全体確認と同時には動かしません。

1. `cd {{worktree}} && node scripts/local-ci.mjs --list` で、`.github/workflows/ci.yml` の `docs-lint` と `verify` のステップを読みます。`uses:` 以外のステップを、出た順に、それぞれの working-directory で 1 つずつ打ちます。並列にはしません。コマンドは表のとおりにし、次の 2 つだけ変えます。
   - vitest のステップ（shared・web・desktop・mcp-server の `npm run test`。どれも `vitest run`）は `npm run test -- --maxWorkers=4` で打ちます。
   - docs-lint のステップは `LC_ALL=C bash scripts/docs-lint.sh` で打ちます。
2. 最初の失敗で止めず、全ステップの終了コードを記録します。`--fail-fast` は使わず、`npm ci` のステップも飛ばしません。終了コードは `cmd | tail` から取らず、出力を変数かファイルに取ってから `$?` を見ます。
3. ブランチが `.claude/scripts/` のスクリプトを触っていて、そのテストが docs-lint に入っていなければ（docs-lint が回すのは `records.test.mjs` だけです）、repo の根で `node --test .claude/scripts/<name>.test.mjs` を打ち、ステップとして記録します。
4. worktree の中で引数なしの `node ~/.claude/skills/worktree-policy/scripts/scope-overlap.mjs` を打ち、`結論:` の行を記録します。BLOCK は失敗に数えます。終了コード 3（未確認）は重なりなしと読まず、gh の認証かネットワークを直して打ち直します。それでも 3 なら失敗にします。終了コード 4（設定が足りない）も失敗にします。WARN は失敗に数えず、PR 本文に書きます。
5. 合格は、全ステップの終了コードが 0 で、scope-overlap に BLOCK がないときだけです。失敗がこのブランチと関係なさそうでも（origin/main でも赤いなど）、失敗にして理由を書きます。直しはしません。

notes は日本語（です・ます）で書きます。

## PR の決まり

全体確認が合格したあとに、work-finishers がこの決まりで push して PR を作ります。全体確認の役は push しません。全体確認が失敗したときは、push も PR もしません。

1. push は `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -u origin {{branch}}` で打ちます。既定の資格情報マネージャーはここで止まったまま戻らないためです。`-u origin {{branch}}` は省きません。ブランチは `--no-track` で切っているので upstream がなく、引数なしの `git push` は通らないためです。
2. PR は `gh pr create -R {{repo}} --base main --head {{branch}} --title "<commit の題>" --body-file <file>` で作ります。題は英語で、commit の題と同じにします。
3. 本文には次を入れます。
   - 何を変えたかの短い要約
   - 全体確認のステップと終了コードの表、scope-overlap の `結論:` の行
   - `Refs #{{n}}` の行。`Closes`・`Fixes`・`Resolves` は使いません。merge で Issue が勝手に close されると、実ブラウザでの確認や db push が残っていても終わったように見えるためです
   - 実ブラウザでの確認の扱いの一文。`runtime: true` の Issue なら「動作確認の結果をこの PR のコメントに付ける」、対象でなければ「実ブラウザでの確認は chat-main に残している」と書きます（db push が要るならそれも）
4. ここでは merge しません。merge は、下の「仕上げ」の回の中か、chat-main の `merge-round` の回で起きます。

## 動作確認

work-finishers が、main のセッションが `runtime: true` の印を付けた Issue の PR #{{pr}}（ブランチ `{{branch}}`、worktree `{{worktree}}`）で行います。dev server と実ブラウザを worktree で使うのは、この役だけの例外です（CLAUDE.md §7.4）。ここには life-editor だけの手順を書きます。

1. **ポートは 5199 に固定します。** chat-main がふだん使う 5173 と、先客がいるときに vite がずらす 5174 から離すためです。始める前に `C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command 'Get-NetTCPConnection -LocalPort 5199 -State Listen -ErrorAction SilentlyContinue'` を打ちます。何も出なければ、ポートが空いていたことを覚えておきます。何か出たら、自分が立てたものではないので止めません。動作確認は「ポート 5199 が使われていた」で見送り、PR のコメントにそう書いて chat-main に残します。この場合は手順 2 以降に進まず、手順 9 でも何も止めません。
2. **env のファイルを写します。** `{{worktree}}/web/.env.local` がなければ、`cp {{main}}/web/.env.local {{worktree}}/web/.env.local` を打ちます。`{{main}}` にもなければ、動作確認を見送って chat-main に残します。worktree には env のファイルがなく、ないと Supabase の初期化で画面が落ちるためです。中身は表示せず、commit しません（`web/.gitignore` の `*.local` で外れています）。
3. **dev server を立てます。** `cd {{worktree}}/web && node {{worktree}}/web/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5199 --strictPort` を、Bash の `run_in_background: true` で打ちます。npm を挟まないのは、止めるときにポートを持つプロセスが 1 つで済むためです。vite を絶対パスで書くのは、手順 4 でコマンドラインに `{{worktree}}` が入っているかを確かめるためです。`--host 127.0.0.1` を付けるのは、Windows では `localhost` が `::1` に向き、IPv4 で待つ server に届かないことがあるためです。shared の build は要りません。web の vite は shared をソースから読むためです。`node_modules` は全体確認の `npm ci` で入っています。なければ `{{worktree}}/shared` と `{{worktree}}/web` で `npm ci` を打ちます。
4. **答えるまで待ち、PID を記録します。** `curl -s -o /dev/null -w "%{http_code}" --retry 30 --retry-delay 2 --retry-connrefused http://127.0.0.1:5199/` が `200` を返せば答えています。続けて `C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command 'Get-NetTCPConnection -LocalPort 5199 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$_" | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" } }'` を打ち、出た PID を記録します。手順 1 でポートが空いていたので、いま待っているのは自分が立てた server です。念のため、コマンドラインに `vite.js` と `{{worktree}}` が入っていることも確かめます。入っていなければ、その `200` を信じません。何も止めずに動作確認を見送り、PR のコメントにそう書きます。`200` が返らないときは、起動ログの末尾を PR のコメントに書き、手順 9 に進みます。
5. **サインインしないで見える画面だけを確かめます。** `http://127.0.0.1:5199/` を開きます。サインインの資格情報は入力しません。ブラウザの localStorage か cookie にセッションが残っていても使いません。サインインの要る画面は、いつも「chat-main に残す」とコメントに書きます。
6. **本番のデータに書き込みません。** サインイン済みのときは、本番の Supabase にあるこうだいさんのデータを見ています。見るだけにして、項目の作成・編集・削除、設定の変更、サインアウト、アカウントの操作は一切しません。書き込まないと確かめられない完了条件は、確かめずに「chat-main に残す」とコメントに書きます。
7. **BLOCKING に数えるのは次のときです。** Issue の完了条件のうち画面で確かめられるものが満たされないとき、白い画面かエラーの画面になるとき、変更した画面で console に新しい error が出るとき、変更した操作の主な流れが通らないときです。文言や余白の小さなずれは BLOCKING にせず、コメントに書くだけにします。
8. **次は chat-main に残します。** マイグレーションを含む PR は確かめません。db push の前は本番のテーブルと合わず、db push はこうだいさんの作業だからです。サインインの要る画面、mobile（Capacitor）と desktop（Electron）のアプリでの確認、IME の入力も残します。narrow の画面は、ブラウザの幅を 390px に狭めて確かめてかまいません。
9. **結果がどうでも、最後に必ず止めます。** 止めるのは手順 4 で記録した PID だけで、`C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command 'Stop-Process -Id <記録した PID> -Force'` を打ちます。ブラウザも閉じます（`browser_close`）。そのあと手順 1 の確認のコマンドをもう一度打ち、何も出ないことを確かめます。PID を記録できなかったときと、止めたあともポートに何か残っていたときは、ほかのプロセスを止めずに、PR のコメントと報告にそう書きます。手順 1 で見送った実行は、何も止めません。

## 仕上げ

work-finishers が、実行のすべてのブランチが終わったあとに 1 度だけ行います。台本の `merge` が `true` になった実行（`## 仕上げ` があり、承認が要る種類の Issue を選んでいない実行）だけです。手順は共通の `merge-round` スキルの「work-finishers が回すとき」に従い、対象はこの実行の PR（{{prs}}）だけにします。merge のコマンドの形は `merge-round.mjs check <n>` が表示します。ここには life-editor だけの決まりを書きます。

1. `fixes` の前に、この実行の PR のうち open のものの `wf-*` の worktree を外します。場所は `git -C {{main}} worktree list --porcelain` で確かめ、`git -C {{main}} worktree remove <その場所>` で外します（理由は「実行のあと」の 2 つめの項目）。全体確認で落ちて PR のない `wf-*` は外しません。
2. `supabase db push` は打ちません。Issue も close しません。どちらもこうだいさんか chat-main の作業です。

## 実行のあと

chat-main（リポジトリ直下の main の checkout）が、実行の報告を受けて次を行います。

- **merge は共通の `merge-round` の回で進めます。** 台本の `merge` が `true` になった実行（`## 仕上げ` があり、承認が要る種類の Issue を選んでいない実行）では、work-finishers が仕上げとして merge-round を回します（`## 仕上げ`）。仕上げを回さなかった実行の PR と、承認が要るファイルを変えるので仕上げ役が飛ばした PR は、chat-main が merge-round を回して入れます。承認が要る PR は、hook の確認でこうだいさんがその場で決めます。
- **PR が open の `wf-*` の worktree は、merge-round の「衝突と確認の赤を振り分ける」（`fixes`）より前に外します。** main の checkout で `git worktree remove <worktreeRoot>/wf-<番号>` を打ちます。ブランチは origin に残るので、PR はそのまま動きます。共通の `merge-round.mjs` は、main の checkout の外にある worktree を、自分が作る一時 worktree（`merge-verify`・`autofix-*`）を除いてすべて担当の作業場所に数えるためです。残しておくと、誰もいない worktree 宛てに `/goal` の指示文が出ます。chat-main が衝突を直す autofix も、「作業場所がブランチを開いている」と判定されて止まります。PR のない `wf-*`（全体確認で落ちたもの）は外さずに残します。
- **実ブラウザでの確認は、印の付いた PR を work-finishers が、残りを chat-main がします。** `runtime: true` の印を付けた Issue の PR は、work-finishers の動作確認（`## 動作確認`）が確かめて PR にコメントします。印のない画面に関わる PR と、動作確認が chat-main に残した分は、merge の後に chat-main が playwright MCP と dev server で確かめます。db push が要る PR は、こうだいさんの作業として伝えます。
- **Issue の close は workflow がしません。** 実ブラウザでの確認と db push が済んだあとに、こうだいさんか chat-main が手で閉じます（CLAUDE.md §7.2）。
- **全体確認で落ちた Issue** はブランチが `wf-<番号>` の worktree に残るので、次の回では共通の除外で外れます。その worktree で直して PR まで進めるか、ブランチと worktree を消して次の回に回すかを、chat-main がこうだいさんに聞きます。
- **notes に出た Scope の外の気づき**は、chat-main が `issue-dispatch` で起票します。
- **記録**は、chat-main が `task-tracker` で専用のブランチ `chore/tracker-main-YYYYMMDD` に残します。実装の PR には載せません。
- **片付け**は、`finished-work` スキルで残った `wf-*` の worktree を一覧にし、確認を取ってから消します。Windows で `Permission denied` になったときの手順は共通の `worktree-policy` スキルの「作業場所を消す」にあり、掴んでいるのが Orca のターミナルなら `.claude/CLAUDE.md` §7.4 のとおり閉じてから消します。

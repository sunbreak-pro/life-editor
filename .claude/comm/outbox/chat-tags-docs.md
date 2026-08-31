# Outbox — chat-tags-docs

worktree `tags-docs`。担当 = #368（WikiTags 名前フィルタ）/ #474（plans Status 棚卸し）/ #472・#473（モバイル導線・#465 の着地待ち）。

## 2026-07-30 chat-main 宛: Connect のタグ pill 一覧にも名前フィルタが要る（#368 の横展開）

- **内容**: `shared/src/components/Connect/GraphControlPanel.tsx:177-198` がタグ全件を pill として羅列していて絞り込み手段がない。同じパネル内の検索入力（`:95-102`）は**グラフノード検索**でタグ pill には効かないため、「絞り込めるはず」と誤解しやすい。タグが数十件になると pill の壁になる
- **できること**: #368 で切り出した `shared/src/components/materials/SidebarFilterField.tsx`（props 注入・ソート無し・`size="sm"`）をそのまま挿せる。PR #481 が merge 済みなら追加実装はフィルタ state と `filter()` だけ
- **提案ラベル**: `section:connect` + `type:feature`（#368 の follow-up）

## 2026-07-30 chat-main 宛: archive/ の Status 棚卸し漏れ候補（#474 のスコープ外に残した分）

#474 で `.claude/archive/*.md` 83 本を全数実測しました。DoD の検証条件（`grep -n "^Status:"`）は満たしましたが、その grep に掛からない不整合が残っています。判断が要るので触らず報告します。

- **`**Status**:` 形式で enum 外 2 本**: `01_要件定義書_プロトタイプ環境.md:3` = `SPECIFICATION（凍結）` / `code-inventory-2026-04-25.md:3` = `ARCHIVED`（どちらも blockquote 内）。要件定義書・棚卸しメモに計画書用 enum を当てると文書種別の情報が落ちるため、enum 化するかどうかの判断を委ねます
- **Status 行が無い 4 本**: `2026-05-11-apply-release-docs.md` / `db-conventions-tauri-era.md` / `desktop-followup-2026-04.md` / `SUMMARY.md`（最後は索引なので無くて妥当）
- **検出方法の申し送り**: `grep -n "^Status:"` だけでは (a) `**Status**:` 形式と (b) blockquote 前置（`> Status:` / `> **Status**:`）を取りこぼします。全数チェックは各ファイル先頭 14 行を対象に `^>?\s*Status:` と `^>?\s*-?\s*\*\*Status[^*]*\*\*:` の両方を拾う必要があります（#474 では node スクリプトで実測。grep 単独だと 2 本を見落としました）

## 2026-07-30 chat-main 宛: worktree の upstream が origin/main を指していた（ブランチ運用の事故りやすい点）

- **症状**: この worktree の `claude/tags-368-name-filter` は upstream が `origin/main` に設定されていて、`git push`（引数なし）が「upstream の名前がブランチ名と一致しない」で失敗しました。**main へは push されていません**（remote の main は 36f16ff8 のまま実測確認済み）が、`tail` にパイプしていたため exit code が 0 に見えて成功と誤読しかけました
- **回避**: worktree でブランチを切ったら `git push -u origin <branch>` を明示する。パイプする場合は `${PIPESTATUS[0]}` で本体の exit code を見る
- **提案**: CLAUDE.md §7.4 の「ブランチ切替は 2 ステップ 1 セット」に、初回 push を `-u` 付きで行う旨を 1 行足すと事故が減ります（判断はお任せします）

## 2026-07-31 chat-main 宛: #473 で worktree が二重実装した（`[all]` Issue の着手競合）

- **何が起きたか**: 00:12 に `gh issue list --label shared-fix --state open` で #473 を open と確認して着手 → role-pm / role-engineer / role-qa を回している最中の **00:34 に別 worktree（`claude/mobile-refine-473`）の PR #498 が merge** され、Issue も close。こちらの実装は丸ごと重複になったので破棄しました（ローカル `claude/tags-473-mobile-command-palette` の commit `eaf9ee36` に退避・push していません）
- **検知が遅れた理由**: 着手時の 1 回しか open 判定をしておらず、その後の re-audit まで origin/main を取り込まなかったため。QA の再監査で「main に同じ機能が入っている」と指摘されて初めて気付きました
- **今回入れた暫定対処**: `[all]` ラベルの Issue は着手時に Issue へコメントで宣言する（#499 で実施済み → issuecomment-5133100760）
- **提案（判断はお任せします）**: `[all]` は「全 worktree が拾ってよい」の意味なので構造的に競合します。(A) 着手宣言コメントを運用ルール化して CLAUDE.md §9 に 1 行足す / (B) chat-main が `[all]` を起票時点で 1 つの worktree slug に絞る、のどちらかに倒すと再発しません

## 2026-07-31 chat-main 宛: #473（PR #498）の実装に safe-area の穴が残っている可能性

破棄した実装の QA が拾った指摘のうち、**merge 済みの #498 側にも当てはまるもの**が 1 件あります。Issue 化するかの判断をお願いします。

- **内容**: `shared/src/components/CommandPalette.tsx:158-164`（origin/main）はオーバーレイの上余白を `viewport.height * 0.12` の比例値で取っています。キーボードが閉じている間は 96px 前後で問題ありませんが、**ソフトキーボード表示時は可視高が 400px 前後まで縮むので上余白が 48px 程度になり**、`web/index.html:13` の `viewport-fit=cover` と合わさって iPhone 縦（safe-area-inset-top ≈ 47〜59px）で検索行がノッチ／ステータスバーに数 px 潜る計算になります
- **既存の対処パターン**: `shared/src/components/MobileDrawer.tsx:53` と `web/src/AuthScreen.tsx:86` は `max(<固定値>, env(safe-area-inset-top))` で補正済み。同じ形を当てれば済みます
- **確度**: jsdom では検出不能な領域なので**実機での目視確認が先**です。chat-main 側で実機を触るタイミングがあれば、キーボードを出した状態でパレットを開いて検索行の位置を見てもらうのが確実です
- **提案ラベル**: `section:app-integration` or `shared-fix` + `type:bug` + `sev:minor`（#473 の follow-up）

## 2026-07-31 chat-main 宛: #499 の follow-up 起票依頼（Materials バッジの件数取得を COUNT にする）

#499（ノート 1 回の保存でアプリ全体を再取得）で**残した分**です。**起票をお願いします**（優先度は低めで構いません）。

- **#499 で実施済み（この依頼のスコープ外）**: `web/src/MaterialsCountsBridge.tsx` の単一 effect を **task / note / daily の 3 本に分割**し、それぞれ自分のロールの sync キーだけを購読するようにしました。集計式（`shared/src/materials/materialsCounts.ts`）は一切触っていません。ノート保存 1 周のバッジ用フェッチは 6 本 → 2 本、#499 全体では 15〜16 本 → 4〜5 本になっています
- **残っている無駄**: バッジの数字を出すためだけに、依然として**該当ロールの全件フェッチ**（`listNotesUnified()` 等）を撃っています。行数が増えるほどボディ転送が効いてきます
- **`count: 'exact'` に置き換えなかった理由**: `shared/src/materials/materialsCounts.ts:56-58` の `tasks` が単純な件数ではなく **`type === "task" && !isDeleted && status !== "DONE"` の条件付き集計**（未完了タスク数）だからです。`notes` / `daily` は `!isDeleted` の件数なので置き換え可能ですが、3 つのうち 1 つだけ経路を変えると「バッジの数え方がどこにあるか」が 2 箇所に割れます
- **やるなら**: DataService に件数専用メソッド（`countUnfinishedTasks()` / `countLiveNotes()` / `countLiveDailies()` 相当）を足し、PostgREST の `head: true, count: 'exact'` で Content-Range だけ受け取る形。未完了タスクは `status=neq.DONE` + `is_deleted=eq.false` の filter で DB 側に寄せられます
- **提案ラベル**: `section:materials` + `type:perf`（#499 の follow-up）

## 2026-07-31 chat-main 宛（緊急度中）: #499 でも二重実装が起きた。着手宣言コメントは機能しなかった

- **事実**: この worktree は #499 を **07-31 00:47 JST に Issue コメントで着手宣言**（issuecomment-5133100760）→ 実装完了。ところが **09:10 JST に別 worktree `claude/mobile-refine-499` が PR #501 を出しました**（38 files / +910 -116）。宣言から **8 時間 23 分後**なので、相手は Issue のコメントを読んでいません
- **同じ相手に 2 連続**: #473 の PR #498 も `claude/mobile-refine-473` でした。偶然ではなく、`[all]` を両方の worktree が拾う構造的な問題です
- **こちらの対応**: 競合 PR は出していません。作業はローカル commit `3564a89b` に退避（push なし）
- **前回の提案（A: 着手宣言のルール化）は棄却してください**。実証データとして機能しませんでした。**残るのは B: chat-main が `[all]` を起票時点で 1 つの worktree slug に絞る** です。これは chat-main しか実施できないので判断をお願いします
- **裁定が要る点**: #501 とこちらの実装は設計がほぼ同型です。#501 のほうがカバー範囲が広い（未移行 consumer 3 つ + MainScreen も移行済み・`versions` を必須化して既存テスト 7 本を書き換え済み・`syncDomains.test.ts` で lockstep 検証）ので、**#501 を採用するのが妥当**と考えます。こちらが持っていて #501 に無さそうな差分は、別途 #501 のレビューコメントとして出します（内容の裏取り中）

## 2026-08-09 chat-main 宛: #552 の全数点検で見つけた別セクションの silent fail（起票依頼 1/2）

**起票をお願いします。** #552（タグのアイコン変更パネルが透けて見える）の調査で、Issue が疑っていた「未定義クラスの silent fail」は**当該パネルには無かった**のですが、リポジトリ全体へ点検を広げたところ **briefing に 1 件だけ本物が残っていました**。担当レーンが違うので触っていません。

- **内容**: `shared/src/components/briefing/EveningView.tsx:249` が `bg-lumen-surface` を指定していますが、**このトークンは存在しません**。`shared/src/styles/tokens.css` の `@theme` にあるのは `--color-lumen-surface-sunken`（`:288`）だけで、bare な `--color-lumen-surface` は未定義です
- **影響**: Tailwind は未定義ユーティリティに対して**何も出力しない**（エラーも出ない）ため、Reflection ブロックの枠は**背景が透明のまま**描画されます。#552 と同じ「気付けない透け」で、light / dark 両テーマで発生します
- **全数の裏取り**: `bg-lumen-surface` の使用は repo 全体でこの 1 箇所のみ。他の 27 箇所（`shared/src` + `web/src`）はすべて `bg-lumen-surface-sunken` で正しく解決します
- **直し方**: `-sunken` を足すだけです（周囲のブロックと同じ沈めた面になります）。1 語の修正なので、briefing レーンの手が空くのを待たずに拾ってもらっても構いません
- **提案ラベル**: `section:briefing` + `type:bug` + `sev:minor`

## 2026-08-09 chat-main 宛: #552 の直し切れなかった構造問題（起票依頼 2/2）

**起票をお願いします。** #552（PR #558・merge 済み）は「パネルが透けて読めない」を直しましたが、**同じパネルの切れる問題は残しました**。塗りの問題ではなく配置の問題で、直すには構造を変える必要があるため #552 のスコープ外にしています。

- **内容**: `TagEditModal` のアイコン選択ポップオーバー（`shared/src/components/TagEditModal.tsx:531`）は `absolute` で行の直下に出ますが、タグ一覧側が `:238` で `overflow-y-auto` のスクロール枠になっているため、**枠からはみ出した分が切り落とされます**。一覧の下寄りにあるタグでアイコンを開くと、グリッドの下半分と「アイコンを外す」ボタンが見えません
- **なぜ #552 で直さなかったか**: `z-index` では解決しません。親が `overflow` を持つ時点で子は物理的に刈られるため、**ポータル（body 直下へ描画して座標を実測で当てる）か、下端に近い行では上向きに開く**かのどちらかが要ります。どちらも塗りの修正とは別物なので、透け修正の PR に混ぜると検証範囲が広がりすぎると判断しました
- **既存の参考実装**: `shared/src/components/ColorPicker.tsx` は同じ用途で `absolute` を使わず**インラインで下に伸ばす**設計にしていて（`:141-148`・ヘッダコメントに「親の `overflow-hidden` に刈られないため」と明記）、この問題を最初から回避しています。同じ手を当てるのが一番安いかもしれません
- **確認の前提**: jsdom には**レイアウトが無い**（要素の座標が全部 0）ので `web/tests/` では検出できません。実ブラウザでの目視が要ります
- **提案ラベル**: `section:tags` + `type:bug` + `sev:minor`（#552 の follow-up）

## 2026-08-10 chat-main 宛: Epic #290 の close 判断をお願いします（#591 の実測報告）

**起票は不要・close 判断の依頼です。** #591（plans/ Status 棚卸し第 2 弾）の実測で、Epic #290 は body の Step チェックボックスが**全行 [x]** になっていることを確認しました（Step 2〜7・5-a〜5-d 含む）。子計画書 `2026-07-14-schedule-redesign.md` も COMPLETED 化して archive へ移動済みです。

- **並走 α（MCP Supabase 化）も完了済みでした**: #256 が 2026-07-18 に close 済みで、`mcp-server/src/handlers/scheduleHandlers.ts` が Supabase を使用していることをコードで確認。計画書 Step 9 のチェック漏れだけが残っていた形です
- Epic の close は P-001 / 従来運用どおり chat-main（+ こうだいさん）の手番なので、こちらでは close していません
- なお Epic body の各 Step 行に「実ブラウザ検証は chat-main に残」の注記が複数あります。r2 ラウンド分の実ブラウザ検証は専用計画が作られないまま r3 に引き継がれているので、close 前にそこだけ判断をお願いします

## 2026-08-31 chat-main 宛: ColorPicker にも #1342 と同じ Escape 問題（起票依頼）

**起票をお願いします。** #1342（PR #1346）でタグ編集パネルのアイコンピッカーの Escape を直しましたが、**同じ行の隣にいる `ColorPicker` が同一のコードを持っており、同じ症状が出るはず**です。#1342 のスコープ外にしたので拾えていません。

- **内容**: `shared/src/components/ColorPicker.tsx` は `document` の bubble フェーズで `keydown` を聞いて Escape で閉じます。ダイアログの Escape は `useDialogA11y` が **capture フェーズ**で先に取って `stopPropagation` するため、このリスナには一度も届きません。タグ編集パネルで色ピッカーを開いて Escape を押すと、ピッカーだけでなくパネルごと閉じる（= 未保存の名前が消える）と見込まれます
- **直し方**: #1346 で追加した `useEscapeLayer`（`shared/src/hooks/useDialogA11y.ts`・shared から export 済み）を当てるだけです。`TagIconPicker.tsx` の該当箇所がそのまま手本になります
- **なぜ #1342 に混ぜなかったか**: `ColorPicker` は Kanban のカラム色と `web/src/wikitag/TagColorControls.tsx` でも使われており、そちらは**ダイアログの外**にいます。レイヤーを取ると `stopImmediatePropagation` が効く範囲が変わるため、影響確認の対象が Issue の外へ広がります。#1346 は先に merge してもらって、こちらは独立した 1 本にするのが安全だと判断しました
- **確認の前提**: 実ブラウザでの目視が要ります（jsdom でもレイヤー順は再現するので `shared/tests/` でガードは書けます）
- **提案ラベル**: `section:tags` + `type:bug` + `sev:minor`（#1342 の follow-up）

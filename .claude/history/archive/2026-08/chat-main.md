# HISTORY ARCHIVE (chat-main, 2026-08)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-04 - Loop Engineering: 3 計画書の整合性評価 + Phase 1 インフラ配置（PR #594）

#### 概要

ユーザー持ち込みの 2 計画書（loop-catalog / context-cost-reduction-harness）と親計画（2026-07-28-loop-engineering-harness）の整合性を評価し、指示の実施順序がカタログ側の「Phase 2 前提」裁定と矛盾している点を含む 3 点をユーザーに確認。裁定（①順序 = 親 Phase 1 → カタログ → コスト → 親 Phase 2 ②Phase 0→1 昇格の前倒し確定 ③実行基盤は調査して提案）に基づき、親計画 Phase 1 のインフラを PR #594 として配置した。自動発火は D-20260804-main-1 の裁定まで無効。

#### 変更点

- **整合性評価**: 順序矛盾（カタログ = Phase 2 の前提条件）/ 1 セッションで消化できない時間ゲート 3 箇所 / 実行基盤の未指定 / plans 未配置・Branch 未記入 / MCP ツール定義仮説への deferred tools の影響、を検出して報告
- **plans/ 配置**: `2026-08-04-loop-catalog.md` + `2026-08-04-context-cost-reduction-harness.md`（Branch 記入 + Worklog に裁定記録を追記して原文どおり配置）
- **automation/ 改訂（Cloud Routine 退役）**: `routine-digest.md`（朝 06:03・dev-digest スキルの薄い外枠）+ `routine-night-safe.md`（夜 22:33・読み取り中心の監査 4 本 = docs 整合 / Issue 台帳 / PR conflict / 検証準備・書き込みは outbox 報告のみ）+ `run-routine.ps1`（headless launcher・未実測）を新設。README / routine-ids を全面書き換え、旧 night / morning プロンプトは Phase 2 改訂待ちバナー付きで凍結
- **権限の二層化**: `settings.json` の `permissions.ask` に `git push*` / `gh pr create*` を追加（merge 後は全チャットで push / PR 作成が常に確認必須になる — PR 本文に注意書き）。**この 2 件は 2026-08-10 の #618 / PR #619 で撤去**（無人レーンの担保は runner 側 settings へ分離）
- **実測補正**: セッション内 scheduled tasks（CronCreate）はセッション限定 + 繰り返し 7 日期限。親計画 §3-7 の前提を Worklog で補正し、推奨基盤 = Task Scheduler + `claude -p`（2026-07-16 朝刊プロトタイプの型）を **D-20260804-main-1** として起票
- **親計画更新**: Status 行 / Steps 6〜9 / Worklog 追記。docs-lint = OK

#### 次セッション用プロンプト（セッション 2: ループカタログ）

```
ループカタログ計画の実装セッション（Loop Engineering セッション 2/3）。
前提: PR #594 が merge 済みであること（未 merge なら停止して報告）。
正本 = .claude/docs/vision/plans/2026-08-04-loop-catalog.md（着手時に Status を IN PROGRESS 化）。
進め方は計画書 §4 のとおり:
1. ローカル実態の調査（~/.claude/skills/ の役割系・パイプライン系の中身と実運用 / リポジトリ内スキルとの責務の重なり / hooks・permissions が機械強制している範囲)
2. 調査結果から子計画書を docs/vision/plans/ に作成 → 私がレビュー
3. レビュー後にループ定義フォーマットを 1 本目（/loop-triage 推奨）で確定 → 残り（/loop-implement /loop-verify /loop-postmortem）を配置
制約: Scope = .claude/skills/loop-*/ と plans/ のみ。全ループ明示起動（disable-model-invocation）+ 反復上限宣言 + 必須 5 見出し（目標 / 完了条件 / 予算 / 停止条件 / 使ってよい道具）。既存パイプラインを呼ぶ薄い外枠にし、手順を書かない。
セッション終了時に、コスト削減ハーネス（2026-08-04-context-cost-reduction-harness.md・セッション 3）向けのプロンプトを生成すること。
```

### 2026-08-01 (2) - 判断キュー 8 件の消化と docs 反映（PR #527 merged・#524〜#528 起票）

#### 概要

巡回を 5 周した末にユーザーが判断キューへ回答を返し、溜まっていた 8 件をすべて消化した。回答は行き先が 3 通り（Issue のゲート解除 / 実装 Issue の起票 / docs への反映）に分かれるため、それぞれ実行して停止条件（#467 / #468 close + open PR 0）まで戻した。

#### 変更点

- **回答の転記**: `.claude/comm/decisions/ANSWERS.md` に 8 件（main `3dd7b511`）。うち D-20260730-mobile-1 は明示指名が無く「放置時 A」での確定なので、ユーザー回答ではない旨を行に明記
- **ゲート解除 1 件**: D-20260801-sched-1 = A（移動時にレンズを外す）を #520 にコメント。DoD 1 番目の 🛑 が外れ schedule-refine が着手可に
- **起票 2 件（B 採用 = 実装が要るもの）**: **#525** `BottomSheet` に明示的な閉じるボタン（mobile-2）／ **#526** パスワード付きノートのモバイルシートを Desktop と同じ「本文だけロック」に揃える（mobile-3）。どちらも `[mobile-refine]` 宛て
- **docs 反映 4 件 = PR #527**（merged `637a64e6`・CI 2 ゲート pass）: CLAUDE.md §9 から `[all]` prefix を廃し「起票時点で slug を 1 つに決める」へ（main-2）／ §7.4 に「tracker は実装ブランチに載せない」（main-1）／ `rules/docs-consistency.md` §3 に「enum は plans/ 由来だけ」+ 全数チェックの正しい grep（main-2）／ ClaudeDesign fan-out 計画書を COMPLETED 化して `archive/` へ `git mv` し、CLAUDE.md §6 の「追跡正本」宣言を **Epic #321 + mobile-scope.md + Issue 群**へ付け替え（tags-1）
- **自分で作った不具合を自己レビューで検出**: archive へ移した計画書の相対リンク 2 本が階層ぶんずれてリポジトリ外を指していた（`../../` のまま）。同 PR 内で修正（`e6f0b7cc`）
- **同種の既存壊れを発見 → #528**: `archive/` の 5 ファイル・6 本が同じ理由で壊れている（リンク先はすべて実在・階層だけが誤り）。根本原因は `scripts/docs-lint.sh` がリンク解決を検査していないことなので、検出の追加も DoD に入れた
- **巡回 2〜5 周目の所見**: outbox は **worktree の実体まで直接 diff** しないと未 push 分を取りこぼす（tags-docs に 4 エントリ・内容は処理済み）。PR #479 は squash merge のため `git merge-base` では未マージに見えるが、mergeCommit `ac32c7b9` が main の祖先であることを実測して着地を確認（§7.4 の「差分で判定しない」の実例）

### 2026-08-01 - open PR 巡回の完走（open PR 0 到達・Epic #290 / #321 の DoD 実測確認・#523 のレビュー検出 1 件）

#### 概要

「open PR を巡回して merge 可能なものを報告 → outbox の未処理を処理 → merge を検知したら Epic のチェックボックスと docs Status を追随」の巡回を、停止条件（#467 / #468 close + open PR 0）まで走らせた。巡回開始時の open PR 2 本はレビュー中にユーザーが merge したため、レビュー結果は merge 後の指摘として記録に残す形になった。

#### 変更点

- **停止条件の達成**: #467（Step 5-c Mobile List+FAB）・#468（Step 6 台帳タグレンズ）とも CLOSED、open PR は 0（巡回中に #521 / #522 / #523 が merge され main は `8e624422`）
- **PR レビュー 2 本**: #522（tracker 復元・docs 専用）は本文の 3 claim を `git show origin/main:` で実測照合し全一致 — 指摘なし。#523（`useGraphInteraction` の d3 sim を発火時読み取りへ）は変更自体は正しいが、**deps から `simRef.current` を落としたことでリスナーの貼り直し機会がサイズ変更時のみになる**副作用を検出（下記）
- **検出（未起票・memory「予定」に記録）**: `GraphCanvas.tsx:178` の `onSelect` は `selectedId` を掴む inline クロージャで、effect が凍結すると**選択中ノードの再クリックによる選択解除が常に効かなくなる**。従来は `simRef.current` の dep がグラフ再構築のたびに偶然貼り直していたため「たまに効く」状態だった（#523 が壊したのではなく確定化させた）。直しは #523 と同じ発想でコールバックも ref 経由の発火時読み取りにする
- **Epic / docs の追随は不要と実測**: Epic #290 は Step 2〜7 が全て [x]（PR 番号・merge commit つき）、Epic #321 は Phase 2 の 5 項目すべて [x] で残は Phase 1 の #391 のみ。mobile-scope.md・plans の Status 行も各レーンが自 PR 内で追随済みだった
- **outbox 巡回**: 全 18 ファイルを走査し、最新の未処理候補（chat-schedule-refine 2026-08-01 の起票依頼 = #520 起票済み /「記録のみ」項目 = 本人が tracker で処理済み）まで含めて**未処理ゼロ**を確認
- **残タスク**: open Issue 8 件（#507 / #509 / #511 = materials、#519 = connect、#520 = schedule、#512 / #517 = shared-fix、#372 = 将来 DDL）+ Epic #321 Phase 1 の #391

# HISTORY ARCHIVE (chat-main, 2026-08)

ローリングアーカイブ: `history/chat-main.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-29 - AI 連携の可視化 + Claude 起動導線の計画書 2 本作成と起票（#1210 / #1211・PR #1212）

#### 概要

「アプリ UI に Claude / AI 連携の要素がゼロ」というユーザー課題を受け、$0 制約（アプリから Claude API を呼ばない = Non-Goal 準拠）での組み込み範囲を 2 段階に分解。実装計画書 2 本を新規作成し、計画書パスを本文に記した Issue を 2 件起票、計画書は docs PR として open した。

#### 変更点

- **計画書**: `.claude/docs/vision/plans/2026-08-29-ai-integration-visibility.md`（段階 1: Settings AI 連携カード + ビルド時生成の MCP ツールカタログ JSON + Briefing 帰属バッジ。DDL なし・既存データ導出のみ）/ `2026-08-29-claude-launcher-desktop.md`（段階 2: IPC `claude:launch` 追加 + OS ターミナルで `claude` spawn + `isDesktopShell()`。段階 1 merge が前提・Step 0 に UI 置き場のユーザー確認ゲート）
- **起票**: #1210（[settings] 段階 1・shared-fix）/ #1211（[main] 段階 2・shared-fix・Blocked by #1210）。重複チェック済み（隣接 #1201 はスコープ別と明記）
- **PR**: #1212（docs のみ・計画書 2 本。一時 worktree `plans-ai-integration` 経由で `docs/ai-integration-plans` ブランチから提出・merge はユーザー手番）
- **実測根拠**: MCP ツールレジストリ = `mcp-server/src/tools.ts:39-60`（heartbeat 機構なし）/ Briefing 書き込みに author メタなし（`briefingHandlers.ts:430-559`）/ desktop IPC は 10 上限中 7（`ipcContract.ts:93`）— Explore 報告を spot check で全数確認してから計画書へ反映

### 2026-08-29 - Open Issue 一斉消化 fan-out r4 計画書（PR #1208）

#### 概要

open Issue 28 件・open PR 0 本の実測スナップショットから、凍結 2 件（#898 / #677）を除く全 Issue を PR に到達させる fan-out r4 計画書を作成し PR #1208 として open した。宛先振り直し 4 件も同日実施。実装は本計画書の `/goal` を各レーンへ貼ってから（このセッションでは着手しない）。

#### 変更点

- **計画書**: `.claude/docs/vision/plans/2026-08-29-open-issue-fanout-r4.md` 新規。Wave 1 = 6 レーン 19 件（schedule 2 / materials 6 / settings 3 / connect 1 / shared-fix 4 / web-public 3）、Wave 2 = #1194（gate: #1174 merge）+ #1184（gate: Wave 1 UI 系 merge）、chat-main 手番 = #1202 / #1137 / #1135 + r3 計画書の COMPLETED 化。貼り付け用 `/goal` 8 本・`/loop`・`/schedule`（任意）と停止条件を同梱
- **宛先振り直し**: #1197 / #1198 / #1199 → `[web-public]`、#1184 → `[refactor-core]` にタイトル prefix 変更（ラベルは維持。shared-fix 9 件集中の是正）
- **縄張り**: `MainScreen.tsx` の 2 レーン交差は #1199 先行 + #1171 側 rebase で緩和 / Backlinks 部品は #1171・#1172 とも読み取り専用 / tour は Wave 1 中 shared-fix 専有 / パネル統一の先回り禁止（#1184 = Wave 2）を明記
- **main 同期**: ローカル未コミットだった tracker 2 ファイルは merge 済み PR #1203 と同一内容と実測（`git diff origin/main` 空）→ restore で二重 PR を回避し、`git pull --ff-only` で 9 コミット取り込み（`b95561cf`）

### 2026-08-29 - 配布品質監査（Web 完結）+ ドロワーアイコン変更 PR #1195 + 配布要件 6 件起票

#### 概要

「他の人に Web で配布する」観点の品質監査を実施し、P0×4 / P1×5 / P2×3 のギャップを特定。ユーザー裁定（メール確認 = 実装 / サインアップ = 開放のまま / 配布 = 限定人数 / ポリシー = 作成）を受けて #1197〜#1202 の 6 件を起票した。並行して、モバイルドロワーの開閉アイコンを Desktop と同系（PanelRight / PanelRightClose）へ変更する PR #1195 を worktree drawer-icon から提出（全ゲート緑・open）。

#### 変更点

- **監査の主要発見**: 技術基盤（RLS owner-only + 公開 anon key + Cloudflare Workers デプロイ）は既に第三者対応水準。CLAUDE.md の「N=1 / 友達ビルド flag」はコード実態より古い（flag は実在しない）。ErrorBoundary ゼロ / アカウント削除なし / ポリシー類なしが主なギャップ
- **起票**: #1197（メール確認 ON + AuthScreen 確認待ち UI）/ #1198（privacy policy + terms）/ #1199（トップレベル ErrorBoundary）/ #1200（アカウント削除 + サインアウト監査・section:settings）/ #1201（チュートリアルに Briefing 説明 — Epic #1121 へ追加）/ #1202（CLAUDE.md 配布記述の整合・[main]）
- **無料枠の見立て**（web-researcher 実測 2026-08-29）: ボトルネックは DB 500MB + egress 5GB/月。安全圏 10〜20 人・実用上限 30〜50 人
- **実装**: PR #1195 = `RightSidebarToggle.tsx`（hamburger variant Menu → PanelRight）+ `RightSidebarContents.tsx`（close X → PanelRightClose）。スワイプ開閉は #792 / #1050 で実装済みだったため新規実装なし（playwright 実測は別途）
- **サブエージェント報告**: worktree 作成時の tool 出力に紛れた偽指示（Bash の sed/cat で編集しろ）を role-engineer が無視した旨の共有あり
- **スワイプ touch バグ（#1204 → PR #1205）**: playwright + CDP 合成タッチの実測で、edge スワイプ開（#1050）/ スワイプ閉（#792）が**タッチでは 100% 不発**と確定（narrow レイアウト全面が touch-action: auto で、水平 20px 時点の pointercancel により開 56px / 閉 72px に到達不能）。修正 = 追跡中の横サンプルのみ non-passive touchmove で preventDefault + 軸ロックの累積化（初動ジッター救済）+ selectstart/dragstart ガード + 内側スクローラへ touch-pan-y。ブランチ build の vite preview :4174 で再検証し全項目 PASS（開 5/5・ジッター 12px まで救済・41° 5/5・閉 5/5・縦スクロール非干渉・連続 5 回・7 セクション回帰 42/42）。Chrome の縦パンスロップ ~15px 超のジッターは救済外（既知トレードオフ・実測境界つき）

### 2026-08-29 - Connect 後継（Tag hub + Related パネル）の方針確定と起票

#### 概要

connect-refine が #1152（Connect 退役）を実行中の裏で、Connect 機能の後継案 4 つ（Related パネル / Tag hub / Claude 製つながりダイジェスト / 局所ミニグラフ）を比較し、ユーザー確定で案 1 + 案 2 を採用。#1171 / #1172 として起票し、#1153 へ役割分担コメントを残した。

#### 変更点

- **方針確定（2026-08-29 ユーザー確定）**: 新 Connect は Tag 起点の hub ページ（力学グラフは復活させない）。#1153 との役割分担 = 時間軸の入口は Calendar / トピック軸の入口は Connect（「今日への配置」は Calendar サイドバー残留）。タグ無しアイテムは「未分類」疑似タグで受ける
- **起票**: #1171（[connect] Tag hub セクション新設・`section:connect`）/ #1172（[materials] LinkPanel の Related パネル化・`section:materials`）。どちらも **Blocked by #1152** を本文に明記
- **#1153 コメント**: 旧カンバンの「タグ軸で Todo を眺めて整理する」役割は #1171 が引き取り、サイドバー側にタグ別グルーピングを作り込まない旨を明記
- **実測の副産物**: タグの lucide アイコン + カラーはデータ列（`wiki_tags.icon` / `color`）も設定 UI（TagIconPicker / TagColorControls）も実装済みで、欠けているのは表示面（TagPill 等）だけ — 新規機能ではなく #1171 の表示要件として畳み込んだ

### 2026-08-30 - Desktop 配布パッケージ化の現状調査・起票・計画書

#### 概要

「Desktop はビルドできるのに配れない」状態を実測で確定し、mac / Windows それぞれの配布を #1300 / #1301 として起票、実装計画書を PR #1302 で提出した。コード変更はゼロ（ドキュメントのみ）。

#### 変更点

- **調査の実測**: GitHub Release **0 本**（`gh release list` が空）/ リリース自動化なし（`ci.yml` は `electron-vite build` で止まる — 意図的）/ `desktop/package.json` の version が `0.0.0` のまま（`artifactName` に版が乗る）/ **macOS は一度も未ビルド**（`resources/icon.icns` は commit 済みだが未検証）/ `directories.buildResources` が実在しない `desktop/build/` を指す
- **実現可能性の土台**: repo が **public** なので GitHub-hosted の macOS / Windows ランナーが無料。tag 駆動の GitHub Actions を **\$0 原則を壊さずに**入れられる
- **裏取り（electron-builder 公式ドキュメント）**: 未署名（`identity: null`）の `.app` は **Apple Silicon で起動を拒否される**（Big Sur / M1 以降は署名の存在自体を要求）。回避はユーザー側の「システム設定 → プライバシーとセキュリティ → このまま開く」or `xattr -dr com.apple.quarantine`。**ad-hoc 署名（`identity: "-"`）はビルドしたマシンでしか動かない**ため配布の代替にならず、代替案表で明示的に却下した
- **起票**: #1300（[main] Windows 配布パッケージ化 — リリース基盤 + windows ジョブ + 実機受け入れ）/ #1301（[main] macOS 配布パッケージ化 — macos ジョブ + Gatekeeper 導線 + 実機受け入れ）。どちらも `type:feature` / `sev:important` / `area:tooling`
- **計画書**: `plans/2026-08-30-desktop-app-packaging.md`（PR #1302 open）。11 Step / Gate 付き・代替案 7 件・AC 12 件。署名 / 公証 / `electron-updater` 有効化 / ストア申請は Non-goals（移行 SSOT §8 の完成後判断のまま）
- **判断キュー**: D-20260830-main-1（Intel Mac 向け x64 `.dmg` を配るか — `macos-latest` は arm64 でクロスビルドの起動検証ができない）。P-005 に従い実装で先行せずキューへ
- **検証**: CI docs-lint pass（9 秒）。変更 2 ファイルの相対リンク 5 本・Status enum・`records.mjs check` をローカルで個別確認（ローカルの `docs-lint.sh` 全体は Git Bash で極端に遅く、CI の結果を採用した）

### 2026-08-23 - #994 モバイル体感の実ブラウザ計測 6 項目（PR #1112）+ follow-up 3 件起票

#### 概要

#797 が静的調査で止めた 6 項目を、playwright MCP の実ブラウザ（CDP で throttling）+ 作者本人の実 Supabase データで全数計測し、レポートに §8 として追記した（PR #1112 open）。実害が出た 3 点を **#1114 / #1115 / #1116** として起票し、**#992 は今の実データでは再現しない**ことを実測で確定した。

#### 実測値

| 項目                 | 実測                                                                 | 判定                            |
| -------------------- | -------------------------------------------------------------------- | ------------------------------- |
| 再レンダリング       | 初回 14 commit / 切替は Schedule だけ 164.5 ms（Materials の 13 倍） | Schedule が突出（#1101 の対象） |
| ポモドーロの REST    | 開始 1.1 秒で 5 本、残り 59 秒は 0 本、停止時 1 本                   | 約 6 本・長さに比例しない       |
| 実データの行数 / FPS | ノート 5 / Todo 4 / Event 0 → スクロールできるリストが 0             | FPS 測定不能                    |
| ツールチップ         | 1 hover = 1 commit・5.72 ms、60 fps 維持                             | 実害なし                        |
| Slow 4G + CPU 4x     | FCP 2,820 / LCP 3,860 / TBT 430 ms                                   | "needs improvement" 帯          |
| lucide eager/lazy    | eager 99.6%（466.5 KB raw / 1,704 モジュール）                       | 最大の改善余地                  |

#### 変更点

- **レポート §8 追記**（`.claude/docs/reports/2026-08-13-mobile-performance.md`）: 計測環境・6 項目の実測値・副作用の記録。§6 の未計測表から §8 へ参照を張った。docs-lint 緑
- **計測手法**: `__REACT_DEVTOOLS_GLOBAL_HOOK__` の shim を `addInitScript` で React より先に差し込み `onCommitFiberRoot` で commit 回数と `actualDuration` を集計。初期ロード系は `vite preview` の本番成果物 + CDP の `Network.emulateNetworkConditions` / `Emulation.setCPUThrottlingRate`。**コミット時間は dev ビルドでしか取れない**（本番 React は `actualDuration` を記録しない）ので、dev / prod を使い分けて注記した
- **lucide の内訳は sourcemap の mappings を復号して出力バイトをモジュールへ帰属**させて算出。eager 466.5 KB / lazy 1.7 KB = **eager 99.6%**。原因は `shared/src/components/tagIcon.ts:19` の `import { icons }`（レジストリ**オブジェクト全体**の参照で tree-shaking が無効化される）。curated 26 個の明示マップに替えた一時パッチで **gzip 417.52 → 300.64 KB（−28.0%）** を実測 → パッチは破棄（`git diff` で確認）
- **#992 の着手条件は満たされなかった**: `scrollHeight > clientHeight` の要素を全走査しても該当なし。仮想化は「今の重さを直す施策」ではなく「データが増えた後の先行投資」で、着手するなら合成データで閾値を先に決めるのが筋、と結論を残した
- **起票 3 件**: #1114（lucide・`sev:important` / shared-fix）/ #1115（Briefing のエディタ即時マウント・shared-fix）/ #1116（`Untitled todo` 自動生成 + ID 規約違反・`type:bug` / section:work）

#### 踏んだ罠

- **`performance.getEntriesByType("resource")` は resource timing バッファ上限（既定 250 件）で溢れる**。Supabase への 211 リクエストが「0 件」に見えて接続先を疑いかけた。全数が要るときは `window.fetch` を差し替えて自前で記録する
- **naive な線形外挿が結論を反転させかけた**: 60 秒で 5 本 → 30 分で 150 本、と割り算すると「ポモドーロが REST を垂れ流している」ように読めるが、実際は開始 1.1 秒に全部集中していて残りは 0 本。**バースト分布を確認せずにレートへ換算しない**
- **計測が実データを書き換えた**: タイマーを「No Todo」で開始したら `Untitled todo` が実 DB に作られた（ユーザー確認のうえソフトデリート）。supabase MCP は read-only トランザクションなので UPDATE が通らず、削除はアプリ自身の経路（life-editor MCP `delete_todo`）で行った。**書き込みを伴う操作を実データで計測するときは、何が書かれるかを先に fetch ログで押さえる**
- **CRLF のファイルに LF で追記していた**。既存ファイルへ heredoc で追記する前に行末を確認する

### 2026-08-16 - outbox の起票依頼を全消化（25 件）+ 全レーンへの /goal 配布 + §7.1 の複製撤去（#1010）

#### 概要

8 レーンの outbox に溜まっていた起票依頼を全数照合して **25 件を起票**（#991〜#1015）、レーンごとの `/goal` プロンプトを作って配布した。あわせて、その中で最優先だった **#1010（§7.1 のコマンド表が CI から遅れている）を D-20260816-main-2 = B で実装**（PR #1020）し、相対パスで作られて入れ子になっていた worktree 2 本を正しい場所へ移した。

#### 変更点

- **起票 25 件**: perf 4（#991〜#994・#797 の実測レポート由来）/ schedule follow-up 6（#995〜#998・#1000 と横展開 #999）/ mcp-server・横断 5（#1001〜#1004・#1011 = #782 の QA 見送り分）/ 公開 Web 3（#1005 CSP・#1007 manifest 色・#1009 ステータスバー文字色）/ BottomSheet の safe-area #1008 / docs・環境 4（#1006・#1010・#1013・#1015）/ mobile-scope 追随 #1014
- **7 月分の依頼はすべて起票済みだった**ことを実測で確認（#365 / #366 / #369 / #370 / #371 / #372 / #519）。未起票で残っていたのは 8 月分だけ
- **`[all]` の二重着手を避けるため 1 Issue = 1 レーンに固定**。web/ 配下の #1005 / #1009 はタイトル prefix ごと `[web-public]` へ、Notes 側の #999 は materials-refine へ寄せた（#473 で 40 分の二重実装が起きた教訓）
- **#1010 = D-20260816-main-2 = B**（ユーザー回答）: §7.1 のコマンド列挙を削除し、`.github/workflows/ci.yml` の `verify` + `docs-lint` を PR 前ゲートの正本と明記。回し方（各ステップの `working-directory` へ `cd`）と、コマンド名からは読めない罠 4 点（build はテストを見ず vitest は型を見ない / web の lint は `web/` しか歩かない / TypeScript の版が web だけ違う / docs-lint は `LC_ALL=C`）だけを残した。同じ表を指していた `loop-verify` スキルも `ci.yml` 参照へ付け替え（PR #1020）
- **踏まれた回数**: `typecheck:tests` の漏れで PR #924 / #980 / #842 / #985 の 4 本が「ローカル全緑・CI だけ赤」。追随依頼が 2 回出ても入らなかったので、表を直すのではなく複製そのものを畳んだ
- **入れ子 worktree の是正**: `workspaces/life-editor/workspaces/life-editor/settings-refine`（2 段）と同 `.../workspaces/life-editor/work-refine`（3 段）を正しい階層へ `git worktree move`。**両方とも Orca のターミナルが掴んでいて「Device or resource busy」で 1 度失敗した** — `orca terminal list --json` で handle を特定し `orca terminal close` してから移動した（worktree-policy の Windows 節と同型の詰まり方）。空になった中間ディレクトリは `rmdir` で撤去
- **副産物**: #1013（`pre-commit-tracker-guard.sh` が `history/archive/` 配下を tracker と認識せずブロックする）を起票。本 commit 自体がその穴に当たるため `[tracker-ok]` で通している

### 2026-08-15 - #675 の実ブラウザ回帰検証（6 項目 PASS）→ CLOSE + #870 起票

#### 概要

#675（Schedule の巨大ホスト 3 本を責務ごとに分割）の DoD 最終項目「merge 後に chat-main で playwright」を実施し、**6 項目すべて PASS / FAIL 0** で close した。検証中に見つかった既存挙動の不具合 1 件を **#870** として切り出した。

#### 実ブラウザ検証（main `5c86b05b` / dev server 5173）

| 項目                   | 判定   | 実測                                                                                                    |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 週表示                 | **OK** | 日付ヘッダ 8/9–8/15・00:00–23:00 グリッド・現在時刻ライン・既存 2 件とも正常                            |
| 月表示                 | **OK** | August 2026 正常。Week ⇄ Month ⇄ Day を往復しても崩れなし                                               |
| ドラッグ移動           | **OK** | Mon 19:00 → Thu 14:00。リロード後も保持（`PATCH items_meta` / `events_payload` とも 204）               |
| リサイズ               | **OK** | 下端ハンドルで 14:00–15:00 → 14:00–17:00。リロード後も保持                                              |
| 繰り返しのスコープ選択 | **OK** | This event only / This and following / All events の 3 つが別々に効いた（下記）                         |
| Todo の追加と削除      | **OK** | ボード追加（2→3）→ トレイ「Add to today」→ 全日チップ → 時間帯へドラッグで 13:00–14:00 化 → 削除（3→2） |

スコープの内訳: **This event only** = 8/15 だけ改名し 8/14 は不変 / **This and following** = 8/14 で 06:00 に変更 → 8/14・8/15 の両方が 06:00 / **All events** = 8/15 で 05:00 に変更 → 過去側の 8/14 も 05:00。**console error 0 件**（`Invalid hook call` / `Rendered more hooks than…` は一度も出ず）・Supabase **938 リクエストすべて 200/201/204**。

#### 行数の測り方を誤っていた（自己訂正）

前セッションで「`CalendarTab.tsx` が 2,392 → 2,562 行に**増えている**」と報告したが誤り。**分割前の基準を Issue 起票時点の数字にしていた**のが原因で、分割 PR #839 の直前直後で測ると **2,716 → 2,557 行（159 行減）**。起票から分割までの間に別の機能追加（モバイル day-list の Todo 行 #761、詳細パネルからの Todo 削除 #775 ほか）が 300 行以上足していた。**行数の増減を語るときは対象コミットの直前直後で測る** — 文書に書かれた過去の数字を基準にしない。

#### DoD の数え方（コメントに明記した）

- 「`useScheduleMutations` の引数が 28 個から実質半減」は達成扱いにしたが、内訳を残す。`UseScheduleMutationsArgs` が自前で持つのは **12 個**で、繰り返し系 **17 個**（`UseRepeatMutationsArgs` 19 個 − Omit 2 個）は `useRepeatMutations` へそのまま横流し → **ホストが渡す総数は 29 個で減っていない**。「公開インターフェースの diff がゼロ」と表裏の関係
- 分割成果物のテストは実在: `shared/tests/useWeekTimeGridDrag.test.tsx` / `web/tests/useRepeatMutations.test.tsx` / `web/tests/useScheduleTodoChips.test.tsx` +（`useScheduleItemsAPI` 分割分）`agendaEmptyLabel` / `scheduleCopy` / `scheduleViewModels` / `calendarNavMonthSheet`

#### 新規起票 #870（`type:bug` / `section:schedule`）

時刻変更と繰り返し ON を**同じ Save** で行うと、生成されるルーチンのテンプレート時刻が**変更前**の値になる（当日だけ新時刻・翌日以降が旧時刻）。原因は `web/src/schedule/useRepeatMutations.ts:321` の `const seed = selected;` が下書きではなく確定済みの選択を読む点。**分割前の `useScheduleMutations.ts:628` にも同一行がある**ので #675 の退行ではない（`git show 82614e48^` で確認）。#712 で繰り返し系フィールドだけは「1 回の Save でまとめて渡る」形に直されており、時刻フィールドが取り残されている。

#### 対象外と確認した 2 件（修正不要）

- 繰り返しが翌週に生成されない = `CalendarTab.tsx:1207-1211` のコメントどおりの設計（ナビゲーションは fetch のみで materialize しない）
- 「This and following」が手編集済みの回に届かない = `SupabaseScheduleItemsService.ts:680` の rule 2「手編集は系列編集に勝つ」どおりの仕様。最初これに引っかかり、汚染のない系列を作り直して再検証した

### 2026-08-14 - #831 の stacked merge 事故を検出して復旧 + D-20260813-briefing-1 の昇格（#860 起票）

#### 概要

#831（コード上の Task → Todo 改名）の 3 PR が**すべて MERGED 表示のまま、main に届いたのは PR-A だけ**という状態を検出し、復旧 PR #865 の着地まで見届けた。あわせて判断キュー D-20260813-briefing-1 をユーザー回答 = A で確定し、台帳へ昇格して実装 Issue #860 を起票した。

#### 変更点

- **事故の正体 = stacked PR の base 張り替えレース**: #861（base=main）が 01:44:14Z、#862 が **01:44:24Z**（10 秒差）に merge。GitHub が #862 の base を main へ張り替える前に merge されたため、#862 は PR-A のブランチへ、#863 は #862 のブランチへ入った。3 本とも MERGED 表示になるので PR state だけ見ると気付けない（memory `stacked-pr-base-retarget-race` / #397 と同型）
- **検出の決め手は 3 角度**: ① `gh pr view <n> --json mergeCommit` の SHA を `git merge-base --is-ancestor <sha> origin/main` にかけると #861 = IN / #862・#863 = NOT ② main の `mcp-server/src/tools.ts` に `list_tasks` / `create_task`、i18n に `typeTask` / `noTasks` が残存 ③ `git diff --stat origin/main origin/claude/shared-fix-831-task-to-todo-mcp-docs` が **284 files / +3,461 / −3,478**
- **⚠️ 変数名の grep で誤検出しかけた**: `TaskNode` の件数で判定したら `setTaskNodes` というローカル変数に当たり、一瞬「PR-A も壊れている」と読み違えた。**改名の着地判定は型名ではなく「その PR でしか生まれない成果物」で行う** — MCP ツール名・i18n キー名・リネーム後のファイル名（`useScheduleTodoChips.test.tsx` 等）が該当する
- **復旧はやり直し不要だった**: 3 ブランチとも remote に健在で、`-mcp-docs` が PR-B + PR-C の commit を両方持っていた → main を取り込んで base=main の PR 1 本（#865）にまとめて着地。実装の書き直しはゼロ
- **着地の再確認**: `list_tasks` / `typeTask` が 0 ヒット、リネーム後ファイル 3 本が main のツリーに出現、#831 は `Closes` で自動 CLOSED
- **据え置き 3 点は無事**: `TodoNodeType = "task"`（型名だけ変わり `generateId` は `task-` を作り続ける）/ `role: "task"` が `SupabaseTodosService.ts:110,180` + `todoMapper.ts:61,295` の 4 箇所とも残存 / `tasks_payload` が mcp-server 各ハンドラで健在
- **D-20260813-briefing-1 = A**: 「今週」カードの週バー（直近 7 日）と Work タブ週次集計（月曜固定）を両方とも暦週へ寄せる。台帳 `decisions/D-20260813-briefing-1.md` を作成 → `ANSWERS.md` へ 1 行転記 → `comm/decisions/chat-briefing-refine.md` を空に
- **#860 起票**: `[analytics]` / `section:analytics`（briefing-refine レーン）。対象は `MobileAnalyticsView.tsx:121` の `aggregateByDay(sessions, 7)` と `analyticsAggregation.ts:162` の私有 `startOfWeek()` の 2 箇所で、`WorkTimeChart.tsx:56` の 14 日窓は対象外と本文に明記
- **レーン投入の順序を保留に**: #860 / #675 のプロンプトは用意済みだが、#831 が `shared/src/components` と `web/src` を丸ごと触るため投入を止めた。とくに #675 のやること 1（taskChips 抽出）は改名対象そのもの。**大規模改名は後・細かい作業が先**の順序をユーザーへ提示した

### 2026-08-13 - #837 userData を productName 配下へ（PR #857 open）+ /goal 再配布が実質不要だった件

#### 概要

#837（デスクトップの設定が `%APPDATA%\desktop` に落ちて `productName` と一致しない件）を実装して PR #857 を出した。あわせて「次の一斉フェーズを /goal 配布とサブエージェントのどちらで回すか」の選定依頼に答え、前者と判断した上で配布直前に実測を取り直したところ、**各レーンは前回の /goal でまだ自走しており、こちらが配る前に 6 件を merge まで運んでいた**。

#### 変更点

- **#837 の修正**（`desktop/src/main/index.ts`）: `app.setName("Life Editor")` と `app.setPath("userData", <appData>/Life Editor)` を **Store 生成より前**に実行する。`app.getPath("userData")` は `app.getName()` 由来で、`app.getName()` は asar 内 `package.json` の `name`（= `desktop`）を返すため electron-builder の `productName` は効いていなかった。解決済みパスは初回読み取りでキャッシュされるので、順序そのものが修正の一部
- **旧 config の引き継ぎ**: 旧 `%APPDATA%\desktop\config.json` を新しい場所へ 1 回だけ copy（move ではない）。新側に config があればスキップするので、以降の編集が古い内容で上書きされることはない
- **実測（Windows 11 / `npm run dev`）**: Electron 4 プロセス起動（#545 の健康判定基準）+ `%APPDATA%\Life Editor\config.json` に旧値がそのまま（`theme=system` / `closeToTray=true` / `bounds 2560x1392`）。ゲート = desktop typecheck exit 0 / electron-vite build exit 0 / docs-lint OK（desktop に lint・test スクリプトは無い）
- **known-issue 033 に 2 点追記**: ① **worktree ごとに再発する** — `node_modules` を共有しないため、メイン clone を直しても worktree は壊れたまま残る（今回 win-verify で再発し、実機確認が一度空振りした） ② 復旧の近道 = 修復済み clone の `dist/` をコピーして `printf` で `path.txt` を書く（115MB の zip 展開より速い）
- **配布方式の判断 = 既存レーンへの /goal（サブエージェントは不採用）**: chat-main は `main` 専有で `git checkout <feature>` 禁止のため実装ブランチが切れない / `isolation: worktree` の一時 worktree は `node_modules` を持たず lint・test・build が通らない / Windows は worktree 削除が `Permission denied` で残骸化する。対して既存 11 レーンは npm install 済みで、Issue のラベルがレーンとほぼ 1:1 に対応していた
- **配布は実質不要だった**: 6 レーン分の /goal を用意した直後に取り直したところ **#838 / #830 / #826 / #827 / #672 / #793 が既に merge 済み**（06:31〜06:33 に集中）。**新規に渡す必要があったのは #795（briefing）と #708（schedule）の 2 本だけ**で、残りは貼ると二重指示になるため取り下げた
- **レーン割り当てを Issue 側へ明示（6 件）**: `shared-fix` ラベルは複数レーンが自分宛と解釈しうるため（#473 = 40 分の二重実装）、#838 / #827 → shared-fix、#797 / #792 → mobile-refine、#831 → 保留、#837 → chat-main とコメントした。うち #838 / #827 は書いた直後に merge されて空振り

### 2026-08-13 - #700 Step 2: 検証用 MCP ツール 3 本（投入 / 読み出し / 後片付け）

#### 概要

検証を画面操作に頼らず回すための MCP ツールを 3 本足した（PR #821 open）。撒き先は 2026-08-12 に確定した `D-20260812-shared-fix-3`（案 A = 検証専用アカウント + RLS 分離）に従う。**「何を撒いたかツール側が覚えている」形**にしたので、検証データの削除がユーザー手番のまま残らない。実装は `mcp-server/**` に閉じ、規約を `db-conventions.md` §14 に足しただけで実運用コードには触れていない。

#### 変更点

- **`seed_verification_state`**: 指定日に task / event / note をまとめて作る。`preset: "busy_day"` = 重なった予定 2 本 + 終日予定 + 完了済み Todo + 未着手 Todo + 日付なし Todo。**書き込みは既存の `createTask` / `createScheduleItem` / `createNote` を通す**（専用の書き込み経路を持つと「その経路の fixture」になり、orphan recovery や §10.2 の bump が実データと違ってしまうため）
- **`read_verification_state`**: `items_meta` + `<role>_payload` の 2 行を 1 つの塊で返す。`run_id` / `date` / `id` のいずれか 1 つで選択（2 つ渡すと「聞かれていない条件で答える」ので拒否）。**soft delete された行も隠さず出す** — 「画面から消えた」と「行が消えた」を区別できるようにするのがこのツールの価値
- **`cleanup_verification_state`**: 台帳の id だけを hard delete（payload → `items_meta` の順。composite FK が NO ACTION のため）。soft では Trash に残るので hard。dry_run あり
- **台帳 = `mcp-server/.verification-ledger.json`**（git 非追跡）: 撒いた行を記録し、削除に成功した分だけ台帳から消す。**失敗した行は残るので再実行が復旧手順**になる。撒く途中で落ちた場合も書けた分は `finally` で記録される
- **二重の安全弁**: ① RLS（全テーブル `auth.uid() = user_id`・MCP は anon key + `signInWithPassword` の一般ユーザーで service_role を使わない）② `LIFE_EDITOR_VERIFICATION_MODE=1` が無いと 3 ツールとも**書く前に throw**。パスワードからは接続先アカウントを判別できないので、宣言を要求する形にした
- **daily は撒けない仕様**: id が日付由来（`daily-<YYYY-MM-DD>`）で実データと区別できず、id で消す cleanup が本物の日記を巻き込むため。task / event / note はランダム id なので衝突しない
- **`.mcp.json` は変更していない**（Scope 外 + 認証情報はユーザー手番）。併存方式は「検証用エントリをもう 1 本立て、その env でだけ credentials とフラグを渡す」と決め、スニペットを `db-conventions.md` §14 に記載
- **検証**: mcp-server 12 files / 196 tests・shared 217 / 1980・web 32 / 269・docs-lint すべて exit 0。テストは Supabase をメモリ上の偽テーブルに差し替えて一巡を回す（実 DB には触れない）
- **注意（実測で踏んだ）**: `npm run build \| tail` は exit code が tail のものになるため、`tsc` 未インストールの失敗が「緑」に見えた。パイプするなら `${PIPESTATUS[0]}` を見る（worktree-policy の既知の罠と同型）

### 2026-08-11 - backlog 一斉棚卸し（Phase 1 並列調査 → Phase 2 実ブラウザ検証 → Phase 3 反映）

#### 概要

chat-main の backlog を 4 体並列の読み取り専用調査 + 実ブラウザ検証 1 体で棚卸しし、Issue 側へ反映した。**実ブラウザは PASS 5 / BLOCKED 3 / FAIL 0・回帰なし**。判断キューの回答 3 件を台帳へ昇格し、実測で浮いた課題 2 件を schedule レーンへ起票（#707 / #708）。**停止条件に 2 件当たったので、#627 の子 Issue 一斉起票と #321 の close は保留**して判断キューへ積んだ。

#### Phase 2 実ブラウザ検証の結果（main = `da9ae58b` / dev server 5173）

| 項目                                               | 判定                               | 実測                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#681** blur は下書き保持・保存されない           | **PASS**                           | タイトル変更 → メモ欄へ blur で「Saved」→「Unsaved」・保存ボタン有効化・チップは旧タイトルのまま。Esc で破棄確認 → リロードしても DB は旧値（`items_meta.updated_at` 未更新）                                                                                        |
| **#681** 保存ボタンで確定する                      | **PASS**                           | 保存 → チップ即更新・「Saved」復帰・ボタン disabled・リロード後も保持（`updated_at` 更新）                                                                                                                                                                           |
| **#681** 繰り返しは保存ボタンを経由せず即時 commit | **PASS**（PR 記載どおりの caveat） | 未編集状態で「Daily」を押しただけで `POST items_meta` → `POST routines_payload` → `PATCH events_payload` → オカレンス一括 INSERT。表示は「Saved」のまま・Undo も無効                                                                                                 |
| **#684** Event ⇄ Todo 変換で id 維持               | **PASS**                           | 往復とも `schedule-b7d3c2d2-5ce2-48a3-ae03-9b18671f8e3f` で完全一致（`PATCH items_meta` で role のみ差し替え）                                                                                                                                                       |
| **#684** routine 由来は「変換は不可能です」        | **PASS**                           | 文言完全一致・書き込みリクエスト 0 件。ただし**ネイティブ `window.alert`**（`web/src/schedule/CalendarTab.tsx:1818`）→ #707 起票                                                                                                                                     |
| **#684** 子を持つ Todo の変換拒否                  | **BLOCKED**                        | 子 Todo を作る UI が無く再現不可（`shared/src/components/TaskAddDialog.tsx:72` が常に `parentId: null`・既存データにも `parent_item_id` 0 件）。入れ子は #418 で退役済みなので到達不能な分岐                                                                         |
| **#686** routine 作成の undo                       | **BLOCKED**                        | `createRoutine`（undo を積む唯一の関数 = `shared/src/hooks/useRoutinesAPI.ts:81,129`）の呼び出しが `web/src/` に 0 件。UI からの繰り返し作成は `convertEventToRoutine` 経由で意図的に undo なし（`useRoutinesAPI.ts:344-350`）                                       |
| **#686** routine 更新の undo + 翻訳トースト        | **PASS**                           | 「毎日」→「曜日」を Undo で `frequency_type: daily` に復元。トースト「元に戻しました: 繰り返しの変更」= 生キーではない                                                                                                                                               |
| **#686** routine 削除の undo + 翻訳トースト        | **PASS**（ただし要判断）           | `is_deleted: false` に戻りリスト復帰・トースト「元に戻しました: 繰り返しの削除」。**戻るのはルーチン行だけ**で、種イベント（`schedule-b7d3c2d2`）と元オカレンス（`si-1fe619b3` / `si-25634b94`）は削除済みのまま、当日分が新 id（`si-9d18df3c`）で再生成 → #708 起票 |

console error は操作区間で 0 件（warning は `apple-mobile-web-app-capable` の deprecation のみ）。テストデータは全てゴミ箱送り・言語設定は English へ復帰済み。**保存ボタン経路に回帰なし**。

#### Phase 1 調査の結果

- **#587（Notes 神ファイル分割）**: 実測 `useNotesUnifiedAPI.ts` 967 → **431 行**、`SupabaseNotesUnifiedService.ts` 842 → **303 行**（PR #642 / #647 で着地）。DoD 1〜3 はコードで満たされる（公開 IF diff・呼び出し側 diff ともに `git show --stat` が空）。**落ちているのは DoD 4 だけ** = `notesUnifiedHelpers.ts`（220 行・純粋関数 11 本）のテスト参照が repo 全体で 0 件、`useNotesUnifiedCRUD.ts`（374 行）に専用テストなし → **open のまま維持**
- **#627（保存ボタン統一 Epic）**: 起票時 5 行 → 実測 **19 行**（追加 12 / 削除 0 / 記述訂正 1）。Schedule は PR #681 で save-button 化済みだが繰り返しだけ immediate = 厳密には mixed。Settings 4 パネルは immediate だが**書き込み先が localStorage で DataService 非経由**。Briefing / Tags 画面は起票時に丸ごと抜けていた。`TaskDetailPanel` の Tasks / Schedule 両用は確認（実描画は `KanbanView.tsx:532` と `CalendarTab.tsx:2178` の 2 箇所のみ）
- **#290（Schedule redesign Epic）**: Step 2〜7 が**コード上 9/9 DONE**・本文チェックボックスと実装の乖離なし・子 Issue 9 件すべて CLOSED。残は実ブラウザ検証のみ
- **#321（Mobile UI/UX Epic）**: コード 8/8 DONE・子 Issue 11 件すべて CLOSED。ただし本文が想定しない open が 5 件（#691 / #692 と mobile 裁定 3 件）
- **#512（パレット safe-area）**: 未着手。`CommandPalette.tsx:206-216` は `paddingTop: viewport.height * 0.12` のままで safe-area 参照なし。本文の引用行番号がドリフト（`:158-164` → 実際は `:206-216`）
- **#530（Windows desktop）**: `cd desktop && npm run typecheck` / `npm run build` とも **exit 0**。`desktop/.env` は不在で、**`web/.env.local` は desktop ビルドに効かない**（electron-vite の `envDir` が `desktop/`）。今ある成果物は資格情報が `undefined` に置換されており、ログインすると落ちる。インストール済み実体は 08-02 04:17 UTC ビルドで **#548 の修正より前**なのでインストーラ作り直しが先

#### 反映

- Issue コメント: #587 / #290 / #512 / #530 / #321。**#627 は本文ごと実測表へ差し替え**（DoD 1・2 を [x] 化）
- **判断キューの回答 3 件を台帳へ昇格**（`records.mjs index` 同一コミット）: **D-20260809-main-2 = A**（`records.mjs` に archive スキャンを足して `archive/INDEX.md` を生成）/ **D-20260804-main-1 = A**（Windows タスクスケジューラ + `claude -p` で 06:03・22:33 に発火）/ **D-20260810-main-3 = A**（STALE スキル 5 本を現行アーキで書き直す）
- **新規起票**: **#707**（変換の確認・拒否をネイティブ dialog から in-app へ）/ **#708**（繰り返し削除の Undo で種イベントとオカレンスが戻らない — 方式 A/B/C の裁定が先）。どちらも `section:schedule` 単一レーン
- **停止条件 2 件を判断キューへ**: **D-20260811-main-1**（#627 の対象範囲 — Settings / Briefing / 作成フォームを含めるか。差が 2 行を大きく超えたため子 Issue の一斉起票を保留）/ **D-20260811-main-2**（#321 のスコープ確定 — #692 は完了済み #467 の巻き戻しを含むため close 前に裁定が要る）

#### 判明した運用上の事実

- **`chore/tracker-main-20260811` は使えなかった**: 別 worktree（harness-loop）が占有中で、かつその PR #682 は既に MERGED。merge 済み PR のブランチへ後追い push しても main に届かないため、**`chore/tracker-main-20260811-2` を新設**した
- サブエージェントの引用は全数スポットチェックした（`EventEditorPane.tsx:589` / `TaskDetailPanel.tsx:85,87` / `CommandPalette.tsx:206-216` / `useCalendarNav.ts:32` / `BriefingScreen.tsx:66` / `MobileShellActions.tsx:51-70` / `CalendarTab.tsx:1818` / `useRoutinesAPI.ts:344-350` / `TaskAddDialog.tsx:72` ほか）。**存在しない引用はゼロ**

### 2026-08-10 - /goal バッチのオーケストレーションと merge 後の一括検証（実ブラウザ 9 PASS / FAIL 0）

#### 概要

open Issue 20 件を Issue タイトルのレーン接頭辞どおり 8 レーンへ `/goal` プロンプトで分配し（briefing-refine worktree 新設込み）、同日中に merge された 17 PR を main へ取り込んで一括検証した。静的ゲート（shared 1554 / web 167 tests）全緑・playwright 実ブラウザ検証 9 PASS / FAIL 0。検証で発覚した DDL 未適用（0023）をユーザーが push してタグ機能を復旧し、最後の BLOCKED だった #626 も実測 PASS で締めた。

#### 変更点

- **オーケストレーション**: 8 レーン（schedule-refine / shared-fix / mobile-refine / briefing-refine / materials-refine / refactor-core / work-refine / tags-docs）へ `/goal` を配布。達成条件は「担当 Issue が closed / CI 緑 PR で merge 待ち / 判断キュー待ちのいずれか」。レーン間依存は #631 → #632 の 1 本だけと明示。briefing-refine worktree を新設（絶対パス・`.session-branch` / `.session-name` 同時作成）
- **取り込みと静的ゲート**: main `8a701323` → `3a64470e`（86 files・+5,772/−2,238。Notes 神ファイル分割 #587 / #588 を含む）。web は vitest 不在で空振り → `npm install` で解消（この Windows 機の `web/node_modules` が古かった）
- **実ブラウザ検証（playwright-ui-verifier）**: PASS 9 = #590 Work レイアウト / #593 Todo チップグリフ / #592 Todo 文言統一 / #572 タグ色空状態 a11y / #587+#588 Notes 回帰（エラー 0）/ materials 3 画面 / #586 モーダル・グラフ回帰 / #631 ドキュメント不動（モバイル幅実測）/ #633 シート max-height + 内部スクロール。ログインは資格情報がこの PC に無くユーザーの手動サインインで解除（Playwright 永続プロファイルにセッション保持）
- **DDL 適用（ユーザー実行）**: `0023_wiki_tag_connections_origin` 未適用が発覚 — `wiki_tag_connections` への GET が 400（`column origin does not exist`）になり `useWikiTagsUnifiedAPI` の `Promise.all` ごと reject してタグ機能がアプリ全体で無効化されていた。supabase CLI 不在のため `npx supabase link + db push` で適用 → #626（チップ詳細のタグ付け外し）を実測 PASS・テストデータ片付け完了（`verify-20260810-tag` 削除含む）
- **裏取り**: パスワードノートの set / remove UI 不在は分割前 `8a701323` の NotesView でも `mode: "verify"` しか配線されていなかった = #588 の欠落ではなく従前からのギャップ
- **起票 / 追記**: **#680**（i18n 取りこぼし 3 点 — trash 行 aria-label / エディタ placeholder / en 単複）を新規起票、**#632** へ FAB の実測コメント追記（#631 着地により着手可能化）
- **残**: #632（mobile-refine）/ #628・#625（判断キュー待ち）/ #623・#609・#585（briefing-refine）/ #586 残り（PR #649 open）/ iPhone 目視 3 点（#631 pull-to-refresh・#633 シート上端・#512 パレット safe-area）

### 2026-08-10 - ユーザー要望 7 件の起票と、最優先 1 本（#624 ポモドーロ数値入力）の実装

#### 概要

ユーザーから届いた要望 7 件を重複チェックのうえ GitHub Issue 6 本（#623〜#628）に落とし、そのうち唯一の `type:bug` である #624 を実装した（**PR #629 merged → iPhone Chrome で実機確認 OK → #624 CLOSED**）。要件の 1 つは既存 Issue に該当したので新規は立てず、実測結果をコメントで足した。あわせて #607 / #608 の計画書を乖離レビュー付きで archive し、**同じ実機確認で残っていた目視 4 点も全て消化**した（#607 / #608 とも CLOSED）。

#### 変更点

- **起票 6 本**: **#623** 朝刊の本文 / rightSidebar に `+` を置き Schedule アイテムを追加（`section:briefing`）/ **#624** ポモドーロ数値入力の空欄バグ（`type:bug` `sev:important` `section:work`）/ **#625** Event⇄Todo の相互変換（`section:schedule`）/ **#626** Todo の詳細からもタグを付け外し（`section:schedule`）/ **#627** Epic「編集の確定を保存ボタンに統一（Note・Daily 除く）」（`shared-fix` `[all]` — `[all]` は Epic に限り可）/ **#628** その段階 1 = Schedule 詳細編集パネル（`section:schedule`）
- **要件「Task→Todo 改称」は起票せず #592 にコメント**: Work 画面の i18n 名前空間（`work.*` / `pomodoro.*` / `taskDetail.*` / `kanban.*`）は既に全て Todo 表記で、`.ts` / `.tsx` の「タスク」ハードコードもテスト 2 本の中だけだった。残存は #592 が既に列挙している schedule 系キーのみなので、スコープを広げず実測結果だけ足した
- **#625 / #628 は Issue 本文に「先に決めること」を明記**: #625 = 変換で id を維持するか（維持ならタグ / リンクが無傷だが、payload 生成列 `parent_item_role` の都合で「旧 payload 削除 → `items_meta.role` UPDATE → 新 payload INSERT」の順序が要る）・落ちるフィールド・routine occurrence の可否。#628 = 保存ボタンでのみ確定するか blur 保存を残すか。どちらも着手レーンが判断キューへ積んでから実装に入る（P-005）
- **#624 の原因**（`shared/src/components/PomodoroSettings.tsx:211-239`）: `NumberField` が毎キーストロークで `Number(e.target.value)` を commit していたため、欄を空にすると `Number("") === 0` が飛び、`TimerContext.tsx:276` の `clampMinutes` が最小値 1 に丸めて書き戻していた。制御コンポーネントなので次のキーが来る前に `1` が再描画され、その上に `50` が乗って **`150`** になる
- **修正 = 「空欄」を独立した状態に**: 空にした欄は `""` を表示して**何も commit しない**（保存済みの値は数値が入るまで無傷）。それ以外は従来どおり host の値が正なので clamp は今も見える。空欄のまま blur / プリセット保存すると「`<項目名>`に数値を入力してください」ダイアログ。**ダイアログを閉じると空欄はすべて保存済みの値へ戻す** — 空欄のまま残すと次の blur でまたダイアログが出て、ユーザーが nav に到達できない罠になるため
- **セクション遷移そのものは止めていない**（意図的）: router が無く `setSection` の呼び出し口が app shell 全体に散るため、ガードを通すと `shared-fix` 級になり他レーンと衝突する。実際には nav をクリックする動作が先にフィールドを blur させるので警告は出る。PR 本文に明記した
- **RED チェック済み**: 修正を外すと新規 4 テストが落ち、1 本は `expected '150' to be '50'` とユーザー報告そのままの値を出す。clamp を再現するホストをテスト側に置いたのが要点で、これが無いと「150」は現れない
- **#607 / #608 の計画書を archive**（PR #621 / #622 とも merged 2026-08-10 10:05 UTC）: 乖離レビュー 3 行を記入 — スコープ逸脱 1 件（`useNotesUnifiedAPI.ts` = D-20260810-main-4）/ AC 免除ゼロだが diff 行数超過を明示 / 判断の行き先は全て埋まり「行き先なし」ゼロ
- **実機確認で 4 点すべて OK**（2026-08-10・**iPhone の Chrome**）: ① Note の本文タップで入力パネルが閉じない ② キーボードでタブバーが消え、閉じると戻る ③ タブバー非表示中もホームインジケータ帯に本文が乗らない（QA の NIT 1 件目）④ 「その他」シートがキーボードで消えるのは許容（NIT 2 件目）。#607 / #608 とも CLOSED。**計画書 Step 5 の未達はこれで解消**したので、archive 時点の乖離レビューから「未達」の記述を落とした
- **「iOS 未検証」が解消**: iOS のブラウザは全て WebKit（WKWebView）なので、Chrome で見ても `visualViewport` の挙動は Safari と同じ経路を通る。`useSoftKeyboard` の「同じ幅で観測した最大可視高との差」判定が iOS でも成立することを実機で確認できた（Safari の UI そのものは未確認）
- **副産物 = #512 が測れる状態になった**: 「コマンドパレットの上余白が safe-area を踏む」は iPhone のノッチ前提の指摘で、Android 実測（上端 inset ≈ 0）では反証にならず宙に浮いていた。**ユーザーが iPhone を実機として使えると分かった**ので 👀 節へ回す
- **追加起票 3 本**（同日・実機確認の最中にユーザーが見つけたスマホ固有の崩れ。いずれもコード実測で原因の当たりまで書いた）: **#631** ドキュメント自体がスクロールしてボトムタブバーの下まで行ける + pull-to-refresh 誤爆（`body { min-height: 100vh }` と `h-[100svh]` の単位不一致 / `overscroll-behavior` が内側 div にしか無い）/ **#632** 追加用 FAB の位置が画面ごとに揃わない（Schedule = `fixed bottom-6 right-6` vs Notes = `absolute bottom-5 right-5` で基準もオフセットも別）/ **#633** Schedule 編集シートの上端がブラウザ UI に隠れ内部スクロールが無い（同じ `BottomSheet` を使う他 2 面だけが `max-h-[92vh] min-h-[70vh] overflow-hidden` を渡している）。**3 本は #631 → #632 / #633 の順**（`fixed` の見かけがドキュメントスクロールに引きずられるため、#631 を直さないと後続を実測できない）

#### 次セッションへの引き継ぎプロンプト（貼り付け用）

```text
life-editor の chat-main セッションを開始する。

まず `.claude/memory/chat-main.md` と `.claude/comm/decisions/ANSWERS.md` を読み、
`gh issue list -R sunbreak-pro/life-editor --state open` で自分宛の open Issue を確認すること。
未 merge の PR #630（tracker）が残っていたら、merge はユーザーの手番なので状態だけ確認して先へ進む。

今回の目標 = スマホ実機で見つかった崩れ 3 本（#631 / #632 / #633）を片付け、その後で「保存ボタン統一」の
段階 1（#628）へ進む。#624 は実装 + iPhone 実機確認まで完了して CLOSED 済み。

0. **#631 から着手する**（触るのは `web/src/index.css` と `shared/src/components/AppShell.tsx` の 2 ファイル）。
   ボトムタブバーの下までスクロールでき、上に引っ張ると Chrome が再読み込みする件。原因は Issue 本文に
   実測付きで書いた = `body { min-height: 100vh }`（index.css:32）と `h-[100svh]`（AppShell.tsx:212）の
   単位不一致で、モバイル Chrome では body だけ URL バー分高くなる。`overscroll-behavior: none` も
   AppShell 内側の div にしかなく、viewport のスクローラ（html / body）に無いので効いていない。
   **これが #632 / #633 の実測前提**（`fixed` の見かけがドキュメントスクロールに引きずられる）。

   続けて #632（FAB の位置が画面ごとに揃わない → 共通部品へ寄せる。#509 の「最終行に重なる」を再発させない）
   → #633（Schedule 編集シートに max-height + 内部スクロールを与える）。#633 は #628 と同じ
   `web/src/schedule/CalendarTab.tsx` を触るので、片方ずつ順に進めること。
   3 本とも DoD に 👀 実機（iPhone Chrome）目視が入るので、実装が終わったらユーザーに見てもらう。

1. #628（Schedule 詳細編集パネルに保存ボタン）へ進む。これが Epic #627 の雛形になり、
   ここで決めた流儀が Work / Tasks / Settings へ波及する。着手前に Issue 本文の「先に決めること」を
   ユーザーへ確認すること:
     (a) 保存ボタンでのみ確定し、blur は draft 保持のみ（未保存で閉じるときは確認ダイアログ）
     (b) blur 保存は据え置き、ボタンは「今すぐ確定 + 保存済み表示」
   P-005 により UX が分岐する判断はキュー必須。回答が来るまで実装に入らない。

2. 流儀が決まったら実装する。`EventEditorPane` は Desktop のオーバーレイと Mobile の BottomSheet の
   両方を backing しているので、片方だけ見て終わらせない。routine アイテムの scope ダイアログ（#279）が
   1 回しか出ないこと（1 ジェスチャ 1 コミット = #553）と、日付の unmount flush と二重書き込みしないことを守る。

3. #628 が close したら Epic #627 の対象面の棚卸しを grep で実測して本文を更新し、子 Issue を
   1 面 1 本で起票する（`[all]` は Epic 専用。子は宛先 slug を 1 つに決める）。

余力があれば #626（Todo の詳細からタグ付け外し）→ #623（朝刊の + 追加導線）の順。どちらも既存部品の
流用が前提で、新しい生成 UI やタグ操作経路を作らない。#625（Event⇄Todo 変換）は items_meta +
<role>_payload の 2 行分割モデルに触るので最後に回し、判断 3 件が未回答のうちは着手しない。

小粒だが 1 つ: #512（コマンドパレットの上余白）は iPhone で測れる状態になった。キーボード表示中に
パレットを開いて上端が safe-area へ潜らないかユーザーに見てもらい、踏まないなら NOT_PLANNED で close する。

工程は lead-pipeline に従う（中ティア = 実装 → session-verifier → task-tracker）。
tracker は実装ブランチに載せない（D-20260801-main-1）。merge は常にユーザー（P-001）。
```

### 2026-08-10 - スマホ ソフトキーボード起因バグ 2 件（#607 / #608・PR #621 merged）

#### 概要

公開 Web URL をスマホの主導線に据えた直後（D-20260807-main-1）に出た `sev:important` 2 件を 1 本の計画で片付けた。#607（Note に書き込めない）は「自分の書き込みが自分の hydrate を無効化する」、#608（タブバーがせり上がる）はキーボード表示中の非描画で対処。どちらも実装 + 回帰テストまで着地し、実機での見た目確認は deploy 後に残る。

#### 変更点

- **#607 の原因確定と修正**（`shared/src/hooks/useNotesUnifiedAPI.ts`）: `updateNote` はローカル行に**クライアント時計**の `updatedAt` を載せるが、own-write のエコーで走るリロードが返すのは**サーバ時計**。#301 の限定無効化マージ（`prev.updatedAt === row.updatedAt` の行だけ本文キャッシュを維持）は、**いま編集中のノートだけが必ず外れる**構造だった → `isContentLoaded` false → mobile シートがエディタを skeleton に差し替え → フォーカスが外れてキーボードが閉じる。Desktop はエディタが note id で keyed され remount しないため無傷。マージ判定に「**開いている行 かつ 自分が書いた行**」を OR で追加
- **マークの寿命を「リロード 1 回」に**（QA の BLOCKING 指摘）: 初版は「選択が外れるまで」だったが、mobile シートの `closeSheet` は shared の選択を落とさないため実質セッション中ずっと生き、その間に他デバイス / MCP が同じノートに書くと**こちらの古い本文で無言上書き**する筋があった。保持した行はサーバの `updatedAt` を取り込むので使い捨てで足り、in-flight の書き込みがある間だけ保留する（`unackedWritesRef`）
- **#608 = `shared/src/hooks/useSoftKeyboard.ts` 新設 + `AppShell.tsx`**: narrow でキーボード表示中は `BottomTabBar` を描画しない。判定は「**同じ幅で観測した最大可視高との差**」で、レイアウトごと縮む UA でも visual だけ縮む UA でも成立する（実機での `innerHeight` / `visualViewport.height` 実測待ちを解消）。`documentElement.clientHeight` との差を使う案は QA 指摘で棄却 — モバイルの ICB は大ビューポートを返すため常時 60〜110px 浮き、上下 2 段バーの UA では**キーボード無しでナビが恒久的に消える**危険側の失敗になる。ピンチズームは `vv.scale > 1` で除外
- **回帰テスト 2 本**（`shared/tests/notesOpenNoteOwnEditHydrate.test.tsx` 3 ケース / `appShellSoftKeyboard.test.tsx` 3 ケース）。#607 側 2 件は**修正を戻すと落ちることを実測で確認**。jsdom にレイアウトが無いので固定するのは「判断が下ること」まで（CLAUDE.md §7.1）
- **Scope 例外 = D-20260810-main-4**: `useNotesUnifiedAPI.ts` は #587（分割予定）のため「触らない」宣言だったが、原因確定を受けてユーザー裁定で例外入り（実測 = #587 未着手・open PR ゼロ）。#587 に分割時の申し送りをコメント済み
- **#512 は close せず**: Android 実機で「潜っていない」を実測しコメントしたが、指摘は iPhone の `safe-area-inset-top` 前提で Android は上端 inset ≈ 0 のため反証にならない
- **AC「PR diff ±200 行以内」超過を明示**（免除ではなく PR 本文に内訳記載）: 実装 約 200 行 + テスト 約 380 行 + 記録類

### 2026-08-10 - 確認待ちの摩擦を除去（#618 permissions + tracker 新運用の規約化・PR #619 / dotfiles PR #15 open）

#### 概要

対話セッションが「許可を出してください」「merge したら声をかけてください」で止まる 2 つの摩擦を外した。前者は `permissions.ask` の非破壊ゲート撤去（#618）、後者は END の task-tracker を session-verifier 直後に実行する新運用の台帳化（D-20260810-main-1）。life-editor は PR #619、グローバル資産は dotfiles PR #15 に分けた（どちらも open）。

#### 変更点

- **`permissions.ask` を 1 件へ縮小**（#618）: `Bash(git push*)` / `Bash(gh pr create*)` を除去し `Bash(gh pr merge*)` のみ残した（P-001 の機械担保）。**`deny` は 27 件のまま無変更**（diff の deny 行の増減ゼロを機械確認）。プロンプトが増えた原因は PR #594（夜間レーンの柵）と PR #596（P-001 の担保）の 2 つで、それ以前はグローバル `Bash(*)` allow で素通りしていた
- **無人レーンの担保を runner 側へ分離**: 夜のレーンが commit 止まりである根拠が「repo の `permissions.ask` が止めてくれる」だったため、外した時点で**プロンプトの禁止文しか残らない**状態になる。`automation/routine-night.md` §停止条件 と `automation/README.md`（動作モデル + 安全則の 2 箇所）を「**runner 側 settings で担保する**（`claude -p --settings <無人用>` / `--disallowedTools`）」に書き換えた。対話セッションの柵と無人レーンの柵を同じ settings.json で兼用しない
- **D-20260810-main-1 を台帳化**: END の tracker は **session-verifier が緑になった直後**に実行し、ユーザー確認も実装 PR の merge も待たない。**`D-20260801-main-1`（tracker を実装ブランチに載せない）は維持**で、置き換えたのは実行タイミングだけ。`supersedes` は D-ID ではなく「CLAUDE.md §7.4 の該当行」「worktree-policy SKILL.md の該当節」という**文書位置の文字列**で宣言している（`records.mjs check` は D-ID 形式のみ双方向検証するため、旧決定を Active から落とさずに済む）
- **反映は 2 文書を行単位で**: CLAUDE.md §7.4 の「merge 後に 1 commit でまとめ」と `skills/worktree-policy/SKILL.md` の同文。§7.4 は「正本は worktree-policy スキル」と宣言しているので、CLAUDE.md だけ直すと SSOT と矛盾する
- **dotfiles PR #15**: `skills/task-tracker/SKILL.md`（作業終了フロー冒頭に実行タイミング）・`skills/lead-pipeline/SKILL.md`（中ティア連鎖の 3）・`agents/role-engineer.md`（引き継ぎの「セルフ検証結果」を session-verifier と同じ 5 ゲート表 + 総合 PASS/FAIL へ）。role-engineer は **G7/G14 の対の残件** — PR #14 で lead-pipeline Step 4 と role-qa Step 2 が「role-engineer の Verdict を検分」に変わったのに、出す側が `session-verifier 出力: <要約>` のままで受け手が検分できなかった
- **PR #14 との衝突回避**: dotfiles の 2 スキルは PR #14 も触っているため、編集行が重ならない位置（#14 = 中ティア Step 0 追加 / END フロー Step 5、こちら = Step 3 の行末 / END フロー冒頭）を選んだ。どちらを先に merge しても自動マージできる想定
- **DoD の 4 つ目は持ち越し**: 「確認プロンプトなしで push / PR 作成が通る」の実測は、**このセッションが読んでいる settings が main 側の旧 `ask`**（worktree の settings.json はロードされない）なので確定できない。merge + セッション再起動後に 1 回測る
- **本セッションが新運用の初適用**: verifier 緑（Types〜Coverage は ⏭️ / Project Rules ✅ = records check + docs-lint）の直後に、merge を待たず本 tracker を実行した

### 2026-08-10 - ハーネス統合とループ再設計 Phase A+B+C（PR #616 merged・dotfiles PR #14 open）

#### 概要

「計画 → 実装 → 検証 → 改善」のループを長期運用できるよう、ハーネスの穴 5 件と重複 8 系統を life-editor（19 ファイル）+ claude-dotfiles（26 ファイル）の 2 レーンで一括改修した。P-008（実装中スコープ凍結）を POLICY に追加し、計画テンプレートへ「検討した代替案」節と完了時の乖離レビュー 3 行を義務化。life-editor 側は PR #616 が merge 済み、dotfiles 側は PR #14 が open（中身は symlink 経由で `~/.claude` に実効済み・merge はユーザー手番）。（計画書: archive/2026-08-10-harness-loop-consolidation.md）

#### 変更点

- **P-008 実装中スコープ凍結**（ユーザー承認 2026-08-10・POLICY.md）: 実装中に計画外の追加・変更・削除が浮上したら実装せずキュー or Issue 依頼へ積み、現計画を続行。Scope / AC の変更・逸脱の自己免除はユーザー回答まで禁止。`_TEMPLATE.md`・`rules/decision-queue.md`・dotfiles の lead-pipeline（中ティアのミニスコープ宣言）へ配線
- **計画テンプレの強化**: 「検討した代替案（案 / 採否 / 却下理由 / 復活条件・最低 2 案）」節を必須化（ask-user の選択肢と回答も転記）。完了時の乖離レビュー 3 行（スコープ逸脱 / AC 免除 / 途中判断の行き先）を Worklog 必須に（実行者 = task-tracker END フロー）
- **重複のポインタ化（Lane L）**: comm/README の「タスク分配の正本」宣言を撤回し docs-workflow へ／ decisions 昇格手順・分担表・loop-\* の環境事実・frontend.md の jsdom 段落を各正本への ID 参照へ／ records.md に「インライン注記には D-ID を添える」を追加
- **Mac 専用 symlink 10 本 = known-issues/031**: skills 8 + agents 2 は Mac 絶対パスで Windows では解決不能。削除・stub 化は Mac を壊すため禁止。実体化は Mac セッションの手番（skill-lib / agents-lib に git remote があれば Windows clone でも可 — remote の有無は Mac で確認）
- **dotfiles 側（Lane G・PR #14）**: tone 3 ファイルの正本を tone-persona へ一本化（呼び名はサブエージェント向け複写 1 行だけ tone.md に残す — QA Blocking の回収）／ role-qa の判定ラベルを Blocking / Important / Suggestion に統一／ git-workflow §0.1.1 に「プロジェクト側 POLICY override が優先」を明記／ `MANDATORY FIRST ACTION` 行を rule + hook の 2 系統へ集約（G19）
- **QA / 検証**: role-qa 監査 NEEDS REVISION（Blocking 1 / Important 6）→ 同日全件回収。docs-lint（LC_ALL=C）+ `records.mjs check` 緑。乖離レビュー = G19 の Scope 逸脱 4 ファイルを Scope 追記で正規化 / AC 免除なし / role-engineer Verdict 形式は次 PR へ
- **残件**: dotfiles PR #14 merge（ユーザー）/ role-engineer Verdict 形式（次 PR）/ Phase D = Scope 照合 hook（#173 系）/ symlink 実体化（Mac — known-issues 031）

### 2026-08-09 - main の未追跡資産を 2 PR に整理（Codex 対応を複製から参照へ・PR #610 / #611 merged）

#### 概要

main の作業ディレクトリに未追跡のまま残っていた 13 ファイルと、宙に浮いていた `chore/docs-sync-20260731` を整理した。未コミット分は計画書 1 本（#610）と Codex 対応（#611）に分割し、Codex 側は全文コピーだった初版を「参照」方式へ組み直した。両方 merge 済み・ブランチと一時 worktree は撤去済み。

#### 変更点

- **`chore/docs-sync-20260731` は PR を出さず削除**: 4 commit・docs 5 ファイルの中身が**すべて既に main にあり**、PR を出すと `2026-07-14-schedule-redesign.md` と `memory/chat-main.md` を古い版へ巻き戻す差分になった（main は Step 5-c 完了まで進んでいたのにブランチは Step 6 止まり）。three-dot diff だけ見ると 97 insertions の正当な差分に見えるので、**two-dot で「ブランチ側にしかない行」を数えて 0 と 12 行の巻き戻しであることを確認**してから判断した
- **PR #610（計画書）**: `2026-08-03-open-issue-fanout-r3.md` 313 行を追加。docs-lint が**新しい検査 (e)** で落ちた — pull で入った記録グラフ層（`.claude/INDEX.md` + `records.mjs`）により、plans/ を触った PR は `node .claude/scripts/records.mjs index` を同一 PR に含める必要がある。ローカル検証を Codex 側ブランチで回していたため見落とした（**plans/ を触る PR では lint を必ずそのブランチで回す**）
- **PR #611（Codex 対応）**: 初版は `CLAUDE.md` / skills / hooks の全文コピーで、**発見時点で既に原本 5 コミット分ズレていた**（`.claude/hooks/*.sh` は hooks-lib 分離済み・`docs-workflow/SKILL.md` も更新済み）。加えて「Claude」→「Codex」の一括置換が固有名詞まで巻き込み、`.Codex/rules/` 等の実在しないパス・ブランチ名 `Codex/<slug>`・「**Codex** API 直課金」・「**Codex** 本体の SSE バグ」が生まれていた（`${CLAUDE_PROJECT_DIR}` は置換漏れで残存）
- **参照方式への再設計**: 実体は `.claude/` 側 1 つだけを保ち、Codex 側は入口のみ。`hooks.json` は `.claude/hooks/*.sh` を **git ルート相対**で呼ぶ（初版は `C:\Users\user\...` の絶対パス直書きで他マシン・worktree では動かなかった）。副次的に**バグが 1 つ消えた** — `.claude/hooks/*.sh` は `$(dirname $0)/..` から vendor 実装を探すため、`.codex/hooks/` に置いたコピーからだと `.codex/scripts/hooks-lib/` を見にいって外していた
- **仕様の裏取り**（公式ドキュメント）: スキルは **`.agents/skills/`** から探される（`.codex/skills/` ではない・`$CWD` から repo root まで遡る）／ hooks は `<repo>/.codex/hooks.json` が読まれ、コマンドは**セッションの cwd** で走るため絶対パスか git ルート相対が推奨（公式例が `$(git rev-parse --show-toplevel)`）
- **スキルを 4 本に絞った根拠**: `.claude/skills/` 17 個のうち 8 個はシンボリックリンクで、**Windows では実体化せずリンク先パスが書かれただけのテキストになっている**（`file` で確認）。残る実体 9 本のうち `loop-*` 5 本は Claude Code のスラッシュコマンド前提。差し引き 4 本

### 2026-08-06 - Loop Engineering Phase 2 の文書整備（夜の実装レーンを薄い殻へ・PR #597 merged `5161a9a1`）

#### 概要

親計画 §8 Step 9 のゲート（ループカタログ定着後に decision キューで Phase 2 着手可否を裁定）を**ユーザー指示で前倒しし、試験運用 0 件のまま** Phase 2 の文書整備を実施した。`goals.md` は役割ごと差し替え、`routine-night.md` は `/loop-implement` を呼ぶ薄い殻に書き換えている。**発火は有効化していない**（実行基盤の裁定 D-20260804-main-1 が未回答）。

#### 変更点

- **飛ばしたゲートを先に記録**: カタログは同日 merge（#595）で試験運用ゼロ、キューでの裁定も無し。Step 6（2026-08-04）と同型の前倒しである旨を親計画の Worklog 先頭に明記した上で着手
- **`goals.md` の役割変更**: 旧版は Goal 1〜3 + `ACTIVE` / `PENDING` / `BLOCKED` の状態機械で、中身が Tauri / D1 時代のまま陳腐化。**一覧を持たせず「今夜どれを選ぶか」の判断基準だけ**にした（open Issue の正本は GitHub — 数値の非複製原則）。必須条件 4 つ（一晩で commit まで届く / 無人で完結する / 誰の手番でもない / 未回答の decision に乗っていない）→ 順序（小さく確実な順 → bug > task > feature → 番号の古い順）→ 候補ゼロなら基準を緩めず終わる
- **設計判断（ユーザー裁定）**: open Issue は**全件がレーン宛の prefix 付き**で、無条件では夜のレーンが 1 件も拾えない構造だった。拾う範囲を「**宛先レーンはあるが滞留している Issue**」と確定。滞留の判定 = ① Issue 番号を含むブランチ / open PR の不在 ② 宛先レーンの 3 日無活動（ブランチ最終コミット + `.session-name` の mtime の**両方**。commit を残さず調査だけのレーンを前者だけでは見落とす）③ 着手宣言の不在。3 日は初期値
- **`routine-night.md` を薄い殻へ**: 無人固有の 6 点のみ（Scope 宣言 / Issue の選び方 / セッション予算 90 分の bash 明示計測 / 停止条件 / 報告先 / 質問経路）。検証ゲート・ティア判定・worktree 手順・機械が止める禁止は各正本へ委譲し重ねて書かない。`/loop-implement` との差分 1 点（周回数の記録先を計画書 Worklog ではなく報告に）を明記
- **訂正**: 親計画 §2 / §7 の「draft PR 止まり」→ **commit 止まり**。`Bash(git push*)` / `Bash(gh pr create*)` が `permissions.ask` にあり無人では必ず失敗するため。解放の可否は `2026-08-06-autonomous-operation-endpoint.md` §3 第 1 段の管轄
- **追随 3 か所も同一 PR に同梱**（起草時は Scope 外としたが同日ユーザー指示で取り込み）: `run-routine.ps1` の `ValidateSet` に `night` 追加（**無いと手動でも起動できなかった**）/ `README.md` の状態列と Phase 2 記述 / **`routine-morning.md` を退役**（中心の仕事が「goals.md の状態機械を朝に更新」で、その機械ごと畳んだため前提が消えた。朝の枠は `routine-digest.md`）。旧 Step の行き先表を残し、**後継のいない worktree prune は人手のまま**と明示
- **検証**: `LC_ALL=C bash scripts/docs-lint.sh` OK / `run-routine.ps1` は PowerShell パーサで構文 OK / shared lint 0 errors・test 1502 passed・build 通過 / web lint 指摘なし・build 通過・test 124 passed。**プロダクトコードの変更ゼロ**。fresh worktree には `node_modules` が無く初回は全滅したので `npm ci` 後に再実行している

#### 次セッション用プロンプト（セッション 3: コンテキストコスト削減ハーネス — 同日の旧プロンプトを差し替え）

```
コンテキストコスト削減ハーネスの実装セッション（Loop Engineering セッション 3/3）。

正本 = .claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md（Status: Draft・未着手）
親計画 = .claude/docs/vision/plans/2026-07-28-loop-engineering-harness.md
姉妹計画 = .claude/docs/vision/plans/2026-08-04-loop-catalog.md（ループ定義の構造。コストは扱わない）

## 最初に確認すること（「完了」の範囲を先に確定する）

**1 セッションで全 Step は終わらない。** Step 5（Phase 3 移送）は計画自身が
「移行（Electron + Supabase）完了後に実施」と定めていて、移行は未完了。
Risks にも「移行中に移送すると移送先自体が動く」と書いてある。

したがって今回の到達点は **Phase 1（計測）+ Phase 2（枠づくり）+ Phase 4（/loop-prune）** で、
Phase 3 は移行完了まで開けない。Acceptance Criteria の
「移送前後の再測定で固定費が減少している」は今回は満たせない ——
**満たせない項目があることを最初に認めた上で、残りを全部埋める**こと。
Status は COMPLETED にせず IN PROGRESS のまま、残が Phase 3 だけと分かる形で書く。

（移行ゲートを前倒しで開けるかはユーザー判断。開けたいなら decision キューに A/B で起票し、
　回答を待たずに Phase 1/2/4 を進める）

## 本題 1: Phase 1 — 計測（Step 1〜2）

**何も削らない。内訳を数字で出すことだけが目的。** 二段構え（概算 → 上位項目だけ精密）は
2026-08-04 裁定で確定済み。全項目の精密計測はしない。

調査対象は計画書 §4 の表が正本。ただし **表に載っていない支配項が 1 つある**（下の申し送り参照）。

結果は本書の Worklog ではなく**独立した計測結果ファイル**に残す
（再測定して差分を見るため）。再現可能な測定手順を同じファイルに書くこと ——
「どう測ったか」が無いと次回の数字と比較できない。

## 本題 2: Phase 2 — 枠づくり（Step 4）

CLAUDE.md を **航法（Navigation）/ 目的（Why）の 2 層**へ再編する枠を用意し、
移送先（skill / docs）を先に作る。**全面書き換えではなく既存記述の振り分け。**

- 移送先が無い記述は、移送先を作るまで消さない（消失ゼロ）
- 実体の無い禁止は、hooks / permissions に実体を作ってから文章を削る
- この段階では枠と移送先の確保まで。実際の移送は Phase 3

## 本題 3: Phase 4 — /loop-prune（Step 6）

`.claude/skills/loop-prune/SKILL.md` を作る。**これが最終成果物**
（計画書 §1: 成果物として残すのは 1 段目の計測と 4 段目の維持機構）。

- 形式はループカタログの既存 4 本に揃える（必須 5 見出し = 目標 / 完了条件（機械検証可能）/
  予算 / 停止条件 / 使ってよい道具。手順は書かない。disable-model-invocation: true）
- 対になる /loop-postmortem（知見を足す側）が既にあるので、**肥大を戻す側**として設計する。
  カタログ自身も棚卸しの対象に含める
- 予算の実測値は 2026-08-04-loop-catalog-implementation.md の Worklog を参照

## 判断が要る 2 点（キューに書いて進む・待たない）

1. **Phase 3 の移行ゲートを前倒しで開けるか** — 開けるなら移送も今回やる
2. **グローバル資産（~/.claude/CLAUDE.md と claude-dotfiles/claude/rules/）を Scope に入れるか**
   — 計画書の Scope は .claude/** と .mcp.json だけで、グローバル側が入っていない。
   だが実測するとここが無視できない大きさ（申し送り参照）。**別リポジトリなので PR も別**になる

## 制約

- Phase 1 の間は **読み取りと計測結果ファイルの追加のみ**。既存ファイルは変更しない
- 削減量を KPI にしない（削りすぎは探索コストを増やして逆効果）。基準は「移送先があるものは移す」だけ
- 調査を目的化しない。上位項目が見えたら次へ進む
- worktree から作業する。メイン直下は main 専有。ブランチを切ったら .claude/comm/.session-branch を書き換える
- 計画書 frontmatter の Branch を着手時のブランチ名に更新する（現在は配置 PR のまま）
- tracker を実装ブランチに載せない（D-20260801-main-1）。merge は常にこうだいさん（P-001）
- PR 前に CLAUDE.md §7.1 の lint / build / test（docs だけでも docs-lint は LC_ALL=C 付き）

## 申し送り（2026-08-06 実測・そのまま使ってよい）

- **プロジェクトの常時ロード分は約 31KB**: .claude/CLAUDE.md 18.5KB +
  rules/ 3 本 12.6KB（うち frontend.md 7.5KB と docs-consistency.md 4.3KB は path-scoped）
- **グローバル側がほぼ同規模で、計画書 §4 の調査表に入っていない**:
  claude-dotfiles/claude/rules/ は 11 本 28.8KB で、うち 8 本が毎セッション無条件でロードされる
  （bash-tool-stability 3.2KB / tone 7.3KB / heavy-workflows 1.8KB 等）。
  **これが最大の盲点**の可能性がある。§4 の表に 1 行足すところから始めること
- **MCP の仮説は環境側で部分解消されている**: 現行 Claude Code には deferred tools
  （ツール定義を必要時に取り寄せる遅延ロード）があり、MCP ツールは名前だけ提示されて
  スキーマは ToolSearch 時にロードされる。「毎セッション全量積まれる」前提で測らないこと
- .claude/skills/ は 8 本。.claude/scripts/ は実在する（docs-lint はリポジトリ直下の scripts/）
```

### 2026-08-06 - ループカタログ初期 4 本の配置（Loop Engineering セッション 2・PR #595 merged）

#### 概要

親計画 `2026-08-04-loop-catalog.md` §4 の手順どおり、この Windows 機のローカル実態を実測してから子計画書を起こし、`/loop-triage` でフォーマットを確定させたうえで残り 3 本を同一形式で配置した。実測の結果、親計画が置いていた前提が 2 か所で崩れていたため、設計を 2 点変更している。

#### 変更点

- **子計画書**: `2026-08-04-loop-catalog-implementation.md`（§1 ローカル実測 / §2 責務境界 / §3 フォーマット + 規約 / §4 初期 4 本 + 設計変更 2 点 / Scope / Steps 8 本 / 機械検証可能な AC 8 項目）。親計画に `Child:` を追加し Status を `IN PROGRESS` 化
- **前提の崩れ ①（死んだスキル）**: リポジトリ内スキル 12 本のうち **8 本が Mac パスを指すシンボリックリンク切れ**（`add-component` / `add-feature` / `add-ipc-channel` / `db-migration` / `frontend-react-designer` / **`issue-dispatch`** / `session-loader` / `test-writing`）。生きているのは `dev-digest` / `docs-workflow` / `schedule-management` / `worktree-policy` の 4 本のみ
- **前提の崩れ ②（merge の穴）**: `gh pr merge` が repo `permissions` の deny にも ask にも無く、**POLICY P-001「merge は常にユーザー」が機械では未強制**。さらに `git-workflow` §0.1.1 の自動マージ指定と衝突している。→ **D-20260804-main-2** として判断キューへ起票（A = `permissions.ask` へ追加 / B = deny / C = 現状維持 + §0.1.1 を life-editor 非適用と明記）
- **設計変更 2 点**: ① `/loop-triage` は**起票しない**（`issue-dispatch` が死んでおり、起票は chat-main 一元）。判定と着手順の提示までで、起票が要るものは outbox へ依頼を append ② `/loop-implement` は **draft PR を作らない**（`git push*` / `gh pr create*` が `permissions.ask` のため無人実行では必ず止まる）。完了条件は commit + PR 本文の下書きをファイル出力まで
- **配置した 4 本**: `loop-triage`（12 件 / 20 分）・`loop-implement`（5 周 / 90 分）・`loop-verify`（3 周 / 30 分・`session-verifier` の内部 2 リトライの**外側の輪**）・`loop-postmortem`（5 件 / 20 分・1 件につき 1 行）。全本 `disable-model-invocation: true` + 必須 5 見出し + 6 つ目の `## 環境の事実`（ユーザー承認）。時間上限は宣言だけでは無視された実例（494 反復の暴走）があるため `START_TS=$(date +%s)` の実測を明記
- **見出し語彙は `automation/routine-*.md` に合わせた**。親 Phase 2 で `routine-night.md` を `/loop-implement` の薄い殻に書き換えられるようにするため
- **検証**: AC 8 項目すべて機械確認（4 本存在 / 5 見出し 5-5 / `disable-model-invocation` 4-4 / 反復・時間上限 4-4 / 死んだスキルを呼び先に指名していない / 親→子の参照あり / `LC_ALL=C bash scripts/docs-lint.sh` = OK）。CI = docs-lint pass 7s + typecheck/test/build pass 3m7s。**PR #595 merged `18da6b5f`**

#### 次セッション用プロンプト（セッション 3: コンテキストコスト削減ハーネス）

```
コンテキストコスト削減ハーネスの実装セッション（Loop Engineering セッション 3/3）。
前提: PR #595 が merge 済み（18da6b5f・ループカタログ初期 4 本が main にある）。
正本 = .claude/docs/vision/plans/2026-08-04-context-cost-reduction-harness.md（着手時に Status を IN PROGRESS 化）。
範囲は Phase 1（計測）+ Phase 2（枠づくり）まで。Phase 3（移送）は Electron 移行完了後なので着手しない。
Phase 1 で必ず実測すること:
- 常時ロード分（CLAUDE.md + ~/.claude/CLAUDE.md + rules/ 群）の実トークン数
- 条件ロード分（skills / path-scoped rules / docs）が実際に何回・どれだけ載っているか
- 実測前に削る判断をしない（どこが重いかは推測では当たらない）
Phase 2 の枠づくりでは、ループカタログと同じ規律に従う:
- 削るのではなく「読む条件」を足す（path-scoped / 明示起動へ寄せる）
- 削った細則の分だけ「なぜ」を厚くする
- 数値・列挙の正本を 1 か所に寄せる（数値の非複製原則）
制約: Scope は計画書に宣言したパスのみ。CLAUDE.md を削るときは、その行を消したら Claude が間違うかで判断し、根拠を Worklog に残す。
既知の関連: 姉妹計画の loop-prune（増えた文書を畳むループ）は本計画の管轄。カタログは 4 本を上限にしてある。
```

#### 次セッション用プロンプト（自律運転の到達点・第 1 段の設計 — セッション 3 より先にこちら）

```
自律運転の到達点・第 1 段の設計セッション。

前提: PR #596 が merge 済みであること（未 merge なら停止して報告）。
正本 = .claude/docs/vision/plans/2026-08-06-autonomous-operation-endpoint.md（Status は既に IN PROGRESS）。
姉妹 = .claude/docs/vision/plans/2026-08-04-loop-catalog-implementation.md（ループ 4 本の定義）。

## 最初にやること: 夜間レビュー試験運用の回収

2026-08-06 23:33 JST に 1 回だけ走らせたクラウド routine（trig_018fECsiaVRLNSCFcoVMDF4q）の結果が
Notion の「Life Editor Night Review」ハブ（3b4b6365-53cc-8158-93d5-e3514ff6d9d3）にある。
同じハブの下に「Cloud Probe 2026-08-06」（環境実測）も置いてある。

1. Night Review 2026-08-06 を読み、§1-A-2 の残る未検証 = `gh auth status` の結果を確定させて計画書に追記する
2. 監査の検出内容（docs 整合 / Issue 台帳 / PR conflict / 検証準備）を裁く。起票が必要なものは chat-main が起票する
3. 実際の所要時間を Worklog に記録する（反復上限・時間上限の実測値として使う）

## 本題: 第 1 段の設計を書き直す

実測で前提が変わっている。クラウド環境には life-editor のチェックアウトも .claude/settings.json も無い（§1-A-2）。
したがって第 1 段は「ローカルの permissions を緩める」話ではなく、
ガードレールが効かない環境に GitHub の書き込み認証を置くかどうかの話になっている。

`gh auth status` の結果で分岐する:

- 認証が無かった場合: 「書く手段が無いから書けない」が構造的な安全担保になっている。
  第 1 段を進めるならこの担保を意図的に外すことになるので、外す前提条件を設計する
  （どの操作まで許すか / 認証をどう供給するか / トークンをどこに置くか）。
  トークンをプロンプトに平文で書くのは禁止（CLAUDE.md §9 の鉄則・2026-05-17 の流出未遂）
- 認証が有った場合: 柵の無い環境に既に書き込み能力がある状態。
  第 1 段の解放以前に現状が危ないので、まずそれを塞ぐ設計を先に書く

どちらでも共通で決めること:

- クラウドの routine 定義が git 管理外という穴（Risks に記載）をどうするか。
  正本を .claude/automation/ に置いて、trigger 側は clone して読むだけにする案が有力
- 夜間レビューを常設化するか（今は 1 回きり）。常設化するなら発火頻度と利用枠の消費を見てから

## 制約

- Scope は計画書の Scope 節で宣言し直す。POLICY.md には触れない（P-001 は据え置き確定）
- merge は常にこうだいさん（P-001・D-20260806-main-1 = B で再確認済み）。
  gh pr merge は permissions.ask に入れてあるので、押す前に必ず止まる
- 不可逆操作（DDL 適用・シークレット投入・force 系 git・履歴改変）は判断キューに書かず同期で確認（P-007）
- tracker（memory/ + history/）の更新を実装ブランチに載せない（D-20260801-main-1）
- クラウド実行はサブスクの利用枠を食う（別請求は無い）。試験は 1 回ずつ、繰り返し登録は結果を見てから

## セッション終了時

コスト削減ハーネス（2026-08-04-context-cost-reduction-harness.md・Loop Engineering セッション 3）向けの
プロンプトを生成すること。貼り付け用の下書きは本エントリの上のブロックにある。
```

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

### 2026-08-13 - #530 Windows 実機 golden path 通過（CLOSED）+ 11 レーンへの /goal 配布

#### 概要

open Issue 23 件を実測して 11 レーンへ /goal で配り、chat-main 自身の手番だった **#530（Windows 実機起動）を最後まで通して CLOSED** した。08-02 から止まっていた前提（`desktop/.env` 不在・#548 の白画面）が両方解けたため、ビルドからインストール、golden path の目視までを一続きで実施。途中で `npm run dev` だけが壊れている環境問題を踏み、known-issues 033 として記録した。

#### 変更点

- **/goal fan-out（11 レーン）**: Issue 本文の「担当レーン」指定と、直近 merge PR のブランチ名（誰が続きを持っているか）で割り当てた。schedule-refine = #789 → #774 → #708 → #790 / shared-fix = #672 残り → #782 / refactor-core = #701 Step 2 → #673 → #675 / web-public = #791 → #676 残り / tags-docs = #674 残り → #777 / materials-refine = #776 / settings-refine = #779 → #778 / mobile-refine = #716 の裁定済み 3 件 / work-refine = #781 / briefing-refine = #780 / harness-loop = #700 Step 2
- **#530 の前提解除**: `desktop/.env` は `web/.env.local` に必要な 2 キーが揃っていたのでコピーで配線（値を読まずに済み・`.gitignore:83` で除外済み）。renderer への注入は `out/renderer/assets/index-*.js` に `supabase.co` が 39 ヒット / `VITE_SUPABASE_URL` の未置換リテラルが 0 で確認（08-11 の実測は逆で `undefined` のままだった）
- **#530 の検証**: `build:win` exit 0 → `win-unpacked` 起動でプロセス 4 本 → NSIS サイレントインストール（`/S`・per-user）で実体を 08-02 13:17 → 08-13 00:07 に更新 → インストール先から起動して 4 本 → **ログイン → Todo 追加・編集・削除が PASS**（目視）。Menu / Tray / ウィンドウサイズ復元も PASS で、`%APPDATA%\desktop\config.json` に `windowBounds` が書かれることを実測
- **起動判定の基準**: 「プロセスが生きている」ではなく **4 本立つこと**。#545 は 1 本だけ立って落ちており、生存だけを見た煙試験が見抜けなかった
- **known-issues 033 新設**: `npm run dev` が `Error: Electron uninstall` で落ちる件。`node_modules/electron/dist` にライセンスファイル 1 個しか無く `path.txt` も欠けていた。**`build:win` は緑のまま**なので CI ゲートを素通りする（dev と electron-builder で Electron の入手経路が違う）。キャッシュ済み zip の手動展開で復旧。`path.txt` を `echo` で書くと改行がパスに混ざって `ENOENT` になる落とし穴つき（`printf` を使う）
- **新規起票 2 件**: **#831** = コード上の名前を Task → Todo に統一する（画面表示は既に Todo・DB は据え置き。実測 = ファイル 55 本 / 出現 3,470 箇所。据え置きは ID prefix `task-` / `role: "task"` の値 / DB 列名の 3 点）。**#837** = userData が `%APPDATA%\desktop` に入り `productName: Life Editor` と一致しない
- **#831 の着手条件**: `gh pr list --state open` が 0 件の谷間。起票直後に 11 レーンへ /goal が配られて open PR 4 件になったため、その旨を Issue にコメントして条件を明文化した

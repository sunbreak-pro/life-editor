# HISTORY (chat-main)

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

> 古いエントリは [`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照

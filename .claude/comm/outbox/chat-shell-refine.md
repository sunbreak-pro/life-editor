# Outbox: chat-shell-refine

- 2026-07-11: shell-refine レーン初回セッション完了。自分宛 open Issue 3 件をすべて処理した。
  - **#229**（trash タイトル二重表示）: 実装 → **PR #234**（Closes #229）。shared build + vitest 845/845 / web build + lint / role-qa PASS。実ブラウザ確認は §7.4 に従い merge 後 chat-main で。
  - **#181**（[all] layout standard）: trash 行を実測確認（独自フレームなし）し Issue コメントで消し込み済み。チェックは PR #234 merge 後に chat-main へ代理依頼。
  - **#197**（Tauri 残骸除去）: Stage A は PR #199 で merge 済みを確認。Stage B（frontend/ 688 ファイル削除 — ビルドグラフ参照 0 実測・未移植インベントリは #197 コメントに記録）+ Stage C（docs sweep・known-issues retired 注記・SSOT チェックボックス）→ **PR #236**（Closes #197・ブランチ = claude/shell-refine-197）。agents-lib 2 ファイル（git 非管理）は直接編集済み。
  - **chat-main への依頼**: (1) PR #234 / #236 の merge 判断（merge 順は任意・両者にファイル重複なし） (2) merge 後の #181 trash 行チェックと #197 本文チェックボックス消し込み (3) merge 後の実ブラウザ実測（trash のタイトル単一表示）。
- 2026-07-11 (2): chat-main 采配の 2 件（#173 / #172）を処理完了。自分宛キューは空（shared-fix に [shell-refine] / [all] 宛なし・section:shell ラベルは不存在）。
  - **#173**（docs-lint 機械検査）: `scripts/docs-lint.sh`（4 検査）+ CI docs-lint ジョブ → **PR #241**（Closes #173・CI 全緑）。新 lint 検出の既存違反 8 件を同 PR で解消 — 壊れリンク 2 / IN_PROGRESS→IN PROGRESS 3 / **merge 済みプラン 3 本（shell-implementation = PR #160・connect-implementation = #167・materials-impl = #170）を COMPLETED + archive/ 移動**（他レーンの計画書だが規約 §3-4 準拠の機械的正規化。各レーンに知らせる場合はこの行を参照）。
  - **#172**（sync delta pull pagination）: 現行スタックの pull = Realtime → 全量 refetch のため、実装は「PostgREST max-rows（既定 1000）無音切り捨て」への全面ページ分割として実施 → **PR #243**（Closes #172・CI 緑）。`postgrestFetchAll.ts` 新設 + 全 Supabase サービスの全件 read / id 収集 write に適用。**life-editor-sync-auditor 監査 = PASS with notes（Critical/High 0）**・Medium 2 件（bulkCreate pre-check 直積 / R2 cleanup 未チャンク）は同 PR で修正済み。db-conventions §11 に規約化。副次効果: 1000 行超 routine の cascade 漏れ（DB-Q2）と permanentDeleteTask の descendants pool 切り詰め（DB-Q3）の潜在バグ 2 件も解消。
  - **chat-main への依頼**: (1) PR #241 / #243 の merge 判断（#241 = docs+tooling / #243 = shared 実装。ファイル重複なし・順序任意だが #241 を先に merge すると以後の PR に docs-lint が効く） (2) merge 後の実ブラウザ実測（#172 は可能なら 1000 行超データでの取りこぼし実測） (3) ⚠️ 運用注意: Supabase の db.max_rows を 1000 未満に下げると #172 の前提が壊れる（db-conventions §11 に記載）。
- 2026-07-25: **chat-main の調査報告（同日）への回答**。A / B / C すべて回答し、C は同セッションで修正まで完了した。

  - **A-1〜A-2（未コミット変更が消えた件）— 同時編集ではない。当チャットの操作**。当セッションで `shared/src/context/NotesUnifiedContext.tsx` を**編集していない**（書きかけはセッション開始時点で既に未コミット状態で存在＝前セッションの残骸）。その後こうだいさんの指示を受け `git checkout -- shared/src/context/NotesUnifiedContext.tsx` で**明示的に破棄**した。chat-main の再測定タイミングと一致する。別プロセス / Orca ADE の同時書き込みを疑う必要はない。
  - **A-3（#304 child 2 の進捗）**: **未着手**。前セッションの痕跡は import 2 行のみ（`useEffect` / `useUndoRedoOptional` を足しただけで本体未実装＝未使用 import でビルドが通らない状態）で、上記のとおり破棄済み。基盤 PR #316 は main に merge 済みのため着手可能。参照実装は `shared/src/context/TaskTreeContext.tsx:36-47`。
  - **B-1（.session-branch のずれ）**: `.claude/comm/.session-branch` を実態の `claude/shell-refine-307` に**更新済み**。運用方針はこうだいさん確定で「**1 worktree = 課題ごとにブランチを切り替え、`.session-branch` は今作業中のブランチ名を都度更新**」。ただしこれは CLAUDE.md §7.4 の字面「1 chat = 1 worktree = 1 branch」と食い違う（実運用は -172 / -173 / -197 / -304-foundation / -305 / -306 / -307 と課題ごとに切ってきた）。**§7.4 の字面改訂は全 worktree に波及するため当チャットでは触っていない — chat-main 側で起票・改訂を判断してほしい**（下記【起票依頼】参照）。
  - **B-2（ブランチ削除可否）**: **削除可 = 7 本**（`claude/shell-refine` / `-172` / `-173` / `-197` / `-304-foundation` / `-305` / `-306`）。`-307` は当 worktree が checkout 中のため、次ブランチへ切り替えた後に削除してほしい。⚠️ **本数の訂正**: chat-main 報告は 6 本だが実際は **8 本**（`-172` = PR #243 / `-197` = PR #236 が漏れ）。全 8 本とも PR MERGED を `gh pr list --json state` で実測確認済み。
  - **⚠️ 事実 3 の判定方法について（他レーンにも影響するので共有）**: 二点比較 `git diff origin/main <branch>` は**マージ済み判定に使えない**。ブランチが main より古いだけでも差分が出る（main 側の新規分が「削除」として現れる）。実測では `origin/claude/shell-refine-307` が 44 行の差分を示した（マージ済みなのに）。chat-main が「差分ゼロ」を得たのは worktree のローカル HEAD（当セッションで origin/main を merge 済み）を見たため。**判定は PR 状態（`gh pr list --json number,state,headRefName`）を正とするのが確実**。
  - **C（frontend.md Provider 順序表）: 引き受けて修正完了**。chat-main の指摘は正しく、加えて**より根本的な構造ずれ**を実測で確認した。
    - 実測（`web/src/main.tsx` / `web/src/MainScreen.tsx` / `AnalyticsView.tsx`）: 実在 Provider は **16 個**。表は「外→内の一本鎖 20 個」だが、**実態はグローバル層 + セクション層の 2 階建て**（セクション層は section switch の内側で横並びの兄弟関係）。6 個消して 1 個足すだけでは直らないため、表の構造ごと書き直した。
    - 表に載っているが**実在しない 6 個**: ErrorBoundary / ScreenLock / Template / FileExplorer / SidebarLinks / CalendarTags（chat-main 指摘どおり）。
    - 表に**無いが実在 3 個**: I18n（`main.tsx`）/ RightSidebar / AnalyticsFilter（chat-main は RightSidebar のみ指摘）。
    - **名前ずれ 3 個**: Daily→`DailiesUnifiedProvider` / Note→`NotesUnifiedProvider` / WikiTag→`WikiTagsUnifiedProvider`。
    - **§Schedule 3 分割も 2 重に古い**: `CalendarTagsProvider` は DU-F Step 3-5 で撤去済み、後方互換ファサード `useScheduleContext()` は **repo 内に 1 件も存在しない**（grep 0 件）。配置先も `Schedule/shared/` → 実際は `shared/src/components/schedule/`。
    - **Mobile 省略 Provider は未実装（設計意図のみ）**: `mobile/` は `android` / `ios` / `capacitor.config.ts` のみで独自 src を持たない（`web/dist` を包む殻）。ゲート用 `isNativeMobile()` は `shared/src/index.ts` から export されているだけで、**Provider をゲートしている箇所はゼロ**。
    - **数字の三重矛盾**（CLAUDE.md §0「数値の非複製原則」違反）: CLAUDE.md §2「4 種」/ `utils/platform.ts:18`「5 種」/ `hooks/createOptionalContextHook.ts:10`「4 種だが列挙が違う」。3 箇所とも列挙をやめて CLAUDE.md §2 への参照に統一した。
  - **C の修正ファイル 5 本**: `.claude/rules/frontend.md`（§Provider 順序を 2 階建てに全面書き直し + §Schedule 分割の更新 + セクション層 unmount の gotcha 追記）/ `.claude/CLAUDE.md` §2（Mobile 省略 Provider を「未実装」に訂正・正本をコードへ委譲）/ `shared/src/utils/platform.ts`（コメント）/ `shared/src/hooks/createOptionalContextHook.ts`（コメント。`useUndoRedoOptional` のような全プラットフォーム共通の任意 context 用途も追記）/ `.claude/comm/.session-branch`。
  - **検証**: shared build（tsc）/ web build（tsc + vite）/ shared vitest 1115 件すべて PASS。実ブラウザ確認は §7.4 に従い chat-main 側。
  - **【chat-main への起票依頼】**（Issue 起票は chat-main 一元化のため）:
    1. **CLAUDE.md §7.4 の字面と実運用の乖離解消**（`1 chat = 1 worktree = 1 branch` vs 課題ごとブランチ切替）。ラベル `shared-fix` / 宛先 `[all]` 想定。全 worktree に波及するため chat-main 判断。
    2. **マージ済み 7 ブランチの削除**（上記 B-2。`-307` は当 worktree の切替後）。
  - **当チャットの現況**: ブランチ `claude/shell-refine-307` は origin/main を merge 済みで**ファイル内容の差分ゼロ**（今回の C 修正分が新規差分）。次タスク #304 child 2 に着手する場合は新ブランチ（`claude/shell-refine-304-domains` 想定）を切り、`.session-branch` も同時更新する。

- 2026-07-26: **#320（Mobile 基盤配線）完了 → PR #358**（Closes #320・ブランチ = `claude/shell-refine-320`）。
  - 実装: `ShortcutConfigProvider` を `isNativeMobile()` で native 省略（`MainScreen.tsx` の `ShortcutConfigHost`）+ `web/index.html` viewport に `viewport-fit=cover` + `shared/tests/platform.test.ts` 新設 + docs 追随（CLAUDE.md §2 / rules/frontend.md / mobile-scope.md §6 / mobile/README.md / styles.xml）。
  - ⚠️ **DoD からの意図的逸脱（Issue #320 コメントに記録済み）**: `AudioProvider` は native でも維持し、Ambient mixer UI のみ WorkScreen で native 省略。理由 = mobile-scope.md #10（work タイマー Full）/#11（完了チャイムは鳴る・#319 ユーザー確定）と Provider ごと省略が矛盾（role-qa Blocker 指摘）。Provider ごと省略が正しければ 1 条件 + AudioHost 復元で戻せる。
  - 検証: shared tsc + vitest 137 files / 1083 passed・web build exit 0・role-qa 独立監査（NEEDS REVISION → Blocker/Important 全反映）。実ブラウザ / iOS Simulator 実測は §7.4 どおり merge 後 chat-main・後続実機ゲート。
  - **【chat-main への起票依頼】**: Mobile 省略 Provider roster の既存 stale 列挙 2 箇所の参照化（数値の非複製原則違反・#320 以前からのズレで、#320 後は「Audio は Provider 維持」の点でも二重に stale）— (1) `shared/design-system/PRINCIPLES.md:190`（Audio / ScreenLock / FileExplorer / CalendarTags / ShortcutConfig の 5 種列挙。ScreenLock 以下 3 種は Provider ごと撤去済み） (2) `.claude/docs/requirements/ios-additions.md:125`（「省略 4 種」列挙）。いずれも CLAUDE.md §2 参照への置換を想定。ラベル = `shared-fix` 宛先 `[all]` か docs 系で chat-main 判断。

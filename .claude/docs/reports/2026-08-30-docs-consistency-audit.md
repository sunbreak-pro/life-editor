# 2026-08-30 ドキュメント整合監査 — CLAUDE.md + `.claude/` docs 棚卸し

- 実施: 2026-08-30 chat-main（ユーザー依頼「コードが大規模化しており CLAUDE.md の整合性や不要ドキュメントを調査してほしい」）
- 手法: 読み取り専用の調査エージェント 2 体（① CLAUDE.md の全主張を実装と突き合わせ ② docs/vision/plans・requirements・vision・skills・agents の棚卸し）→ load-bearing な指摘は chat-main が実測で spot check（`rules/docs-consistency.md` §5）。裏取り済み = Backlinks 2 パス不在 / plans 2 本の Status 行 / STALE スキル 5 本の最終コミット / core.md の Tauri 残置 / coding-principles の FROZEN / TrashCategory / TypeScript 版数 / PropertyType 0 件 / sounds バケット / AppProviders 移設 / SessionStart hook 3 本 / 0026 ローカル在
- 検出限界: `scripts/docs-lint.sh` は相対 markdown リンクしか実在検査しない。バッククォート内のコードパス（今回の Backlinks 型の drift）は構造的に検出不能で、今後も人力 sweep が要る

## 総括

| 領域            | 結果                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLAUDE.md       | **high 7 / medium 6 / low 5**。参照リンク 34 パスは全実在・§3 / §7 の機構記述は概ね正確で、**腐っているのは「列挙・個数・旧スタックの残骸」に集中** |
| plans/（19 本） | enum 逸脱 0・COMPLETED 残置 0 だが、**Status が現実から遅れているものが 11 本**（high 5）                                                           |
| requirements/   | 退役注記は概ね健全。**実在しないファイルを「残っている」と断言する箇所 1 件（high）**                                                               |
| vision/         | core.md の本文が Tauri / D1 / SQLite 前提のまま 3.5 か月放置（冒頭注記のみで本文無修正）                                                            |
| skills/         | **STALE 5 本が「書き直す」裁定（D-20260810-main-3 = 2026-08-11 回答）から 19 日間 0 コミット**。現役スキルから STALE への生きた導線 2 本            |
| agents/         | 健全（退役前提の定義なし）                                                                                                                          |

## 共通根因（docs 修正より先にユーザー判断を推奨）

plans 4 本 + skills 5 本の滞留は、**2026-08-11 に回答済みのまま未実装の裁定 2 件**に収束する:

1. **D-20260804-main-1**（= A: Windows Task Scheduler + `claude -p` で夜間発火）— `automation/routine-ids.md` が今も PENDING。これが plans の `2026-05-26-autonomous-dev-routine`（BLOCKED 理由が失効）/ `2026-07-28-loop-engineering-harness` / `2026-08-06-autonomous-operation-endpoint` の Status 滞留の根
2. **D-20260810-main-3**（= A: STALE スキル 5 本を現行アーキで書き直す）— 5 本とも最終コミットが 2026-08-10 の vendor 化（`a2d4bd54`）のまま

## Part 1 — CLAUDE.md（行番号は 2026-08-30 時点 `7339bd2e`）

### High（実装と食い違い / 誤誘導するポインタ）

| #   | 節                  | 主張                                                                                        | 実測                                                                                                                                                      | 直し方                                                                                                              |
| --- | ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | §4 ソフトデリート   | 対象に Databases / Templates、Events 無し                                                   | `shared/src/components/TrashView.tsx:31-33` = `"todos" \| "notes" \| "dailies" \| "routines" \| "events"` の 5 種                                         | 列挙を消し「対象は `TrashView.tsx::TrashCategory` が正」へ                                                          |
| 2   | §8 Connect 退役注記 | backlink 部品は `shared/src/components/Backlinks/` + `shared/src/utils/itemLinks.ts` へ移設 | **両パスとも #1239（D-20260829-connect-1 = B）で削除済み**・現物は `web/src/wikitag/LinkPanel.tsx`                                                        | 「呼び出し元ゼロのため #1239 で削除。リンク一覧は LinkPanel」へ書き換え（tier-2-supporting.md:185 も同罪 — Part 2） |
| 3   | §4 見出し           | 変更手順 → `db-migration` スキル                                                            | 同スキルは STALE（起動禁止）で本文が「手順は CLAUDE.md §7.3」と逆参照 = 循環                                                                              | 委譲先を「§7.3 + `supabase/migrations/`」へ                                                                         |
| 4   | §2 / §3.2           | Provider 省略とネストの正本 = `web/src/MainScreen.tsx`                                      | #676 (a) で `web/src/AppProviders.tsx` へ移設済み（`:88-117` 鎖 / `:122-139` `isNativeMobile()` ゲート）。`rules/frontend.md` にも同じ stale ポインタあり | 正本パスを AppProviders.tsx へ差し替え（rules/frontend.md も同時）                                                  |
| 5   | §7.1                | TypeScript は web = 6.x / shared・desktop = 5.6                                             | **4 パッケージ全部 `~6.0.2`**（shared / web / desktop / mcp-server の package.json 実測）                                                                 | 版数の括弧を削除（「web の build は shared も検査する」の結論だけ残す）                                             |
| 6   | §4                  | PropertyType 実装済み: text / number / select / date / checkbox                             | 現行コード（shared / web / mcp-server）に `PropertyType` / `database_payload` の hit **0 件**。旧 Tauri 実装の記述                                        | 「汎用 DB は凍結（D-20260704-main-1）・現行スタックに実装なし」へ                                                   |
| 7   | §9 鉄則             | 音源コミット禁止（`public/sounds/` は `.gitignore`）                                        | `public/sounds/` も `.gitignore` の該当行も不在。実体は Supabase Storage `sounds` バケット（`shared/src/constants/sounds.ts:17-21`）                      | 「音源は Storage 配信・リポジトリにバイナリを置かない（機械ガードなし）」へ                                         |

### Medium

- 冒頭 → **移行 SSOT のヘッダが約 7 週遅れ**: Status = 「Phase 3/4 は実機 golden path 待ち」のまま（`Updated: 2026-07-08`・path が Mac 前提）。本文後半には Windows golden path 通過（#530・2026-08-13）と Web URL 公開済み（#600・2026-08-09）が記録済みで、ヘッダとの自己矛盾。`:191`「frontend/ + src-tauri/ は触らず維持」も削除済み記録（`:406-407`）と矛盾。#1300 / #1301 + `2026-08-30-desktop-app-packaging.md` 未反映
- §7.3 — SessionStart hook の列挙が 2 本（実測 3 本: regen-index.sh / `records.mjs index` / session-start-check.sh）。列挙をやめ「登録は settings.json が正」推奨
- §4 — 「約 20 テーブル」（実測 21）は §0 の数値非複製原則に自ら抵触。数字を落とす
- §8 — Tier 2「11」の列挙に再新設 Connect（Tag hub・live section）が入っておらず、requirements 側にも Feature 節が無い。§9 の「機能追加時は §8 更新」DoD が #1171 で回っていない
- §8 — Tier 個数（7 / 11 / 6）と tier-2 側の「12」の二重管理。個数を落とし列挙のみ残す
- §5 — 「起動導線は生成デザイン確定後に再設計」は `2026-08-29-claude-launcher-desktop.md`（Draft）起票済みの現況より古い

### Low

- §7.0 — role-pm / role-engineer / role-qa と lead-pipeline 等は dotfiles 側にしか無い（symlink 0 本なので不変式自体は維持）。「プロジェクト固有 = repo 内、共通ハーネス = dotfiles」と書き分け
- §3.2 — セクション追加は registry + `web/src/sectionDescriptors.tsx` の 2 箇所（後者への言及なし）
- §3.2 — section state は `useShellNavigation` へ抽出済み（実質同義）
- §8 — Tier 3 に出荷済み Analytics が同居（「出荷済み・成熟待ち」の 1 語推奨）
- §3.1 — 「`invoke()` 等」が Tauri 語彙のまま（一般化推奨）

### 問題なしと確認できた節（再監査不要）

参照リンク 34 パス全実在 / §1 Vision / §2 の挙動面（Capacitor 薄殻・ShortcutConfig 省略・Audio 非ゲート・Ambient のみ省略・撤去 3 Provider の grep 0）/ §3.1 DataService 境界 / §3.3 2 行分割 / §3.2 registry SSOT / §4 ID 不変式・5 role check 制約 / §5 MCP catalog 導線 / §7.1 CI ゲート構成（TS 版数の 1 行を除く）/ §7.2 P-001 機械担保 / §7.3 PreToolUse 3 hook / §7.4 / §9 派生 INDEX 非追跡・トークン参照

## Part 2 — `.claude/` docs 棚卸し

### plans/ 全 19 本の Status 一覧

| ファイル                                                   | Status                  | 判定                                                                                                                       |
| ---------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `_TEMPLATE.md`                                             | Draft                   | OK                                                                                                                         |
| `2026-05-23-cleanup-and-consolidation-deletion-targets.md` | REFERENCE               | 要処置（archive 移動 — 親は archive 済・実削除 2026-07-11 完了）                                                           |
| `2026-05-24-multi-chat-worktree-policy.md`                 | ACTIVE (adopted policy) | OK                                                                                                                         |
| `2026-05-26-autonomous-dev-routine.md`                     | BLOCKED                 | 要処置 **high**（ブロッカー「Cloud 登録 trig_PENDING」は台帳退役で失効。現行ブロッカー = Task Scheduler 未登録へ差し替え） |
| `2026-06-19-step1-desktop-daily-driver.md`                 | IN PROGRESS             | 要処置（DEFERRED 化 + 後継 = `2026-08-30-desktop-app-packaging.md` 参照）                                                  |
| `2026-07-15-briefing-loop.md`                              | ACTIVE (adopted policy) | OK                                                                                                                         |
| `2026-07-16-briefing-headless-claude-prototype.md`         | REFERENCE               | low（内容は技術検証記録 — `docs/reports/` 移動も可）                                                                       |
| `2026-07-28-loop-engineering-harness.md`                   | IN PROGRESS             | 要処置 **high**（「D-20260804-main-1 未回答のため」が虚偽 — 2026-08-11 に A 回答済・未実装が正）                           |
| `2026-08-04-context-cost-reduction-harness.md`             | IN PROGRESS             | 要処置（自ら「移行完了まで着手不可」→ DEFERRED へ）                                                                        |
| `2026-08-04-loop-catalog.md` / `-implementation.md`        | IN PROGRESS             | low（親子で Status 文重複・「4 本」は実体 5 本で非複製原則違反・試験運用 0 件のまま）                                      |
| `2026-08-06-autonomous-operation-endpoint.md`              | IN PROGRESS             | 要処置（3 週停止 → BLOCKED 化 + 依存 = D-20260804-main-1 実装を明記）                                                      |
| `2026-08-07-web-mobile-public-url.md`                      | IN PROGRESS             | 要処置（公開は 2026-08-09 完了・#600 CLOSED。残 2 項目を Issue 化して COMPLETED + archive）                                |
| `2026-08-09-record-graph-layer.md`                         | IN PROGRESS             | 要処置 **high**（「D-20260809-main-2 回答待ち」が虚偽 — 2026-08-11 に A 回答済。`archive/INDEX.md` 生成は未実装のまま）    |
| `2026-08-10-core-refactor.md`                              | Draft                   | 要処置 **high**（C1〜C9 全 CLOSED・残は C10 #677 と #898 のみ。実態化 + C10 分離）                                         |
| `2026-08-29-ai-integration-visibility.md`                  | IN PROGRESS             | 要処置 **high**（#1210 CLOSED 2026-08-30 → COMPLETED + archive）                                                           |
| `2026-08-29-claude-launcher-desktop.md`                    | Draft                   | OK                                                                                                                         |
| `2026-08-29-schedule-todo-tab-retirement.md`               | IN PROGRESS             | 要処置 **high**（#1153 CLOSED・Worklog「実装完了」→ COMPLETED + archive）                                                  |
| `2026-08-30-desktop-app-packaging.md`                      | Draft                   | OK                                                                                                                         |

### requirements/

- **high**: `tier-2-supporting.md:185` — 「再利用可能な部品として `Backlinks/BacklinkView.tsx` と `itemLinks.ts` が残っている」→ **両方 #1239 で削除済み**（実在しないファイルの断言）。CLAUDE.md high #2 と同根
- medium: Connect = Tag hub（#1171・live section）の Feature 節が tier-2 に無い / `tier-1-core.md` の `IPC Commands:` 行 4 箇所は冒頭注記の対象外に読める（注記の対象を明記するだけで可）
- low: tier-1 Database の Status に「凍結」語なし / tier-3 Paper Boards の Owner が退役 Connect 配下パス
- 問題なし: Terminal / File Explorer / 力学グラフ / Analytics の退役・凍結注記、`mobile-scope.md` の #1290 追随（3 箇所反映済み）

### vision/

- **high**: `core.md` — 冒頭に反転注記はあるが、本文 §1（SQLite ローカル SSOT）/ L82（rusqlite + Tauri 2.0 + D1）/ §5 Platform（Tauri 2.0）が 3.5 か月無修正。§5 の Provider 列挙も撤去済み Provider（ScreenLock / FileExplorer / CalendarTags）を現行として列挙
- medium: `coding-principles.md:76` 「`frontend/` は FROZEN」（同ファイル L10 は削除済みと記載 = 自己矛盾）
- 問題なし: `db-conventions.md` / `claude-md-layering.md`（リンク切れ 0）

### skills/ + agents/

- **high**: STALE 5 本（add-component / add-feature / add-ipc-channel / db-migration / test-writing）が裁定（D-20260810-main-3 = A）から 19 日間 0 コミット
- **high**: `frontend-react-designer/SKILL.md:16-17` が STALE 4 本へ「生きた導線」を張る（起動禁止スキルへ誘導）。references/motion.md の keyframes 出典も削除済み `frontend/src/index.css`
- medium: `agents/life-editor-migration-validator.md:28` が STALE の db-migration を現役参照
- 問題なし: 他 skills 横断 grep で退役機構前提は検出されず / agents 2 本は退役注記済み

## 推奨処置（3 束 + 判断 1 件）

1. **束 A（機械的・1 PR）**: 完了済み plans 2 本 + REFERENCE 1 本を archive へ / `2026-08-10-core-refactor.md` ほか Status 行の実態化（計 11 本）
2. **束 B（事実誤り訂正・1〜2 PR）**: CLAUDE.md high 7 件 + tier-2 の Backlinks 記述 + core.md の行内注記 + frontend-react-designer の導線差し替え + rules/frontend.md の AppProviders 追随
3. **束 C（ユーザー判断）**: 回答済み未実装の 2 裁定（D-20260804-main-1 = Task Scheduler 登録 / D-20260810-main-3 = STALE 5 本書き直し）を「今やる / Issue 化して積む / 裁定を取り下げる」のどれにするか
4. 副次発見: `supabase/migrations/0026_drop_calendars.sql`（#1304 merge 済み）が **push 待ち** — リモートに `calendars` が残存。次回 `cd supabase && npm run db:push` で適用される

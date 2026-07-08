---
Status: IN_PROGRESS
Created: 2026-07-08
Branch: claude/app-integration
Owner-chat: app-integration
Parent: .claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md
---

# Plan: App Integration — 9 画面骨格の一体化（Section SSOT + legacy 撤去 + rightSidebar 整合）

> design fan-out（Parent 計画）の後続。IA.md 末尾の「実装の再編（MainScreen.tsx のセクション再構成・SectionId 整理）は生成デザイン確定後の別計画」= 本計画。

---

## Context

- **動機**: design fan-out の 9 オーダー（shell / schedule / materials / connect / work / analytics / settings / auth / trash）が全て main に merge 済み（#160〜#175）。各画面は実データ（DataService / providers）で配線済みだが、「個別 merge の集合」の状態であり、一つのアプリケーションとしての継ぎ目（セクション定義の二重管理・旧画面の残骸・rightSidebar の空パネル・横断導線の欠け）が残っている。これを解消して統合を完了させる。
- **現状の実測**（2026-07-08 調査 + role-qa 検証済み・main = `8a08364b` #175 直後。行番号は同 commit 基準）:
  1. **Section 定義の二重管理**: `shared/src/types/taskTree.ts:1-8` の `SectionId` が旧定義のまま（`terminal` 残存・`trash` 欠落）。**`SectionId` の実消費者は FROZEN `frontend/` のみ**で、web / shared は import していない。web は `web/src/MainScreen.tsx:94` に独自 `Section` 型を持ち、`NAV_MAIN`(:106) / `NAV_UTILITY`(:113) / `MOBILE_ORDER`(:117) / `ALL_SECTIONS`(:126) / `SECTION_ICON`(:142) の 5 リストが手動並走している。**本 Step の実目的は「型の書き換え」ではなく「shared に section registry を新設し、web がそれを import して 5 リストを導出する」こと**（型だけ直しても統合は進まない）
  2. **死んだ旧画面・旧部品**: web 5 ファイル（`web/src/TasksScreen.tsx`・`web/src/tasks/TaskTreeView.tsx`・`web/src/schedule/ScheduleView.tsx`・`ScheduleCalendarView.tsx`・`ScheduleItemsView.tsx`）と shared 3 部品（`Sidebar.tsx`・`Sheet.tsx`・`TaskDetailModal.tsx`）が実行経路から未参照。ただし **`Sheet` / `Sidebar` は `shared/tests/components.test.tsx:14-16`（複数行 barrel import）+ `:353-414`（describe ブロック 2 本）が参照** — 削除時は同テストの該当 describe 除去が必須。行単位 grep では複数行 import を取りこぼすので、参照確認はシンボル名の全文検索で行う。web 5 ファイルと `TaskDetailModal` は参照ゼロ（テスト含む）
  3. **rightSidebar の空パネル**: トグルは全セクションに出る（`MainScreen.tsx:321` sectionToolbar）が、Analytics / Trash の画面は `RightSidebarPortal` に中身を供給していない = トグルを押すと空パネル。**Connect は shell トグル + `ConnectGraphView.tsx:486` の portal 供給という標準形で正しく動作しており、手本**（KanbanView / WorkScreen 等と同一パターン。「二重経路」ではない — 2026-07-08 QA 訂正）
  4. **横断導線の欠け**: shell レベル new-task（`MainScreen.tsx:194` handleNewTask）は Materials/Tasks への遷移のみで create-and-focus 未配線 / Materials タブの件数バッジ未使用（HeaderTabs のバッジ機能は実装済み）/ undo・redo ショートカット未配線（`MainScreen.tsx:472` コメント）
- **制約**: 完成まで $0 厳守 / 9 impl レーンは全 merge 済みで競合レーンなし（役目を終えた worktree の prune はユーザー実行・本計画のスコープ外）
- **Non-goals**: デザイン再生成・brief 改訂 / 新機能の追加 / FROZEN `frontend/` への変更（`SectionId` 改訂で frontend 側に型不整合が残るのは許容 — Phase 5 で破棄予定。判断を Worklog に記録）/ DB・DDL 変更 / Electron・Capacitor 実機検証（merge 後の別ゲート）

---

## Scope (Touchable Paths)

```
shared/src/types/**
shared/src/**                 # section registry 新設・barrel 整理・旧部品削除。Analytics/** は #175 直後につき挙動変更しない
shared/src/i18n/locales/**
shared/tests/**
web/src/**
.claude/CLAUDE.md             # §3.2 SectionId 記述の同期（§2/§5/§8 に terminal 言及があれば同時）
docs/requirements/tier-1-core.md  # Terminal 記述の整理（IA.md:63 の申し送り）
.claude/docs/vision/plans/2026-07-08-app-integration.md
```

スコープ外の変更が必要になった場合は、計画書を更新してから手を付ける（更新せず広げない）。

---

## Steps

| #   | Step                                                                                                                                                                                                                            | Gate    | Acceptance                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Section SSOT 統一** — shared に section registry を新設（順序・アイコン・ラベル・utility 区分・mobile 4+More 順の SSOT）し、**web がそれを import** して MainScreen の 5 リストを導出に置換。`SectionId` は registry 派生の 7 種（terminal 除去・trash 追加）へ改訂。`MainScreen.tsx:92-93` の terminal コメント残骸と i18n の terminal ブロック（`en.json:1983-2040, :2639` 相当・ja 同様）も掃除 | 🤖 自律 | AC #3・#4（リテラル配列消滅）/ build 緑                                                                            |
| 2   | **legacy 撤去** — 死画面 5 + 旧 shared 部品 3 を削除し、`components/index.ts` barrel と **`shared/tests/components.test.tsx` の `Sheet` / `Sidebar` describe ブロック**から除去                                                     | 🤖 自律 | 8 ファイルが `git ls-files` に不在 / シンボル名の全文検索（複数行 import 対応）で参照 0 / shared test 緑            |
| 3   | **rightSidebar 整合** — Analytics / Trash に `ConnectGraphView.tsx:486` と同じ `RightSidebarPortal` 供給パターンで中身を実装（最小 = セクション文脈の詳細パネル）するか、トグルを画面単位で非表示化。**Connect は現状維持（手本・触らない）** | 🤖 自律 | 全セクションでトグル押下時に空パネルが出ない（テストで担保）                                                          |
| 4   | **横断導線** — new-task の create-and-focus 配線 / Materials タブ件数バッジ / undo・redo の扱い決定（配線するか、明示的にスコープ外化して Worklog に判断記録）                                                                       | 🤖 自律 | 実装分は vitest 緑 / 見送り分は Worklog に理由付きで記録                                                            |
| 5   | **ドキュメント同期** — CLAUDE.md §3.2（および §2/§5/§8 の terminal 言及）と `docs/requirements/tier-1-core.md` を SectionId 改訂に同期（コードと同一 PR ルール・IA.md:63 の申し送り回収）。Issue #146 を本 PR で閉じられるか確認し、可能なら Fixes 行に含める | 🤖 自律 | CLAUDE.md §3.2 が新 SectionId と一致 / `gh issue view 146` 確認記録                                                 |
| 6   | **統合検証** — shared build+test / web build / i18n 両 catalog / hex 検査 / golden path（全 7 セクション巡回 + 主要 CRUD 1 周）                                                                                                     | 🤖 + 👀 | 下記 AC 全緑 + ユーザーが画面で 1 周                                                                                |
| 7   | **draft PR (#176) Ready 化 → merge**                                                                                                                                                                                              | 🛑 人手 | PR レビュー & merge ボタン                                                                                          |

- Step 1 と 2 は独立(並行可)。Step 3 は Step 1 の後を推奨(sectionToolbar の per-section 化に registry を使うため)。Step 5 は Step 1 の後
- 重さの采配は lead-pipeline のティア判定に従う(本計画 = 重: role-pm 済み扱い → engineer → verifier → qa)

---

## Files（主要な影響ファイル）

| File                                                        | Operation   | Notes                                                                            |
| ----------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `shared/src/sections.ts`（新設・名称は実装時判断）          | Create      | nav 順序・アイコン・ラベル・utility 区分・mobile 順の SSOT。web が import する    |
| `shared/src/types/taskTree.ts`                              | Edit        | `SectionId` 7 種へ（terminal→削除・trash→追加。registry 派生にできればなお良い） |
| `web/src/MainScreen.tsx`                                    | Edit        | 5 リストを registry 導出へ / sectionToolbar per-section 化 / :92-93 コメント掃除 |
| `web/src/TasksScreen.tsx` ほか死画面 5 ファイル             | Delete      | 参照ゼロ（テスト含む・2026-07-08 QA 検証済み）                                    |
| `shared/src/components/{Sidebar,Sheet,TaskDetailModal}.tsx` | Delete      | `components/index.ts` barrel からも除去                                           |
| `shared/tests/components.test.tsx`                          | Edit        | **`Sheet` / `Sidebar` の import + describe ブロック除去**（削除とセットで必須）  |
| `web/src/analytics/AnalyticsScreen.tsx`                     | Edit        | RightSidebarPortal 中身 or トグル抑止（Connect パターンを手本に）                 |
| `web/src/trash/TrashScreen.tsx`                             | Edit        | 同上                                                                              |
| `shared/src/i18n/locales/{en,ja}.json`                      | Edit        | 新規文字列は両 catalog 必須 / terminal 残骸ブロックの削除                         |
| `shared/tests/**`                                           | Create/Edit | registry・toolbar・空パネル解消のテスト                                           |
| `.claude/CLAUDE.md`                                         | Edit        | §3.2（+ terminal 言及箇所）を新 SectionId に同期                                  |
| `docs/requirements/tier-1-core.md`                          | Edit        | Terminal 記述の整理（履歴として保持しつつ現状を訂正）                             |

（`web/src/connect/ConnectScreen.tsx` は**変更なし想定** — 標準形の手本。挙動確認のみ）

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build && npm run test` exit 0（`components.test.tsx` の更新を含む）
- [ ] `cd web && npm run build` exit 0
- [ ] `grep -rn '"terminal"' shared/src/ web/src/` = 0（**新設 registry を含む** shared/src 全体 + web。型・nav・i18n からの terminal 消滅）
- [ ] `grep -En "const (NAV_MAIN|NAV_UTILITY|MOBILE_ORDER|ALL_SECTIONS|SECTION_ICON)" web/src/MainScreen.tsx` = 0（5 リストの手動並走が registry 導出に置換されている）
- [ ] 死ファイル 8 つが `git ls-files` に存在しない
- [ ] RightSidebarToggle が表示される全セクションに portal 供給元がある（Analytics / Trash の空パネル解消をテストで担保）
- [ ] 新規・変更 UI 文字列が en / ja 両 catalog に存在する
- [ ] 新規・変更ファイルに hex カラー直書き 0（`grep -rE "#[0-9a-fA-F]{3,8}"` を実行し、**PR/Issue 参照（`#146` 等の #数字）は除外して判定**。canvas fallback の `graph-theme.ts` 既存分・tokens.css は対象外）
- [ ] PR diff ±1500 行以内目安（超過見込みならステップ単位で分割 PR）

---

## Risks / Known Issues 参照

- **SectionId 改訂は web / shared のビルドでは検証されない**: 実消費者が FROZEN `frontend/` のみで、web / shared の tsconfig は frontend を型検査しない。frontend 側に残る型不整合は Phase 5 破棄前提で許容（Non-goals 参照）。「型だけ直して AC を通す」罠を避けるため、統合の実体は AC #4（リテラル配列消滅）で担保する
- **単一書込者の引き継ぎ**: 本レーンが `web/src/MainScreen.tsx` とシェル部品の新オーナー（fan-out 時代の shell-impl から引き継ぎ）。9 impl レーン全 merge 済みで競合レーンなし。docs-issue-cleanup レーンは docs のみで非競合
- **Issue #146（terminal 退役）との重複**: Step 1 / 5 が残コード整理と重なる。着手時に `gh issue view 146` で重複作業がないか確認し、本 PR で閉じられるなら PR 本文の Fixes 行に含める
- **worktree は node_modules 非共有**: 最初に `shared/` と `web/` で `npm install`。`.env` 欠落 build での supabase 誤 tree-shake に注意（memory `worktree-supabase-treeshake`・known-issue 参照）
- **commit 誤着地防止**: commit 直前に `git rev-parse --abbrev-ref HEAD` = `claude/app-integration` を確認（memory `shared_worktree_branch_crosswire`）

---

## References

- vision: `.claude/docs/design/IA.md`（目標構成の SSOT。「実装の再編は別計画」= 本計画。:63 に doc 整理の申し送り）
- Parent: `.claude/docs/vision/plans/2026-07-05-design-implementation-fanout.md`
- 規約: `.claude/rules/frontend.md` / `.claude/docs/design/briefs/_COMMON-CONTEXT.md`
- related skills: `frontend-react-designer`, `add-component`, `test-writing`

---

## Worklog

- 2026-07-08: 計画作成（chat-main が調査 → 起案。実装は app-integration レーン）。現状実測は Context 記載のとおり（main = `8a08364b`・#175 直後時点）。
- 2026-07-08: role-qa アドバーサリアルレビュー（NEEDS-CHANGES）を反映 — ①`Sheet`/`Sidebar` のテスト参照（`components.test.tsx`）を削除手順に組込み ②SectionId の実消費が FROZEN frontend のみである事実と registry 化の実目的を明記・AC #4 追加 ③terminal grep のスコープを shared/src 全体へ拡大 ④CLAUDE.md / tier-1-core.md 同期を Step 5 として追加 ⑤Connect「二重経路」は誤読と訂正（標準形の手本・現状維持）⑥hex 検査の Issue 参照 false positive 注記 ⑦i18n の terminal 残骸掃除を Step 1 に追加。

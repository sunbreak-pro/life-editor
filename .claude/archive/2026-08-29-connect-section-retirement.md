---
Status: COMPLETED # 2026-08-29 起案・同日実装・PR #1175 merged / Issue #1152 CLOSED
Created: 2026-08-29
Branch: claude/connect-1152-retire-section
Owner-chat: connect-refine
---

# Plan: Connect セクションを力学グラフごと退役する（タグ / バックリンク / 検索は温存）

> 対応 Issue: #1152（`section:connect` / `type:task` / `sev:important` / `area:structural`）

---

## Context

- **動機**: 力学グラフは「記録の取り出し口」として検索・タグ・バックリンクと重複しており、shared 3,903 行 + web host 177 行の維持費に見合わない。関係の発見は Claude + MCP 検索が担う設計思想（2026-08-27 ユーザー確定）。**可視化（見せ方）だけを退役し、データと取り出し口は全部残す**
- **制約**: 退役は「セクションを消す」だけでは終わらない。`SectionId` registry から nav / mobile bottom bar / コマンドパレット / lazy chunk / i18n が派生しているため、1 行消すと 6 系統に波及する。旧 `terminal` 退役（#146）と同じ手順を踏む
- **Non-goals**:
  - `wiki_tags` / `wiki_tag_assignments` / `wiki_tag_connections` の DB・DataService には**一切触らない**（DDL 変更ゼロ）
  - Notes の `LinkPanel`（リンク追加・削除・バックリンク一覧）・inline リンク sync・コマンドパレット検索・MCP `search_by_tag` / `search_all` の挙動を変えない
  - d3 依存パッケージの削除（後述の「スコープ外に出したもの」）

---

## 実測（着手前に確認した事実）

計画の前提が実物と食い違っていた点があるため、判断の根拠として残す。

1. **`BacklinkView` と `backlinkSourceIds` / `resolveLinkId` の現行の呼び出し元は Connect 内部だけ**。Issue 本文と依頼文はいずれも「LinkPanel が使用」としているが、実測では `web/src/wikitag/LinkPanel.tsx` は `useWikiTagsUnifiedContext().getLinksForItem()` から双方向リンクを自前で読んでおり、3 つのいずれも import していない（`LinkPanel.tsx:52` は「Connect の BacklinkView と同じ icon + count の見せ方にした」という**設計の参照コメント**）。したがって Connect を丸ごと消しても LinkPanel は壊れない
2. それでも**依頼どおり救出する**（削除しない）。理由は下の代替案表 A-2 を参照。救出後は「呼び出し元ゼロの再利用可能部品」になるため、その事実を PR 本文と `comm/decisions/` に明記し、削除するかどうかの判断はユーザーへ回す
3. `backlinkSourceIds` / `resolveLinkId` は `WikiTagConnection` 型にしか依存しておらず、グラフ層と結合していない（そのまま `utils/` へ移せる）
4. `BacklinkView` は `graph/graph-types` の `GraphNode` / `GraphNodeType` に依存する。この 2 型はグラフエンジンごと消えるので、移設先に**必要最小の 2 型を再定義**する（`id` / `label` / `type` の 3 フィールドしか読んでいない）
5. `SidebarNavSection.id` は `string` なので、`shared/tests/appShell.test.tsx` / `sidebarNav.test.tsx` の `"connect"` は**汎用コンポーネントのフィクスチャ**であり型エラーにならない。逆に `persistLastSection(id: SectionId)` を呼ぶ `useStartupSection.test.ts` は `typecheck:tests` で落ちる

---

## 検討した代替案（必須）

| 案                                                                        | 採否 | 却下理由                                                                                                    | 復活条件                                                       |
| ------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A-1 セクション + グラフ一式を削除し、backlink 部品は非 Connect 配下へ移設 | ✓    | —                                                                                                           | —                                                              |
| A-2 backlink 部品も一緒に削除（実測 1 のとおり呼び出し元ゼロ）            | ✗    | ユーザー依頼と Issue の両方が明示的に「移設」を指定している。削除は不可逆で、復元コストは移設コストより高い | ユーザーが「呼び出し元ゼロなら消してよい」と回答したら別 PR で |
| A-3 セクションを nav から隠すだけでコードは残す（feature flag 退役）      | ✗    | 維持費（3,903 行 + d3 4 パッケージ）を落とすのが Issue の目的そのもので、隠しても費用は残る                 | グラフを再導入する決定が出たら                                 |
| A-4 グラフだけ消して Connect セクションは backlink 一覧の器として残す     | ✗    | backlink 一覧は Notes の LinkPanel が既に担っており、セクションを 1 つ残すと IA に重複が残る                | LinkPanel が担えない横断バックリンク要求が出たら               |

---

## Scope (Touchable Paths)

```
shared/src/sections.ts
shared/src/components/Connect/**            (削除)
shared/src/components/Backlinks/**          (新規 — 救出先)
shared/src/components/index.ts
shared/src/utils/itemLinks.ts               (新規 — 救出先)
shared/src/utils/resetPreferences.ts        (doc コメントのみ)
shared/src/utils/analyticsAggregation.ts    (doc コメントのみ)
shared/src/services/SupabaseWikiTagsUnifiedService.ts (doc コメントのみ)
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
shared/tests/**                             (connect / graph 系の削除 + 移設)
web/src/connect/**                          (削除)
web/src/lazySections.ts
web/src/sectionDescriptors.tsx
web/src/MainScreen.tsx                      (コメントのみ)
web/src/notes/useItemLinkTargets.ts         (コメントのみ)
web/src/wikitag/LinkPanel.tsx               (コメントのみ)
web/tests/lazySectionChunks.test.ts
.claude/CLAUDE.md
.claude/rules/frontend.md
.claude/docs/requirements/mobile-scope.md
.claude/docs/requirements/tier-2-supporting.md
.claude/docs/design/IA.md                   (退役注記のみ)
.claude/docs/design/briefs/connect.md       (退役注記のみ)
.claude/docs/vision/plans/2026-08-29-connect-section-retirement.md
```

### スコープ外に出したもの（P-008 — 実装せずキューへ）

- **`shared/package.json` / `web/package.json` の d3 依存 4 本 + 型定義 4 本の削除**。本 PR 後は未使用になるが、Issue の Scope 宣言に package.json が無く、lockfile 再生成まで含むと差分の性格が変わる。`comm/outbox/` に follow-up Issue の起票依頼を出す
- `docs/reports/` 配下の Connect 記述。**当時の実測記録**であり現況を語る文書ではないため書き換えない（`../rules/docs-consistency.md` の歴史注記の扱いに従う）

---

## Steps

| #   | Step                                                                                                    | Gate    | Acceptance                                  |
| --- | ------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------- |
| 1   | 救出: `BacklinkView` を `components/Backlinks/` へ、helper 2 本を `utils/itemLinks.ts` へ、テストも移設 | 🤖 自律 | 移設先テストが緑（`itemLinks.test.ts`）     |
| 2   | 削除: `components/Connect/` 一式 + `web/src/connect/` + グラフ系テスト 8 本                             | 🤖 自律 | グラフ実体シンボルの grep が 0 件           |
| 3   | registry / host 配線: `sections.ts` / `components/index.ts` / `sectionDescriptors` / `lazySections`     | 🤖 自律 | `SECTION_IDS` から `connect` が消える       |
| 4   | テスト追随: `sections.test.ts` / `lazySectionChunks.test.ts` / `useStartupSection` / `resetPreferences` | 🤖 自律 | shared / web の vitest 緑                   |
| 5   | i18n: `connect.*` ブロックと `section.connect` を削除、backlink 文言 2 本を `backlinks.*` へ移設        | 🤖 自律 | en / ja のキー構造が一致・i18n キーテスト緑 |
| 6   | docs 追随: CLAUDE.md §8 / `rules/frontend.md` / `mobile-scope.md` #13 / `tier-2-supporting.md`          | 🤖 自律 | `bash scripts/docs-lint.sh` exit 0          |
| 7   | CI verify 15 ステップ + docs-lint をローカルで全通し                                                    | 🤖 自律 | 全ステップ exit 0                           |
| 8   | PR 作成（#1152 参照）                                                                                   | 🤖 自律 | PR open                                     |
| 9   | PR merge                                                                                                | 🛑 人手 | ユーザーの merge ボタン（P-001）            |

### Gate 凡例

- **🤖 自律** — Claude が完結。応答前に型検査 / テストを回して検証する
- **🛑 人手** — ユーザー操作必須（PR merge）

---

## Acceptance Criteria (機械検証可能)

- [ ] `SECTION_IDS` から `connect` が消え、sidebar / mobile bottom bar / コマンドパレットに Connect が出ない（`shared/tests/sections.test.ts` が新しい 7 セクションを pin）
- [ ] グラフ実体シンボル（simulation / canvas / graph view）の grep が shared / web で 0 件
- [ ] `components/Connect` へのパス参照が shared / web で 0 件
- [ ] `BacklinkView` / `backlinkSourceIds` / `resolveLinkId` が非 Connect 配下に存在し、移設テストが緑
- [ ] Notes の LinkPanel 系テストが無改変で緑（web の vitest）
- [ ] i18n の en / ja に `connect` トップレベルキーと `section.connect` が存在しない
- [ ] CI `verify` ジョブ全 15 ステップをローカルで再現して exit 0（shared: lint / build / typecheck:tests / test → web: lint / build / typecheck:tests / test → desktop: typecheck / test / build → mcp-server: build / typecheck:tests / test）
- [ ] `bash scripts/docs-lint.sh` exit 0（ローカルは `LC_ALL=C` 付き）
- [ ] 完了・退役時: CLAUDE.md §8 と `mobile-scope.md` #13 に退役注記を入れた

---

## DB Migration Notes

DDL なし。`wiki_tag_connections` を含むテーブルは一切変更しない。

---

## Risks / Known Issues 参照

- **最大のリスク = 救出漏れ**。Connect 配下には LinkPanel と同名概念の部品が複数あるため、削除前に grep で呼び出し元ゼロを確認してから消す（実測 1 の手順）
- `web/tests/lazySectionChunks.test.ts` は「lazy のまま静的 import されていないこと」を守る番人。エントリを消すだけで、残る 2 本の守りは緩めない
- docs-lint (a) の相対リンク検査に引っかかるため、退役注記から消えたファイルへリンクしない
- `LC_ALL=C` 無しで `scripts/docs-lint.sh` を回すと日本語 Status 行が偽陽性になる（`../CLAUDE.md` §7.1）

---

## References

- Issue: #1152
- 先例: 旧 `terminal` セクション退役（#146・D-20260705-main-1 → `../CLAUDE.md` §3.2 / §8）
- 温存対象の正本: `../docs/requirements/tier-2-supporting.md`（WikiTags）・`../docs/requirements/mobile-scope.md`

---

## Worklog

- 2026-08-29: 着手前調査で「LinkPanel が backlink 部品を使用」という Issue の前提が実物と異なることを確認（実測 1）。依頼どおり移設で進め、削除可否はユーザー判断へ回す
- 2026-08-30: PR #1175 merged / Issue #1152 CLOSED を確認し archive へ移動。移動に伴い本文の相対パスを `.claude/archive/` 基準へ貼り替えた（`../CLAUDE.md` / `../rules/…` / `../docs/requirements/…`）
- 2026-08-30: **乖離レビュー**（archive 前の必須 3 行。実施は #1171 セッションで、根拠は本計画の Worklog・`history/chat-connect-refine.md` の 2026-08-29 エントリ・`comm/` の記録）
  1. **スコープ逸脱**: あり。`docs/design/IA.md` と `docs/design/briefs/connect.md` を sweep 中に Scope へ追加した（下の 2026-08-29 の行が理由）。どちらも決定本文は書き換えず注記のみ
  2. **AC 免除**: なし。Acceptance Criteria は全項目を満たして PR を出した
  3. **途中で出た判断の行き先**: d3 依存 8 本の削除 → `comm/outbox/chat-connect-refine.md` の起票依頼（P-008）/ 呼び出し元ゼロになった backlink 部品 3 つの保持可否 → 判断キュー `D-20260829-connect-1`（**2026-08-30 時点で未回答**・放置時＝保持）。破棄した指摘は無し
- 2026-08-29: docs sweep 中に Scope を 2 本追加した（当初は「記録なので触らない」に分類していた）。`docs/design/IA.md` は `Status: APPROVED` の**現況を語る SSOT** で「本流 5 = … Connect …」と書いており、放置すると後続セッションが Connect を再追加しかねないため退役注記を入れた。`docs/design/briefs/connect.md` は退役済み画面のデザイン投入先に見えるため冒頭に警告を 1 段落。どちらも**決定本文は書き換えず注記のみ**（`rules/docs-consistency.md` §2 の歴史注記の作法）

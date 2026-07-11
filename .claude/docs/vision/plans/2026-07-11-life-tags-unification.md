---
Status: Draft # 方向は 2026-07-11 ユーザー確定済み。詳細設計と着手は layout standard v2 の共通部品 merge 後
Created: 2026-07-11
Branch: TBD # 着手時に実装レーンとあわせて決定
Owner-chat: TBD
Parent: (なし — 兄弟計画: 2026-07-11-layout-standard-v2.md)
---

# Plan: life-tags 統一 — folder 概念の廃止と WikiTag 基盤への一本化

> **本計画が要件 6（2026-07-11 ユーザー提示）の方向の正本**。詳細設計（UI モック・移行規則・対象コード実測）は Step 2 で本計画に追記する。

---

## Context

- **動機**: Tasks / Notes / Daily は現在「フォルダ・タグ・ステータス」の 3 系統で整理されており、画面ごとに使える手段が違う。全セクション共通の一つの整理概念 **life-tags** に統一し、フォルダのような整理・まとめは「タグ + フィルタリング」で実現する。階層は作らず**一階層 + フィルタで自由度を高める**方針に切り替える（多階層フォルダはシンプルさと操作性を損なうため廃止）
- **2026-07-11 ユーザー決定（AskUserQuestion で確定）**:
  1. **実体 = 既存 WikiTag 基盤を拡張して一本化**（`wiki_tags` / assignments / groups / connections・`items_meta` 全 role 対応）。新規タグシステムは作らない — 2 系統併存の二重管理を避ける
  2. **folder は「folder ノードだけ」廃止**。タスク同士の親子（サブタスク）は存続する
  3. **status（未着手 / 進行中 / 完了）は独立軸のまま残す**。整理 = タグ、進捗 = ステータスの役割分担。カンバンの status ビュー・完了処理は不変
  4. **着手は layout standard v2 の後**（計画は先行作成・実装は v2 共通部品 merge 後）
- **制約**: コスト $0 / DataService 境界（§3.1）/ 2 行分割 sync モデル・wiki 系テーブル規約 = `docs/vision/db-conventions.md` / DDL はローカルファイル先行 → ユーザー `supabase db push`
- **Non-goals**: status のタグ統合（運用が定着してから再検討）/ タグの階層化（一階層原則）/ 汎用 Database（凍結中）への適用 / Routine 専用タグ UI（CLAUDE.md §4 — Routine には持たせない）

---

## 設計方針（方向の正本 — 詳細は Step 2 で追記）

### 名称と実体

- UI 表示名 = **"Life Tags"**（仮 — i18n catalog 追加時に en/ja を確定）
- **DB テーブルは改名しない**（`wiki_tags` のまま — migration / sync リスク回避）。型・Provider 名（WikiTag → LifeTag 等）の段階的リネームは実装判断（やるなら改名 sweep = `rules/docs-consistency.md` §2 必須）

### folder → life-tag の移行

- 対象 = Tasks / Notes の `type:"folder"` ノード（folder はデータモデル上、独立テーブルではなくノード種別）
- 各 folder を**同名の life-tag に変換**し、直下のアイテムへ assignment を付与。folder の色は tag の色へ継承
- 多階層 folder の平坦化規則（直近 folder 名のみ付与 or 祖先 folder 名も併付与）は**未定** — 移行スクリプト設計時に実データの階層深度を実測して確定
- folder ノード自体は変換後**ソフトデリート**（復元可能性を残す。hard delete しない）

### UI 波及

- **Kanban**: folder ビュー廃止 → **tag ビューが後継**（view 切替 enum から folder を除去・永続化済み view 設定の migration を忘れない）。status ビューは存続
- **Notes / Daily**: フォルダツリー → タグフィルタ + タググルーピング（タグをフォルダのように見せる UI/UX — 一覧のグループ見出し・サイドリスト等。詳細設計で確定）
- **全セクション共通のタグフィルタ UI**: 配置（ヘッダー or rightSidebar パネル）は**未定** — layout standard v2 の標準ヘッダー/パネル構造が確定してから決める

### データ移行

- 移行 migration + 変換スクリプト（folder rows → `wiki_tags` + assignments）。**実行 = 🛑 ユーザー**（実データの引っ越し）
- 実行前バックアップと検証クエリ（folder 数 = 変換された tag 数、直下アイテム数 = assignment 数）を移行スクリプトとセットで用意

---

## Scope (Touchable Paths) — 着手時に実測で確定

```
shared/src/types/**               ← taskTree（NodeType）/ wikiTagUnified
shared/src/components/Kanban/**   ← folder ビュー除去・tag ビュー強化
shared/src/components/**          ← タグフィルタ / グルーピング UI（新設分）
shared/src/services/**            ← Mapper / DataService の folder 経路整理
web/src/**                        ← 各セクションの adoption
supabase/migrations/*.sql         ← 移行 DDL・変換スクリプト
.claude/docs/vision/plans/2026-07-11-life-tags-unification.md
.claude/CLAUDE.md / docs/requirements/**  ← §4・§8・tier-1/2 の追随（同一 PR）
```

---

## Steps

| #   | Step                                                                                    | Gate    | Acceptance                                     |
| --- | --------------------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| 1   | 本計画 PR merge（方向の確定）                                                           | 🛑 人手 | PR merge                                       |
| 2   | 詳細設計を本計画に追記（UI モック・平坦化規則・対象コード面積と folder 実データの実測） | 🤖 自律 | 本計画更新 PR（Status → IN PROGRESS）          |
| 3   | epic Issue 起票 + 実装レーン決定（新 worktree or 既存レーン）                           | 🛑 人手 | Issue URL・Branch/Owner-chat を frontmatter に |
| 4   | 移行 migration / スクリプト → shared UI → 各セクション adoption                         | 🤖 + 🛑 | DDL push はユーザー / build・test pass         |
| 5   | データ移行実行 + 検証クエリ + 全画面確認                                                | 🛑 + 👀 | 検証クエリ一致 + ユーザー OK                   |

---

## Acceptance Criteria (機械検証可能 — 方向レベル。Step 2 で具体化)

- [ ] folder ビュー・folder ノード作成 UI がコードから消えている（`KanbanViewMode` に folder が無い等・grep で確認）
- [ ] 既存 folder が同名タグとして引き継がれている（検証クエリで folder 数 = tag 数・直下アイテム数 = assignment 数）
- [ ] タスクのサブタスク（task 親子）が回帰していない（既存 test green）
- [ ] status ビュー・完了処理が回帰していない（既存 test green）
- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] docs 追随: CLAUDE.md §4（ID 不変式の folder 表記）・§8 / requirements tier-1（Tasks / Notes）・tier-2（WikiTags）の sweep（`rules/docs-consistency.md` §2）
- [ ] 完了時: 本計画 Status → COMPLETED + `archive/` 移動 + per-chat memory 更新（DoD）

---

## DB Migration Notes

- ローカルファイル先行ルール（MANDATORY — `_TEMPLATE.md` 参照）。`apply_migration` MCP 単独使用禁止
- 変換は UPDATE/INSERT 系（DDL は最小）。ロールバック = folder ノードのソフトデリート復元 + 生成 tag/assignment の削除スクリプトを対で用意

---

## Risks / Known Issues 参照

- **移行の不可逆性**: 変換後に folder UI を消すため、移行規則の誤りは目視で気づきにくい → 検証クエリ + folder ソフトデリート保持で保険
- **WikiTag 改名の波及**: 型リネームをやる場合、skill-lib / agents-lib は git 管理外（memory `skill-lib-agents-lib-not-git`）— 改名 sweep の grep 対象に含めること
- **並行レーンとの競合**: Kanban / Notes は materials-refine の領分 — 実装レーン決定時（Step 3）に単一書込者を明確化

---

## References

- 実体コード: `shared/src/types/wikiTagUnified.ts` / `shared/src/types/taskTree.ts`（NodeType）/ `shared/src/components/Kanban/buildColumns.ts`
- DB 規約: `docs/vision/db-conventions.md` / requirements: `docs/requirements/tier-2-supporting.md`（WikiTags）
- 兄弟計画: [`2026-07-11-layout-standard-v2.md`](./2026-07-11-layout-standard-v2.md)

---

## Worklog

- 2026-07-11: 計画作成（chat-docs-workspace）。方向 4 点（WikiTag 拡張一本化 / folder ノードのみ廃止 / status 独立軸 / v2 後に着手）をユーザーと AskUserQuestion で確定

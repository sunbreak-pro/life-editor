---
Status: COMPLETED — 2026-05-31（PR #38 merged）／ 2026-05-30 着手・スコープ拡大（Tasks 統一）
Created: 2026-05-30
Branch: feat/notes-folder-dnd-ux（worktree `.claude/worktrees/du-g/`、main fa437ad = G4 込み 起点）
Owner-chat: du-g
Task: Notes/Tasks ツリーの DnD UX を Desktop(TaskTree) パターンに統一（フォルダ挿入の確実性 + 視覚フィードバック + 入れ子表示）
---

# Plan: Notes/Tasks Tree DnD UX 統一（TaskTree パターン）

## Context（なぜ）

ユーザー報告の段階的フィードバック:

1. 初期: Notes で Folder への DnD が「わかりづらい」「ほとんど成功しない」
2. 中盤: ドラッグ中に他の行が動く reflow が混乱の元 → **静止リスト + 薄い ghost** で改善（「かなり良くなった」）
3. 終盤: **フォルダの末尾にフォルダがあると、その下に項目を置けない**（兄弟として外に出せず中に入ってしまう）。「現在の Desktop の TaskTree のツリー構造を参考に」「Web 版 Tasks も同じ DnD ロジック + UI に」

### 根本原因と最終方針

- 当初の自作 `sibling-below`（最後の子の下端で縦ゾーン分割）は **最後の子がフォルダのケースを扱えず脆い**。
- Desktop `frontend/src/hooks/useTaskTreeDnd.ts` は **より素直**: フォルダ下端(>0.75/0.8) = `moveNode(active, folder, "below")` = **フォルダの兄弟として後ろに置く**。`expanded → inside` の特殊ケースは存在しない。これが「末尾フォルダの下に置けない」を構造的に解く。
- → **`sibling-below` を撤去し、TaskTree パターンへ統一**。Notes/Tasks 両方を同じロジック + 同じ見た目にする。

## Scope (Touchable Paths)

```
shared/src/utils/noteDropIntent.ts     # 純粋判定 above/below/inside（sibling-below 撤去、Notes/Tasks 共有）
shared/tests/noteDropIntent.test.ts    # 上記の境界テスト
web/src/components/TreeNodeIndent.tsx  # 新規: depth ガイドライン indent（Notes/Tasks 共有、TaskNodeIndent 踏襲）
web/src/components/treeCollision.ts    # 新規: 共有衝突 pointerWithin+rectIntersection
web/src/components/TreeDragGhost.tsx   # 新規: 共有 薄ghost(opacity-60)
web/src/notes/useNoteTreeDnd.ts        # TaskTree パターン化（below-folder=兄弟 / Rule 1 / 静止 / ghost）
web/src/notes/NotesView.tsx            # 視覚統一（グリップhover / indent / folder↔toggle hover / 共有衝突・ghost）
web/src/tasks/useTaskTreeDnd.ts        # 新規: Notes hook のミラー（TaskNode 用、collapsed Set 注入）
web/src/tasks/TaskTreeView.tsx         # 全面改修: Notes と同一 DnD ロジック + UI
web/src/index.css                      # --color-notion-accent-subtle トークン
```

## 設計（最終 = TaskTree 統一）

### A. DnD ロジック（Notes/Tasks 共通）

1. **衝突**: `pointerWithin` →（隙間時）`rectIntersection` fallback（共有 `treeCollisionDetection`）
2. **ゾーン**（共有 `computeNoteDropIntent`）: フォルダ above<0.2 / inside 0.2–0.8 / below>0.8、非フォルダ 0.5。**`below` フォルダ = `moveNode below` = 兄弟として後ろ**（expanded 特殊ケース無し）
3. **inside** = `moveNodeInto`（末尾追加）
4. **Rule 1**: 展開フォルダをグリップで掴んだ瞬間に折り畳む（1ブロック化）。cancel で復元、drop 後は畳んだまま
5. **静止リスト**: `useSortable` の transform/transition を**適用しない**（reflow 無し）
6. **薄い DragOverlay ghost**（opacity-60）がカーソル追尾。行ブロックは動かさない
7. `MeasuringStrategy.Always`（Rule 1 collapse 後の rect ズレ対策）

### B. 視覚（Notes/Tasks 共通、TaskTree 参考）

- **グリップ**: 既定非表示 → 行 hover で表示（`group-hover:opacity-100`）
- **入れ子**: `TreeNodeIndent`（depth × `w-4` ガイド列 + 中央 `w-px` 縦線、最終子は elbow=半分高さ）
- **フォルダアイコン ↔ トグル hover 切替**: 既定 Folder アイコン → 行 hover で chevron（展開で ▾ / 折畳で ▸）。クリックで expand。タスクは status グリフ（トグル無し）
- **ドロップインジケータ**: above/below = 2px accent 線、inside = `border-notion-accent bg-notion-accent-subtle`

## Acceptance Criteria（機械検証可能）

- [x] `cd shared && npx tsc -b` exit 0
- [x] `cd shared && npx vitest run` 全 pass（235）
- [x] `cd web && npm run build` exit 0
- [x] `computeNoteDropIntent` は above/below/inside（sibling-below 撤去）
- [x] Notes/Tasks 双方が共有 `treeCollisionDetection` / `TreeNodeIndent` / `TreeDragGhost` を使用
- [x] below-folder = `moveNode below`（両ツリー、expanded 特殊ケース無し）
- [ ] 👀: 末尾フォルダの下に項目を兄弟として置ける / folder↔toggle hover / 両ツリー体感一致（ユーザー確認）

## DB Migration Notes

なし（frontend DnD + shared 純粋関数のみ。DDL 変更なし）。

## Steps（Gate 列付き）

| #   | Step                                                                        | Gate    |
| --- | --------------------------------------------------------------------------- | ------- |
| 1   | `computeNoteDropIntent` を above/below/inside に統一（sibling-below 撤去）  | 🤖 自律 |
| 2   | `useNoteTreeDnd` を TaskTree パターン化（below-folder=兄弟 / Rule1 / 静止） | 🤖 自律 |
| 3   | 共有 `TreeNodeIndent` / `treeCollision` / `TreeDragGhost` 新設              | 🤖 自律 |
| 4   | `NotesView` 視覚統一（グリップhover / indent / folder↔toggle hover）        | 🤖 自律 |
| 5   | `useTaskTreeDnd`（Tasks 用ミラー）+ `TaskTreeView` 全面改修                 | 🤖 自律 |
| 6   | shared tsc / vitest / web build 緑                                          | 🤖 自律 |
| 7   | session-verifier → commit → role-qa（別コンテキスト）→ PR                   | 🛑 人手 |
| 8   | 実機目視（末尾フォルダ下挿入 / hover アイコン / 両ツリー一致）              | 👀 目視 |

## References

- Desktop 参照: `frontend/src/hooks/useTaskTreeDnd.ts` / `frontend/src/components/Tasks/TaskTree/{TaskTreeNode,TaskNodeIndent}.tsx`
- 移動ロジック（無改変）: `shared/src/hooks/useNoteTreeMovement.ts` / `useTaskTreeMovement.ts`
- @dnd-kit 6.3.1

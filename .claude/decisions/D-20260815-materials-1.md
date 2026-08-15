---
id: D-20260815-materials-1
type: decision
status: answered
asked: 2026-08-15
answered: 2026-08-16
chat: materials-refine
answer: B
topics: [materials, todos, status, kanban, mcp]
refs: ["#873"]
supersedes: []
superseded-by: []
implemented-by: ["#873"]
promoted-to: null
---

# D-20260815-materials-1: #873 の Todo 2 値化は「表示だけ」か「保存値ごと」か

## 背景

`TodoStatus = NOT_STARTED | IN_PROGRESS | DONE`（`shared/src/types/todoTree.ts:17`）。IN_PROGRESS は 12 ファイルが参照し、Kanban は 3 ステータスで列を組む（`shared/src/components/Kanban/buildColumns.ts`）・MCP の Todo ハンドラも 3 値を受ける。

## 選択肢と裁定

- A: **表示だけ 2 値化**（Kanban と MCP を壊さない。リストと詳細はチェックボックス 1 つにして「未完 = NOT_STARTED または IN_PROGRESS / 完了 = DONE」で描き、チェックを外したときは NOT_STARTED を書く。既存の IN_PROGRESS データはそのまま残り、Kanban では今まで通り 3 列で見える）— 却下
- B: **保存値ごと 2 値化**（`TodoStatus` を 2 値へ縮め、既存の IN_PROGRESS を未完側へ寄せる。Kanban は 2 列になり、MCP の 3 値 API も破壊的変更。UI の一貫性は最も高い）— **採用**（2026-08-16 チャットで回答）

## 実装の着地（PR #926 = 2026-08-16 提出・merge 待ち）

- 型・保存値とも 2 値（`shared/src/types/todoTree.ts`）。列挙は `STATUS_ORDER` の 1 箇所が正で、Kanban 2 列も Mobile のフィルタチップ 2 個もそこから導出される
- **DDL なし**: `tasks_payload.status` の CHECK は 3 値のまま。レガシー行は読み出し時に畳む（`todoMapper.toStatus` / MCP の `toToolStatus`）。`toNodeType` がレガシー `"folder"` を畳むのと同じ形
- リスト行のコントロールは `TodoStatusCycleButton` → `TodoStatusCheckbox`（`role="checkbox"` + `aria-checked`）。3 値の巡回には対応する ARIA ロールが無く、押した結果を名乗れていなかった
- MCP は宣言どおり破壊的変更: ツール enum から `in_progress` を撤去し `toDbStatus` が弾く。briefing の 2 本目の open-todo クエリ（`status = IN_PROGRESS`）は撤去し、open todo の定義は carry-over のみになった

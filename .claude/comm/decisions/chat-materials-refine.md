# Decision Queue — chat-materials-refine

### D-20260815-materials-1: #873 の Todo 2 値化は「表示だけ」か「保存値ごと」か

- 背景: #873。`TodoStatus = NOT_STARTED | IN_PROGRESS | DONE`（`shared/src/types/todoTree.ts:17`）。IN_PROGRESS は 12 ファイルが参照し、Kanban は 3 ステータスで列を組む（`shared/src/components/Kanban/buildColumns.ts`）・MCP の Todo ハンドラも 3 値を受ける
- A: **表示だけ 2 値化**（推奨 — Kanban と MCP を壊さない。リストと詳細はチェックボックス 1 つにして「未完 = NOT_STARTED または IN_PROGRESS / 完了 = DONE」で描き、チェックを外したときは NOT_STARTED を書く。既存の IN_PROGRESS データはそのまま残り、Kanban では今まで通り 3 列で見える）
- B: **保存値ごと 2 値化**（`TodoStatus` を 2 値へ縮め、既存の IN_PROGRESS を未完側へ寄せる。Kanban は 2 列になり、MCP の 3 値 API も破壊的変更。UI の一貫性は最も高い）
- 放置時: #873 は保留し、他の materials Issue を先に片付ける（実装に入らない）
- 期限感: いつでも（他 6 件の Issue は本判断に依存しない）

### D-20260815-materials-2: #876 でモバイルの詳細ボトムシート（#471）を畳むか

- 背景: #876 は「モバイルの Note / Daily の一覧をサイドバーへ出し、メインは選択中の本文」。narrow のドロワー（`MobileDrawer` = ハンバーガーで開く「詳細」パネル）は wide の rightSidebar と同じ中身を出す作りなので、`NotesView.tsx` の `isWide && <RightSidebarPortal>` ゲートを外せば一覧はそのまま入る。問題はメイン側 — 現在 narrow の本文は 92% 高のボトムシート（#471・mobile-scope #7 で「Full 編集」として入れた面）で開く
- A: **ボトムシートを畳む**（推奨 — メインが本文になるのでシートは同じものの二重表示になる。デスクトップと同じ「一覧 → 選ぶ → メインで書く」1 本になり、#876 の文面どおり。#471 の判断を明示的に上書きすることになる）
- B: **ボトムシートを残す**（メインは本文、一覧行のタップはこれまで通りシート。同じ本文への入口が 2 つ並ぶ）
- 放置時: #876 は保留（他 6 件は着地済み or 別キュー）
- 期限感: いつでも。A なら Daily 側も同時に決まる（過去エントリ一覧をドロワーへ移し、DateStrip は本文側に残す想定）

（2026-08-12 昇格分 = D-20260812-materials-1 / D-20260812-materials-2 — `.claude/decisions/` 台帳へ。台帳化とキューからの除去は chat-main が代行した）

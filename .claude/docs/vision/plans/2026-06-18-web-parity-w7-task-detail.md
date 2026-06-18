---
Status: Draft
Created: 2026-06-18
Branch: claude/web-w7-task-detail-plan
Owner-chat: web-w6-master-detail
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ./2026-06-16-web-parity-w6-detail-panel.md
---

# Plan: Web/Mobile セクション内部深化 第2弾（W7・Tasks 詳細パネル / Master-Detail 採用）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の子計画書（W7）。
> W6 で**共有 `MasterDetail` プリミティブ**（広幅2カラム / 狭幅 `BottomSheet`）を新設し **Notes をパイロット**採用した。
> 本書はその**第2採用先＝Tasks** を扱う。Notes と違い Tasks は**選択状態を持たない**ため、
> 選択基盤の新設 + タスク詳細編集パネルが要点になる。Schedule カレンダー充実は W8 へ送る。

---

## Context

- **動機**: W6 で `MasterDetail` は導入済みだが採用先は Notes のみ。Tasks セクション（`web/src/tasks/TaskTreeView.tsx`）は依然**ツリー単一カラム**で、行に対する詳細編集面が無い（旧 Tauri TaskTree の TipTap detail pane は web 移植時に意図的に未移植 — `TaskTreeView.tsx` 冒頭コメント）。`TaskNode` は `title` / `status` / `content`（リッチテキスト）/ `priority` / `scheduledAt` / `workDurationMinutes` / `timeMemo` 等のリッチなフィールドを持つのに、UI からは tree 行の rename/status cycle しか触れない。
- **到達基準**: 広幅で tree↔detail が**同時に見えて行き来できる**（Notes と同じ操作感）。狭幅は detail をフルハイトのシートで出す。**ピクセル一致は求めない**（親書 Context 方針 2）。
- **制約**:
  - コスト $0 厳守（DDL なし・新規依存なし。既存 `MasterDetail` / `useMediaQuery` / `BottomSheet` / `RichTextEditor` で完結）。
  - 既存の不変式を維持: DataService 境界（§3.1/§6.4・`updateNode` 等はコールバック注入）、Provider ネスト順（§6.2）、section ルーティングは `useState`（§3.2・React Router 不使用）、新規 UI は `shared/src/components/` 集約（§6）、`notion-*` 厳守・主要 UI 背景に透明度禁止、i18n は props 注入（shared 内 `useTranslation()` 直呼び禁止）。
  - **選択状態はセクション（Tasks ドメイン）が保持**（シェルへリフトしない）。`MasterDetail` は無改変で再利用。
- **Non-goals**:
  - **Schedule カレンダー充実**（週/日ビュー・時間グリッド・イベント DnD）→ **W8**。
  - Tasks の DnD / status / CRUD ロジックの作り替え（W6 で Notes と統一済の `useTaskTreeDnd` 等には触れない）。
  - タスクの全フィールド編集 UI の網羅（priority / schedule / reminder / color / icon 等）。本書のパイロット detail は **title / status / content（リッチテキスト）+ 既存 TagPicker/LinkPanel** に絞る。残フィールドは W7+ の追補で段階追加。
  - リサイズ可能ペイン幅（W6 同様・固定幅 + 折りたたみで足りる）。
  - `frontend/`（FROZEN）/ `desktop/` / `mobile/` 包装の改変。Notes / Schedule / Daily / Work など**Tasks 以外のセクション**の改変。

---

## 中核設計：選択基盤の新設 + 共有 TaskDetailPanel + MasterDetail 再利用

Notes パイロット（W6）と同じ3点で構成する。差分は「**選択状態を新設する**」点のみ（Notes は既存だった）。

| 層 | W6 (Notes) | W7 (Tasks) |
| --- | --- | --- |
| 選択状態 | `NotesUnifiedProvider` に既存（`selectedNote` / `setSelectedNoteId`） | **新設** — `useTaskTreeAPI` + `TaskTreeContextValue` に `selectedTaskId` / `setSelectedTaskId` / `selectedTask` を追加（Notes と同形・CRUD 削除時に選択 id を null へ寄せる） |
| 詳細 UI | 既存 `RichTextEditor` をそのまま | **新設** `shared/src/components/TaskDetailPanel.tsx`（純粋表示・props 注入） |
| レイアウト | `MasterDetail`（W6 新設） | **同じ `MasterDetail` を再利用**（無改変） |

- **選択基盤（shared）**: `useTaskTreeAPI` 内に `useState<string | null>` を持ち、戻り値に `selectedTaskId` / `setSelectedTaskId` / `selectedTask`（`tasks.find(...) ?? null`）を追加。`TaskTreeContextValue` は `ReturnType<typeof useTaskTreeAPI>` なので型は自動波及。削除/移動で選択中ノードが消える場合は `setSelectedTaskId(null)`（Notes の `selectedNoteIdRef` パターンに倣う）。**DataService 非依存の純粋な選択状態**。
- **TaskDetailPanel（shared・純粋表示）**: props = `task`（選択中 `TaskNode`）/ `onUpdateTitle(id, title)` / `onCycleStatus(id)` / `onUpdateContent(id, content)` / ラベル群（i18n props 注入）/ 必要なら `children`（web 側で TagPicker/LinkPanel/RichTextEditor を slot 注入 — TipTap は web 依存なので shared に持ち込まない）。title 入力は Notes の `NoteTitleInput` と同じ **debounce-and-flush + `key={task.id}` remount-safe** を踏襲（共通化できるなら別 PR で。本書は重複実装可）。
- **TaskTreeView 組み替え（web）**: `MasterDetail` で `master`=既存ツリー（行クリックで `setSelectedTaskId`）/ `detail`=`TaskDetailPanel`（RichTextEditor / TagPicker / LinkPanel を slot）/ `detailOpen = selectedTask != null` / `onCloseDetail = () => setSelectedTaskId(null)`。空状態・ラベルは web の `TaskTreeView` が `t()` で解決し props 注入。`RichTextEditor` は Notes 同様 `key={selected.id}` で remount（`title` では keying しない）。
- **デザインシステム再利用**: `MasterDetail`（W6）/ `RichTextEditor`（既存 web）/ `TagPicker` / `LinkPanel`（既存 web）/ `cn`。新設は `TaskDetailPanel` + Tasks 選択基盤のみ。

---

## Scope (Touchable Paths)

```
shared/src/hooks/useTaskTreeAPI.ts            ← Tasks 選択基盤を追加（selectedTaskId / setSelectedTaskId / selectedTask）
shared/src/components/TaskDetailPanel.tsx     ← 新設（純粋表示の詳細パネル・props/slot 注入）
shared/src/components/index.ts                ← barrel export 追加
shared/tests/taskSelection.test.ts(x)         ← 新設（選択基盤: set→解決 / 削除で null 化）
shared/tests/taskDetailPanel.test.tsx         ← 新設（最小描画・title/status コールバック）
shared/src/i18n/locales/en.json               ← detail 空状態 / status / 閉じる 等
shared/src/i18n/locales/ja.json               ← 同上（両 catalog 同キー）
web/src/tasks/TaskTreeView.tsx                ← MasterDetail でレイアウト組み替え（パイロット）
.claude/docs/vision/plans/2026-06-18-web-parity-w7-task-detail.md
.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md  ← W7 参照を1行追記
```

スコープ外の変更が必要になったら、本計画書を更新してから着手する（更新せず広げない）。

**対象外（明示）**: `frontend/`（FROZEN・参照のみ）/ `desktop/` / `mobile/` / `web/src/notes/**`（W6 済）・`web/src/schedule/**`（W8）/ Tasks 以外のセクション / `MasterDetail.tsx`（W6・無改変）/ `AppShell.tsx`（W5・無改変）/ `supabase/`（DDL なし）/ Tasks の DnD・CRUD ロジック本体。

---

## Steps

| #   | Step                                                                                                  | Gate    | Acceptance                                                  |
| --- | ---------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| 1   | Tasks 選択基盤を `useTaskTreeAPI` に追加（`selectedTaskId` / `setSelectedTaskId` / `selectedTask`）   | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 2   | `TaskDetailPanel` 新設（純粋表示・props/slot 注入・`notion-*`）                                        | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 3   | barrel export 追加（`shared/src/components/index.ts`）                                                 | 🤖 自律 | `cd shared && npm run build` exit 0                          |
| 4   | i18n: detail 空状態 / status / 「閉じる」等を en/ja 両 catalog に追加                                   | 🤖 自律 | 両ファイル同キー存在・`npm run build` exit 0                |
| 5   | 最小 test（選択基盤: set→解決 / 削除で null 化・`TaskDetailPanel` 描画 + コールバック）                | 🤖 自律 | `cd shared && npm run test` 全 pass                         |
| 6   | `TaskTreeView` をパイロット採用（tree=master / `TaskDetailPanel`=detail。DnD/CRUD は無改変）           | 🤖 自律 | `cd web && npm run build` exit 0                             |
| 7   | レスポンシブ/操作感の目視（広幅3ペイン同時表示・狭幅シート開閉・タスク切替で content remount 維持）     | 👀 目視 | 主要動線を手で1周（広幅/狭幅とも）                          |
| 8   | Draft PR → レビュー → main merge                                                                      | 🛑 人手 | PR レビュー & merge ボタン                                  |

### Gate 凡例

- **🤖 自律** — Claude 完結。後追い検証（tsc / test）で品質担保。Stop hook で型崩壊検出。
- **👀 目視** — レイアウト/体感は Claude では検証不能。ユーザーが画面で確認。
- **🛑 人手** — PR merge はユーザー操作必須。

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd shared && npm run build`（tsc -b）exit 0
- [ ] `cd shared && npm run test`（vitest）全 pass（Tasks 選択基盤 + `TaskDetailPanel` の最小 test 含む）
- [ ] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [ ] `cd frontend && npm run build`（旧 Tauri 非破壊の担保・並立期間中）exit 0
- [ ] `shared/src/i18n/locales/en.json` と `ja.json` で新規コピーキーが**両方**に存在
- [ ] PR diff が ±500 行以内（選択基盤 + 新部品1 + パイロット1セクション。scope creep ガード）
- [ ] git diff が Scope 宣言パス内のみ（Stop hook が scope drift 警告を出さない）

---

## DB Migration Notes

- **なし**（DDL ゼロ。レイアウト + 既存フィールド編集のみ。`tasks` / `items_meta` をそのまま使用）。

---

## Risks / Known Issues 参照

- **選択状態の新設範囲**: Notes は `NotesUnifiedProvider` に選択を持つので、対称性のため Tasks も**共有 API（`useTaskTreeAPI`）側に持たせる**のが自然。ただし `TaskTreeContextValue = ReturnType<typeof useTaskTreeAPI>` のため、戻り値追加は型に自動波及する＝**戻り値 object に足すだけ**で済む（新規 Context 不要）。Provider ネスト順（§6.2）は不変。
- **content の remount 破壊**: Notes と同じく `RichTextEditor` は `key={selected.id}` で remount。title では keying しない（入力中の focus 喪失防止）。詳細スロットに同条件で差し込み、「タスク切替で content 入れ替わる / 入力中に消えない」を目視。
- **TipTap を shared に持ち込まない**: `RichTextEditor` は web 依存（TipTap）。`TaskDetailPanel` は **slot（children/render prop）でエディタを受け取る**純粋表示に留め、shared が web 専用依存を抱えないようにする（§6 デザインシステムは shared だが TipTap は host）。
- **MasterDetail 無改変の維持**: W7 は `MasterDetail` の props で完結するはず。もし不足（例: detail スクロール挙動）が出ても、まず web 側 slot で吸収し、`MasterDetail` 改変は最後の手段（W6 の他採用先＝将来の Schedule にも影響するため）。
- 着手前に `.claude/docs/known-issues/INDEX.md` を `task` / `detail` / `select` / `remount` で grep。

---

## References

- 親ロードマップ: `./2026-06-07-web-desktop-parity-roadmap.md`（W0〜W6・2層モデル・棚卸し）
- 直前: `./2026-06-16-web-parity-w6-detail-panel.md`（共有 `MasterDetail` の props / 不変式 — **W7 はこれを再利用**）
- 移行 SSOT: `../../../2026-05-04-cross-platform-migration.md`
- frontend 規約: `../../../rules/frontend.md`（Provider 順序 / Pattern A / `notion-*` / i18n）
- 設計原則: `../coding-principles.md`（部品共通 / 画面分岐の2層モデル）
- 参照実装（FROZEN・読むだけ）: `frontend/` の旧 TaskTree detail pane（TipTap）/ `web/src/notes/NotesView.tsx`（W6 パイロットの写経元）
- related skills: `lead-pipeline`（ティア判定）/ `role-pm → role-engineer → role-qa`（分解・実装・監査）/ `git-orchestrator`

---

## Worklog

- 2026-06-18（起草）: W6（`MasterDetail` + Notes パイロット）完了を受け、第2採用先を Tasks に確定。Notes と違い Tasks は選択状態を持たないため、`useTaskTreeAPI` への選択基盤追加（戻り値 object に3項目）が W7 固有の要点。詳細 UI は新設 `TaskDetailPanel`（純粋表示・TipTap は slot で host から注入）。`MasterDetail` は無改変で再利用。パイロット detail のスコープは title / status / content + 既存 TagPicker/LinkPanel に限定し、priority/schedule 等の全フィールドは W7+ 追補へ。DDL ゼロ・新規依存ゼロ（$0）。本書は計画のみ（実装は次セッション — 同名 prompt 参照）。

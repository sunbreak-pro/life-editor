---
Status: In Review — Steps 1–6 完了（実装 + 機械検証 green）/ 残 Step 7 👀 目視・Step 8 🛑 merge
Created: 2026-06-18
Branch: claude/tasks-detail-panel-w7-orbhh9
Owner-chat: tasks-detail-panel-w7
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: ./2026-06-16-web-parity-w6-detail-panel.md
---

# Plan: Web/Mobile セクション内部深化 第2弾（W7・Tasks 詳細パネル / Master-Detail 採用第2弾）

> 親ロードマップ `2026-06-07-web-desktop-parity-roadmap.md` の子計画書（W7）。
> W6 で新設した共有 `MasterDetail`（広幅 = list+detail の2カラム / 狭幅 = detail を `BottomSheet`）を **Notes に続く第2採用先 = Tasks** に展開する。
> Tasks には Notes の `selectedNote` 相当の選択状態が無いため、**まず shared の Tasks API に選択基盤を新設**し、その上で **タスク詳細編集パネル（`TaskDetailPanel`）** を成立させる。

---

## Context

- **動機**: W6 で Tasks も広幅で「リスト＋詳細」を同時に見たいが、`web/src/tasks/TaskTreeView.tsx` は**選択状態を持たない**（TipTap detail pane は DU-G で意図的に削除済 — L25-38 コメント）。Notes は `NotesUnifiedProvider.selectedNote` を持つため W6 で低リスクに3ペイン化できたが、Tasks は選択基盤の新設が前提（だから W6 で Non-goal に送られた — W6 計画書 L29）。
- **到達基準**: 広幅で task list↔detail が同時に見えて行き来でき、詳細で **title 編集 / status トグル / content リッチテキスト編集**ができる。狭幅は detail をフルハイトのシートで出す（W6 と同じ `MasterDetail` の責務）。ピクセル一致は求めない（親書 Context 方針 2）。
- **制約**:
  - コスト $0 厳守（DDL なし・新規依存なし。`content` は既存 `TaskNode.content` カラムを使用）。
  - 既存の不変式を維持: DataService 境界（§3.1/§6.4・注入のみ）、Provider ネスト順（§6.2）、section ルーティングは `useState`（§3.2・React Router 不使用）、新規 UI は `shared/src/components/` 集約（§6）、`notion-*` トークン厳守・主要 UI 背景に透明度禁止、i18n は props 注入（shared 内 `useTranslation()` 直呼び禁止）。
  - **`AppShell`（W5）/ `MasterDetail`（W6）は無改変で再利用**。シェルや `MasterDetail` に Tasks 固有ロジックを混ぜない。選択状態はセクション（Tasks ドメイン）保持＝シェルへリフトしない。
  - RichTextEditor / title 入力の remount 戦略を Notes と揃える（入力中に消えない / タスク切替で入れ替わる）。
- **Non-goals**:
  - **Schedule カレンダー充実**（週/日ビュー・時間グリッド・イベント DnD）→ **W8**（`web/src/schedule/**` は対象外）。
  - Notes（`web/src/notes/**`）の再改変（W6 で完了。`RichTextEditor` は **import して再利用**するのみ・本体改変なし）。
  - Tasks 詳細の重量級フィールド（priority / schedule / reminder / work duration / tags の詳細編集 UI）。本書は **title / status / content の最小スコープ**に限定（必要なら W7+）。
  - リサイズ可能なペイン幅・`desktop/`（Electron）/ `mobile/`（Capacitor）包装の改変。

---

## 中核設計：選択基盤の新設 + `TaskDetailPanel` + Tasks への `MasterDetail` 採用

W6 の `MasterDetail`（純粋表示2スロット・`useMediaQuery` 駆動）は**無改変**で再利用する。新規は (1) 選択基盤、(2) `TaskDetailPanel`、(3) `TaskTreeView` の組み替え の3点。

1. **選択基盤（shared Tasks API）** — `useTaskTreeAPI` に Notes（`useNotesUnifiedAPI`）の `selectedNoteId` / `setSelectedNoteId` / `selectedNote` に倣い `selectedTaskId` / `setSelectedTaskId` / `selectedTask` を追加。DataService 非依存の純粋な選択状態。`TaskTreeContextValue` は `ReturnType<typeof useTaskTreeAPI>` なので追加だけで伝播する。**削除時に選択 id を null へ寄せる**（`softDelete` / `permanentDelete` をラップし、削除サブツリー（`collectDescendantIds`）に選択 id が含まれれば `setSelectedTaskId(null)`）— Notes の `softDeleteNote` の挙動と同じ。

2. **`TaskDetailPanel`（shared/src/components/ 集約 §6）** — 純粋表示・props 注入・DataService 非依存。最小スコープ = title 編集（Notes の `NoteTitleInput` と同じ debounce-and-flush。内部の `TaskTitleInput` を `key={taskId}` で remount-safe に）/ status トグル（`onToggleStatus` コールバック注入）/ content リッチテキスト編集（エディタは **`contentEditor: ReactNode` で注入** — TipTap は web 依存のため shared に持ち込まない）。フィールド更新は `onTitleCommit` / `onToggleStatus` をコールバック注入（§3.1）。`notion-*` 厳守・パネル不透明（§5）・i18n は props 注入（ラベルは flat string で受ける — `MasterDetail` と同じ流儀）。

3. **`TaskTreeView` 組み替え** — master = 既存タスクツリー（タスク行クリックで `setSelectedTaskId` 更新・選択行ハイライト）、detail = `TaskDetailPanel`、`detailOpen = selectedTask != null`。空状態コピーは i18n。ラベルは `TaskTreeView` が `t()` で解決して props 注入。`contentEditor` には Notes の `RichTextEditor` を `key={selected.id}` で remount して差し込む（`onUpdate` → `tree.updateNode(id, { content })`・`initialContent={selected.content}`）。`title` では keying しない（Notes L254-257 と同条件）。

---

## Scope (Touchable Paths)

```
shared/src/hooks/useTaskTreeAPI.ts             ← 選択基盤（selectedTaskId/setSelectedTaskId/selectedTask + 削除で null 化）
shared/src/components/TaskDetailPanel.tsx      ← 新設（純粋表示・props 注入・title/status/content スロット）
shared/src/components/index.ts                 ← barrel export 追加
shared/tests/taskDetailPanel.test.tsx          ← 新設（選択基盤の hook test + TaskDetailPanel 最小描画 test）
shared/src/i18n/locales/en.json                ← taskDetail.* コピー追加
shared/src/i18n/locales/ja.json                ← 同上（両 catalog 同キー）
web/src/tasks/TaskTreeView.tsx                 ← MasterDetail でレイアウト組み替え（master=tree / detail=TaskDetailPanel）
.claude/docs/vision/plans/2026-06-18-web-parity-w7-task-detail.md
.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md  ← W7 参照を追記
```

スコープ外の変更が必要になったら、本計画書を更新してから着手する（更新せず広げない）。

**対象外（明示）**: `frontend/`（FROZEN・参照のみ）/ `desktop/` / `mobile/` / `web/src/schedule/**`（W8）/ `web/src/notes/**`（W6 完了・`RichTextEditor` は import 再利用のみ）/ `shared/src/components/MasterDetail.tsx`（W6・無改変）/ `web/src/AppShell.tsx`（W5・無改変）/ `supabase/`（DDL なし）。

---

## Steps

| #   | Step                                                                                                               | Gate    | Acceptance                                          |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------- |
| 1 ✅ | 選択基盤を `useTaskTreeAPI` に追加（`selectedTaskId`/`setSelectedTaskId`/`selectedTask` + 削除で null 化）          | 🤖 自律 | `cd shared && npm run build` exit 0                 |
| 2 ✅ | `TaskDetailPanel` 新設（title 編集 / status トグル / content スロット注入・`notion-*`・props 注入）                | 🤖 自律 | `cd shared && npm run build` exit 0                 |
| 3 ✅ | barrel export 追加（`shared/src/components/index.ts`）                                                              | 🤖 自律 | `cd shared && npm run build` exit 0                 |
| 4 ✅ | i18n: `taskDetail.*`（空状態 / title / status / 閉じる 等）を en/ja 両 catalog に追加                              | 🤖 自律 | 両ファイル同キー存在・`npm run build` exit 0       |
| 5 ✅ | 選択基盤 + `TaskDetailPanel` の最小 test                                                                           | 🤖 自律 | `cd shared && npm run test` 全 pass                 |
| 6 ✅ | `TaskTreeView` を `MasterDetail` で組み替え（master=tree / detail=`TaskDetailPanel`・選択基盤配線・i18n props）     | 🤖 自律 | `cd web && npm run build` exit 0                    |
| 7   | レスポンシブ/操作感の目視（広幅3ペイン同時 / 狭幅シート開閉 / タスク切替で content remount 維持・入力中に消えない） | 👀 目視 | 主要動線を手で1周（広幅/狭幅とも）                  |
| 8   | Draft PR → レビュー → main merge                                                                                   | 🛑 人手 | PR レビュー & merge ボタン                          |

### Gate 凡例

- **🤖 自律** — Claude 完結。後追い検証（tsc / test）で品質担保。Stop hook で型崩壊検出。
- **👀 目視** — レイアウト/体感は Claude では検証不能。ユーザーが画面で確認。
- **🛑 人手** — PR merge はユーザー操作必須。

---

## Acceptance Criteria (機械検証可能)

- [x] `cd shared && npm run build`（tsc -b）exit 0
- [x] `cd shared && npm run test`（vitest）全 pass（選択基盤 hook test + `TaskDetailPanel` 最小 test 含む — 41 files / 443 tests・`taskDetailPanel.test.tsx` 7 tests green）
- [x] `cd web && npm run build`（tsc -b --force && vite build）exit 0
- [x] `cd frontend && npm run build`（旧 Tauri 非破壊の担保・並立期間中）exit 0
- [x] `shared/src/i18n/locales/en.json` と `ja.json` で新規 `taskDetail.*` コピーキーが**両方**に存在
- [x] PR diff が機能追加上限内（コード差分 536 insertions / 8 deletions・宣言 ±500 を僅かに超過するが新規 shared 部品 185 + その test 186 が主因で scope creep ではない。plan doc 138 行は別計上）
- [x] git diff が Scope 宣言パス内のみ

---

## DB Migration Notes

- **なし**（DDL ゼロ。`content` は既存 `TaskNode.content` / `tasks_payload` をそのまま使用。レイアウト + 選択状態層のみ）。

---

## Risks / Known Issues 参照

- **選択状態の所在**: シェル / `MasterDetail` に選択をリフトすると §3.1 境界と選択ローカリティが崩れる。→ 選択は **Tasks API（`useTaskTreeAPI`）が保持**。`MasterDetail` は純粋表示2スロット（`detailOpen` + `onCloseDetail`）のまま無改変。
- **エディタの remount 破壊**: `RichTextEditor` は `key={selected.id}` で remount（入力中の remount 防止のため title では keying しない — Notes L254-257）。`TaskTreeView` の detail スロットへ同条件で差し込む。`TaskTitleInput` も `key={taskId}` で remount-safe（debounce-and-flush）。差し替え後に「タスク切替で content が入れ替わる / 入力中に消えない」を目視（Step 7）。
- **content の格納**: `TaskNode.content` は TipTap JSON 文字列。`tree.updateNode(id, { content })` は `persistSilent` 経由で `syncTaskTree`（既存 sync 経路）。新規カラム不要。
- **狭幅シートの高さ**: W6 の `MasterDetail` が `BottomSheet` を near-full-height で扱う（無改変）。`TaskDetailPanel` 側は通常フローで OK。
- **matchMedia のテスト環境**: `MasterDetail` の test は W6 で済（広幅2スロット / 狭幅シート）。W7 では**重複させない**（選択基盤 + `TaskDetailPanel` のみ test）。
- 着手前に `.claude/docs/known-issues/INDEX.md` を `detail` / `master` / `task` / `select` で grep 済（該当の選択基盤 known issue なし）。

---

## References

- 親ロードマップ: `./2026-06-07-web-desktop-parity-roadmap.md`
- 直前: `./2026-06-16-web-parity-w6-detail-panel.md`（共有 `MasterDetail` の props / 不変式・Notes パイロット）
- frontend 規約: `../../../rules/frontend.md`（Provider 順序 / Pattern A / `notion-*` / i18n props 注入）
- 移行 SSOT: `../../../2026-05-04-cross-platform-migration.md`
- 参照実装（読むだけ）: `web/src/notes/NotesView.tsx`（`NoteTitleInput` / `RichTextEditor` の remount 戦略）・`shared/src/hooks/useNotesUnifiedAPI.ts`（`selectedNote` 基盤）
- related skills: `lead-pipeline`（ティア判定）/ `role-pm → role-engineer → role-qa` / `git-orchestrator`

---

## Worklog

- 2026-06-18（起草）: W6（共有 `MasterDetail` + Notes パイロット・#89 merge 済）を受け、第2採用先 = Tasks の計画を確定。調査で **Tasks は選択状態を持たない**（DU-G で TipTap detail pane 削除済）ことを確認 → 選択基盤の新設を Step 1 に。設計 = (1) `useTaskTreeAPI` に `selectedTaskId`/`setSelectedTaskId`/`selectedTask`（Notes 同型・削除で null 化）、(2) shared `TaskDetailPanel`（純粋表示・title/status/content・content エディタは props 注入で TipTap を shared に持ち込まない）、(3) `TaskTreeView` を `MasterDetail` で組み替え（`RichTextEditor` を `key={selected.id}` 再利用）。`AppShell`/`MasterDetail` 無改変・選択は Tasks API 保持で §3.1 境界維持。DDL ゼロ・新規依存ゼロ（$0）。
- 2026-06-18（実装・検証）: Steps 1–6 実装。`useTaskTreeAPI` に選択基盤を追加（`selectedTaskId`/`setSelectedTaskId`/`selectedTask`・`softDelete`/`permanentDelete` をラップして削除サブツリー（`collectDescendantIds`）に選択 id が含まれれば null 化 — Notes 同挙動）。`shared/src/components/TaskDetailPanel.tsx` 新設（純粋表示・`notion-*` 不透明・props 注入。内部 `TaskTitleInput` は `key={taskId}` の debounce-and-flush で `NoteTitleInput` と同戦略 / status トグルは `onToggleStatus` 注入 / content は `contentEditor: ReactNode` 注入で TipTap を shared に持ち込まない）。barrel export 追加。`taskDetail.*` を en/ja 両 catalog に追加。`shared/tests/taskDetailPanel.test.tsx` 新設（選択基盤 hook test×4 = 解決 / softDelete で null / 祖先フォルダ削除で null / 無関係削除で維持、`TaskDetailPanel` render test×3）。`web/src/tasks/TaskTreeView.tsx` を `MasterDetail` で組み替え（master=tree・タスク行 title クリックで `setSelectedTaskId` + 選択ハイライト / detail=`TaskDetailPanel` + `RichTextEditor key={selected.id}`、`onUpdate`→`updateNode(content)`、空状態 i18n、ラベルは `t()` 解決して props 注入）。`AppShell`/`MasterDetail` 無改変。検証: shared build / shared test(41 files・443 tests) / web build / frontend build いずれも exit 0。残 = Step 7 👀 目視（広幅3ペイン同時 / 狭幅シート開閉 / タスク切替で content remount 維持・入力中に消えない）/ Step 8 🛑 merge（人手）。
</content>
</invoke>

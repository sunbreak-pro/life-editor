---
Status: ARCHIVED — PR1 COMPLETE（①②③④ 実装=02c9045 / role-qa 独立監査 PASS=2026-05-17）+ forward-port #1#2#3 適用済。PR2 以降は Backlog 参照
Archived: 2026-05-23 (by cleanup-and-consolidation Phase 1-1)
Created: 2026-05-17
Task: Phase 2 S3 Notes — 実ブラウザ評価で判明したバグ修正 + 旧来 UI/UX 段階的収束
Project path: /Users/newlife/dev/apps/life-editor
Branch: refactor/web-first-v2
Parent: .claude/docs/vision/plans/2026-05-16-phase2-core-migration.md（S3 の継続）
SSOT: .claude/2026-05-04-cross-platform-migration.md（Phase 2）
---

# Plan: Notes Web 版 旧来パリティ（バグ修正優先・UX 段階的）

## Context

Phase 2 S3 Notes（lean web 版）の実ブラウザ評価で 7 件の問題が判明。ユーザー方針＝
**「バグ修正優先、UX は段階的」**。旧来 = Tauri 版 `frontend/`（不可侵・読み取り参照のみ）。

旧来リファレンス（Explore 調査済、file:line 根拠）:

- ツリーノード: `frontend/src/components/Ideas/NoteTreeNode.tsx`
- インライン rename: `frontend/src/components/shared/EditableTitle.tsx`（controlled + autoFocus + checkComposing + onBlur 確定）
- パスワードゲート: `frontend/src/components/Ideas/NotesView.tsx` L321-387（blur overlay + click-to-unlock）+ `frontend/src/context/ScreenLockContext.tsx`（per-note `unlockedIds: Set`、再ロック無し）
- Trash: `frontend/src/components/Trash/TrashView.tsx`（mount 時 `loadDeletedNotes()`）
- drop indicator: `NoteTreeNode.tsx` L140-145,262-268（`h-0.5 bg-notion-accent` バー + folder-inside `ring-2 ring-notion-accent`）

## 根本原因（確定診断）

| #   | 症状                                                    | 根本原因                                                                                                                                                                                                             | 修正層                                    |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| ①   | ノート名をゆっくり打つとフォーカス喪失（Folder は正常） | `NotesView.tsx:448` `key={`${selected.id}:${selected.title}`}`。300ms デバウンス保存→`selected.title` 変化→key 変化→`NoteTitleInput` remount→フォーカス喪失。Folder は inline input 無し（prompt 方式）で無症状      | web UI                                    |
| ②   | 削除後 Trash が表示されない                             | `useNotesAPI.ts:486` `loadDeletedNotes()` がどこからも呼ばれず `deletedNotes` 常に `[]`。`NotesView.tsx:404` の `length > 0` で `<details>` 非描画。softDelete 後もローカル未反映                                    | shared hook                               |
| ③   | パスワード設定しても閲覧ゲートが無く無意味              | unlock 状態管理が存在しない。`verifyNotePassword` の結果が UI に反映されず、`RichTextEditor` は常に full 描画（`NotesView.tsx:520-526`）。blur/overlay 無し                                                          | web UI（必要なら shared に unlock state） |
| ④   | Folder 削除手段が無い                                   | フォルダクリックは `onToggleExpand` のみ（`NotesView.tsx:149-151`）→フォルダは `selectedNote` にならない→右ペイン Delete に到達不能。行レベル削除 UI も無し。`softDeleteNote` は id 非依存で動くが子カスケード要確認 | web UI（+ DataService カスケード調査）    |

## PR1 スコープ（今回・バグ修正優先）

- [x] **①タイトルフォーカス**: `NoteTitleInput` の key を `key={selected.id}` のみに変更（title を除去）。外部 rename での再シードは単一ユーザー前提で不要。デバウンス保存・onBlur flush・unmount flush の挙動は維持。→ 実装 02c9045 / QA PASS
- [x] **②Trash 表示**: `useNotesAPI` の初回ロード effect（`syncVersion` 依存）で `fetchDeletedNotes()` も実行（独立 try/catch でツリー非ブロック）。`softDeleteNote` 成功時に subtree を `deletedNotes` へローカル prepend（restore/permanentDelete はローカル整合済）。→ 実装 02c9045 / QA PASS
- [x] **③パスワードゲート**: NotesView にセッション unlock 集合（`Set<string>`、再ロック無し＝旧来踏襲）。`selected.hasPassword && !unlocked.has(id)` の時 `RichTextEditor` を blur + `pointer-events-none select-none` + クリックで verify→成功で unlock 集合追加→解除。タイトル/操作バーは表示維持（本文のみ blur）。→ 実装 02c9045 / QA PASS
- [x] **④Folder 削除**: ホバー Trash2 ボタンを `NoteRow` に追加（note/folder 両方）。子カスケードは hook 層（`useNotesAPI.softDeleteNote` post-order DFS + 循環 `seen` ガード）で担保＝孤児化防止。データ層 `ds.softDeleteNote` は単一行 flip のまま据え置き。restore は単一ノードのみ＝子孫 Trash 残存は**既知制約**（Backlog ⑧、コード/計画書に明文化済）。→ 実装 02c9045 / QA PASS（最重点検証クリア）

完了時: session-verifier → role-qa（別コンテキスト）→ task-tracker（パス指定 commit）→ git-orchestrator。

## Backlog（PR2 以降・UX 段階的収束、ユーザー「覚えておく」分含む）

- [ ] **⑤旧来ツリー UX 収束**: 行内ホバーアクション一式（grip / chevron / inline rename = `EditableTitle` 相当 / delete）。`window.prompt` rename を inline 編集へ。フォルダも選択/アクション可能に。`NoteTreeNode` 相当の行レイアウトへリファクタ（規模大）
- [ ] **⑥DnD 視覚フィードバック**: drop indicator バー（above/below `h-0.5 bg-notion-accent`）+ folder-inside `ring-2 ring-notion-accent bg-notion-accent/5`。`useNoteTreeDnd` に overInfo を公開し `NoteRow` で描画（旧来 `NoteTreeNode.tsx` L140-145,262-268）
- [ ] **⑦chevron↔名前 間隔**: 行の gap / インデント微調整（旧来 `depth*16+4px` + `gap-0.5` 基準に合わせる）。`NotesView.tsx:101` `depth*18+8` と `gap-2`/`gap-1.5` を再設計
- [ ] **⑧subtree restore**: PR1 で folder softDelete は subtree 一括だが restore は単一ノードのみ（子孫が Trash 残存）。folder restore 時に子孫も再帰復元する。`useNotesAPI.ts restoreNote` を subtree 対応へ（PR1 で既知制約としてコード/計画書に明文化済）
- [ ] **追加改善（随時追記）**: 実ブラウザ評価で出る他の改善点をここに蓄積。太字等リッチテキストの操作 affordance（ツールバー or ショートカット周知）、search dropdown、wiki/note links UI（backlink パネル＝データ層は実装済・UI 未配線）、sort UI

## Files（PR1）

| File                                                            | Operation        | Notes                                                           |
| --------------------------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| `web/src/notes/NotesView.tsx`                                   | Edit             | ①key 修正 ③unlock state + blur overlay ④行削除ボタン            |
| `shared/src/hooks/useNotesAPI.ts`                               | Edit             | ②初回 effect で loadDeletedNotes + softDelete ローカル push     |
| `shared/src/context/NoteContextValue.ts` / `NoteContext.tsx`    | 確認             | interface 露出に変更不要か確認（loadDeletedNotes は既に公開済） |
| `shared/src/services/SupabaseDataService.ts`                    | 調査/必要時 Edit | ④フォルダ子カスケード soft-delete の有無確認                    |
| `.claude/docs/vision/plans/2026-05-16-phase2-core-migration.md` | Edit             | S3 注記に本 PR を追補（完了時）                                 |

## Verification（PR1）

- [x] ①ノート名を1文字ずつ間を空けて入力してもフォーカスが維持される。ノート切替で draft が正しく再シード（QA PASS）
- [x] ②ノート/フォルダ削除直後に Trash セクションが出現、件数増加。リロード後も Trash に残る。restore/完全削除が機能（QA PASS）
- [x] ③パスワード付きノートを開くと本文が blur + クリックで unlock、正解で本文表示・誤りで弾く。別ノート往復で再 blur されない（セッション unlock 保持）（QA PASS）
- [x] ④フォルダ行のホバーで削除ボタン、削除で folder + 全子孫が一括 Trash 入り（孤児化無し）。folder restore は単一ノードのみ＝子孫 Trash 残存は既知制約（コード+Backlog ⑧ に明文化済）（QA PASS・最重点）
- [x] web `tsc -b` / `eslint` green、`frontend/` 非破壊（git diff 0 行で確認）

## forward-port（chat-refactor handoff、PR1 と同時収束）

実ブラウザ評価とは別に、frontend リファクタ修正の shared/ 未反映 5 件のうち #1#2#3 を本フェーズで適用（#4#5 は MEMORY 予定へ切出し）。

- [x] **FP#1 Critical**: `shared/src/utils/getDescendantTasks.ts` visited ガード（KI-016 OOM 再発防止）。`d62a2dc` の 3 hunk をそのまま適用、QA で適用元とバイト一致確認
- [x] **FP#2 High**: `shared/src/types/wikiTag.ts` `entityType` の `"memo"` 除去 + `WikiTagEntityType` 参照化
- [x] **FP#3 Mid**: `shared/src/hooks/createContextHook.ts` `if (!value)` → `if (value == null)`（null 安全化）
- [ ] FP#4 #5（型集約 Low・挙動不変）は今回スコープ外 → MEMORY.md 予定 / 別フェーズ

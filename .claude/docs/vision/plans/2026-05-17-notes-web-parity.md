---
Status: IN PROGRESS — PR1（バグ修正①②③④）着手。PR2 以降は Backlog 参照
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

- [ ] **①タイトルフォーカス**: `NoteTitleInput` の key を `key={selected.id}` のみに変更（title を除去）。外部 rename での再シードは単一ユーザー前提で不要。デバウンス保存・onBlur flush・unmount flush の挙動は維持
- [ ] **②Trash 表示**: `useNotesAPI` の初回ロード effect（`ds.fetchAllNotes` と同じ effect / `syncVersion` 依存）で `loadDeletedNotes()` も実行。`softDeleteNote` 成功時に対象を `deletedNotes` へローカル push（restore/permanentDelete は既にローカル整合済）
- [ ] **③パスワードゲート**: NotesView にセッション unlock 集合（`Set<string>`、再ロック無し＝旧来踏襲）。`selected.hasPassword && !unlocked.has(id)` の時 `RichTextEditor` を blur + `pointer-events-none select-none` + クリックで verify ダイアログ→成功で unlock 集合追加→解除。タイトル/操作バーは表示維持（旧来 L321-387 準拠、blur 対象は本文のみ）
- [ ] **④Folder 削除**: 行レベル削除アクション（ホバー表示 Trash2 ボタン）を `NoteRow` に追加（note/folder 両方）。フォルダ削除時の子ノードの扱い＝ `SupabaseDataService.softDeleteNote` / `useNoteTreeMovement` の挙動を調査し、子が orphan 化するなら再帰 soft-delete をデータ層 or hook で担保（孤児防止）。確証が取れない場合は role-qa で要検証項目に明示

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

- [ ] ①ノート名を1文字ずつ間を空けて入力してもフォーカスが維持される。ノート切替で draft が正しく再シード
- [ ] ②ノート/フォルダ削除直後に Trash セクションが出現、件数増加。リロード後も Trash に残る。restore/完全削除が機能
- [ ] ③パスワード付きノートを開くと本文が blur + クリックで unlock ダイアログ、正解で本文表示・誤りで弾く。別ノート往復で再 blur されない（セッション unlock 保持）
- [ ] ④フォルダ行のホバーで削除ボタン、削除で folder + 全子孫が一括 Trash 入り（子孫の孤児化無し＝旧来比改善）。folder restore は単一ノードのみ＝子孫 Trash 残存は既知制約（コード+Backlog ⑧ に明文化済）
- [ ] web `tsc -b` / `eslint` / `vite build` green、`frontend/` 非破壊

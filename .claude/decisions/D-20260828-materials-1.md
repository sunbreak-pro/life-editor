---
id: D-20260828-materials-1
type: decision
status: answered
asked: 2026-08-28
answered: 2026-08-28
chat: chat-materials-refine
answer: A
topics: [materials, notes, empty-state, mru, localStorage]
refs: ["#1149", "shared/src/state/materialsSelectionStore.ts", "web/src/notes/NotesView.tsx"]
supersedes: []
superseded-by: []
implemented-by: ["#1165"]
promoted-to: null
---

# D-20260828-materials-1: Materials 空状態の「最近開いたアイテム」候補は何を元に選ぶか

## 背景

（#1149 本文の「要判断」節から。同 Issue はキューへの起票と回答待ちを指示していたが、回答が同期で得られたためキューを経由せず直接昇格した。）

Desktop で Materials を最初に開いたときの初期状態が、画面中央に追加ボタンと一文（ja「ノートを選ぶか、新しく作成してください」）だけになっている。**選べと言っておいて、選ぶ対象を 1 つも出していない**。ここに最近開いたアイテムを候補として残したい。

「最近開いた」を持つ入れ物が今は無い。`shared/src/state/materialsSelectionStore.ts` は直近 1 件だけ・メモリのみ（#282）で、ファイル冒頭が "It intentionally resets on app restart" と明記しているとおりアプリを開き直すと消える。要望が指しているのはまさに「最初に開いたとき」なので、この store をそのまま使うと候補が常に空になる。

## 選択肢と裁定

- **A: 開いた履歴（MRU）を新設**（**採用** — ユーザー回答 2026-08-28）。`materialsSelectionStore` の隣に「直近 N 件の id を localStorage に持つ」層を足し、選択経路が積む。要望の「最近**開いた**」に文字どおり一致する。キー名は `life-editor` 接頭辞つき（D-20260812-materials-1）。ソフトデリート済み / 存在しない id は表示時に落とす
- B: 新しい状態を持たず、既存の `updatedAt` 降順の先頭 N 件を出す（却下 — 実装は軽いが「最近**編集**した」であって「開いた」ではない。読んだだけのノートが候補に出てこないが、それこそ再提示する価値のあるもの）

## 波及

- 新設 `shared/src/state/recentNotesStore.ts`（localStorage・キー `life-editor:recent-notes`・上限 5 件）+ `shared/src/hooks/useRecentNotes.ts`
- `useNotesUnifiedAPI` / `useNotesUnifiedCRUD` の既存 `setNotesSelection(id)` 4 か所に記録を併置
- `materialsSelectionStore` 自体は**無変更**（session-scoped の設計はそのまま正しい）

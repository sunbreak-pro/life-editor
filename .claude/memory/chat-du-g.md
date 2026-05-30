# MEMORY (chat-du-g)

## 進行中

### 🔧 Notes Folder DnD UX 改善（着手日: 2026-05-30）

**対象**: `web/src/notes/NotesView.tsx` / `web/src/notes/useNoteTreeDnd.ts` / `shared/src/hooks/useNoteTreeMovement.ts`（純粋判定関数の新設先候補 shared）
**計画書**: （未作成 — 実装前に計画化予定）

- 前回: —
- 現在: 根本原因分析完了。① `overInfo` 計算済だが NotesView が未描画 = ドロップ視覚フィードバックゼロ / ② `collisionDetection=closestCenter` が pointer-Y ゾーン判定と座標不一致 / ③ inside ゾーンが中央 50% のみで的が狭い（折りたたみフォルダで顕著）。data 層（`moveNodeInto`）は健全
- 次: `pointerWithin` 衝突判定 + inside ゾーン拡大 + 純粋関数 `computeNoteDropIntent` を shared に抽出して unit test + `NoteRow` に薄青ハイライト（inside）/ 挿入線（above/below）。G4 commit + 単独 PR 後に別 commit/PR

## 直近の完了

- DU-G G4（legacy Notes/Daily 死削除・A-2 Bridge dispatch 撤去）✅（2026-05-30、未 merge / PR 作成予定）

## 予定

- Notes DnD UX を別 commit/PR 化（G4 PR の後段）
- 👀 ユーザー実機確認: Notes Folder への DnD 挿入の改善体感（薄青ハイライト + 緩和判定）

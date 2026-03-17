# Plan: Task Tracker — Paper/Point Canvas 6 UI/UX Improvements 完了記録

**Status**: PLANNED

## Context

Paper/Point Canvas の 6 件の UI/UX 改善が実装完了（TypeScript ビルド通過済み）。
作業終了フローとして MEMORY.md / HISTORY.md を更新し、コミット＋プッシュする。

## Steps

### [ ] 1. MEMORY.md 更新

- 「直近の完了」先頭に `- Paper/Point Canvas — 6 UI/UX Improvements ✅（2026-03-17）` 追加
- 3件超過分を削除（4件目 = TipTap TaskList extension を削除）

### [ ] 2. HISTORY.md 先頭追記

```markdown
### 2026-03-17 - Paper/Point Canvas — 6 UI/UX Improvements

#### 概要

Paper view と Point view の ReactFlow キャンバスに対する 6 件の UI/UX 改善。CanvasControls 共有化、Scan アイコン統一、UnifiedColorPicker 導入、Frame resize handle 拡大、Frame 脱出ロジック、TipTap JSON プレビュー対応。

#### 変更点

- **CanvasControls 共有コンポーネント**: `CanvasControls.tsx` を新規作成。TagGraphView と PaperCanvasView の両方で使用。fitView アイコンを Maximize2 → Scan に統一
- **Frame UnifiedColorPicker**: PaperFrameNode のインラインカラーパレットを UnifiedColorPicker（HexColorPicker + プリセット）に置換
- **Frame resize handle**: CSS `::before` 疑似要素で 24px グラブ領域を追加
- **Frame 脱出ロジック**: `extent: "parent"` 制約を削除し、handleNodeDragStop で 50px 超過時に parentNodeId を null に更新
- **TipTap JSON プレビュー**: `tiptapText.ts` の `getContentPreview` に HTML フォールバック追加。PaperCanvasView の `stripHtml` と TagGraphView の `extractContentPreview` を統一
```

### [ ] 3. コミット + プッシュ

- `git add` で全変更をステージ
- コミットメッセージ: `feat: Paper/Point Canvas — 6 UI/UX improvements`
- `git push`

## Files

| File                 | Operation |
| -------------------- | --------- |
| `.claude/MEMORY.md`  | 更新      |
| `.claude/HISTORY.md` | 先頭追記  |
